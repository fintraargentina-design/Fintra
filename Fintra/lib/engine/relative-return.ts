export type RelativeReturnWindow = '1Y' | '3Y' | '5Y';

export interface RelativeReturnWindowData {
  asset_return: number | null; // Realized total return over window, in percent
  benchmark_return: number | null; // Same window, same methodology
  asset_max_drawdown?: number | null; // Max drawdown over window, positive percent (e.g. 35 for -35%)
  benchmark_max_drawdown?: number | null; // Same convention as asset
}

export type RelativeReturnTimeline = {
  [K in RelativeReturnWindow]: RelativeReturnWindowData | null;
};

export type RelativeReturnBand = 'underperformer' | 'neutral' | 'outperformer';

export interface RelativeReturnComponents {
  window_alpha: {
    [K in RelativeReturnWindow]: {
      asset_return: number | null;
      benchmark_return: number | null;
      alpha: number | null; // asset - benchmark, in percentage points
      score: number | null; // 0–100, 50 = market-like
    };
  };
  consistency_score: number | null; // 0–100, oriented: 0 = consistently negative, 50 = mixed, 100 = consistently positive
  drawdown_penalty: number | null; // 0–100, penalty only (0 = no penalty)
}

export interface RelativeReturnResult {
  score: number | null; // 0–100
  band: RelativeReturnBand | null;
  confidence: number | null; // 0–100
  components: RelativeReturnComponents;
  windows_used: RelativeReturnWindow[];
}

function clampScore(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

const WINDOW_LABELS: RelativeReturnWindow[] = ['1Y', '3Y', '5Y'];

function computeWindowAlphaScores(timeline: RelativeReturnTimeline | null | undefined) {
  const windowAlpha: RelativeReturnComponents['window_alpha'] = {
    '1Y': { asset_return: null, benchmark_return: null, alpha: null, score: null },
    '3Y': { asset_return: null, benchmark_return: null, alpha: null, score: null },
    '5Y': { asset_return: null, benchmark_return: null, alpha: null, score: null }
  };

  const alphaScores: number[] = [];
  const alphas: number[] = [];
  const used: RelativeReturnWindow[] = [];

  if (!timeline) {
    return { windowAlpha, alphaScores, alphas, used };
  }

  const MAX_ABS_ALPHA = 20; // 20 percentage points vs benchmark maps to extremes

  for (const w of WINDOW_LABELS) {
    const data = timeline[w];
    if (!data) continue;
    const asset = data.asset_return;
    const bench = data.benchmark_return;
    windowAlpha[w].asset_return = asset;
    windowAlpha[w].benchmark_return = bench;

    if (asset == null || bench == null) {
      continue;
    }

    const alpha = asset - bench; // both in percent
    windowAlpha[w].alpha = alpha;

    const clamped = Math.max(-MAX_ABS_ALPHA, Math.min(MAX_ABS_ALPHA, alpha));
    const score = 50 + (clamped / MAX_ABS_ALPHA) * 50; // -MAX -> 0, 0 -> 50, +MAX -> 100
    const scoreClamped = clampScore(score);

    windowAlpha[w].score = scoreClamped;
    alphaScores.push(scoreClamped);
    alphas.push(alpha);
    used.push(w);
  }

  return { windowAlpha, alphaScores, alphas, used };
}

function computeConsistencyScore(alphas: number[], windows: RelativeReturnWindow[]): number | null {
  const n = alphas.length;
  if (n === 0) return null;
  if (n === 1) return 50; // single window → neutral consistency

  const POS_EPS = 0.01; // 1 percentage point

  let pos = 0;
  let neg = 0;

  for (const a of alphas) {
    if (a > POS_EPS) pos += 1;
    else if (a < -POS_EPS) neg += 1;
  }

  const allPos = pos > 0 && neg === 0;
  const allNeg = neg > 0 && pos === 0;

  if (allPos) {
    const avgPos = alphas.reduce((s, v) => s + v, 0) / n;
    const MAX_REF = 10; // 10 percentage points
    const boost = Math.max(0, Math.min(25, (avgPos / MAX_REF) * 25));
    return clampScore(75 + boost); // 75–100
  }

  if (allNeg) {
    const avgNeg = Math.abs(alphas.reduce((s, v) => s + v, 0) / n);
    const MAX_REF = 10;
    const penalty = Math.max(0, Math.min(25, (avgNeg / MAX_REF) * 25));
    return clampScore(25 - penalty); // 0–25
  }

  return 50; // mixed → neutral consistency
}

function computeDrawdownPenalty(timeline: RelativeReturnTimeline | null | undefined): number | null {
  if (!timeline) return null;

  let penalty = 0;
  let hasData = false;

  for (const w of WINDOW_LABELS) {
    const data = timeline[w];
    if (!data) continue;

    const assetDd = data.asset_max_drawdown;
    const benchDd = data.benchmark_max_drawdown;
    if (assetDd == null || benchDd == null) continue;

    hasData = true;
    const diff = assetDd - benchDd; // both positive numbers (e.g. 35 for -35%)
    if (diff <= 0) continue; // asset no worse than benchmark

    const MAX_DIFF = 20; // cap at 20 percentage points deeper drawdown
    const clampedDiff = Math.max(0, Math.min(MAX_DIFF, diff));
    const windowPenalty = (clampedDiff / MAX_DIFF) * 20; // up to 20 points penalty
    if (windowPenalty > penalty) penalty = windowPenalty;
  }

  if (!hasData) return 0;
  return clampScore(penalty);
}

function computeConfidence(
  alphaScores: number[],
  consistencyScore: number | null,
  windowsUsed: RelativeReturnWindow[]
): number | null {
  const n = windowsUsed.length;
  if (n === 0) return null;

  const coverageFactor = n / WINDOW_LABELS.length; // 0–1

  let signalConsistencyFactor = 0.5;
  if (consistencyScore != null) {
    if (consistencyScore >= 60 || consistencyScore <= 40) {
      signalConsistencyFactor = 1;
    } else {
      signalConsistencyFactor = 0.7;
    }
  }

  const base = 30 + 40 * coverageFactor * signalConsistencyFactor;
  return clampScore(base);
}

function bandFromScore(score: number | null): RelativeReturnBand | null {
  if (score == null) return null;
  if (score >= 60) return 'outperformer';
  if (score <= 40) return 'underperformer';
  return 'neutral';
}

export function calculateRelativeReturn(
  timeline: RelativeReturnTimeline | null | undefined
): RelativeReturnResult {
  const { windowAlpha, alphaScores, alphas, used } = computeWindowAlphaScores(timeline);

  if (used.length === 0) {
    return {
      score: null,
      band: null,
      confidence: null,
      components: {
        window_alpha: windowAlpha,
        consistency_score: null,
        drawdown_penalty: null
      },
      windows_used: []
    };
  }

  const consistencyScore = computeConsistencyScore(alphas, used);
  const drawdownPenalty = computeDrawdownPenalty(timeline);

  let alphaComponent: number | null = null;
  if (alphaScores.length > 0) {
    const avgAlphaScore = alphaScores.reduce((s, v) => s + v, 0) / alphaScores.length;
    alphaComponent = clampScore(avgAlphaScore);
  }

  let finalScore: number | null = null;
  if (alphaComponent != null) {
    const consistencyComponent = consistencyScore != null ? consistencyScore : 50;
    const raw = 0.7 * alphaComponent + 0.3 * consistencyComponent;
    const beforePenalty = clampScore(raw);
    const penalty = drawdownPenalty != null ? drawdownPenalty : 0;
    finalScore = clampScore(beforePenalty - penalty);
  }

  const confidence = computeConfidence(alphaScores, consistencyScore, used);
  const band = bandFromScore(finalScore);

  return {
    score: finalScore,
    band,
    confidence,
    components: {
      window_alpha: windowAlpha,
      consistency_score: consistencyScore,
      drawdown_penalty: drawdownPenalty
    },
    windows_used: used
  };
}


export interface FintraVerdictInputs {
  fgos: {
    score: number | null;
    band: 'weak' | 'defendable' | 'strong' | null;
    confidence: number | null;
  };

  competitive_advantage?: {
    score: number | null;
    band: 'weak' | 'defendable' | 'strong' | null;
    confidence: number | null;
  };

  sentiment?: {
    score: number | null;
    band: 'pessimistic' | 'neutral' | 'optimistic' | null;
    confidence: number | null;
  };

  dividend_quality?: {
    score: number | null;
    band: 'weak' | 'acceptable' | 'high' | null;
    confidence: number | null;
  };

  relative_return?: {
    score: number | null;
    band: 'underperformer' | 'neutral' | 'outperformer' | null;
    confidence: number | null;
  };
}

export type FintraVerdictLabel =
  | 'exceptional'
  | 'strong'
  | 'balanced'
  | 'fragile'
  | 'speculative'
  | 'inconclusive';

export interface FintraVerdictResult {
  verdict_label: FintraVerdictLabel | null;
  verdict_score: number | null;
  confidence: number | null;
  drivers: {
    positives: string[];
    negatives: string[];
    tensions: string[];
  };
}

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) {
    list.push(value);
  }
}

export function resolveFintraVerdict(inputs: FintraVerdictInputs): FintraVerdictResult {
  const { fgos, competitive_advantage, sentiment, dividend_quality, relative_return } = inputs;

  if (!fgos || fgos.score === null || fgos.band === null) {
    return {
      verdict_label: 'inconclusive',
      verdict_score: null,
      confidence: null,
      drivers: {
        positives: [],
        negatives: ['Insufficient core FGOS data to form a verdict'],
        tensions: [],
      },
    };
  }

  const fgosBand = fgos.band;
  const compBand = competitive_advantage?.band ?? null;
  const sentBand = sentiment?.band ?? null;
  const divBand = dividend_quality?.band ?? null;
  const rrBand = relative_return?.band ?? null;

  const positives: string[] = [];
  const negatives: string[] = [];
  const tensions: string[] = [];

  if (fgosBand === 'strong') {
    pushUnique(positives, 'Strong business quality');
  } else if (fgosBand === 'defendable') {
    pushUnique(positives, 'Defendable business quality');
  } else if (fgosBand === 'weak') {
    pushUnique(negatives, 'Weak business quality');
  }

  if (compBand === 'strong') {
    pushUnique(positives, 'Strong competitive advantage');
  } else if (compBand === 'defendable') {
    pushUnique(positives, 'Defendable competitive advantage');
  } else if (compBand === 'weak') {
    pushUnique(negatives, 'Weak competitive advantage');
  }

  if (divBand === 'high') {
    pushUnique(positives, 'High dividend quality');
  } else if (divBand === 'acceptable') {
    pushUnique(positives, 'Acceptable dividend quality');
  } else if (divBand === 'weak') {
    pushUnique(negatives, 'Unsustainable dividends');
  }

  if (rrBand === 'outperformer') {
    pushUnique(positives, 'Persistent outperformance');
  } else if (rrBand === 'underperformer') {
    pushUnique(negatives, 'Structural underperformance');
  }

  if ((fgosBand === 'strong' || fgosBand === 'defendable') && sentBand === 'pessimistic') {
    pushUnique(tensions, 'Strong business with pessimistic sentiment');
  }

  if (fgosBand === 'weak' && sentBand === 'optimistic') {
    pushUnique(tensions, 'Weak business with optimistic sentiment');
  }

  if ((divBand === 'high' || divBand === 'acceptable') && rrBand === 'underperformer') {
    pushUnique(tensions, 'Good dividends with poor returns');
  }

  const hasWeakBusiness = fgosBand === 'weak';
  const hasWeakDividend = divBand === 'weak';
  const hasUnderperformance = rrBand === 'underperformer';

  const fragileCondition = hasWeakBusiness || hasWeakDividend || hasUnderperformance;
  const speculativeCondition = hasWeakBusiness && sentBand === 'optimistic';

  const exceptionalCondition =
    fgosBand === 'strong' &&
    compBand === 'strong' &&
    divBand !== 'weak' &&
    divBand !== null &&
    rrBand === 'outperformer' &&
    sentBand !== 'optimistic';

  const strongCondition =
    (fgosBand === 'strong' || fgosBand === 'defendable') &&
    compBand !== 'weak' &&
    divBand !== 'weak' &&
    rrBand !== 'underperformer' &&
    sentBand !== 'optimistic';

  const balancedCondition = !fragileCondition && !speculativeCondition && sentBand === 'neutral';

  let verdictLabel: FintraVerdictLabel = 'balanced';

  if (exceptionalCondition) {
    verdictLabel = 'exceptional';
  } else if (speculativeCondition) {
    verdictLabel = 'speculative';
  } else if (strongCondition) {
    verdictLabel = 'strong';
  } else if (fragileCondition) {
    verdictLabel = 'fragile';
  } else if (balancedCondition) {
    verdictLabel = 'balanced';
  }

  let verdictScore = clamp(fgos.score as number);
  let adjustment = 0;

  if (divBand === 'high') {
    adjustment += 7;
  } else if (divBand === 'weak') {
    adjustment -= 7;
  }

  if (rrBand === 'outperformer') {
    adjustment += 7;
  } else if (rrBand === 'underperformer') {
    adjustment -= 7;
  }

  if (sentBand === 'optimistic') {
    adjustment -= 3;
  } else if (sentBand === 'pessimistic') {
    adjustment += 3;
  }

  verdictScore = clamp(verdictScore + adjustment);

  let modulesWithData = 1;
  const moduleConfidences: number[] = [];

  if (typeof fgos.confidence === 'number' && Number.isFinite(fgos.confidence)) {
    moduleConfidences.push(fgos.confidence);
  }

  if (competitive_advantage && (competitive_advantage.score !== null || competitive_advantage.band !== null)) {
    modulesWithData += 1;
    if (
      typeof competitive_advantage.confidence === 'number' &&
      Number.isFinite(competitive_advantage.confidence)
    ) {
      moduleConfidences.push(competitive_advantage.confidence);
    }
  }

  if (sentiment && sentiment.band !== null) {
    modulesWithData += 1;
    if (typeof sentiment.confidence === 'number' && Number.isFinite(sentiment.confidence)) {
      moduleConfidences.push(sentiment.confidence);
    }
  }

  if (dividend_quality && (dividend_quality.score !== null || dividend_quality.band !== null)) {
    modulesWithData += 1;
    if (
      typeof dividend_quality.confidence === 'number' &&
      Number.isFinite(dividend_quality.confidence)
    ) {
      moduleConfidences.push(dividend_quality.confidence);
    }
  }

  if (relative_return && (relative_return.score !== null || relative_return.band !== null)) {
    modulesWithData += 1;
    if (
      typeof relative_return.confidence === 'number' &&
      Number.isFinite(relative_return.confidence)
    ) {
      moduleConfidences.push(relative_return.confidence);
    }
  }

  const totalComponents = 5;
  const missingComponents = totalComponents - modulesWithData;

  let confidence: number | null = null;

  if (moduleConfidences.length > 0) {
    const sum = moduleConfidences.reduce((acc, value) => acc + value, 0);
    const avg = sum / moduleConfidences.length;
    const coverageFactorBase = 0.6 + 0.1 * (modulesWithData - 1);
    const coverageFactor = coverageFactorBase > 1 ? 1 : coverageFactorBase;
    const contradictionsPenalty = tensions.length * 10;
    const rawConfidence = avg * coverageFactor - contradictionsPenalty;
    confidence = clamp(rawConfidence);
  }

  if (
    confidence !== null &&
    (confidence < 20 || (modulesWithData <= 2 && missingComponents >= 3 && confidence < 35))
  ) {
    verdictLabel = 'inconclusive';
  }

  return {
    verdict_label: verdictLabel,
    verdict_score: verdictScore,
    confidence,
    drivers: {
      positives,
      negatives,
      tensions,
    },
  };
}

// components/cards/funcionesTarjetas.ts

/* =========================================================
   Tipos base (compatibles con tus wrappers FMP)
   ========================================================= */
export type PricePoint = { date: string; close: number };
export type DividendEvent = { date: string; adjDividend?: number; dividend?: number };

export type AnalysisBundle = {
  symbol: string;
  price?: number;
  asOf?: string;

  fundamentals?: {
    margins?: { ebitda?: number; operating?: number; net?: number; fcf?: number };
    leverage?: { netDebtToEBITDA?: number | null; interestCoverage?: number | null };
    quality?: { roic?: number | null; wacc?: number | null; roicMinusWacc?: number | null; fcfConversion?: number | null };
    roe?: number | null;
    currentRatio?: number | null;
    debtToEquity?: number | null;
    fcf?: number | null;
    netDebt?: number | null;

    // Series históricas (para CAGRs)
    revenueHistory?: { date: string; value: number }[];
    netIncomeHistory?: { date: string; value: number }[];
    equityHistory?: { date: string; value: number }[];
  };

  valuation?: {
    evToEbitda?: number | null;
    evToEbit?: number | null;
    evToSales?: number | null;
    pToFcf?: number | null;
    fcfYield?: number | null;
    marketCap?: number | null;
    priceTarget?: { symbol?: string; targetLow?: number; targetHigh?: number; targetMean?: number; numberOfAnalysts?: number } | null;
    upgradesNet?: number | null;
    forwardEPSNextFY?: number | null; // si lo provees desde AnalystEstimates
  };

  performance?: {
    prices?: PricePoint[];
    benchmark?: PricePoint[]; // ej: SPY
  };

  dividends?: {
    ratioPayoutNI?: number | null;  // de /ratios si lo traes
    dividendYieldTTM?: number | null; // de /ratios o cálculo local
    dividendPerShareTTM?: number | null;
    lastPayment?: { date: string; amount: number } | null;
    frequency?: string | null; // Quarterly, Semi-Annual, Annual
    fcfTTM?: number | null;
    netIncomeTTM?: number | null;
    dividendsPaidTTM?: number | null;
    sharesOutstandingHistory?: { date: string; value: number }[];
    history?: DividendEvent[];
  };

  peers?: Array<{
    symbol: string;
    evToEbitda?: number | null;
    evToSales?: number | null;
    pToFcf?: number | null;
    fcfYield?: number | null;
  }>;
};

/* =========================================================
   Helpers numéricos / formateo
   ========================================================= */
const toNum = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));
const safeDiv = (a?: number | null, b?: number | null) => (a == null || b == null || b === 0 ? null : a / b);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export const pct = (x?: number | null, d = 1) => (x == null ? 'N/A' : `${(x * 100).toFixed(d)}%`);
export const pct100 = (x?: number | null, d = 1) => (x == null ? 'N/A' : `${x.toFixed(d)}%`);
export const moneyShort = (n?: number | null, d = 1) => {
  if (n == null) return 'N/A';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(d)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(d)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(d)}M`;
  return `${sign}$${a.toFixed(d)}`;
};

/* CAGR entre primer y último valor de una serie (N años) */
export function cagrFromSeries(series?: { date: string; value: number }[], years = 5) {
  if (!series?.length) return null;
  const sorted = [...series].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const first = sorted[0].value;
  const last = sorted[sorted.length - 1].value;
  if (first <= 0 || last <= 0) return null;
  return Math.pow(last / first, 1 / years) - 1;
}

/* =========================================================
   Semáforos / badges (devuelven tailwind + etiqueta)
   ========================================================= */
export function badgeRoicSpread(spread?: number | null) {
  if (spread == null) return { color: 'bg-gray-600', label: 'N/D' };
  if (spread > 0.03) return { color: 'bg-green-600', label: 'ROIC>WACC' };
  if (spread >= 0) return { color: 'bg-yellow-600', label: 'Ajustado' };
  return { color: 'bg-red-600', label: 'Destruye valor' };
}

export function badgeNetDebtEbitda(x?: number | null) {
  if (x == null) return { color: 'bg-gray-600', label: 'N/D' };
  if (x < 1) return { color: 'bg-green-600', label: '<1×' };
  if (x <= 3) return { color: 'bg-yellow-600', label: '1–3×' };
  return { color: 'bg-red-600', label: '>3×' };
}

export function badgeFCFMargin(x?: number | null) {
  if (x == null) return { color: 'bg-gray-600', label: 'N/D' };
  if (x > 0.25) return { color: 'bg-green-600', label: '>25%' };
  if (x >= 0.15) return { color: 'bg-yellow-600', label: '15–25%' };
  return { color: 'bg-red-600', label: '<15%' };
}

export function badgeFCFYield(x?: number | null) {
  if (x == null) return { color: 'bg-gray-600', label: 'N/D' };
  if (x > 0.05) return { color: 'bg-green-600', label: '>5%' };
  if (x >= 0.02) return { color: 'bg-yellow-600', label: '2–5%' };
  return { color: 'bg-red-600', label: '<2%' };
}

export function badgeSharpe(x?: number | null) {
  if (x == null) return { color: 'bg-gray-600', label: 'N/D' };
  if (x >= 1.0) return { color: 'bg-green-600', label: '≥1.0' };
  if (x >= 0.5) return { color: 'bg-yellow-600', label: '0.5–1.0' };
  return { color: 'bg-red-600', label: '<0.5' };
}

/* =========================================================
   Desempeño: retornos, vol, Sharpe, MDD, SMA, beta
   ========================================================= */
function sortAsc(prices: PricePoint[]) {
  return [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function dailyReturns(prices: PricePoint[]) {
  const s = sortAsc(prices);
  const out: { date: string; r: number }[] = [];
  for (let i = 1; i < s.length; i++) {
    const prev = s[i - 1].close;
    const cur = s[i].close;
    if (prev > 0 && cur > 0) out.push({ date: s[i].date, r: cur / prev - 1 });
  }
  return out;
}

function simpleReturnBetween(prices: PricePoint[], daysBack: number) {
  const s = sortAsc(prices);
  if (!s.length) return null;
  const end = s[s.length - 1];
  const targetTime = new Date(end.date).getTime() - daysBack * 24 * 3600 * 1000;
  // buscar el punto más cercano <= target
  let start = s[0];
  for (let i = s.length - 1; i >= 0; i--) {
    if (new Date(s[i].date).getTime() <= targetTime) { start = s[i]; break; }
  }
  if (!start?.close || !end?.close) return null;
  return end.close / start.close - 1;
}

function ytdReturn(prices: PricePoint[]) {
  const s = sortAsc(prices);
  if (!s.length) return null;
  const year = new Date(s[s.length - 1].date).getFullYear();
  const first = s.find(p => new Date(p.date).getFullYear() === year);
  if (!first) return null;
  return s[s.length - 1].close / first.close - 1;
}

function rollingSMA(prices: PricePoint[], window: number) {
  const s = sortAsc(prices);
  const out: { date: string; sma: number }[] = [];
  const q: number[] = [];
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    q.push(s[i].close);
    sum += s[i].close;
    if (q.length > window) sum -= q.shift()!;
    if (q.length === window) out.push({ date: s[i].date, sma: sum / window });
  }
  return out;
}

function maxDrawdown(prices: PricePoint[]) {
  const s = sortAsc(prices);
  let peak = -Infinity;
  let mdd = 0;
  for (const p of s) {
    peak = Math.max(peak, p.close);
    mdd = Math.min(mdd, p.close / peak - 1);
  }
  return mdd; // negativo
}

function stdev(vals: number[]) {
  if (!vals.length) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const v = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length - 1 || 1);
  return Math.sqrt(v);
}

function joinByDate(a: { date: string; r: number }[], b: { date: string; r: number }[]) {
  const map = new Map(b.map(x => [x.date, x.r]));
  const outA: number[] = [];
  const outB: number[] = [];
  for (const x of a) {
    const rb = map.get(x.date);
    if (rb !== undefined) { outA.push(x.r); outB.push(rb); }
  }
  return { a: outA, b: outB };
}

function covariance(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (!n) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let c = 0;
  for (let i = 0; i < n; i++) c += (x[i] - mx) * (y[i] - my);
  return c / (n - 1 || 1);
}

export function computePerformance(prices?: PricePoint[], benchmark?: PricePoint[], rfDaily = 0) {
  if (!prices?.length) return null;

  const r1m = simpleReturnBetween(prices, 30);
  const r3m = simpleReturnBetween(prices, 90);
  const r6m = simpleReturnBetween(prices, 180);
  const r1y = simpleReturnBetween(prices, 365);
  const rYTD = ytdReturn(prices);

  // volatilidad anualizada (252 d)
  const rets = dailyReturns(prices).map(x => x.r);
  const volDaily = stdev(rets) ?? null;
  const volAnn = volDaily == null ? null : volDaily * Math.sqrt(252);

  // sharpe 1y (rf diario asumido ~0 si no pasás)
  const meanDaily = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : null;
  const sharpe = meanDaily == null || volDaily == null || volDaily === 0
    ? null
    : ((meanDaily - rfDaily) / volDaily) * Math.sqrt(252);

  const mdd = maxDrawdown(prices);

  // SMA y distancias
  const s = sortAsc(prices);
  const last = s[s.length - 1]?.close ?? null;
  const sma50 = rollingSMA(prices, 50).at(-1)?.sma ?? null;
  const sma200 = rollingSMA(prices, 200).at(-1)?.sma ?? null;
  const distSMA50 = last && sma50 ? last / sma50 - 1 : null;
  const distSMA200 = last && sma200 ? last / sma200 - 1 : null;

  // momentum 12-1 y 6-1 (excluyendo último mes)
  const r12m = simpleReturnBetween(prices, 365);
  const r1m_ex = simpleReturnBetween(prices, 30);
  const momentum12_1 = r12m != null && r1m_ex != null ? r12m - r1m_ex : null;
  // Eliminar esta línea duplicada: const r6m = simpleReturnBetween(prices, 180);
  const momentum6_1 = r6m != null && r1m_ex != null ? r6m - r1m_ex : null;

  // beta/correlación vs benchmark
  let beta: number | null = null;
  let corr: number | null = null;
  if (benchmark?.length) {
    const a = dailyReturns(prices);
    const b = dailyReturns(benchmark);
    const { a: ax, b: bx } = joinByDate(a, b);
    const cov = covariance(ax, bx);
    const varB = stdev(bx);
    const varB2 = varB == null ? null : varB * varB;
    beta = cov == null || varB2 == null || varB2 === 0 ? null : cov / varB2;
    const sdx = stdev(ax), sdy = stdev(bx);
    corr = cov == null || sdx == null || sdy == null || sdx * sdy === 0 ? null : cov / (sdx * sdy);
  }

  // 52w hi/lo
  const lastDate = new Date(s[s.length - 1].date);
  const back52 = new Date(lastDate.getTime() - 365 * 24 * 3600 * 1000);
  const lastYear = s.filter(p => new Date(p.date) >= back52);
  const low52w = lastYear.length ? Math.min(...lastYear.map(x => x.close)) : null;
  const high52w = lastYear.length ? Math.max(...lastYear.map(x => x.close)) : null;

  return {
    r1m, r3m, r6m, r1y, ytd: rYTD,
    volAnn, sharpe, mdd,
    sma50, sma200, distSMA50, distSMA200,
    momentum12_1, momentum6_1,
    beta, corr,
    low52w, high52w,
    lastPrice: last ?? null,
  };
}

/* =========================================================
   Peers: medianas y percentiles
   ========================================================= */
export function peerMedian(values: Array<number | null | undefined>) {
  const arr = values.map(v => toNum(v)).filter((x): x is number => Number.isFinite(x));
  if (!arr.length) return null;
  arr.sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

export function percentileRank(value?: number | null, sample?: Array<number | null | undefined>) {
  if (value == null || !sample?.length) return null;
  const arr = sample.map(v => toNum(v)).filter((x): x is number => Number.isFinite(x)).sort((a, b) => a - b);
  if (!arr.length) return null;
  const below = arr.filter(x => x <= value).length;
  return below / arr.length; // [0..1]
}

/* =========================================================
   Dividendos: yield, payout, growth, streak, buyback
   ========================================================= */
export function ttmDividendPerShare(history?: DividendEvent[], asOf?: string) {
  if (!history?.length) return null;
  const end = asOf ? new Date(asOf) : new Date(history[history.length - 1].date);
  const start = new Date(end.getTime() - 365 * 24 * 3600 * 1000);
  const inWindow = history.filter(d => new Date(d.date) >= start && new Date(d.date) <= end);
  const total = inWindow.reduce((a, d) => a + (toNum(d.adjDividend ?? d.dividend) || 0), 0);
  return total || null;
}

export function dividendStreakYears(history?: DividendEvent[]) {
  if (!history?.length) return 0;
  // cuenta años consecutivos con suma anual creciente
  const byYear = new Map<number, number>();
  for (const d of history) {
    const y = new Date(d.date).getFullYear();
    const amt = toNum(d.adjDividend ?? d.dividend) || 0;
    byYear.set(y, (byYear.get(y) || 0) + amt);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  let streak = 0, best = 0;
  for (let i = 1; i < years.length; i++) {
    const up = (byYear.get(years[i]) || 0) >= (byYear.get(years[i - 1]) || 0);
    if (years[i] === years[i - 1] + 1 && up) { streak++; best = Math.max(best, streak); }
    else streak = 0;
  }
  return best;
}

export function buybackYield(sharesHistory?: { date: string; value: number }[]) {
  if (!sharesHistory?.length) return null;
  const s = [...sharesHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const cur = s[s.length - 1].value;
  const prev = s.length > 1 ? s[s.length - 2].value : null;
  if (!prev || prev === 0) return null;
  return -(cur - prev) / prev; // positivo si reduce acciones
}

/* =========================================================
   Normalizadores para cada Tarjeta
   (devuelven el shape que tus cards esperan)
   ========================================================= */

// FundamentalCard
export function normalizeForFundamentalCard(a: AnalysisBundle) {
  const f = a.fundamentals || {};
  const m = f.margins || {};
  const q = f.quality || {};

  const revenueCAGR5 = cagrFromSeries(f.revenueHistory, 5);
  const netIncomeCAGR5 = cagrFromSeries(f.netIncomeHistory, 5);

  return {
    roe: f.roe ?? null,
    roic: q.roic ?? null,
    gross_margin: m.operating != null && f.margins ? null : null, // si querés, alimentalo directo con ratios.grossMargin
    net_margin: m.net ?? null,
    debt_equity: f.debtToEquity ?? null,
    current_ratio: f.currentRatio ?? null,
    free_cash_flow: f.fcf ?? null,
    // extras sugeridos:
    ebitda_margin: m.ebitda ?? null,
    operating_margin: m.operating ?? null,
    fcf_margin: m.fcf ?? null,
    roic_wacc_spread: q.roicMinusWacc ?? null,
    net_debt_ebitda: f.leverage?.netDebtToEBITDA ?? null,
    interest_coverage: f.leverage?.interestCoverage ?? null,

    datos: {
      valoracion: {
        revenueCAGR: { value: revenueCAGR5 == null ? null : +(revenueCAGR5 * 100).toFixed(1) },
        netIncomeCAGR: { value: netIncomeCAGR5 == null ? null : +(netIncomeCAGR5 * 100).toFixed(1) },
      }
    }
  };
}

// ValoracionCard
export function normalizeForValoracionCard(a: AnalysisBundle) {
  const v = a.valuation || {};
  const forwardPE = v.forwardEPSNextFY && a.price ? a.price / v.forwardEPSNextFY : null;

  return {
    valoracion_pe: forwardPE,                 // P/E forward (si hay EPS next FY)
    valoracion_peg: null,                     // si tenés growth explícito podés calcular PEG
    valoracion_pbv: null,                     // si traes bookValuePerShare & price
    valoracion_implied_growth: null,          // si implementás Gordon o reverse-DCF
    market_cap: v.marketCap ?? null,
    free_cash_flow: a.fundamentals?.fcf ?? null,

    // extras útiles a mostrar:
    ev_ebitda: v.evToEbitda ?? null,
    ev_ebit: v.evToEbit ?? null,
    ev_sales: v.evToSales ?? null,
    p_fcf: v.pToFcf ?? null,
    fcf_yield: v.fcfYield ?? null,

    peers: a.peers || [],
    price_target: v.priceTarget || null,
    upgrades_net: v.upgradesNet ?? null,
  };
}

// DesempeñoCard
export function normalizeForDesempenoCard(a: AnalysisBundle) {
  const perf = computePerformance(a.performance?.prices, a.performance?.benchmark);
  return {
    current_price: perf?.lastPrice ?? a.price ?? null,
    beta: perf?.beta ?? null,
    low52w: perf?.low52w ?? null,
    high52w: perf?.high52w ?? null,

    // grilla de períodos
    performance: {
      '1M': perf?.r1m != null ? +(perf.r1m * 100).toFixed(2) : null,
      '3M': perf?.r3m != null ? +(perf.r3m * 100).toFixed(2) : null,
      '6M': perf?.r6m != null ? +(perf.r6m * 100).toFixed(2) : null,
      '1Y': perf?.r1y != null ? +(perf.r1y * 100).toFixed(2) : null,
      'YTD': perf?.ytd != null ? +(perf.ytd * 100).toFixed(2) : null,
    },

    // extras (podés mostrarlos en la modal)
    vol_annualized: perf?.volAnn ?? null,
    sharpe_1y: perf?.sharpe ?? null,
    mdd: perf?.mdd ?? null,
    sma50: perf?.sma50 ?? null,
    sma200: perf?.sma200 ?? null,
    distSMA50: perf?.distSMA50 ?? null,
    distSMA200: perf?.distSMA200 ?? null,
    momentum12_1: perf?.momentum12_1 ?? null,
    momentum6_1: perf?.momentum6_1 ?? null,
  };
}

// DividendosCard
export function normalizeForDividendosCard(a: AnalysisBundle) {
  const d = a.dividends || {};
  const dpsTTM = d.dividendPerShareTTM ?? ttmDividendPerShare(d.history, a.asOf);
  const lastPrice = a.price ?? a.performance?.prices?.at(-1)?.close ?? null;
  const yieldTTM = lastPrice && dpsTTM ? dpsTTM / lastPrice : d.dividendYieldTTM ?? null;

  const fcfPayout = d.fcfTTM && d.dividendsPaidTTM
    ? Math.abs(d.dividendsPaidTTM) / d.fcfTTM
    : null;

  const streak = dividendStreakYears(d.history);
  const buyback = buybackYield(d.sharesOutstandingHistory);

  return {
    dividendYield: yieldTTM,                  // fracción (0.025 = 2.5%)
    dividendPerShare: dpsTTM ?? null,
    frequency: d.frequency ?? null,
    payoutRatio: d.ratioPayoutNI != null ? Math.round(d.ratioPayoutNI * 100) : null, // %
    fcfPayoutRatio: fcfPayout != null ? Math.round(fcfPayout * 100) : null,          // %
    growth5Y: null,                                                                 // si querés, usa CAGR de DPS anual
    ultimoPago: d.lastPayment ?? null,
    // extras
    streakYears: streak,
    buybackYield: buyback,                   // fracción
  };
}

/* =========================================================
   Comparativa con peers (para ValoraciónCard)
   ========================================================= */
export function buildValuationPeerView(a: AnalysisBundle) {
  const v = a.valuation || {};
  const peers = a.peers || [];

  const peerEvEbitda = peers.map(p => p.evToEbitda);
  const peerEvSales = peers.map(p => p.evToSales);
  const peerPFcf = peers.map(p => p.pToFcf);
  const peerFcfYield = peers.map(p => p.fcfYield);

  const medians = {
    ev_ebitda: peerMedian(peerEvEbitda),
    ev_sales: peerMedian(peerEvSales),
    p_fcf: peerMedian(peerPFcf),
    fcf_yield: peerMedian(peerFcfYield),
  };

  const ranks = {
    ev_ebitda: percentileRank(v.evToEbitda ?? null, peerEvEbitda), // bajo es mejor
    ev_sales: percentileRank(v.evToSales ?? null, peerEvSales),
    p_fcf: percentileRank(v.pToFcf ?? null, peerPFcf),
    fcf_yield: v.fcfYield != null ? (peerFcfYield.filter(x => (x ?? -Infinity) <= v.fcfYield).length / (peerFcfYield.filter(x => x != null).length || 1)) : null, // alto es mejor
  };

  return { medians, ranks };
}

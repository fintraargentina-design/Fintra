// Fintra/app/api/cron/fmp-bulk/fetchBulk.ts

import Papa from 'papaparse';



/**
 * FMP BULK FINANCIALS
 * ⚠️ OBLIGATORIO: year + period
 * ⚠️ NO usar part=0
 */
const YEAR = new Date().getFullYear().toString();
const PERIOD = 'FY'; // Q1 | Q2 | Q3 | Q4 | FY

// ⬇️ agregar a URLs
const FMP_CSV_URLS = {
  profiles: 'https://financialmodelingprep.com/stable/profile-bulk?part=0',

  income: `https://financialmodelingprep.com/stable/income-statement-bulk?year=${YEAR}&period=FY`,
  income_growth: `https://financialmodelingprep.com/stable/income-statement-growth-bulk?year=${YEAR}&period=FY`,

  balance: `https://financialmodelingprep.com/stable/balance-sheet-statement-bulk?year=${YEAR}&period=FY`,
  balance_growth: `https://financialmodelingprep.com/stable/balance-sheet-statement-growth-bulk?year=${YEAR}&period=FY`,

  cashflow: `https://financialmodelingprep.com/stable/cash-flow-statement-bulk?year=${YEAR}&period=FY`,
  cashflow_growth: `https://financialmodelingprep.com/stable/cash-flow-statement-growth-bulk?year=${YEAR}&period=FY`,

  ratios: 'https://financialmodelingprep.com/stable/ratios-ttm-bulk',
  metrics: 'https://financialmodelingprep.com/stable/key-metrics-ttm-bulk',
  scores: 'https://financialmodelingprep.com/stable/scores-bulk',
  quotes: 'https://financialmodelingprep.com/stable/quote-bulk',
};


export interface BulkFetchResult<T = any> {
  ok: boolean;
  data: T[];
  meta: {
    endpoint: string;
    rows: number;
  };
  error?: {
    status?: number;
    message: string;
  };
}

async function fetchAndParseCSV(
  endpointKey: keyof typeof FMP_CSV_URLS,
  apiKey: string
): Promise<BulkFetchResult> {
  const baseUrl = FMP_CSV_URLS[endpointKey];
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}apikey=${apiKey}`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      return {
        ok: false,
        data: [],
        meta: { endpoint: endpointKey, rows: 0 },
        error: { status: res.status, message: `HTTP ${res.status}` }
      };
    }

    const csvText = await res.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: h => h.trim(),
    });

    const rows = (parsed.data as any[]) ?? [];

    return {
      ok: true,
      data: rows,
      meta: { endpoint: endpointKey, rows: rows.length }
    };
  } catch (err: any) {
    return {
      ok: false,
      data: [],
      meta: { endpoint: endpointKey, rows: 0 },
      error: { message: err?.message ?? 'Fetch error' }
    };
  }
}

function indexBySymbol(rows: any[]) {
  const map = new Map<string, any[]>();
  for (const r of rows) {
    const symbol = (r?.symbol || r?.ticker || '').trim().toUpperCase();
    if (!symbol) continue;
    if (!map.has(symbol)) map.set(symbol, []);
    map.get(symbol)!.push(r);
  }
  return map;
}

export async function fetchAllFmpData(fmpKey: string) {
  console.log('🚀 Fetching FMP BULK CSVs');

  const [
  profiles,
  income,
  incomeGrowth,
  balance,
  balanceGrowth,
  cashflow,
  cashflowGrowth,
  ratios,
  metrics,
  scores,
  quotes,
] = await Promise.all([
  fetchAndParseCSV('profiles', fmpKey),
  fetchAndParseCSV('income', fmpKey),
  fetchAndParseCSV('income_growth', fmpKey),
  fetchAndParseCSV('balance', fmpKey),
  fetchAndParseCSV('balance_growth', fmpKey),
  fetchAndParseCSV('cashflow', fmpKey),
  fetchAndParseCSV('cashflow_growth', fmpKey),
  fetchAndParseCSV('ratios', fmpKey),
  fetchAndParseCSV('metrics', fmpKey),
  fetchAndParseCSV('scores', fmpKey),
  fetchAndParseCSV('quotes', fmpKey),
]);

  if (!profiles.ok) {
    throw new Error('CRITICAL: profiles bulk unavailable');
  }

  return {
    meta: {
      income_ok: income.ok,
      balance_ok: balance.ok,
      cashflow_ok: cashflow.ok,
      ratios_ok: ratios.ok,
      metrics_ok: metrics.ok,
      scores_ok: scores.ok,
      quotes_ok: quotes.ok,
    },

    /* profiles: indexBySymbol(profiles.data),
    income: indexBySymbol(income.data),
    balance: indexBySymbol(balance.data),
    cashflow: indexBySymbol(cashflow.data),
    ratios: indexBySymbol(ratios.data),
    metrics: indexBySymbol(metrics.data),
    scores: indexBySymbol(scores.data),
    quotes: indexBySymbol(quotes.data), */
    profiles: indexBySymbol(profiles.data),
    income: indexBySymbol(income.data),
    income_growth: indexBySymbol(incomeGrowth.data),
    balance: indexBySymbol(balance.data),
    balance_growth: indexBySymbol(balanceGrowth.data),
    cashflow: indexBySymbol(cashflow.data),
    cashflow_growth: indexBySymbol(cashflowGrowth.data),
    ratios: indexBySymbol(ratios.data),
    metrics: indexBySymbol(metrics.data),
    scores: indexBySymbol(scores.data),
    quotes: indexBySymbol(quotes.data),
  };
}

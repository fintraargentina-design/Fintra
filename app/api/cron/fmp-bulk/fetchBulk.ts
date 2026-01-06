//Fintra\app\api\cron\fmp-bulk\fetchBulk.ts

import Papa from 'papaparse';

const FMP_CSV_URLS = {
  profiles: 'https://financialmodelingprep.com/stable/profile-bulk?part=0',

  income: 'https://financialmodelingprep.com/stable/income-statement-bulk?part=0',
  balance: 'https://financialmodelingprep.com/stable/balance-sheet-statement-bulk?part=0',
  cashflow: 'https://financialmodelingprep.com/stable/cash-flow-statement-bulk?part=0',

  ratios: 'https://financialmodelingprep.com/stable/ratios-ttm-bulk?part=0',
  metrics: 'https://financialmodelingprep.com/stable/key-metrics-ttm-bulk?part=0',
  scores: 'https://financialmodelingprep.com/stable/scores-bulk?part=0',
};

async function fetchAndParseCSV(url: string, apiKey: string) {
  const res = await fetch(`${url}&apikey=${apiKey}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }

  const csvText = await res.text();
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // 🔒 tipar después
    transformHeader: h => h.trim(),
  });

  return parsed.data as any[];
}

function indexBySymbol(rows: any[]) {
  const map = new Map<string, any[]>();
  for (const r of rows) {
    const symbol = (r.symbol || r.ticker || '').trim().toUpperCase();
    if (!symbol) continue;
    if (!map.has(symbol)) map.set(symbol, []);
    map.get(symbol)!.push(r);
  }
  return map;
}


export async function fetchAllFmpData(fmpKey: string) {
  console.log('🚀 Fetching FMP BULK CSVs');

  const results = await Promise.allSettled([
    fetchAndParseCSV(FMP_CSV_URLS.profiles, fmpKey),

    fetchAndParseCSV(FMP_CSV_URLS.income, fmpKey),
    fetchAndParseCSV(FMP_CSV_URLS.balance, fmpKey),
    fetchAndParseCSV(FMP_CSV_URLS.cashflow, fmpKey),

    fetchAndParseCSV(FMP_CSV_URLS.ratios, fmpKey),
    fetchAndParseCSV(FMP_CSV_URLS.metrics, fmpKey),
    fetchAndParseCSV(FMP_CSV_URLS.scores, fmpKey),
  ]);

  if (results[0].status === 'rejected') {
    throw new Error(`Critical: profiles failed`);
  }

  const [
    profiles,
    income,
    balance,
    cashflow,
    ratios,
    metrics,

    scores,
  ] = results.map(r => (r.status === 'fulfilled' ? r.value : []));

  return {
    profiles: indexBySymbol(profiles),
    income: indexBySymbol(income),
    balance: indexBySymbol(balance),
    cashflow: indexBySymbol(cashflow),
    ratios: indexBySymbol(ratios),
    metrics: indexBySymbol(metrics),
    scores: indexBySymbol(scores),
  };
}

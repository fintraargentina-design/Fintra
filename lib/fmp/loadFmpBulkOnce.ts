let cache: any | null = null;

export async function loadFmpBulkOnce() {
  if (cache) return cache;

  const API_KEY = process.env.FMP_API_KEY!;
  const BASE = 'https://financialmodelingprep.com/api/v3';

  async function fetchJson(url: string) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}apikey=${API_KEY}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`FMP error ${res.status}: ${text}`);
    }
    return res.json();
  }

  cache = {
    profiles: await fetchJson(`${BASE}/profile-bulk`),
    income: await fetchJson(`${BASE}/income-statement-bulk`),
    balance: await fetchJson(`${BASE}/balance-sheet-statement-bulk`),
    cashflow: await fetchJson(`${BASE}/cash-flow-statement-bulk`),
    ratios: await fetchJson(`${BASE}/ratios-ttm-bulk`),
    metrics: await fetchJson(`${BASE}/key-metrics-ttm-bulk`)
  };

  return cache;
}

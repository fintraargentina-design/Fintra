// Fintra/app/api/cron/fmp-bulk/normalizePerformance.ts

import type { FmpProfile, FmpQuote, FmpMetrics, FmpRatios } from '@/lib/engine/types';

export function calcReturn(prices: number[]): number {
  if (prices.length < 2) return 0;
  return ((prices[0] - prices.at(-1)!) / prices.at(-1)!) * 100;
}

export function normalizePerformance(
  profile: FmpProfile | null,
  quote: FmpQuote | null,
  priceChange: any,
  _metrics: FmpMetrics | null,
  ratios: FmpRatios | null
) {
  const price = quote?.price ?? (profile as any)?.price ?? null;
  const ytd = priceChange?.ytd ?? priceChange?.YTD ?? null;
  const divYield =
    ratios?.dividendYieldTTM ?? ratios?.dividendYield ?? (profile as any)?.lastDividend ?? null;

  return {
    price: typeof price === 'number' ? Number(price) : null,
    ytd_percent: typeof ytd === 'number' ? Number(ytd) : null,
    div_yield: typeof divYield === 'number' ? Number(divYield) : null,
  };
}

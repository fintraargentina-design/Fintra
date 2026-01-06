// Fintra/app/api/cron/fmp-bulk/normalizePerformance.ts

export function calcReturn(prices: number[]): number {
  if (prices.length < 2) return 0;
  return ((prices[0] - prices.at(-1)!) / prices.at(-1)!) * 100;
}

export function normalizePerformance(
    profile: any,
    quote: any,
    priceChange: any,
    metrics: any,
    ratios: any
) {
    const price = quote?.price || profile?.price || 0;
    const mCap = profile?.mktCap || quote?.marketCap || metrics?.marketCapTTM || 0;
    
    // Dividend Yield
    const divYield = ratios?.dividendYieldTTM || ratios?.dividendYield || profile?.lastDiv || 0; 

    return {
        profile_ticker: profile.symbol || profile.Symbol,
        div_yield: Number(divYield),
        estimacion: null, 
        last_price: Number(price),
        ytd_percent: priceChange?.ytd || priceChange?.YTD || 0, 
        market_cap: Number(mCap)
    };
}

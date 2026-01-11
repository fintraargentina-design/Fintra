
export function pctReturn(start: number, end: number): number {
  if (start === 0) return 0;
  return ((end - start) / start) * 100;
}

export function volatility(dailyReturns: number[]): number {
  if (dailyReturns.length === 0) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyReturns.length;
  return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
}

export function maxDrawdown(prices: number[]): number {
  if (prices.length === 0) return 0;
  let maxPrice = prices[0];
  let maxDd = 0;

  for (const price of prices) {
    if (price > maxPrice) {
      maxPrice = price;
    }
    const dd = (maxPrice - price) / maxPrice;
    if (dd > maxDd) {
      maxDd = dd;
    }
  }
  return maxDd * 100;
}

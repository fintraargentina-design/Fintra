import { supabaseAdmin } from '@/lib/supabase-admin';
import { getBulkPriceData } from '../shared/bulkCache';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const WINDOWS = [
  { code: '1M', days: 30, ytd: false },
  { code: '3M', days: 90, ytd: false },
  { code: 'YTD', ytd: true, days: 0 },
  { code: '1Y', days: 365, ytd: false },
  { code: '3Y', days: 365 * 3, ytd: false },
  { code: '5Y', days: 365 * 5, ytd: false }
];

export async function backfillPerformanceForDate(date: string) {
  const asOf = dayjs(date);
  const pricesByTicker = await getBulkPriceData();

  const rows: any[] = [];

  for (const ticker of Object.keys(pricesByTicker)) {
    const series = pricesByTicker[ticker]
      .filter((p: any) => dayjs(p.date).isSameOrBefore(asOf))
      .sort((a: any, b: any) => dayjs(a.date).diff(dayjs(b.date)));

    if (series.length < 2) continue;

    const lastPrice = series[series.length - 1].close;

    for (const w of WINDOWS) {
      let windowSeries: any[] = [];

      if (w.ytd) {
        const ytdStart = asOf.startOf('year');
        windowSeries = series.filter((p: any) =>
          dayjs(p.date).isSameOrAfter(ytdStart)
        );
      } else {
        const start = asOf.subtract(w.days!, 'day');
        windowSeries = series.filter((p: any) =>
          dayjs(p.date).isSameOrAfter(start)
        );
      }

      if (windowSeries.length < 2) continue;

      const firstPrice = windowSeries[0].close;
      const prices = windowSeries.map((p: any) => p.close);

      const dailyReturns = windowSeries
        .slice(1)
        .map((p: any, i: number) =>
          pctReturn(windowSeries[i].close, p.close)
        );

      rows.push({
        ticker,
        performance_date: date,
        window_code: w.code,

        return_percent: pctReturn(firstPrice, lastPrice),
        absolute_return: lastPrice - firstPrice,

        volatility: volatility(dailyReturns),
        max_drawdown: maxDrawdown(prices),

        source: 'FMP',
        data_freshness: 100
      });
    }
  }

  if (rows.length) {
    const { error } = await supabaseAdmin
      .from('datos_performance')
      .upsert(rows, {
        onConflict: 'ticker,performance_date,window_code'
      });

    if (error) throw error;
  }
}

function pctReturn(start: number, end: number): number {
    if (start === 0) return 0;
    return ((end - start) / start) * 100;
}

function volatility(dailyReturns: number[]): number {
    if (dailyReturns.length === 0) return 0;
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyReturns.length;
    return Math.sqrt(variance); // Daily volatility
}

function maxDrawdown(prices: number[]): number {
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

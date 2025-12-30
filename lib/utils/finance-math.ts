
import { OHLC } from "@/lib/fmp/types";

/**
 * Normalizes a single OHLC series to base 100 (relative performance).
 * Returns array of objects with { date, value } where value is % change.
 */
export function normalizeRebase100(
  data: OHLC[]
): { date: string; value: number }[] {
  if (!data || data.length === 0) return [];
  
  // Find first valid close price
  const firstValid = data.find(d => {
    const val = d.adjClose ?? d.close;
    return val !== null && val !== undefined && val !== 0;
  });
  if (!firstValid) return [];

  const basePrice = firstValid.adjClose ?? firstValid.close;

  return data.map(d => {
    const currentPrice = d.adjClose ?? d.close;
    // Si falta un dato intermedio, retornamos null o mantenemos el valor previo si quisiéramos forward fill aquí.
    // Para gráficos, es mejor null para romper la línea o dejar que ECharts interpole.
    if (currentPrice === null || currentPrice === undefined) return { date: d.date, value: 0 }; 
    
    return {
      date: d.date,
      value: ((currentPrice - basePrice) / basePrice) * 100
    };
  });
}

/**
 * Align multiple time series to a common set of dates.
 * Uses the intersection of dates (dates present in ALL series) to ensure fair comparison.
 * 
 * @param primarySeries The main series (usually the selected stock)
 * @param otherSeriesList List of other series (benchmark, peers)
 * @returns Object containing aligned arrays for each series
 */
export function alignSeries(
  primarySeries: OHLC[], 
  otherSeriesList: { id: string; data: OHLC[] }[]
): { date: string; [key: string]: number | string }[] {
  if (!primarySeries || primarySeries.length === 0) return [];

  // Create maps for fast lookup: date -> close price
  const primaryMap = new Map(primarySeries.map(d => [d.date.split('T')[0], d.close]));
  
  const otherMaps = otherSeriesList.map(s => ({
    id: s.id,
    map: new Map(s.data.map(d => [d.date.split('T')[0], d.close]))
  }));

  // Find intersection of dates
  // Start with primary dates
  let commonDates = primarySeries.map(d => d.date.split('T')[0]);

  // Filter dates that exist in ALL other series
  // Note: Strict intersection might be too aggressive if data has gaps.
  // Alternative: Union of dates and fill gaps (forward fill). 
  // For relative performance, Forward Fill is usually better to avoid dropping data.
  
  // Let's use Union of all dates, sort them, and Forward Fill.
  const allDates = new Set<string>(commonDates);
  otherSeriesList.forEach(s => {
      s.data.forEach(d => allDates.add(d.date.split('T')[0]));
  });

  const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const result: { date: string; [key: string]: number | string }[] = [];

  // Track last known values for forward fill
  let lastPrimary = NaN;
  const lastOthers: Record<string, number> = {};
  otherSeriesList.forEach(s => lastOthers[s.id] = NaN);

  for (const date of sortedDates) {
      const pVal = primaryMap.get(date);
      if (pVal !== undefined) lastPrimary = pVal;

      const row: any = { date };
      row['primary'] = lastPrimary;

      let allPresent = !isNaN(lastPrimary);

      for (const other of otherMaps) {
          const oVal = other.map.get(date);
          if (oVal !== undefined) lastOthers[other.id] = oVal;
          row[other.id] = lastOthers[other.id];
          if (isNaN(lastOthers[other.id])) allPresent = false;
      }

      // Only push rows where we have at least started tracking all series
      // Or maybe just if we have primary? 
      // For "Relative" chart starting at 0%, we need a common start date where ALL have values.
      if (allPresent) {
          result.push(row);
      }
  }

  return result;
}

/**
 * Normalizes price series to percentage change from the first available point (Base 100 or 0%).
 * Input: Array of aligned objects { date, ticker1: 150, ticker2: 200 ... }
 * Output: Same structure but values are % change.
 */
export function normalizeRebase100Aligned(
    alignedData: { date: string; [key: string]: number | string }[],
    fields: string[]
): { date: string; [key: string]: number | string }[] {
    if (alignedData.length === 0) return [];

    const firstRow = alignedData[0];
    const baseValues: Record<string, number> = {};

    // Capture base values
    for (const field of fields) {
        const val = Number(firstRow[field]);
        if (!isNaN(val) && val !== 0) {
            baseValues[field] = val;
        }
    }

    return alignedData.map(row => {
        const newRow: any = { date: row.date };
        for (const field of fields) {
            const val = Number(row[field]);
            const base = baseValues[field];
            if (base) {
                // (Current - Base) / Base * 100
                newRow[field] = ((val - base) / base) * 100;
            } else {
                newRow[field] = null;
            }
        }
        return newRow;
    });
}

/**
 * Calculates Drawdown series.
 * Drawdown = (Current Price - Rolling Max Price) / Rolling Max Price * 100
 */
export function calculateDrawdown(
    data: OHLC[]
): { date: string; value: number }[] {
    let peak = -Infinity;
    return data.map(d => {
        const price = d.adjClose ?? d.close;
        if (price > peak) peak = price;
        const dd = peak === 0 ? 0 : ((price - peak) / peak) * 100;
        return { date: d.date, value: dd };
    });
}

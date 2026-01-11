// shared/bulkCache.ts

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function getBulkFinancialData() {
  // TODO: Implement actual bulk fetching logic for historical data.
  // For now, returning empty objects to satisfy type checking and runtime safety.
  // This likely requires fetching from FMP's full history bulk endpoints or a different strategy.
  return {
    incomeStatements: {} as Record<string, any[]>,
    balanceSheets: {} as Record<string, any[]>,
    cashFlows: {} as Record<string, any[]>,
    ratios: {} as Record<string, any>
  };
}

export async function getBulkPriceData() {
  const dataDir = path.join(process.cwd(), 'data', 'fmp-valuation-bulk');
  const pricesByTicker: Record<string, { date: string; close: number }[]> = {};

  try {
    if (!fs.existsSync(dataDir)) {
      console.warn(`[getBulkPriceData] Directory not found: ${dataDir}`);
      return {};
    }

    const files = fs.readdirSync(dataDir).filter(f => f.startsWith('prices_') && f.endsWith('.csv'));
    
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const { data } = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });

      for (const row of data as any[]) {
        const { symbol, date, close } = row;
        if (!symbol || !date || close === undefined) continue;
        
        const closeNum = Number(close);
        if (isNaN(closeNum)) continue;

        if (!pricesByTicker[symbol]) {
          pricesByTicker[symbol] = [];
        }
        pricesByTicker[symbol].push({
          date,
          close: closeNum
        });
      }
    }

    // Sort by date ascending for each ticker
    for (const ticker in pricesByTicker) {
      pricesByTicker[ticker].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    console.log(`[getBulkPriceData] Loaded prices for ${Object.keys(pricesByTicker).length} tickers from ${files.length} files.`);
    return pricesByTicker;
  } catch (error) {
    console.error('[getBulkPriceData] Error loading prices:', error);
    return {};
  }
}

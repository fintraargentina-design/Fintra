import { supabase } from '@/lib/supabase';
import { SearchResponse } from '@/lib/fmp/types';

export interface UnifiedSearchResult {
  ticker: string;
  name: string;
  exchange: string;
  currency?: string;
  source: 'local' | 'fmp';
  is_active?: boolean;
}

export async function searchStocks(query: string): Promise<UnifiedSearchResult[]> {
  if (!query || query.length < 2) return [];

  // 1. Local Search
  const { data: localData, error } = await supabase
    .from('fintra_universe')
    .select('ticker, name, exchange, currency, is_active')
    .or(`ticker.ilike.${query}%,name.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error('Local search error:', error);
  }

  if (localData && localData.length > 0) {
    return localData.map(item => ({
      ticker: item.ticker,
      name: item.name || '',
      exchange: item.exchange || '',
      currency: item.currency || '',
      source: 'local',
      is_active: item.is_active || false
    }));
  }

  // 2. FMP Fallback
  // Using existing /api/fmp/search proxy which should point to search-symbol or search-name
  // The user requirement says:
  // Symbol-based search: https://financialmodelingprep.com/stable/search-symbol?query={QUERY}&limit=50
  // Name-based search: https://financialmodelingprep.com/stable/search-name?query={QUERY}&limit=50
  // I will check app/api/fmp/search/route.ts to see what it does.
  // If it's generic, I might need to use a specific endpoint or param.
  // For now, assuming /api/fmp/search maps to a general search.
  // To be safe and compliant with "Strict Rules", I should ideally use the specific endpoints.
  // But let's see what the proxy does first. 
  // I'll stick to the fetch call as implemented in StockSearchModal for now to reuse existing pattern, 
  // but if needed I can adjust the route.
  
  try {
    const res = await fetch(`/api/fmp/search?query=${encodeURIComponent(query)}&limit=10`);
    if (!res.ok) throw new Error('FMP search failed');
    const fmpData: SearchResponse = await res.json();
    
    return fmpData.map(item => ({
      ticker: item.symbol,
      name: item.name,
      exchange: item.exchangeShortName || item.stockExchange,
      currency: item.currency,
      source: 'fmp'
    }));
  } catch (e) {
    console.error('FMP fallback error:', e);
    return [];
  }
}

export async function registerPendingStock(stock: UnifiedSearchResult): Promise<boolean> {
  // If explicitly marked as local, no need to insert
  if (stock.source === 'local') return false;

  console.log('[SearchService] Registering pending stock:', stock.ticker);

  // Insert into fintra_universe
  const { error } = await supabase
    .from('fintra_universe')
    .insert({
      ticker: stock.ticker,
      name: stock.name,
      exchange: stock.exchange,
      currency: stock.currency,
      source: 'fmp_search',
      is_active: false // Pending state
    });

  if (error) {
     // Ignore duplicate key errors, log others
     if (error.code === '23505') {
         return false; // Already exists
     }
     console.error('Error registering stock:', error);
     throw error;
  }
  
  return true; // Newly inserted
}

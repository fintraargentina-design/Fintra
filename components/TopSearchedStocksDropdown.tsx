'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingUp } from 'lucide-react';

interface SearchedStock {
  symbol: string;
  busquedas: number;
}

interface TopSearchedStocksDropdownProps {
  onStockClick?: (symbol: string) => void;
}

export default function TopSearchedStocksDropdown({ onStockClick }: TopSearchedStocksDropdownProps) {
  const [topStocks, setTopStocks] = useState<SearchedStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopSearchedStocks();
  }, []);

  const fetchTopSearchedStocks = async () => {
    try {
      setLoading(true);
      const { data, error: supabaseError } = await supabase
        .from('busquedas_acciones')
        .select('symbol, busquedas')
        .order('busquedas', { ascending: false })
        .limit(5);

      if (supabaseError) {
        throw supabaseError;
      }

      setTopStocks(data || []);
    } catch (err) {
      console.error('Error fetching top searched stocks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStockClick = (symbol: string) => {
    if (onStockClick) {
      onStockClick(symbol);
    }
  };

  if (loading) {
    return (
      <div className="px-3 py-2 text-green-400 text-sm">
        Cargando...
      </div>
    );
  }

  return (
    <>
      {topStocks.map((stock, index) => (
        <button
          key={stock.symbol}
          onClick={() => handleStockClick(stock.symbol)}
          className="px-3 py-2 text-green-400 hover:bg-green-400/10 cursor-pointer rounded transition-colors duration-200 flex items-center space-x-1"
        >
          <span className="font-medium">{stock.symbol}</span>
          <div className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span className="text-xs text-gray-400">{stock.busquedas}</span>
          </div>
        </button>
      ))}
    </>
  );
}
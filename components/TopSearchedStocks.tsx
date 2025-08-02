'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, AlertCircle } from 'lucide-react';

interface SearchedStock {
  symbol: string;
  busquedas: number;
}

interface TopSearchedStocksProps {
  onStockClick?: (symbol: string) => void;
}

export default function TopSearchedStocks({ onStockClick }: TopSearchedStocksProps) {
  const [topStocks, setTopStocks] = useState<SearchedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTopSearchedStocks();
  }, []);

  const fetchTopSearchedStocks = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from('busquedas_acciones')
        .select('symbol, busquedas')
        .order('busquedas', { ascending: false })
        .limit(10);

      if (supabaseError) {
        throw supabaseError;
      }

      setTopStocks(data || []);
    } catch (err) {
      console.error('Error fetching top searched stocks:', err);
      setError('Error al cargar las acciones más buscadas');
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
      <Card className="bg-gray-900/50 border-green-400/20">
        <CardHeader>
          <CardTitle className="text-green-400 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Top 10 Acciones Más Buscadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900/50 border-red-400/20">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-sm">{error}</div>
          <button 
            onClick={fetchTopSearchedStocks}
            className="mt-2 text-green-400 hover:text-green-300 text-sm underline"
          >
            Reintentar
          </button>
        </CardContent>
      </Card>
    );
  }

  if (topStocks.length === 0) {
    return (
      <Card className="bg-gray-900/50 border-green-400/20">
        <CardHeader>
          <CardTitle className="text-green-400 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Top 10 Acciones Más Buscadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-400 text-sm text-center py-4">
            No hay datos de búsquedas disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/50 border-green-400/20">
      <CardHeader>
        <CardTitle className="text-green-400 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Top 10 Acciones Más Buscadas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {topStocks.map((stock, index) => (
            <div 
              key={stock.symbol}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-green-400/10 cursor-pointer transition-all duration-200 border border-transparent hover:border-green-400/30"
              onClick={() => handleStockClick(stock.symbol)}
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-400/20 text-green-400 text-xs font-bold">
                  {index + 1}
                </div>
                <div className="text-sm font-bold text-gray-300">
                  {stock.symbol}
                </div>
              </div>
              <div className="text-xs text-gray-400">
                {stock.busquedas} búsquedas
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
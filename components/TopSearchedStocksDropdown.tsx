'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingUp, RefreshCw, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SearchedStock {
  symbol: string;
  busquedas: number;
}

interface TopSearchedStocksDropdownProps {
  onStockClick?: (symbol: string) => void;
  isMobile?: boolean;
}

export default function TopSearchedStocksDropdown({ onStockClick, isMobile = false }: TopSearchedStocksDropdownProps) {
  const [topStocks, setTopStocks] = useState<SearchedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<string>('');

  useEffect(() => {
    fetchTopSearchedStocks();
    
    // Suscripción en tiempo real para actualizaciones automáticas
    const subscription = supabase
      .channel('busquedas_acciones_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'busquedas_acciones'
        },
        () => {
          console.log('Cambio detectado en busquedas_acciones, actualizando...');
          fetchTopSearchedStocks();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchTopSearchedStocks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Debug: Log para ver todos los datos recibidos
      console.log('Fetching top searched stocks for dropdown...');
      
      const { data, error: supabaseError } = await supabase
        .from('busquedas_acciones')
        .select('symbol, busquedas')
        .order('busquedas', { ascending: false })
        .limit(10); // Aumentado de 5 a 10

      if (supabaseError) {
        throw supabaseError;
      }

      console.log('Dropdown - Datos recibidos:', data);
      console.log('Dropdown - Total de stocks:', data?.length || 0);
      
      setTopStocks(data || []);
    } catch (err) {
      console.error('Error fetching top searched stocks:', err);
      setError('Error al cargar las acciones más buscadas');
    } finally {
      setLoading(false);
    }
  };

  const handleStockClick = (symbol: string) => {
    setSelectedStock(symbol);
    if (onStockClick) {
      onStockClick(symbol);
    }
  };

  const handleRetry = () => {
    fetchTopSearchedStocks();
  };

  // Estado de carga
  if (loading) {
    return (
      <div className="px-3 py-2 text-orange-400 text-sm flex items-center space-x-2">
        <RefreshCw className="w-3 h-3 animate-spin" />
        <span>Cargando...</span>
      </div>
    );
  }

  // Estado de error
  if (error) {
    return (
      <div className="px-3 py-2">
        <div className="text-red-400 text-sm mb-2">{error}</div>
        <button
          onClick={handleRetry}
          className="text-orange-400 hover:text-orange-300 text-xs flex items-center space-x-1 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Reintentar</span>
        </button>
      </div>
    );
  }

  // Estado sin datos
  if (topStocks.length === 0) {
    return (
      <div className="px-3 py-2 text-gray-400 text-sm">
        No hay datos disponibles
      </div>
    );
  }

  // Renderizado para móviles (dropdown)
  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 px-2 py-1 border-none transition-colors text-sm text-gray-400 hover:text-orange-400">
          <span>{selectedStock || <ChevronDown className="w-3 h-3" /> }</span>
          {/* <ChevronDown className="w-3 h-3" /> */}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-gray-800 border-gray-700 max-h-64 overflow-y-auto">
          {topStocks.map((stock) => (
            <DropdownMenuItem
              key={stock.symbol}
              onClick={() => handleStockClick(stock.symbol)}
              className="cursor-pointer transition-colors text-gray-300 hover:bg-orange-500/10 hover:text-orange-400"
            >
              {stock.symbol}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Renderizado para desktop (horizontal con scroll)
  return (
    <>
      {topStocks.map((stock, index) => (
        <button
          key={stock.symbol}
          onClick={() => handleStockClick(stock.symbol)}
          className="px-3 py-1.5 text-gray-400 hover:bg-orange-400/10 cursor-pointer transition-colors duration-200 text-sm font-medium"
        >
          {stock.symbol}
        </button>
      ))}
    </>
  );
}
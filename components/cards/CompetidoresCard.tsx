'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fmp } from '@/lib/fmp/client';

/**
 * Interfaz para los datos de un competidor
 */
interface CompetitorData {
  symbol: string;
  companyName: string;
  marketCap: number | null;
  price: number | null;
  changesPercentage: number | null;
  pe: number | null;
}

/**
 * Interfaz para las props del componente CompetidoresCard
 */
interface CompetidoresCardProps {
  symbol?: string;
  onCompetitorSelect?: (competitor: string) => void;
  selectedCompetitor?: string | null;
}

/**
 * Componente que muestra una tarjeta con los principales competidores
 * de una empresa, visualizados con un estilo similar a FinancialScoresCard
 */
export default function CompetidoresCard({ 
  symbol, 
  onCompetitorSelect, 
  selectedCompetitor 
}: CompetidoresCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);

  /**
   * Obtiene los datos de los competidores usando la API de FMP
   */
  useEffect(() => {
    const fetchCompetitors = async () => {
      if (!symbol?.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Obtener la lista de peers
        const peersResponse = await fmp.peers(symbol);
        const peersList: string[] = Array.isArray((peersResponse as any)?.peers) 
          ? (peersResponse as any).peers 
          : [];

        if (peersList.length === 0) {
          setCompetitors([]);
          setLoading(false);
          return;
        }

        // Limitar a los primeros 6 competidores para mejor visualización
        const topPeers = peersList.slice(0, 6);

        // Obtener datos detallados de cada competidor
        const competitorPromises = topPeers.map(async (peerSymbol) => {
          try {
            const [profileData, quoteData] = await Promise.all([
              fmp.profile(peerSymbol),
              fmp.quote(peerSymbol)
            ]);

            const profile = Array.isArray(profileData) ? profileData[0] : profileData;
            const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData;

            return {
              symbol: peerSymbol,
              companyName: profile?.companyName || peerSymbol,
              marketCap: quote?.marketCap || null,
              price: quote?.price || null,
              changesPercentage: quote?.changesPercentage || null,
              pe: quote?.pe || null,
            };
          } catch (error) {
            console.error(`Error fetching data for ${peerSymbol}:`, error);
            return {
              symbol: peerSymbol,
              companyName: peerSymbol,
              marketCap: null,
              price: null,
              changesPercentage: null,
              pe: null,
            };
          }
        });

        const competitorData = await Promise.all(competitorPromises);
        setCompetitors(competitorData);
      } catch (error) {
        console.error('Error fetching competitors:', error);
        setError('Error al cargar competidores');
      } finally {
        setLoading(false);
      }
    };

    fetchCompetitors();
  }, [symbol]);

  /**
   * Formatea números grandes (market cap) en formato legible
   */
  const formatMarketCap = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A';
    
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toFixed(0)}`;
  };

  /**
   * Formatea el precio con 2 decimales
   */
  const formatPrice = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A';
    return `$${value.toFixed(2)}`;
  };

  /**
   * Formatea el P/E ratio
   */
  const formatPE = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(1);
  };

  /**
   * Obtiene el icono y color para el cambio porcentual
   */
  const getChangeIcon = (change: number | null) => {
    if (change === null || change === undefined) return <Minus className="w-4 h-4 text-gray-400" />;
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  /**
   * Obtiene el color del texto para el cambio porcentual
   */
  const getChangeColor = (change: number | null): string => {
    if (change === null || change === undefined) return 'text-gray-400';
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  if (!symbol?.trim()) {
    return (
      <Card className="bg-tarjetas border-none min-h-[300px]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">No hay símbolo disponible</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="bg-tarjetas border-none min-h-[300px]">
        <CardHeader>
          <CardTitle className="text-orange-400 text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Competidores Principales
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Cargando competidores...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-tarjetas border-none h-[492px]">
        <CardHeader>
          <CardTitle className="text-orange-400 text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Competidores Principales
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-red-400">{error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (competitors.length === 0) {
    return (
      <Card className="bg-tarjetas border-none h-[492px]">
        <CardHeader>
          <CardTitle className="text-orange-400 text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Competidores Principales
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">No se encontraron competidores</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-tarjetas border-none h-[492px]">
      <CardHeader>
        <CardTitle className="text-orange-400 text-lg flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Competidores Principales
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-2">
          {competitors.map((competitor) => (
            <div
              key={competitor.symbol}
              className={`bg-gray-800/50 rounded-lg p-4 border transition-all cursor-pointer ${
                selectedCompetitor === competitor.symbol 
                  ? 'border-orange-500 bg-orange-500/10' 
                  : 'border-gray-700/50 hover:border-orange-500/30'
              }`}
              onClick={() => onCompetitorSelect?.(competitor.symbol)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-orange-300 font-semibold text-sm truncate">
                    {competitor.symbol}
                  </h3>
                  <p className="text-gray-400 text-xs truncate mt-1">
                    {competitor.companyName}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {getChangeIcon(competitor.changesPercentage)}
                  <span className={`text-xs font-medium ${getChangeColor(competitor.changesPercentage)}`}>
                    {competitor.changesPercentage !== null 
                      ? `${competitor.changesPercentage > 0 ? '+' : ''}${competitor.changesPercentage.toFixed(2)}%`
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-gray-500 mb-1">Precio</p>
                  <p className="text-white font-medium">
                    {formatPrice(competitor.price)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Market Cap</p>
                  <p className="text-white font-medium">
                    {formatMarketCap(competitor.marketCap)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">P/E</p>
                  <p className="text-white font-medium">
                    {formatPE(competitor.pe)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
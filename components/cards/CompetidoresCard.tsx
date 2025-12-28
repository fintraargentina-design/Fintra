'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from 'lucide-react';
import { fmp } from '@/lib/fmp/client';
import { enrichStocksWithData, EnrichedStockData } from '@/lib/services/stock-enrichment';

interface CompetidoresCardProps {
  symbol?: string;
  onCompetitorSelect?: (competitor: string) => void;
  onCompetitorSearch?: (competitor: string) => void;
  selectedCompetitor?: string | null;
}

export default function CompetidoresCard({ 
  symbol, 
  onCompetitorSelect, 
  onCompetitorSearch,
  selectedCompetitor 
}: CompetidoresCardProps) {
  const [loading, setLoading] = useState(true);
  const [competitors, setCompetitors] = useState<EnrichedStockData[]>([]);
  const [sector, setSector] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompetitors = async () => {
      if (!symbol?.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // 1. Get Sector and Peers
        const [profileData, peersResponse] = await Promise.all([
           fmp.profile(symbol).catch(() => []),
           fmp.peers(symbol).catch(() => ({ peers: [] }))
        ]);
        
        const companyProfile = Array.isArray(profileData) ? profileData[0] : profileData;
        setSector(companyProfile?.sector ?? null);

        let peersList: string[] = Array.isArray((peersResponse as any)?.peers) 
          ? (peersResponse as any).peers 
          : [];
          
        if (peersList.length === 0) {
           // Fallback: if no peers, maybe fetch by sector? 
           // For now, just empty.
           setCompetitors([]);
           setLoading(false);
           return;
        }

        // Limit to 6
        peersList = peersList.slice(0, 6);

        // 2. Enrich
        const enriched = await enrichStocksWithData(peersList);
        setCompetitors(enriched.sort((a, b) => b.fgos - a.fgos));

      } catch (error) {
        console.error('Error fetching competitors:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompetitors();
  }, [symbol]);

  const getFgosColor = (s: number) => 
    s >= 70 ? "bg-green-500/10 text-green-400 border-green-500/20" : 
    s >= 50 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : 
    "bg-red-500/10 text-red-400 border-red-500/20";

  const getValBadge = (v: string) => {
    if (v === "Undervalued" || v === "Infravalorada") return <Badge className="text-green-400 bg-green-400/10 border-green-400 px-2 py-0.5 text-[9px] h-5" variant="outline">Infravalorada</Badge>;
    if (v === "Fair" || v === "Justa") return <Badge className="text-yellow-400 bg-yellow-400/10 border-yellow-400 px-2 py-0.5 text-[9px] h-5" variant="outline">Justa</Badge>;
    return <Badge className="text-red-400 bg-red-400/10 border-red-400 px-2 py-0.5 text-[9px] h-5" variant="outline">Sobrevalorada</Badge>;
  };

  const formatMarketCap = (val: number) => {
    if (val >= 1e12) return `${(val / 1e12).toFixed(1)}T`;
    if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    return val.toFixed(0);
  };

  if (!symbol?.trim()) {
    return (
      <Card className="bg-tarjetas border-none min-h-[300px]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="h-32 grid place-items-center text-gray-500 text-sm">No hay símbolo disponible</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas border border-white/5 rounded-none overflow-hidden shadow-sm">
        <div className="py-2 px-4 border-b border-white/5 bg-white/[0.02] shrink-0">
          <h4 className="text-xs font-medium text-gray-400 text-center">
            Competidores directos de <span className="text-[#FFA028]">{symbol}</span>
            {sector && <span className="text-gray-500 ml-1">({sector})</span>}
          </h4>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin relative p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-gray-600 bg-gray-600">
                <TableHead className="text-gray-300 text-[10px] h-8 w-[60px]">Ticker</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-center w-[50px]">F.G.O.S.</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-center w-[80px]">Valuación</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-center w-[50px]">Ecosistema</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-center w-[60px]">Div. Yield</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-center w-[60px]">Estimación</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-right w-[70px]">Last Price</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-right w-[60px]">YTD %</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-right w-[70px]">Mkt Cap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex justify-center items-center gap-2 text-gray-400 text-xs">
                       <Loader2 className="w-4 h-4 animate-spin" /> Cargando competidores...
                    </div>
                  </TableCell>
                </TableRow>
              ) : competitors.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={9} className="h-24 text-center text-gray-500 text-xs">
                     No se encontraron competidores directos.
                   </TableCell>
                </TableRow>
              ) : competitors.map((stock) => (
                <TableRow 
                  key={stock.ticker} 
                  className="border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => onCompetitorSelect?.(stock.ticker)}
                >
                  <TableCell className="font-bold text-white px-2 py-0.5 text-xs">{stock.ticker}</TableCell>
                  <TableCell className="text-center px-2 py-0.5">
                    <Badge variant="outline" className={`text-[10px] border-0 px-1.5 py-0 h-5 font-bold ${getFgosColor(stock.fgos)}`}>
                      {stock.fgos || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5">
                    {getValBadge(stock.valuation)}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-blue-400 font-bold">
                    {stock.ecosystem || '-'}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {stock.divYield ? `${stock.divYield.toFixed(2)}%` : '-'}
                  </TableCell>
                  <TableCell 
                    className={`text-center px-2 py-0.5 text-[10px] font-medium ${stock.estimation > 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {stock.estimation ? `${stock.estimation > 0 ? '+' : ''}${stock.estimation.toFixed(1)}%` : '-'}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-xs font-mono text-white">
                    ${stock.price.toFixed(2)}
                  </TableCell>
                  <TableCell 
                    className={`text-right px-2 py-0.5 text-[10px] font-medium ${stock.ytd >= 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {stock.ytd >= 0 ? "+" : ""}{stock.ytd.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-[10px] text-gray-400">
                    {formatMarketCap(stock.marketCap)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
    </div>
  );
}
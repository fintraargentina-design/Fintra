'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox"; //
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from 'lucide-react';
import { fmp } from '@/lib/fmp/client';
import { enrichStocksWithData, EnrichedStockData } from '@/lib/services/stock-enrichment';

interface CompetidoresCardProps {
  symbol?: string;
  onCompetitorSelect?: (competitor: string) => void; // Para navegar
  onToggleCompare?: (ticker: string, checked: boolean) => void; // NUEVO: Para comparar
  selectedForComparison?: string[]; // NUEVO: Estado actual
}

export default function CompetidoresCard({ 
  symbol, 
  onCompetitorSelect, 
  onToggleCompare,
  selectedForComparison = []
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
           setCompetitors([]);
           return;
        }

        peersList = peersList.slice(0, 6);
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

  // Helpers de estilo (mismos que tenías) ...
  const getFgosColor = (s: number) => s >= 70 ? "bg-green-500/10 text-green-400 border-green-500/20" : s >= 50 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-red-500/10 text-red-400 border-red-500/20";
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
          <div className="flex items-center justify-center h-64 text-gray-500 text-sm">No hay símbolo disponible</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas border border-white/5 rounded-none overflow-hidden shadow-sm">
        <div className="py-2 px-4 border-b border-white/5 bg-white/[0.02] shrink-0">
          <h4 className="text-xs font-medium text-gray-400 text-center">
            Competidores de <span className="text-[#FFA028]">{symbol}</span>
          </h4>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin relative p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 bg-gray-600/50">
                {/* Nueva Columna Checkbox */}
                <TableHead className="w-[30px] p-0 text-center"></TableHead> 
                <TableHead className="text-gray-300 text-[10px] h-8 w-[60px]">Ticker</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-center w-[50px]">F.G.O.S.</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-center w-[80px]">Valuación</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-center w-[50px]">Ecosistema</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-8 text-right w-[70px]">Mkt Cap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex justify-center items-center gap-2 text-gray-400 text-xs">
                       <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : competitors.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={6} className="h-24 text-center text-gray-500 text-xs">
                     Sin datos.
                   </TableCell>
                </TableRow>
              ) : competitors.map((stock) => (
                <TableRow 
                  key={stock.ticker} 
                  className="border-white/5 hover:bg-white/5 transition-colors"
                >
                  {/* Checkbox de Selección */}
                  <TableCell className="p-0 text-center w-[30px]">
                    <Checkbox 
                      checked={selectedForComparison.includes(stock.ticker)}
                      onCheckedChange={(checked) => onToggleCompare?.(stock.ticker, checked as boolean)}
                      className="border-white/20 data-[state=checked]:bg-[#0056FF] data-[state=checked]:border-[#0056FF] w-3 h-3 translate-y-[1px]"
                    />
                  </TableCell>
                  
                  {/* Clic en el ticker navega */}
                  <TableCell 
                    className="font-bold text-white px-2 py-0.5 text-xs cursor-pointer hover:underline"
                    onClick={() => onCompetitorSelect?.(stock.ticker)}
                  >
                    {stock.ticker}
                  </TableCell>
                  
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
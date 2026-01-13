"use client";
// Fintra/components/dashboard/PeersAnalysisPanel.tsx

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getHeatmapColor } from "@/lib/utils";
import { EnrichedStockData } from "@/lib/services/stock-enrichment";
import { supabase } from "@/lib/supabase";
import { FgosScoreCell } from "@/components/ui/FgosScoreCell";

interface PeersAnalysisPanelProps {
  symbol: string;
  onPeerSelect?: (ticker: string) => void;
  selectedPeer?: string | null;
}

export default function PeersAnalysisPanel({ symbol, onPeerSelect, selectedPeer }: PeersAnalysisPanelProps) {
  const [peers, setPeers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchPeersData = async () => {
      if (!symbol) {
        if (active) {
            setPeers([]);
            setIsLoading(false);
        }
        return;
      }

      if (active) {
          setIsLoading(true);
          setPeers([]);
      }

      try {
        // 1. Get peers list from Supabase
        // We only use data that exists in our database (Supabase-first)
        const { data: peerRows, error: peerError } = await supabase
          .from('stock_peers')
          .select('peer_ticker')
          .eq('ticker', symbol)
          .limit(20); // Fetch enough candidates

        if (peerError) {
             console.error("Error fetching peers from Supabase:", peerError);
             if(active) {
                 setPeers([]);
                 setIsLoading(false);
             }
             return;
        }

        let peersList: string[] = peerRows ? peerRows.map((r: any) => r.peer_ticker) : [];
        
        if (!peersList.length) {
             if(active) {
                 setPeers([]);
                 setIsLoading(false);
             }
             return;
        }
        
        // Filter out invalid tickers (basic sanity check)
        peersList = peersList.filter(p => {
          if (!p || typeof p !== 'string') return false;
          const clean = p.trim();
          return clean.length > 0 && /^[A-Z0-9.\-\^]+$/i.test(clean);
        });

        // Limit to 8 after filtering
        peersList = peersList.slice(0, 8);

        if (peersList.length === 0) {
             if(active) {
                 setPeers([]);
                 setIsLoading(false);
             }
             return;
        }

        // 2. Enrich data desde Supabase únicamente (sin APIs por ticker)
        const { data: snapshots } = await supabase
          .from('fintra_snapshots')
          .select('ticker, fgos_score, fgos_confidence_label, valuation, created_at')
          .in('ticker', peersList)
          .order('created_at', { ascending: false });

        const { data: eco } = await supabase
          .from('fintra_ecosystem_reports')
          .select('ticker, ecosystem_score, date')
          .in('ticker', peersList)
          .order('date', { ascending: false });

        const snapMap = new Map<string, any>();
        (snapshots || []).forEach((row: any) => {
          if (!snapMap.has(row.ticker)) snapMap.set(row.ticker, row);
        });

        const ecoMap = new Map<string, number>();
        (eco || []).forEach((row: any) => {
          if (!ecoMap.has(row.ticker)) ecoMap.set(row.ticker, row.ecosystem_score);
        });

        const enriched: EnrichedStockData[] = peersList.map((t) => {
          const s = snapMap.get(t) || {};
          const e = ecoMap.get(t);
          return {
            ticker: t,
            name: t,
            price: null as any,
            marketCap: null as any,
            ytd: null as any,
            divYield: 0,
            estimation: 0,
            targetPrice: 0,
            fgos: s?.fgos_score ?? 0,
            confidenceLabel: s?.fgos_confidence_label,
            valuation: s?.valuation?.valuation_status ?? "N/A",
            ecosystem: e ?? 50
          };
        });

        // Ordenar por FGOS de mayor a menor
        enriched.sort((a, b) => b.fgos - a.fgos);

        if(active) {
             setPeers(enriched);
             setIsLoading(false);
        }

      } catch (e) {
        console.error(e);
        if(active) setIsLoading(false);
      } 
    };

    fetchPeersData();

    return () => { active = false; };
  }, [symbol]);

  const getValBadge = (v: string, isSelected: boolean = false) => {
    const lowerV = v?.toLowerCase() || "";
    if (isSelected) {
        let label = "Sobrevalorada";
        if (lowerV.includes("under") || lowerV.includes("infra")) label = "Infravalorada";
        if (lowerV.includes("fair") || lowerV.includes("justa")) label = "Justa";
        return <span className="text-gray-300 text-[9px]">{label}</span>;
    }

    if (lowerV.includes("under") || lowerV.includes("infra")) return <Badge className="text-green-400 bg-green-400/10 border-green-400 px-2 py-0.5 text-[9px] h-5 w-24 justify-center" variant="outline">Infravalorada</Badge>;
    if (lowerV.includes("fair") || lowerV.includes("justa")) return <Badge className="text-yellow-400 bg-yellow-400/10 border-yellow-400 px-2 py-0.5 text-[9px] h-5 w-24 justify-center" variant="outline">Justa</Badge>;
    return <Badge className="text-red-400 bg-red-400/10 border-red-400 px-2 py-0.5 text-[9px] h-5 w-24 justify-center" variant="outline">Sobrevalorada</Badge>;
  };

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden mt-0">
            
      <div className="px-1 py-1 bg-white/[0.02] shrink-0">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Competidores directos de <span className="text-[#FFA028]">{symbol}</span>
        </h4>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin relative p-0 border border-t-0 border-zinc-800">
        <table className="w-full text-sm">
          <TableHeader className="sticky top-0 z-10 bg-[#1D1D1D]">
            <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 w-[60px]">Ticker</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[70px]">Rank. Sectorial</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[80px]">Valuación</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[50px]">Ecosistema</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[60px]">Div. Yield</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[60px]">Estimación</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[70px]">Last Price</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[60px]">YTD %</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[70px]">Mkt Cap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow className="border-zinc-800">
                    <TableCell colSpan={9} className="h-24 text-center">
                        <div className="flex justify-center items-center gap-2 text-gray-400 text-xs">
                           Cargando competidores...
                        </div>
                    </TableCell>
                </TableRow>
            ) : peers.length === 0 ? (
                <TableRow className="border-zinc-800">
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8 text-xs">
                        No se encontraron competidores para {symbol}.
                    </TableCell>
                </TableRow>
            ) : (
                peers.map((peer) => {
                  const isSelected = selectedPeer === peer.ticker;
                  return (
                    <TableRow 
                      key={peer.ticker} 
                      className={`border-zinc-800 hover:bg-white/5 cursor-pointer transition-colors ${isSelected ? '!bg-[#0056FF]' : ''}`}
                      onClick={() => onPeerSelect?.(isSelected ? "" : peer.ticker)}
                    >
                      <TableCell className="font-bold text-white px-2 py-0.5 text-xs w-[60px]">{peer.ticker}</TableCell>
                      <TableCell className="text-center px-2 py-0.5 w-[70px]">
                        <FgosScoreCell score={peer.fgos} confidenceLabel={peer.confidenceLabel} />
                      </TableCell>
                      <TableCell className="text-center px-2 py-0.5 w-[80px]">
                        {getValBadge(peer.valuation, isSelected)}
                      </TableCell>
                      <TableCell className={`text-center px-2 py-0.5 text-[10px] font-bold w-[50px] ${isSelected ? 'text-white' : 'text-blue-400'}`}>
                          {peer.ecosystem || '-'}
                      </TableCell>
                      <TableCell className={`text-center px-2 py-0.5 text-[10px] w-[60px] ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {peer.divYield ? `${peer.divYield.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-center px-2 py-0.5 text-[10px] font-medium text-white w-[60px]"
                        style={isSelected ? undefined : { backgroundColor: getHeatmapColor(peer.estimation) }}
                      >
                        {peer.estimation ? `${peer.estimation > 0 ? '+' : ''}${peer.estimation.toFixed(1)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right px-2 py-0.5 text-xs font-mono text-white w-[70px]">
                        {peer.price != null ? `$${Number(peer.price).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-right px-2 py-0.5 text-[10px] font-medium text-white w-[60px]"
                        style={isSelected ? undefined : { backgroundColor: getHeatmapColor(peer.ytd != null ? Number(peer.ytd) : 0) }}
                      >
                        {peer.ytd != null ? `${Number(peer.ytd) >= 0 ? "+" : ""}${Number(peer.ytd).toFixed(1)}%` : '-'}
                      </TableCell>
                      <TableCell className={`text-right px-2 py-0.5 text-[10px] w-[70px] ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                        {peer.marketCap != null 
                          ? (Number(peer.marketCap) > 1e12 
                              ? `${(Number(peer.marketCap)/1e12).toFixed(1)}T` 
                              : `${(Number(peer.marketCap)/1e9).toFixed(1)}B`)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}

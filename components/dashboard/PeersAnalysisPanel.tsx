"use client";
// Fintra/components/dashboard/PeersAnalysisPanel.tsx

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getHeatmapColor, formatMarketCap } from "@/lib/utils";
import { EnrichedStockData } from "@/lib/services/stock-enrichment";
import { supabase } from "@/lib/supabase";
import { FgosScoreCell } from "@/components/ui/FgosScoreCell";
import { compareStocks, getValBadge, getFgosBandLabel, getMoatLabel, getRelativeReturnLabel, getStrategicStateLabel } from "./TableUtils";

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

        // 2. Enrich data desde fintra_market_state (igual que SectorAnalysisPanel)
        const { data: marketRows, error: marketError } = await supabase
          .from('fintra_market_state')
          .select('ticker, price, market_cap, ytd_return, fgos_score, valuation_status, fgos_confidence_label, market_position, strategic_state, relative_return')
          .in('ticker', peersList);

        if (marketError) {
          console.error("Error fetching market state for peers:", marketError);
          if (active) {
            setPeers([]);
            setIsLoading(false);
          }
          return;
        }

        const enriched: EnrichedStockData[] = (marketRows || []).map((row: any) => ({
          ticker: row.ticker,
          name: row.ticker,
          price: row.price,
          marketCap: row.market_cap,
          ytd: row.ytd_return,
          divYield: null,
          estimation: null,
          targetPrice: null,
          ecosystem: 50, // Default ecosystem score if not available
          fgos: row.fgos_score ?? 0,
          confidenceLabel: row.fgos_confidence_label,
          valuation: row.valuation_status || "N/A",
          marketPosition: row.market_position,
          strategicState: row.strategic_state,
          relativeReturn: row.relative_return
        }));

        // Ordenar usando lógica jerárquica
        enriched.sort(compareStocks);

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

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden mt-0">
            
      <div className="px-1 py-1 bg-white/[0.02] shrink-0">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Competidores directos de <span className="text-[#FFA028]">{symbol}</span>
        </h4>
      </div>

			<div className="flex-1 relative p-0 border border-t-0 border-zinc-800 overflow-y-auto">
        <table className="w-full text-sm">
          <TableHeader className="sticky top-0 z-10 bg-[#1D1D1D]">
            <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 w-[60px]">Ticker</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[120px]">Ranking Sectorial (IFS)</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[120px]">Valuación vs. Sector</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Calidad Fund. (Band)</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Est. Competitiva</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Res. Relativo</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Est. Estratégico</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[70px]">Precio EOD</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[60px]">YTD %</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[70px]">Mkt Cap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow className="border-zinc-800">
                    <TableCell colSpan={10} className="h-24 text-center">
                        <div className="flex justify-center items-center gap-2 text-gray-400 text-xs">
                           Cargando competidores...
                        </div>
                    </TableCell>
                </TableRow>
            ) : peers.length === 0 ? (
                <TableRow className="border-zinc-800">
                    <TableCell colSpan={10} className="text-center text-gray-500 py-8 text-xs">
                        No se encontraron competidores para {symbol}.
                    </TableCell>
                </TableRow>
            ) : (
                peers.map((peer) => {
                  const isSelected = selectedPeer === peer.ticker;
                  return (
                    <TableRow 
                      key={peer.ticker} 
                      className={`border-zinc-800 hover:bg-white/5 cursor-pointer transition-colors ${isSelected ? 'border-2 border-[#002D72]' : ''}`}
                      onClick={() => onPeerSelect?.(isSelected ? "" : peer.ticker)}
                    >
                      <TableCell className="font-bold text-white px-2 py-0.5 text-xs w-[60px]">{peer.ticker}</TableCell>
                      <TableCell className="text-center px-2 py-0.5">
                        <FgosScoreCell score={peer.fgos} confidenceLabel={peer.confidenceLabel} />
                      </TableCell>
                      <TableCell className="text-center px-2 py-0.5">
                        {getValBadge(peer.valuation)}
                      </TableCell>
                      <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                        {getFgosBandLabel(peer.fgos)}
                      </TableCell>
                      <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                        {getMoatLabel(peer.marketPosition)}
                      </TableCell>
                      <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                        {getRelativeReturnLabel(peer.relativeReturn)}
                      </TableCell>
                      <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                        {getStrategicStateLabel(peer.strategicState)}
                      </TableCell>
                      <TableCell className="text-right px-2 py-0.5 text-xs font-mono text-white w-[70px]">
                        {peer.price != null ? `$${Number(peer.price).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-center px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: peer.ytd ? getHeatmapColor(peer.ytd) : 'transparent' }}
                      >
                        {peer.ytd != null ? `${peer.ytd >= 0 ? "+" : ""}${Number(peer.ytd).toFixed(1)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right px-2 py-0.5 text-[10px] w-[70px] text-gray-400">
                        {peer.marketCap != null ? formatMarketCap(Number(peer.marketCap)) : '-'}
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


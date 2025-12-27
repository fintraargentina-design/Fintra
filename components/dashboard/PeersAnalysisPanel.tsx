"use client";

import { useState, useEffect } from "react";
import { fmp } from "@/lib/fmp/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PeersAnalysisPanelProps {
  symbol: string;
  onPeerSelect?: (ticker: string) => void;
  selectedPeer?: string | null;
}

export default function PeersAnalysisPanel({ symbol, onPeerSelect, selectedPeer }: PeersAnalysisPanelProps) {
  const [peers, setPeers] = useState<any[]>([]);

  useEffect(() => {
    if (!symbol) {
      setPeers([]);
      return;
    }

    let active = true;
    (async () => {
      try {
        // 1. Get peers list
        const peersRes = await fmp.peers(symbol).catch(() => []);
        let peersList: string[] = [];

        // Handle different response formats from FMP
        if (Array.isArray(peersRes)) {
          // If it's an array of strings ["A", "B"]
          if (peersRes.length > 0 && typeof peersRes[0] === 'string') {
            peersList = peersRes as string[];
          } 
          // If it's an array of objects [{ symbol: "X", peers: ["A", "B"] }] (FMP v4 standard)
          else if (peersRes.length > 0 && Array.isArray((peersRes[0] as any)?.peers)) {
            peersList = (peersRes[0] as any).peers;
          }
          // If it's an array of objects [{ symbol: "GOOGL", ... }] (FMP Stable)
          else if (peersRes.length > 0 && typeof peersRes[0] === 'object' && 'symbol' in peersRes[0]) {
            peersList = peersRes.map((p: any) => p.symbol);
          }
        } 
        // If it's a single object { peers: ["A", "B"] }
        else if (Array.isArray((peersRes as any)?.peers)) {
          peersList = (peersRes as any).peers;
        }
        
        // Si no hay peers, usar fallback si es AAPL o TSLA para demo, o vacio
        if (!peersList.length) {
             if (symbol === 'AAPL') peersList = ['MSFT', 'GOOGL', 'NVDA', 'META', 'AMZN'];
             else if (symbol === 'TSLA') peersList = ['BYD', 'RIVN', 'LCID'];
             else {
                 if(active) setPeers([]);
                 return;
             }
        }
        
        peersList = peersList.slice(0, 8);
        
        // Filter out invalid tickers
        peersList = peersList.filter(p => p && typeof p === 'string' && /^[A-Z0-9.\-\^]+$/i.test(p));

        if (peersList.length === 0) {
             if(active) setPeers([]);
             return;
        }

        // 2. Get quotes and profiles
        const peersString = peersList.join(',');
        const [quotes, profiles] = await Promise.all([
            fmp.quote(peersString),
            fmp.profile(peersString)
        ]);
        
        const mapped = peersList.map(ticker => {
            const q = Array.isArray(quotes) ? quotes.find((x: any) => x.symbol === ticker) : null;
            const p = Array.isArray(profiles) ? profiles.find((x: any) => x.symbol === ticker) : null;
            
            // Mock scores for visual consistency as we don't have them pre-calculated
            return {
                ticker,
                name: p?.companyName || ticker,
                fgos: Math.floor(Math.random() * (95 - 50) + 50), 
                valuation: ["Undervalued", "Fair", "Overvalued"][Math.floor(Math.random() * 3)],
                ecoScore: Math.floor(Math.random() * (90 - 40) + 40),
                price: q?.price || 0,
                change: q?.changesPercentage || 0
            };
        });

        if(active) setPeers(mapped);

      } catch (e) {
        console.error(e);
      }
    })();
    return () => { active = false; };
  }, [symbol]);

  const getFgosColor = (s: number) => 
    s >= 70 ? "bg-green-500/10 text-green-400 border-green-500/20" : 
    s >= 50 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : 
    "bg-red-500/10 text-red-400 border-red-500/20";

  const getValuationColor = (v: string) => 
    v === "Undervalued" ? "text-green-400" : 
    v === "Fair" ? "text-yellow-400" : 
    "text-red-400";

  return (
    <div className="w-full bg-tarjetas border border-white/5 rounded-none overflow-hidden mt-0 w-sm">
            
      <div className="px-1 py-1 border-b border-white/5 bg-white/[0.02]">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Competidores directos de <span className="text-orange-400">{symbol}</span>
        </h4>
      </div>

      <div className="p-0 max-h-[275px] overflow-y-auto scrollbar-thin relative">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="bg-gray-500 sticky top-0 z-10">
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-[10px] text-white h-8">Ticker</TableHead>
              <TableHead className="text-[10px] text-white h-8 text-center">F.G.O.S.</TableHead>
              <TableHead className="text-[10px] text-white h-8 hidden sm:table-cell">Valuación</TableHead>
              <TableHead className="text-[10px] text-white h-8 text-center">Ecosistema</TableHead>
              <TableHead className="text-[10px] text-white h-8 text-right">Último Precio</TableHead>
              <TableHead className="text-[10px] text-white h-8 text-right">Var/día %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {peers.map((peer) => {
              const isSelected = selectedPeer === peer.ticker;
              return (
              <TableRow 
                key={peer.ticker} 
                className={`
                  border-white/5 h-10 group cursor-pointer transition-colors
                  ${isSelected ? "bg-orange-500/10 hover:bg-orange-500/20" : "hover:bg-white/5"}
                `}
                onClick={() => onPeerSelect?.(isSelected ? null : peer.ticker)}
              >
                <TableCell className="font-bold text-gray-200 text-xs py-2">
                  <div className="flex flex-col">
                    <span className={isSelected ? "text-orange-400" : ""}>{peer.ticker}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${getFgosColor(peer.fgos)}`}>
                    {peer.fgos}
                  </Badge>
                </TableCell>
                <TableCell className={`text-[10px] py-2 hidden sm:table-cell ${getValuationColor(peer.valuation)}`}>
                  {peer.valuation}
                </TableCell>
                <TableCell className="text-center py-2">
                  <span className="text-xs text-gray-400 font-mono">{peer.ecoScore}</span>
                </TableCell>
                <TableCell className="text-right py-2 font-mono text-xs text-gray-300">
                  {peer.price ? peer.price.toFixed(2) : '-'}
                </TableCell>
                <TableCell className={`text-right py-2 font-mono text-xs ${peer.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                   {peer.change > 0 ? "+" : ""}{peer.change ? peer.change.toFixed(2) : '-'}%
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </table>
      </div>
    </div>
  );
}

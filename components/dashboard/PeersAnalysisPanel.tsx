"use client";

import { useState, useEffect } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, TrendingDown } from "lucide-react";

interface PeersAnalysisPanelProps {
  symbol: string;
}

// Mock Data específica para AAPL y genérica para otros
const PEERS_DB: Record<string, any[]> = {
  "AAPL": [
    { ticker: "MSFT", name: "Microsoft Corp", fgos: 89, valuation: "Fair", ecoScore: 95, price: 415.20, change: 0.8 },
    { ticker: "GOOGL", name: "Alphabet Inc.", fgos: 85, valuation: "Fair", ecoScore: 90, price: 175.30, change: 1.2 },
    { ticker: "NVDA", name: "NVIDIA Corp", fgos: 92, valuation: "Overvalued", ecoScore: 88, price: 124.50, change: 2.5 },
    { ticker: "META", name: "Meta Platforms", fgos: 81, valuation: "Undervalued", ecoScore: 82, price: 505.20, change: -1.5 },
    { ticker: "AMZN", name: "Amazon.com Inc", fgos: 78, valuation: "Fair", ecoScore: 85, price: 185.10, change: 0.5 },
  ],
  "TSLA": [
    { ticker: "BYD", name: "BYD Company", fgos: 75, valuation: "Undervalued", ecoScore: 80, price: 25.40, change: 3.2 },
    { ticker: "RIVN", name: "Rivian Auto", fgos: 45, valuation: "Undervalued", ecoScore: 60, price: 14.50, change: -2.1 },
    { ticker: "LCID", name: "Lucid Group", fgos: 40, valuation: "Fair", ecoScore: 55, price: 3.20, change: -4.5 },
  ]
};

const generateFallbackPeers = (symbol: string) => {
  return Array.from({ length: 5 }).map((_, i) => ({
    ticker: `PEER${i+1}`,
    name: `Competitor ${i+1}`,
    fgos: Math.floor(Math.random() * (99 - 40) + 40),
    valuation: ["Undervalued", "Fair", "Overvalued"][Math.floor(Math.random() * 3)],
    ecoScore: Math.floor(Math.random() * (90 - 50) + 50),
    price: (Math.random() * 200 + 20).toFixed(2),
    change: (Math.random() * 5 - 2).toFixed(2)
  })).sort((a, b) => b.fgos - a.fgos);
};

export default function PeersAnalysisPanel({ symbol }: PeersAnalysisPanelProps) {
  const [peers, setPeers] = useState<any[]>([]);

  useEffect(() => {
    // Simular carga de datos basada en el símbolo
    const data = PEERS_DB[symbol] || generateFallbackPeers(symbol);
    setPeers(data);
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
            
      <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
        <h4 className="text-xs font-medium text-gray-400">
          Competidores directos de <span className="text-orange-400">{symbol}</span>
        </h4>
      </div>

      <div className="p-0 max-h-[155px] overflow-y-auto scrollbar-thin relative">
        <Table>
          <TableHeader className="bg-[#111] sticky top-0 z-10">
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-[10px] uppercase text-gray-500 h-8 font-bold">Ticker</TableHead>
              <TableHead className="text-[10px] uppercase text-gray-500 h-8 text-center font-bold">FGOS</TableHead>
              <TableHead className="text-[10px] uppercase text-gray-500 h-8 font-bold hidden sm:table-cell">Valuación</TableHead>
              <TableHead className="text-[10px] uppercase text-gray-500 h-8 text-center font-bold">Eco</TableHead>
              <TableHead className="text-[10px] uppercase text-gray-500 h-8 text-right font-bold">Price</TableHead>
              <TableHead className="text-[10px] uppercase text-gray-500 h-8 text-right font-bold">Var %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {peers.map((peer) => (
              <TableRow key={peer.ticker} className="border-white/5 hover:bg-white/5 h-10 group">
                <TableCell className="font-bold text-gray-200 text-xs py-2">
                  <div className="flex flex-col">
                    <span>{peer.ticker}</span>
                    <span className="text-[9px] text-gray-500 font-normal hidden sm:inline">{peer.name}</span>
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
                <TableCell className="text-right py-2">
                  <span className="text-xs text-gray-200 font-medium">${Number(peer.price).toFixed(2)}</span>
                </TableCell>
                <TableCell className="text-right py-2">
                    <span className={`text-[10px] flex items-center justify-end ${Number(peer.change) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Number(peer.change) >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                      {Math.abs(Number(peer.change))}%
                    </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

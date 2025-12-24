"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown } from "lucide-react";

const SECTORS = [
  "Technology", "Healthcare", "Financials", "Real Estate", 
  "Energy", "Materials", "Consumer Disc.", "Consumer Staples", 
  "Industrials", "Utilities", "Comm. Services"
];

// Mock Data con empresas reales para mejor visualización
const MOCK_DB: Record<string, any[]> = {
  "Technology": [
    { ticker: "NVDA", fgos: 92, valuation: "Overvalued", ecoScore: 88, price: 124.50, change: 2.5 },
    { ticker: "MSFT", fgos: 89, valuation: "Fair", ecoScore: 95, price: 415.20, change: 0.8 },
    { ticker: "AAPL", fgos: 88, valuation: "Overvalued", ecoScore: 75, price: 220.50, change: -0.5 },
    { ticker: "GOOGL", fgos: 85, valuation: "Fair", ecoScore: 90, price: 175.30, change: 1.2 },
    { ticker: "AMD", fgos: 78, valuation: "Fair", ecoScore: 70, price: 160.10, change: -1.8 },
  ],
  "Healthcare": [
    { ticker: "LLY", fgos: 94, valuation: "Overvalued", ecoScore: 85, price: 890.00, change: 3.2 },
    { ticker: "JNJ", fgos: 72, valuation: "Fair", ecoScore: 92, price: 145.50, change: 0.2 },
    { ticker: "PFE", fgos: 55, valuation: "Undervalued", ecoScore: 88, price: 28.30, change: -0.4 },
  ],
  "Financials": [
    { ticker: "JPM", fgos: 82, valuation: "Fair", ecoScore: 96, price: 198.50, change: 1.5 },
    { ticker: "V", fgos: 88, valuation: "Overvalued", ecoScore: 94, price: 275.10, change: 0.6 },
    { ticker: "MA", fgos: 87, valuation: "Fair", ecoScore: 93, price: 450.20, change: 0.9 },
  ],
  "Energy": [
    { ticker: "XOM", fgos: 75, valuation: "Fair", ecoScore: 80, price: 115.40, change: -0.8 },
    { ticker: "CVX", fgos: 70, valuation: "Fair", ecoScore: 82, price: 155.20, change: -1.2 },
    { ticker: "COP", fgos: 68, valuation: "Undervalued", ecoScore: 78, price: 112.50, change: 0.5 },
  ]
};

const generateFallbackStocks = (sector: string) => {
  return Array.from({ length: 4 }).map((_, i) => ({
    ticker: `${sector.substring(0,3).toUpperCase()}${i+1}`,
    fgos: Math.floor(Math.random() * (99 - 40) + 40),
    valuation: ["Undervalued", "Fair", "Overvalued"][Math.floor(Math.random() * 3)],
    ecoScore: Math.floor(Math.random() * (90 - 50) + 50),
    price: (Math.random() * 200 + 20).toFixed(2),
    change: (Math.random() * 5 - 2).toFixed(2)
  })).sort((a, b) => b.fgos - a.fgos);
};

export default function SectorAnalysisPanel() {
  const [selectedSector, setSelectedSector] = useState("Technology");
  
  const stocks = (MOCK_DB[selectedSector] || generateFallbackStocks(selectedSector))
    .sort((a, b) => b.fgos - a.fgos);

  const getFgosColor = (s: number) => 
    s >= 70 ? "bg-green-500/10 text-green-400 border-green-500/20" : 
    s >= 50 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : 
    "bg-red-500/10 text-red-400 border-red-500/20";

  const getValuationColor = (v: string) => 
    v === "Undervalued" ? "text-green-400" : 
    v === "Fair" ? "text-yellow-400" : 
    "text-red-400";

  return (
    <div className="w-full bg-tarjetas border border-white/5 rounded-xl overflow-hidden mb-4 shadow-sm">
      {/* <div className="p-3 border-b border-white/10 bg-white/5">
        <h3 className="text-orange-400 font-semibold flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4" /> Scanner de Oportunidades
        </h3>
      </div> */}
      
      <Tabs defaultValue="Technology" onValueChange={setSelectedSector} className="w-full">
        <div className="border-b border-white/10">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="bg-transparent h-auto p-0 flex w-max">
              {SECTORS.map((sector) => (
                <TabsTrigger 
                  key={sector} 
                  value={sector} 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-400 data-[state=active]:text-orange-400 text-xs px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {sector}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>

        <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
          <h4 className="text-xs font-medium text-gray-400">
            Acciones del sector <span className="text-orange-400">"{selectedSector}"</span>
          </h4>
        </div>

        <div className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
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
              {stocks.map((stock) => (
                <TableRow key={stock.ticker} className="border-white/5 hover:bg-white/5 h-10 group">
                  <TableCell className="font-bold text-gray-200 text-xs py-2">{stock.ticker}</TableCell>
                  <TableCell className="text-center py-2">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${getFgosColor(stock.fgos)}`}>
                      {stock.fgos}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-[10px] py-2 hidden sm:table-cell ${getValuationColor(stock.valuation)}`}>
                    {stock.valuation}
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <span className="text-xs text-gray-400 font-mono">{stock.ecoScore}</span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <span className="text-xs text-gray-200 font-medium">${Number(stock.price).toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                      <span className={`text-[10px] flex items-center justify-end ${Number(stock.change) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {Number(stock.change) >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                        {Math.abs(Number(stock.change))}%
                      </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Tabs>
    </div>
  );
}

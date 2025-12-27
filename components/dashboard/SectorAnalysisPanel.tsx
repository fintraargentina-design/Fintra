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
    { ticker: "NVDA", fgos: 92, valuation: "Overvalued", ecoScore: 88, price: 124.50, change: 2.5, divYield: 0.03, estimation: 130.00, ytd: 145.5, marketCap: 3050 },
    { ticker: "MSFT", fgos: 89, valuation: "Fair", ecoScore: 95, price: 415.20, change: 0.8, divYield: 0.72, estimation: 450.00, ytd: 12.4, marketCap: 3090 },
    { ticker: "AAPL", fgos: 88, valuation: "Overvalued", ecoScore: 75, price: 220.50, change: -0.5, divYield: 0.45, estimation: 210.00, ytd: 15.2, marketCap: 3350 },
    { ticker: "GOOGL", fgos: 85, valuation: "Fair", ecoScore: 90, price: 175.30, change: 1.2, divYield: 0.46, estimation: 190.00, ytd: 24.5, marketCap: 2150 },
    { ticker: "AMD", fgos: 78, valuation: "Fair", ecoScore: 70, price: 160.10, change: -1.8, divYield: 0.00, estimation: 175.00, ytd: 8.5, marketCap: 258 },
    { ticker: "ORCL", fgos: 76, valuation: "Fair", ecoScore: 72, price: 140.45, change: 1.1, divYield: 1.14, estimation: 145.00, ytd: 32.1, marketCap: 385 },
  ],
  "Healthcare": [
    { ticker: "LLY", fgos: 94, valuation: "Overvalued", ecoScore: 85, price: 890.00, change: 3.2, divYield: 0.58, estimation: 920.00, ytd: 52.4, marketCap: 840 },
    { ticker: "JNJ", fgos: 72, valuation: "Fair", ecoScore: 92, price: 145.50, change: 0.2, divYield: 3.41, estimation: 160.00, ytd: -5.2, marketCap: 350 },
    { ticker: "PFE", fgos: 55, valuation: "Undervalued", ecoScore: 88, price: 28.30, change: -0.4, divYield: 5.92, estimation: 32.00, ytd: -1.5, marketCap: 160 },
    { ticker: "UNH", fgos: 81, valuation: "Fair", ecoScore: 89, price: 480.20, change: 0.7, divYield: 1.73, estimation: 520.00, ytd: -8.4, marketCap: 442 },
    { ticker: "ABBV", fgos: 79, valuation: "Fair", ecoScore: 84, price: 170.15, change: -0.3, divYield: 3.65, estimation: 178.00, ytd: 10.2, marketCap: 300 },
    { ticker: "MRK", fgos: 76, valuation: "Undervalued", ecoScore: 86, price: 128.40, change: 0.5, divYield: 2.38, estimation: 135.00, ytd: 18.5, marketCap: 325 },
  ],
  "Financials": [
    { ticker: "JPM", fgos: 82, valuation: "Fair", ecoScore: 96, price: 198.50, change: 1.5, divYield: 2.31, estimation: 210.00, ytd: 16.5, marketCap: 570 },
    { ticker: "V", fgos: 88, valuation: "Overvalued", ecoScore: 94, price: 275.10, change: 0.6, divYield: 0.75, estimation: 290.00, ytd: 5.8, marketCap: 560 },
    { ticker: "MA", fgos: 87, valuation: "Fair", ecoScore: 93, price: 450.20, change: 0.9, divYield: 0.58, estimation: 480.00, ytd: 6.2, marketCap: 420 },
    { ticker: "BAC", fgos: 75, valuation: "Undervalued", ecoScore: 89, price: 39.40, change: 1.2, divYield: 2.43, estimation: 42.00, ytd: 18.2, marketCap: 305 },
    { ticker: "WFC", fgos: 73, valuation: "Fair", ecoScore: 85, price: 58.60, change: -0.2, divYield: 2.38, estimation: 62.00, ytd: 19.5, marketCap: 210 },
    { ticker: "GS", fgos: 78, valuation: "Fair", ecoScore: 90, price: 460.75, change: 0.8, divYield: 2.60, estimation: 475.00, ytd: 19.8, marketCap: 155 },
  ],
  "Energy": [
    { ticker: "XOM", fgos: 75, valuation: "Fair", ecoScore: 80, price: 115.40, change: -0.8, divYield: 3.29, estimation: 120.00, ytd: 15.4, marketCap: 520 },
    { ticker: "CVX", fgos: 70, valuation: "Fair", ecoScore: 82, price: 155.20, change: -1.2, divYield: 4.12, estimation: 165.00, ytd: 4.2, marketCap: 285 },
    { ticker: "COP", fgos: 68, valuation: "Undervalued", ecoScore: 78, price: 112.50, change: 0.5, divYield: 3.01, estimation: 125.00, ytd: -2.5, marketCap: 132 },
    { ticker: "SLB", fgos: 65, valuation: "Undervalued", ecoScore: 75, price: 45.30, change: -1.5, divYield: 2.42, estimation: 55.00, ytd: -12.4, marketCap: 64 },
    { ticker: "EOG", fgos: 72, valuation: "Fair", ecoScore: 79, price: 125.60, change: 0.3, divYield: 2.89, estimation: 135.00, ytd: 3.8, marketCap: 72 },
    { ticker: "MPC", fgos: 74, valuation: "Fair", ecoScore: 76, price: 170.80, change: 0.9, divYield: 1.95, estimation: 180.00, ytd: 15.2, marketCap: 65 },
  ]
};

const generateFallbackStocks = (sector: string) => {
  return Array.from({ length: 6 }).map((_, i) => ({
    ticker: `${sector.substring(0,3).toUpperCase()}${i+1}`,
    fgos: Math.floor(Math.random() * (99 - 40) + 40),
    valuation: ["Undervalued", "Fair", "Overvalued"][Math.floor(Math.random() * 3)],
    ecoScore: Math.floor(Math.random() * (90 - 50) + 50),
    price: (Math.random() * 200 + 20).toFixed(2),
    change: (Math.random() * 5 - 2).toFixed(2),
    divYield: (Math.random() * 5).toFixed(2),
    estimation: (Math.random() * 250 + 20).toFixed(2),
    ytd: (Math.random() * 40 - 10).toFixed(1),
    marketCap: (Math.random() * 2000 + 10).toFixed(0)
  })).sort((a, b) => b.fgos - a.fgos);
};

export default function SectorAnalysisPanel({ onStockSelect }: { onStockSelect?: (symbol: string) => void }) {
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
    <div className="w-full h-full flex flex-col bg-tarjetas border border-white/5 border-b-0 rounded-none overflow-hidden shadow-sm">
      <Tabs defaultValue="Technology" onValueChange={setSelectedSector} className="w-full h-full flex flex-col">
        <div className="border-b border-white/10 shrink-0">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="bg-transparent h-auto p-0 flex min-w-full w-max">
              {SECTORS.map((sector) => (
                <TabsTrigger 
                  key={sector} 
                  value={sector} 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-400 data-[state=active]:text-orange-400 text-xs px-2 py-1 text-gray-400 hover:text-gray-200 transition-colors flex-1"
                >
                  {sector}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>

        <div className="py-1 border-b border-white/5 bg-white/[0.02] shrink-0">
          <h4 className="text-xs font-medium text-gray-400 text-center">
            Acciones del sector <span className="text-orange-400">{selectedSector}</span>
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
              {stocks.map((stock) => (
                <TableRow 
                  key={stock.ticker} 
                  className="border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => onStockSelect?.(stock.ticker)}
                >
                  <TableCell className="font-bold text-white px-2 py-0.5 text-xs">{stock.ticker}</TableCell>
                  <TableCell className="text-center px-2 py-0.5">
                    <Badge variant="outline" className={`text-[10px] border-0 px-1.5 py-0 h-5 font-bold ${getFgosColor(stock.fgos)}`}>
                      {stock.fgos}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-center px-2 py-0.5 text-[10px] font-medium ${getValuationColor(stock.valuation)}`}>
                    {stock.valuation}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-blue-400 font-bold">
                    {stock.ecoScore}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {Number(stock.divYield).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    ${Number(stock.estimation).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-xs font-mono text-white">
                    ${Number(stock.price).toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-right px-2 py-0.5 text-[10px] font-medium ${Number(stock.ytd) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {Number(stock.ytd) >= 0 ? "+" : ""}{Number(stock.ytd).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-[10px] text-gray-400">
                    {Number(stock.marketCap) > 1000 ? `${(Number(stock.marketCap)/1000).toFixed(1)}T` : `${Number(stock.marketCap)}B`}
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

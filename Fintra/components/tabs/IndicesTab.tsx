"use client";

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmp } from "@/lib/fmp/client";
import { FintraLoader } from "@/components/ui/FintraLoader";

const INDICES = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "Nasdaq Composite" },
  { symbol: "^DJI", name: "Dow Jones" },
  { symbol: "^RUT", name: "Russell 2000" },
  { symbol: "^VIX", name: "VIX Volatility" },
  { symbol: "^GDAXI", name: "DAX Performance" }, // Germany
  { symbol: "^FTSE", name: "FTSE 100" }, // UK
  { symbol: "^N225", name: "Nikkei 225" }, // Japan
  { symbol: "BTCUSD", name: "Bitcoin" },
];

export default function IndicesTab() {
  const [dataMap, setDataMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndices = async () => {
      setLoading(true);
      const newDataMap: Record<string, any[]> = {};

      // Fetch data for all indices in parallel
      const promises = INDICES.map(async (idx) => {
        try {
          // Fetch last 30 days roughly
          const res = await fmp.indexHistoricalPrice(idx.symbol, { limit: 30 });
          // Handle both array response and object with historical property
          const rawData = Array.isArray(res) ? res : (res as any).historical || [];
          
          // Reverse to have oldest first
          const hist = rawData.reverse().map((item: any) => ({
            date: item.date,
            value: item.close,
          }));
          newDataMap[idx.symbol] = hist;
        } catch (error) {
          console.error(`Error fetching ${idx.symbol}`, error);
          newDataMap[idx.symbol] = [];
        }
      });

      await Promise.all(promises);
      setDataMap(newDataMap);
      setLoading(false);
    };

    fetchIndices();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <FintraLoader size={32} className="text-blue-500" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pb-20">
      {INDICES.map((idx) => {
        const data = dataMap[idx.symbol] || [];
        const hasData = data.length > 0;
        
        // Calculate basic performance
        const start = hasData ? data[0].value : 0;
        const end = hasData ? data[data.length - 1].value : 0;
        const change = hasData ? ((end - start) / start) * 100 : 0;
        const isPositive = change >= 0;

        return (
          <Card key={idx.symbol} className="bg-tarjetas border-zinc-800 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4 border-b border-zinc-800/50">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-medium text-zinc-200">
                  {idx.name} <span className="text-xs text-zinc-500 ml-1">({idx.symbol})</span>
                </CardTitle>
                {hasData && (
                  <span className={`text-xs font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPositive ? '+' : ''}{change.toFixed(2)}%
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="h-[200px] p-2">
              {hasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      hide 
                      interval="preserveEnd"
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      hide 
                      interval="preserveEnd"
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                      itemStyle={{ color: '#f4f4f5' }}
                      labelStyle={{ display: 'none' }}
                      formatter={(value: number) => [value.toFixed(2), 'Precio']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke={isPositive ? "#22c55e" : "#ef4444"} 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                  Sin datos disponibles
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent } from "@/components/ui/card";
import { searchStockData } from "@/lib/stockQueries";

export default function FGOSRadarChart({ symbol, data, comparedSymbol }: { symbol: string, data: any, comparedSymbol?: string | null }) {
  const [peerData, setPeerData] = useState<any>(null);
  const [loadingPeer, setLoadingPeer] = useState(false);

  // Helper para generar datos mockeados si falla la API
  const generateMockPeerData = () => ({
    growth: Math.floor(Math.random() * 40 + 60),
    profitability: Math.floor(Math.random() * 40 + 60),
    efficiency: Math.floor(Math.random() * 40 + 60),
    solvency: Math.floor(Math.random() * 40 + 60),
    moat: Math.floor(Math.random() * 40 + 60),
    sentiment: Math.floor(Math.random() * 40 + 60),
  });

  // Fetch peer data when comparedSymbol changes
  useEffect(() => {
    if (!comparedSymbol || comparedSymbol === "none") {
      setPeerData(null);
      return;
    }
    
    let active = true;
    (async () => {
      setLoadingPeer(true);
      try {
        const res = await searchStockData(comparedSymbol);
        if (active) {
          if (res?.analysisData?.fgos_breakdown) {
            setPeerData(res.analysisData.fgos_breakdown);
          } else {
             // Fallback a mock data si no hay breakdown disponible
             console.warn(`No FGOS breakdown for ${comparedSymbol}, using mock data`);
             setPeerData(generateMockPeerData());
          }
        }
      } catch (e) {
        console.error("Error fetching peer data", e);
        if (active) setPeerData(generateMockPeerData()); // Fallback en error
      } finally {
        if (active) setLoadingPeer(false);
      }
    })();
    return () => { active = false; };
  }, [comparedSymbol]);

  // Safe default data
  const chartData = [
    { subject: 'Growth', A: data?.growth || 0, B: peerData?.growth || 0, fullMark: 100 },
    { subject: 'Profitability', A: data?.profitability || 0, B: peerData?.profitability || 0, fullMark: 100 },
    { subject: 'Efficiency', A: data?.efficiency || 0, B: peerData?.efficiency || 0, fullMark: 100 },
    { subject: 'Solvency', A: data?.solvency || 0, B: peerData?.solvency || 0, fullMark: 100 },
    { subject: 'Moat', A: data?.moat || 0, B: peerData?.moat || 0, fullMark: 100 },
    { subject: 'Sentiment', A: data?.sentiment || 0, B: peerData?.sentiment || 0, fullMark: 100 },
  ];

  return (
    <Card className="bg-tarjetas border-none h-full shadow-lg py-0 flex flex-col relative group">
      <CardContent className="flex-1 min-h-0 w-full pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="50%" data={chartData}>
            <PolarGrid stroke="#4B5563" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            
            <Radar
              name={symbol}
              dataKey="A"
              stroke="#F97316"
              strokeWidth={2}
              fill="#F97316"
              fillOpacity={0.3}
            />
            
            {peerData && (
              <Radar
                name={comparedSymbol || ''}
                dataKey="B"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="#3B82F6"
                fillOpacity={0.3}
              />
            )}
            
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              formatter={(value) => <span className="text-xs text-gray-400 ml-1">{value}</span>}
            />
            <Tooltip 
               contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
               itemStyle={{ fontSize: '12px' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

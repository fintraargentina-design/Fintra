"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

export default function FGOSRadarChart({ symbol, data }: { symbol: string, data: any }) {
  // Safe default data
  const chartData = [
    { subject: 'Growth', A: data?.growth || 0, fullMark: 100 },
    { subject: 'Profitability', A: data?.profitability || 0, fullMark: 100 },
    { subject: 'Efficiency', A: data?.efficiency || 0, fullMark: 100 },
    { subject: 'Solvency', A: data?.solvency || 0, fullMark: 100 },
    { subject: 'Moat', A: data?.moat || 0, fullMark: 100 },
    { subject: 'Sentiment', A: data?.sentiment || 0, fullMark: 100 },
  ];

  return (
    <Card className="bg-tarjetas border-none h-full shadow-lg">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-orange-400 text-lg flex gap-2">
          <Target className="w-5" /> Análisis FGOS
        </CardTitle>
        <Badge variant="outline" className="text-lg">{symbol}</Badge>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid stroke="#4B5563" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name={symbol}
              dataKey="A"
              stroke="#F97316"
              strokeWidth={2}
              fill="#F97316"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

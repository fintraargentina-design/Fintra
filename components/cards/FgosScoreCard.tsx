import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ScoreRowProps {
  label: string;
  value: number;
  color?: string;
}

const ScoreRow = ({ label, value, color = 'bg-blue-500' }: ScoreRowProps) => (
  <div className="space-y-1">
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value.toFixed(1)}/100</span>
    </div>
    <Progress value={value} className="h-2" indicatorClassName={color} />
  </div>
);

interface FgosScoreCardProps {
  score: number;
  valuationStatus: string;
  breakdown: {
    growth: { score: number };
    profitability: { score: number };
    efficiency: { score: number };
    financialHealth: { score: number };
    valuation: { score: number };
  };
}

export default function FgosScoreCard({ score, valuationStatus, breakdown }: FgosScoreCardProps) {
  const getScoreColor = (s: number) => {
    if (s >= 70) return 'text-green-500';
    if (s >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'undervalued': return 'default'; // dark/black usually
      case 'overvalued': return 'destructive'; // red
      case 'fair': return 'secondary'; // gray
      default: return 'outline';
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex justify-between items-center text-lg">
          <span>FGOS Score</span>
          <Badge variant={getBadgeVariant(valuationStatus)}>
            {valuationStatus || 'N/A'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center mb-6 mt-2">
          <div className={`text-5xl font-bold ${getScoreColor(score)}`}>
            {score?.toFixed(0) || 0}
          </div>
          <span className="text-sm text-muted-foreground mt-1">Puntuación General</span>
        </div>
        
        <div className="space-y-4">
          <ScoreRow 
            label="Crecimiento" 
            value={breakdown?.growth?.score || 0} 
            color="bg-emerald-500" 
          />
          <ScoreRow 
            label="Rentabilidad" 
            value={breakdown?.profitability?.score || 0} 
            color="bg-blue-500" 
          />
          <ScoreRow 
            label="Eficiencia" 
            value={breakdown?.efficiency?.score || 0} 
            color="bg-indigo-500" 
          />
          <ScoreRow 
            label="Salud Financiera" 
            value={breakdown?.financialHealth?.score || 0} 
            color="bg-purple-500" 
          />
          <ScoreRow 
            label="Valoración" 
            value={breakdown?.valuation?.score || 0} 
            color="bg-amber-500" 
          />
        </div>
      </CardContent>
    </Card>
  );
}

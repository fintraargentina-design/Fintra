'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmp } from '@/lib/fmp/client';
import type { PerformanceResponse } from '@/lib/fmp/types';

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const PERIODS = ['1M', '3M', 'YTD', '1Y', '3Y', '5Y'] as const;
type Period = typeof PERIODS[number];

/**
 * Función para obtener el color basado en el score de desempeño
 */
function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e'; // Verde
  if (score >= 40) return '#f59e0b'; // Amarillo
  return '#ef4444'; // Rojo
}

/**
 * Función para obtener el nivel basado en el score de desempeño
 */
function getScoreLevel(score: number): string {
  if (score >= 70) return 'Positivo';
  if (score >= 40) return 'Neutral';
  return 'Negativo';
}

/**
 * Función para calcular el score de desempeño basado en el retorno
 */
function gradeFromReturn(period: Period, retPct: number | null): number {
  if (retPct == null || !Number.isFinite(retPct)) return 50;
  
  const SCALE: Record<Period, { min: number; max: number }> = {
    '1M': { min: -20, max: 20 },
    '3M': { min: -30, max: 30 },
    'YTD': { min: -50, max: 50 },
    '1Y': { min: -50, max: 50 },
    '3Y': { min: -60, max: 60 },
    '5Y': { min: -100, max: 150 },
  };
  
  const { min, max } = SCALE[period];
  const score01 = (retPct - min) / (max - min);
  return Math.max(0, Math.min(100, Math.round(100 * Math.max(0, Math.min(1, score01)))));
}

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────
export default function DesempenoCard({ symbol }: { symbol: string }) {
  const [data, setData] = React.useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    
    fmp.performance(symbol, 'force-cache')
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [symbol]);

  /**
   * Función para construir las métricas de desempeño para mostrar en tarjetas
   */
  const buildPerformanceMetrics = () => {
    if (!data?.returns) return [];
    
    return PERIODS.map(period => {
      const ret = data.returns[period];
      const score = gradeFromReturn(period, ret);
      
      return {
        label: `${period}`,
        value: ret,
        display: ret != null ? `${ret.toFixed(2)}%` : 'N/A',
        score,
        period
      };
    });
  };

  const performanceMetrics = buildPerformanceMetrics();

  return (
    <Card className="bg-tarjetas border-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-orange-400 text-lg flex items-center gap-2">
          <div className="text-gray-400">
           Desempeño
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="h-32 grid place-items-center text-gray-500 text-sm">
            Cargando datos de desempeño...
          </div>
        ) : !data ? (
          <div className="h-32 grid place-items-center text-gray-500 text-sm">
            No hay datos disponibles
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-3">
            {performanceMetrics.map((metric, index) => {
              const scoreColor = getScoreColor(metric.score);
              const scoreLevel = getScoreLevel(metric.score);
              
              return (
                <div 
                  key={index} 
                  className="bg-gray-800/50 rounded p-3 hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-gray-400 text-xs">{metric.label}</div>
                    <div 
                      className="text-xs text-gray-500"
                      style={{ color: scoreColor }}
                    >
                      {scoreLevel}
                    </div>
                  </div>
                  <div 
                    className="font-mono text-lg mt-1"
                    style={{ color: scoreColor }}
                  >
                    {metric.display}
                  </div>                    
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

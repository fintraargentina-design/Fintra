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
      .then((d) => { 
        console.log(`[DesempenoCard] Data received for ${symbol}:`, d);
        if (alive) setData(d); 
      })
      .catch((err) => { 
        console.error(`[DesempenoCard] Error fetching for ${symbol}:`, err);
        if (alive) setData(null); 
      })
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
        label: `Desempeño ${period}`,
        value: ret,
        display: ret != null ? `${ret.toFixed(2)}%` : 'N/A',
        score,
        period
      };
    });
  };

  const performanceMetrics = buildPerformanceMetrics();
  console.log(`[DesempenoCard] Metrics built for ${symbol}:`, performanceMetrics);

  const getHeatmapColor = (score: number) => {
    if (score >= 90) return "#008000"; 
    if (score >= 80) return "#006600"; 
    if (score >= 70) return "#004D00"; 
    if (score >= 60) return "#003300"; 
    if (score >= 50) return "#001A00"; 
    if (score <= 10) return "#800000"; 
    if (score <= 20) return "#660000"; 
    if (score <= 30) return "#4D0000"; 
    if (score <= 40) return "#330000"; 
    return "#1A0000";
  };

  return (
    <div className="w-full">
      {loading ? (
        <div className="h-32 grid place-items-center text-gray-500 text-sm">
          Cargando datos de desempeño...
        </div>
      ) : !data ? (
        <div className="h-32 grid place-items-center text-gray-500 text-sm">
          No hay datos disponibles
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 border-b border-zinc-800">
          {/* Rellenar con elementos vacíos si hay menos de 6 para mantener alineación */}
          {[...performanceMetrics, ...Array(Math.max(0, 6 - performanceMetrics.length)).fill(null)].map((metric, index) => {
            if (!metric) {
               return <div key={`empty-${index}`} className="bg-transparent border-r border-zinc-800 last:border-r-0 h-24" />;
            }
            
            const scoreLevel = getScoreLevel(metric.score);
            
            return (
              <div 
                key={index} 
                className="relative flex flex-col items-center justify-center px-3 py-4 gap-2 cursor-pointer hover:brightness-110 transition-all border-r border-zinc-800 last:border-r-0 h-24"
                style={{ backgroundColor: getHeatmapColor(metric.score) }}
              >
                <div className="text-white/70 text-[10px] font-medium text-center leading-none line-clamp-1 uppercase tracking-wider">
                  {metric.label}
                </div>
                <div className="text-white text-lg font-bold tracking-tight leading-none">
                  {metric.display}
                </div>
                <div className="text-[9px] text-white/90 font-medium uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded leading-none">
                  {scoreLevel}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

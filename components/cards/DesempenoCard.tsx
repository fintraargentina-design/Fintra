'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import * as echarts from 'echarts/core';
import { GaugeChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmp } from '@/lib/fmp/client';
import type { PerformanceResponse } from '@/lib/fmp/types';

echarts.use([GaugeChart, TooltipComponent, CanvasRenderer]);
const ReactEChartsCore = dynamic(() => import('echarts-for-react/lib/core'), { ssr: false });

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const PERIODS = ['1M', '3M', 'YTD', '1Y', '3Y', '5Y'] as const;
type Period = typeof PERIODS[number];

const SCALE: Record<Period, { min: number; max: number }> = {
  '1M': { min: -20, max: 20 },
  '3M': { min: -30, max: 30 },
  'YTD': { min: -50, max: 50 },
  '1Y': { min: -50, max: 50 },
  '3Y': { min: -60, max: 60 },
  '5Y': { min: -100, max: 150 },
};


const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clamp100 = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

const toGaugeValue = (period: Period, retPct: number | null): number => {
  if (retPct == null || !Number.isFinite(retPct)) return 0.5;
  const { min, max } = SCALE[period];
  return clamp01((retPct - min) / (max - min));
};

function gradeFromReturn(period: Period, retPct: number | null): number {
  if (retPct == null || !Number.isFinite(retPct)) return 50;
  const { min, max } = SCALE[period];
  const score01 = (retPct - min) / (max - min);
  return clamp100(100 * clamp01(score01));
}

function labelFromGrade(g: number) {
  if (g >= 67) return { text: 'Positivo', color: '#22c55e' };
  if (g < 33) return { text: 'Negativo', color: '#ef4444' };
  return { text: 'Neutral', color: '#f59e0b' };
}

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────
export default function DesempenoCard({ symbol }: { symbol: string }) {
  const [data, setData] = React.useState<PerformanceResponse | null>(null);
  const [active, setActive] = React.useState<Period>('1M');
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

  const ret = data?.returns?.[active] ?? null;
  const grade = gradeFromReturn(active, ret);       
  const sentiment = labelFromGrade(grade); 
  
  const gaugeVal = grade / 100;                     
  const grade100 = grade; 

  // Opción idéntica al ejemplo “gauge-grade”
  const option = React.useMemo(() => ({
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge' as const,
        startAngle: 180,
        endAngle: 0,
        center: ['50%', '72%'],
        radius: '90%',
        min: 0,
        max: 1,
        splitNumber: 8,
        axisLine: {
          lineStyle: {
            width: 6,
            color: [
              [0.320, 'rgba(239,68,68,0.30)'], // D
              [0.690, 'rgba(234,179,8,0.30)'], // C
              [1.00, 'rgba(34,197,94,0.30)'], // A
            ],
          },
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '18%',
          width: 10,
          offsetCenter: [0, '-40%'],
          itemStyle: { color: 'auto' },
        },
        axisTick: {
          length: 12,
          lineStyle: { color: 'auto', width: 1 },
        },
        splitLine: {
          length: 20,
          lineStyle: { color: 'auto', width: 2 },
        },
        axisLabel: {
          color: '#9ca3af',
          fontSize: 12,
          distance: -40,
          rotate: 'tangential',
          formatter: (value: number) => {
            // mismas posiciones que el ejemplo
            /* if (value === 0.875) return 'Grade A';
            if (value === 0.500) return 'Grade B';
            if (value === 0.125) return 'Grade C'; */
            return '';
          },
        },
        title: {
          offsetCenter: [0, '20'],
          fontSize: 12,
          color: '#cbd5e1',
        },
        detail: {
          fontSize: 18,
          offsetCenter: [0, '-15%'],
          valueAnimation: true,
          formatter: () => String(grade100),
          color: 'auto', // número central (celeste)

        },
        data: [{ value: gaugeVal, name: 'Rating' }],
      },
    ],
  }), [gaugeVal, grade100]);

  return (
    <Card className="bg-tarjetas border-none h-[360px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-orange-400 text-lg">Desempeño — {symbol}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Píldoras de periodo */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setActive(p)}
              className={[
                'px-3 py-1 text-sm border-none transition-colors',
                p === active
                  ? 'bg-orange-500/20 border-orange-400 text-orange-300'
                  : 'bg-transparent border-gray-700 text-gray-300 hover:bg-orange-700/40',
              ].join(' ')}
              aria-label={`Periodo ${p}`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Gauge + barra horizontal de info */}
        <div className="flex flex-col items-center justify-center">

          <div className="w-full h-[220px]">  
            {loading ? (
              <div className="h-full grid place-items-center text-gray-500 text-sm">Cargando…</div>
            ) : (
              <ReactEChartsCore
                echarts={echarts as any}
                option={option as any}
                style={{ height: '100%', width: '100%' }}
              />
            )}
          </div>

          {/* Barra horizontal debajo del gauge */}  
          <div className="flex items-center justify-center gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Periodo</span>
              <span className="text-gray-200 font-medium">{active}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-400">Retorno</span>
              {ret == null ? (
                <span className="text-gray-500">N/A</span>
              ) : (
                <span className={ret >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {ret.toFixed(2)}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-400">Evaluación</span>
              <span className="font-medium" style={{ color: sentiment.color }}>
                {sentiment.text}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

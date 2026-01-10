'use client';
// Fintra/components/cards/DividendosCard.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  ScatterChart,
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CalendarComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { BanknoteIcon, CalendarDays, History } from 'lucide-react';

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CalendarComponent,
  CanvasRenderer,
]);

const ReactECharts = dynamic(() => import('echarts-for-react/lib/core'), { ssr: false });

type View = 'historico' | 'calendario' | 'payout';

// Internal type matching the UI needs (similar to FMP response but adapted)
interface DividendData {
  dpsByYear: { year: number; dps: number }[];
  yieldByYear: { year: number; yield: number | null }[];
  payout: { eps: number | null; fcf: number | null };
  yieldTTM: number | null;
  exDates: string[]; // Kept for type compatibility, though empty
}

export default function DividendosCard({ symbol }: { symbol: string }) {
  const [data, setData] = React.useState<DividendData | null>(null);
  const [view, setView] = React.useState<View>('historico');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);

    async function fetchData() {
      try {
        const { data: rows, error } = await supabase
          .from('datos_dividendos')
          .select('*')
          .eq('ticker', symbol)
          .order('year', { ascending: true });

        if (error) throw error;

        if (alive && rows) {
          // Map rows to UI structure
          const dpsByYear = rows.map((r) => ({ 
            year: r.year, 
            dps: r.dividend_per_share 
          }));
          
          const yieldByYear = rows.map((r) => ({ 
            year: r.year, 
            yield: r.dividend_yield 
          }));

          // Use latest year for payout snapshot
          const latest = rows[rows.length - 1];

          setData({
            dpsByYear,
            yieldByYear,
            payout: {
              eps: latest?.payout_eps ?? null,
              fcf: latest?.payout_fcf ?? null,
            },
            yieldTTM: latest?.dividend_yield ?? null,
            exDates: [], // No calendar data in annual records
          });
        }
      } catch (err) {
        console.error(`[DividendosCard] Error fetching for ${symbol}:`, err);
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchData();

    return () => { alive = false; };
  }, [symbol]);

  // ────────────────── Opciones de gráficos ──────────────────
  const optionHistorico = React.useMemo(() => {
    const years = (data?.dpsByYear ?? []).map((x) => String(x.year)); // Removed reverse() as data is ordered ascending
    const dps = (data?.dpsByYear ?? []).map((x) => +(x.dps ?? 0).toFixed(2));
    const yld = (data?.yieldByYear ?? []).map((x) => (x.yield == null ? null : +(+x.yield).toFixed(2)));

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' as const },
      // legend: {  // <- Comentar o quitar esta sección completa
      //   data: ['Dividendos', 'Yield'],
      //   textStyle: { color: '#9ca3af' },
      // },
      grid: { left: 40, right: 50, top: 32, bottom: 28 },
      xAxis: {
        type: 'category' as const,
        data: years,
        axisLabel: { color: '#9ca3af' },
        axisLine: { lineStyle: { color: '#4b5563' } },
      },
      yAxis: [
        {
          type: 'value' as const,
          name: 'Div. por acción',
          axisLabel: { color: '#9ca3af' },
          splitLine: { lineStyle: { color: 'rgba(75,85,99,0.3)' } },
        },
        {
          type: 'value' as const,
          name: 'Yield %',
          axisLabel: { formatter: '{value}%', color: '#9ca3af' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Dividendos',
          type: 'bar' as const,
          data: dps,
          barWidth: '55%',
          itemStyle: { color: '#60a5fa' },
        },
        {
          name: 'Yield',
          type: 'line' as const,
          yAxisIndex: 1,
          data: yld,
          smooth: true,
          itemStyle: { color: '#f59e0b' },
          connectNulls: true,
          areaStyle: { opacity: 0.08 },
        },
      ],
    };
  }, [data]);

  const optionPayout = React.useMemo(() => {
    const eps = data?.payout?.eps ?? null;
    const fcf = data?.payout?.fcf ?? null;

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
      grid: { left: 40, right: 20, top: 20, bottom: 28 },
      xAxis: {
        type: 'category' as const,
        data: ['Payout EPS', 'Payout FCF'],
        axisLabel: { color: '#9ca3af' },
        axisLine: { lineStyle: { color: '#4b5563' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: '{value}%', color: '#9ca3af' },
        splitLine: { lineStyle: { color: 'rgba(75,85,99,0.3)' } },
        max: 150,
      },
      series: [{
        type: 'bar' as const,
        data: [eps, fcf],
        barWidth: '40%',
        itemStyle: {
          color: (params: any) => {
            const v = params.value as number | null;
            if (v == null) return 'rgba(148,163,184,0.3)';
            if (v <= 40) return '#22c55e';
            if (v <= 60) return '#f59e0b';
            return '#ef4444';
          },
        },
        label: {
          show: true,
          position: 'top',
          color: '#cbd5e1',
          formatter: (p: any) => (p.value == null ? 'N/A' : `${p.value}%`),
        },
        markArea: {
          silent: true,
          data: [
            [{ yAxis: 0 }, { yAxis: 40 }],
            [{ yAxis: 40 }, { yAxis: 60 }],
            [{ yAxis: 60 }, { yAxis: 150 }],
          ],
          itemStyle: {
            color: (params: any) => {
              const y0 = params?.[0]?.yAxis ?? 0;
              if (y0 === 0) return 'rgba(34,197,94,0.08)';
              if (y0 === 40) return 'rgba(245,158,11,0.08)';
              return 'rgba(239,68,68,0.08)';
            },
          },
        },
      }],
    };
  }, [data]);

  return (
    <div className="h-[360px] bg-tarjetas border-none">
      <div className="pb-2 px-6 pt-6 flex flex-row items-center justify-between">
        <div className="text-[#FFA028] text-lg flex items-center gap-2">
          <div className="text-gray-400">
           Dividendos
          </div>
          </div>
        <div className="flex gap-2" role="tablist" aria-label="Vistas de dividendos">
          <button
            onClick={() => setView('historico')}
            role="tab"
            aria-selected={view === 'historico'}
            className={[
              'group inline-flex items-center gap-2 px-3 py-1 text-sm rounded transition-colors',
              view === 'historico'
                ? 'bg-[#FFA028]/20 text-[#FFA028]'
                : 'text-gray-300 hover:bg-gray-700/40'
            ].join(' ')}
            title="Histórico"
          >
            <History className="h-4 w-4" />
          </button>

          <button
            onClick={() => setView('calendario')}
            role="tab"
            aria-selected={view === 'calendario'}
            className={[
              'group inline-flex items-center gap-2 px-3 py-1 text-sm rounded transition-colors',
              view === 'calendario'
                ? 'bg-[#FFA028]/20 text-[#FFA028]'
                : 'text-gray-300 hover:bg-gray-700/40'
            ].join(' ')}
            title="Calendario de pagos"
          >
            <CalendarDays className="h-4 w-4" />
          </button>

          <button
            onClick={() => setView('payout')}
            role="tab"
            aria-selected={view === 'payout'}
            className={[
              'group inline-flex items-center gap-2 px-3 py-1 text-sm rounded transition-colors',
              view === 'payout'
                ? 'bg-[#FFA028]/20 text-[#FFA028]'
                : 'text-gray-300 hover:bg-gray-700/40'
            ].join(' ')}
            title="Payout"
          >
            <BanknoteIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="pt-0 px-6 pb-6">
        <div style={{ height: 260, width: '100%' }}>
          {loading ? (
            <div className="h-32 grid place-items-center text-gray-500 text-sm">Cargando datos de Dividendos...</div>
          ) : view === 'calendario' ? (
             <div className="h-full grid place-items-center text-gray-500 text-sm p-4 text-center">
               El calendario de dividendos futuros no está disponible en la vista histórica.
               <br/>
               Consulte su broker para fechas ex-dividend próximas.
             </div>
          ) : (
            <ReactECharts
              echarts={echarts}
              option={
                view === 'historico'
                  ? optionHistorico
                  : optionPayout
              }
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </div>
        {/* Pie con datos claves */}
        {view === 'historico' && (
          <div className="mt-3 text-xs text-gray-400">
            Yield TTM: {data?.yieldTTM == null ? 'N/A' : `${data.yieldTTM}%`}.  Años: {data?.dpsByYear?.length ?? 0}.
          </div>
        )}
      </div>
    </div>
  );
}

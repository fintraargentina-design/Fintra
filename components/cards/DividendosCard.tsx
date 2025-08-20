'use client';

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
import { fmp } from '@/lib/fmp/client';
import type { DividendsResponse } from '@/lib/fmp/types';
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

export default function DividendosCard({ symbol }: { symbol: string }) {
  const [data, setData] = React.useState<DividendsResponse | null>(null);
  const [view, setView] = React.useState<View>('historico');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fmp.dividends(symbol, 'force-cache')
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [symbol]);

  // ────────────────── Opciones de gráficos ──────────────────
  const optionHistorico = React.useMemo(() => {
    const years = (data?.dpsByYear ?? []).map(x => String(x.year));
    const dps = (data?.dpsByYear ?? []).map(x => +(x.dps ?? 0).toFixed(2));
    const yld = (data?.yieldByYear ?? []).map(x => (x.yield == null ? null : +(+x.yield).toFixed(2)));

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' as const },
      legend: {
        data: ['Dividendos', 'Yield'],
        textStyle: { color: '#9ca3af' },
      },
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

  const optionCalendario = React.useMemo(() => {
    // calendario del año actual con ex-dates
    const exDates = (data?.exDates ?? []).filter(Boolean);
    const year = new Date().getFullYear();
    const range: [string, string] = [`${year}-01-01`, `${year}-12-31`];

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        formatter: (p: any) => {
          const date = Array.isArray(p?.value) ? p.value[0] : (p?.name ?? '');
          return date ? `Ex-Date: ${date}` : '';
        },
      },
      calendar: [{
        top: 40,
        left: 30,
        right: 30,
        cellSize: ['auto', 18],
        range,
        itemStyle: { color: 'rgba(31,41,55,0.6)', borderColor: 'rgba(75,85,99,0.5)' },
        dayLabel: { color: '#9ca3af' },
        monthLabel: { color: '#9ca3af' },
        yearLabel: { color: '#9ca3af' },
      }],
      series: [{
        type: 'scatter' as const,
        coordinateSystem: 'calendar' as const,
        symbolSize: 6,
        itemStyle: { color: '#22c55e' },
        data: exDates
          .filter(d => String(d).startsWith(String(year)))
          .map(d => [d, 1] as [string, number]),
      }],
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

  const option =
    view === 'historico' ? optionHistorico :
    view === 'calendario' ? optionCalendario :
    optionPayout;

  return (
    <Card className="bg-tarjetas border-none">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-orange-400 text-lg">Dividendos — {symbol}</CardTitle>
        <div className="flex gap-2" role="tablist" aria-label="Vistas de dividendos">
          <button
            onClick={() => setView('historico')}
            role="tab"
            aria-selected={view === 'historico'}
            className={[
              'group inline-flex items-center gap-2 px-3 py-1 text-sm rounded transition-colors',
              view === 'historico'
                ? 'bg-orange-500/20 text-orange-300'
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
                ? 'bg-orange-500/20 text-orange-300'
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
                ? 'bg-orange-500/20 text-orange-300'
                : 'text-gray-300 hover:bg-gray-700/40'
            ].join(' ')}
            title="Payout"
          >
            <BanknoteIcon className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div style={{ height: 260, width: '100%' }}>
          {loading ? (
            <div className="h-full grid place-items-center text-gray-500 text-sm">Cargando…</div>
          ) : (
            <ReactECharts
              key={view}                // <- fuerza crear una instancia nueva al cambiar de vista
              echarts={echarts as any}
              option={option as any}
              notMerge={true}
              lazyUpdate={true}
              style={{ height: '100%', width: '100%' }}
            />
          )}
        </div>
        {/* Pie con datos claves */}
        {view === 'historico' && (
          <div className="mt-3 text-xs text-gray-400">
            Yield TTM: {data?.yieldTTM == null ? 'N/A' : `${data.yieldTTM}%`}.  Años: {data?.dpsByYear?.length ?? 0}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as echarts from 'echarts/core';
import { BarChart, CustomChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, CustomChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const ReactEChartsCore = dynamic(() => import('echarts-for-react/lib/core'), { ssr: false });

export type BulletItem = {
  label: string;        // nombre del indicador
  value: number | null; // 0..100 (score)
  target?: number | null; // 0..100 (línea vertical)
  // thresholds define bandas de color del fondo (malo/promedio/bueno)
  thresholds?: { poor: number; avg: number }; // por defecto {40,70}
};

export default function BulletChartEcharts({ items }: { items: BulletItem[] }) {
  const categories = items.map(i => i.label);

  const poor = items.map(i => Math.min(i.thresholds?.poor ?? 40, 100));
  const avg = items.map(i => {
    const p = i.thresholds?.poor ?? 40;
    const a = i.thresholds?.avg ?? 70;
    return Math.max(Math.min(a, 100) - Math.min(p, 100), 0);
  });
  const good = items.map((_, idx) => {
    const a = items[idx].thresholds?.avg ?? 70;
    return Math.max(100 - Math.min(a, 100), 0);
  });
  const values = items.map(i => (i.value == null ? null : Math.max(0, Math.min(100, i.value))));
  const targetsData = items
    .map((i, idx) => (i.target == null ? null : [idx, Math.max(0, Math.min(100, i.target!))]))
    .filter(Boolean) as [number, number][];

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { left: 120, right: 30, top: 10, bottom: 10, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const i = params[0]?.dataIndex ?? 0;
        const v = values[i];
        const t = items[i].target;
        return `
          <div>
            <b>${items[i].label}</b><br/>
            Valor: ${v == null ? 'N/A' : Math.round(v)} / 100<br/>
            Target: ${t == null ? '—' : Math.round(t)} / 100
          </div>
        `;
      }
    },
    xAxis: { type: 'value', min: 0, max: 100, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'category', data: categories, axisTick: { show: false }, axisLine: { show: false } },
    legend: { show: false },
    series: [
      // fondos (malo / medio / bueno) apilados
      {
        name: 'poor',
        type: 'bar',
        stack: 'bg',
        barWidth: 14,
        itemStyle: { color: 'rgba(239,68,68,0.35)' }, // rojo 500/35%
        emphasis: { disabled: true },
        silent: true,
        data: poor
      },
      {
        name: 'avg',
        type: 'bar',
        stack: 'bg',
        barWidth: 14,
        itemStyle: { color: 'rgba(234,179,8,0.35)' }, // amarillo 500/35%
        emphasis: { disabled: true },
        silent: true,
        data: avg
      },
      {
        name: 'good',
        type: 'bar',
        stack: 'bg',
        barWidth: 14,
        itemStyle: { color: 'rgba(34,197,94,0.35)' }, // verde 500/35%
        emphasis: { disabled: true },
        silent: true,
        data: good
      },
      // medida (valor)
      {
        name: 'valor',
        type: 'bar',
        barWidth: 10,
        barGap: '-100%', // superponer sobre fondo
        itemStyle: { color: 'rgba(255,255,255,0.8)' },
        data: values.map(v => (v == null ? 0 : v)),
        z: 3
      },
      // target marker (línea vertical por fila)
      {
        name: 'target',
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const yIdx = api.value(0);
          const xVal = api.value(1);
          const p = api.coord([xVal, yIdx]);        // punto (x,y) en coords
          const size = api.size([0, 1]);            // alto de la categoría
          return {
            type: 'rect',
            shape: {
              x: p[0] - 1,
              y: p[1] - size[1] / 2,
              width: 2,
              height: size[1]
            },
            style: { fill: '#ffffff' }
          };
        },
        encode: { x: 1, y: 0 },
        data: targetsData,
        z: 10,
        silent: true
      }
    ]
  }), [categories.join('|'), JSON.stringify(values), JSON.stringify(poor), JSON.stringify(avg), JSON.stringify(good), JSON.stringify(targetsData)]);

  return <ReactEChartsCore echarts={echarts as any} option={option as any} notMerge lazyUpdate style={{ width: '100%', height: 360 }} />;
}

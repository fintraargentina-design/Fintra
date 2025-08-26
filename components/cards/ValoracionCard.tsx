// components/cards/ValoracionCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmp } from "@/lib/fmp/client";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);
const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

type Row = {
  label: string;
  raw: number | null;
  unit?: "%" | "x";
  score: number | null;
  thresholds: { poor: number; avg: number };
  display: string;
  target?: number | null;
};

const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, x));
const ratioBetterLow = (x?: number | null, maxGood = 10, maxBad = 50) => {
  if (x == null) return null;
  const v = Math.min(Math.max(x, 0), maxBad);
  const score = ((maxBad - v) / (maxBad - maxGood)) * 100;
  return clamp(score);
};
const fmt = (v: number | null | undefined, unit?: "%" | "x") =>
  v == null ? "N/A" : unit === "%" ? `${v.toFixed(2)}%` : `${v.toFixed(2)}x`;

// Normalizaciones seguras (evita NaN/Infinity)
const numOrNull = (x: any): number | null => {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

// Función para obtener el texto del nivel de score
const getScoreLevel = (score: number | null): string => {
  if (score == null) return "Sin datos";
  if (score >= 70) return "Fuerte";
  if (score >= 40) return "Medio";
  return "Débil";
};

// Diccionario de explicaciones para las métricas de valoración
const METRIC_EXPLANATIONS: Record<string, string> = {
  "P/E (PER)": "Price-to-Earnings Ratio - Compara el precio de la acción con las ganancias por acción. Un P/E bajo puede indicar que la acción está infravalorada.",
  "P/E forward": "P/E basado en ganancias futuras estimadas. Útil para evaluar el valor basado en expectativas de crecimiento.",
  "PEG": "Price/Earnings to Growth - Relaciona el P/E con la tasa de crecimiento. Un PEG menor a 1 sugiere que la acción puede estar infravalorada.",
  "P/Book (P/B)": "Price-to-Book Ratio - Compara el precio con el valor contable. Un P/B bajo puede indicar una oportunidad de valor.",
  "P/S (Ventas)": "Price-to-Sales Ratio - Relaciona la capitalización con los ingresos. Útil para empresas con bajos beneficios o pérdidas.",
  "P/FCF": "Price-to-Free Cash Flow - Compara el precio con el flujo de caja libre. Importante para evaluar la capacidad real de generar efectivo.",
  "EV/EBITDA": "Enterprise Value to EBITDA - Múltiplo que considera la deuda. Útil para comparar empresas con diferentes estructuras de capital.",
  "EV/Ventas": "Enterprise Value to Sales - Similar al P/S pero considerando la deuda total de la empresa.",
  "Dividend Yield": "Rendimiento por dividendo - Porcentaje de dividendos anuales respecto al precio de la acción. Importante para inversores que buscan ingresos.",
  "Crecimiento implícito": "Tasa de crecimiento que justificaría el precio actual de la acción según modelos de valoración.",
  "Descuento vs. PT": "Descuento del precio actual respecto al precio objetivo de los analistas. Un descuento alto puede indicar oportunidad."
};

export default function ValoracionCard({ symbol }: { symbol: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('🔍 Cargando valoración para:', symbol);
        
        // Cambiar de fmp.ratios a fmp.valuation
        const valuation = await fmp.valuation(symbol, { period: "annual" });
        console.log('📊 Datos de valoración recibidos:', valuation);
        
        // Verificar si hay error en la respuesta
        if (valuation.error) {
          throw new Error(valuation.error);
        }
        
        // Los datos ya vienen procesados y normalizados
        const {
          pe,
          forwardPe,
          peg,
          pb,
          ps,
          pfcf,
          evEbitda,
          evSales,
          dividendYield,
          impliedGrowth,
          discountVsPt
        } = valuation;
    
        // Precio actual del perfil
        const profileArr = await fmp.profile(symbol);
        const currentPrice = Array.isArray(profileArr) && profileArr.length ? numOrNull(profileArr[0]?.price) : null;
        console.log('💰 Precio actual:', currentPrice);
    
        const build = (
          label: string,
          val: number | null,
          unit?: "%" | "x",
          score?: number | null,
          thresholds?: { poor: number; avg: number }
        ): Row => ({
          label,
          raw: val,
          unit,
          score: score ?? null,
          thresholds: thresholds ?? { poor: 40, avg: 70 },
          display: fmt(val, unit),
        });
    
        const items: Row[] = [
          build("P/E (PER)", pe, "x", ratioBetterLow(pe, 12, 40)),
          build("P/E forward", forwardPe, "x", ratioBetterLow(forwardPe, 12, 40)),
          build("PEG", peg, "x", ratioBetterLow(peg, 1, 3)),
          build("P/Book (P/B)", pb, "x", ratioBetterLow(pb, 2, 6)),
          build("P/S (Ventas)", ps, "x", ratioBetterLow(ps, 2, 12)),
          build("P/FCF", pfcf, "x", ratioBetterLow(pfcf, 15, 40)),
          build("EV/EBITDA", evEbitda, "x", ratioBetterLow(evEbitda, 8, 25)),
          build("EV/Ventas", evSales, "x", ratioBetterLow(evSales, 2, 12)),
          build(
            "Dividend Yield",
            dividendYield, // Ya viene en % desde el endpoint
            "%",
            dividendYield == null ? null : clamp((dividendYield / 8) * 100),
            { poor: 10, avg: 30 }
          ),
          // Derivados (ya calculados en el endpoint)
          build("Crecimiento implícito", impliedGrowth, "%", null, { poor: 40, avg: 70 }),
          build("Descuento vs. PT", discountVsPt, "%", null, { poor: 40, avg: 70 }),
        ];
        
        console.log('📈 Items procesados:', items);
        console.log('🎯 Items con scores válidos:', items.filter(item => item.score !== null));
    
        if (alive) setRows(items);
      } catch (e: any) {
        console.error('❌ Error cargando valoración:', e);
        if (alive) setError(e?.message ?? "Error cargando valoración");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [symbol]);

  const option = useMemo(() => {
    const labels = rows.map((r) => r.label);
    const poor = rows.map((r) => r.thresholds.poor);
    const mid = rows.map((r) => Math.max(r.thresholds.avg - r.thresholds.poor, 0));
    const good = rows.map((r) => Math.max(100 - r.thresholds.avg, 0));
    const scores = rows.map((r) => (Number.isFinite(r.score as number) ? (r.score as number) : 0));

    return {
      backgroundColor: "transparent",
      grid: { left: 170, right: 50, top: 10, bottom: 10 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "none" },
        backgroundColor: "rgba(248, 250, 252, 0.98)",
        borderColor: "rgba(203, 213, 225, 0.8)",
        borderWidth: 1,
        textStyle: { color: "#64748b", fontSize: 11 },
        confine: false,
        appendToBody: true,
        position: function (point: any, params: any, dom: any, rect: any, size: any) {
          return [point[0] + 10, point[1] - size.contentSize[1] / 2];
        },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex;
          if (idx == null || !rows[idx]) return "";
          
          const row = rows[idx];
          const scoreTxt = row.score == null ? "Sin datos" : `${Math.round(row.score)} / 100`;
          const scoreColor = getScoreColor(row.score);
          const scoreLevel = getScoreLevel(row.score);
          
          return `
            <div style="max-width: 320px; padding: 12px; line-height: 1.4; background-color: rgba(248, 250, 252, 0.98); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #334155;">${row.label}</div>
              
              <div style="margin-bottom: 6px; font-size: 11px;">
                <span style="color: #64748b;">Valor:</span> 
                <span style="font-weight: 600; color: #475569;">${row.display}</span>
              </div>
              
              <div style="margin-bottom: 8px; font-size: 11px;">
                <span style="color: #64748b;">Score:</span> 
                <span style="font-weight: 600; color: ${scoreColor};">${scoreTxt}</span>
                <span style="margin-left: 6px; padding: 2px 6px; border-radius: 3px; font-size: 9px; background-color: ${scoreColor}15; color: ${scoreColor};">${scoreLevel}</span>
              </div>
            </div>`;
        },
      },
      xAxis: {
        type: "value",
        max: 100,
        axisLabel: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      yAxis: {
        type: "category",
        data: labels,
        axisLabel: { color: "#e2e8f0" },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          name: "débil",
          type: "bar",
          stack: "range",
          data: poor,
          barWidth: 14,
          itemStyle: { color: "rgba(239,68,68,0.30)" },
          emphasis: { disabled: true },
          tooltip: { show: false },
        },
        {
          name: "medio",
          type: "bar",
          stack: "range",
          data: mid,
          barWidth: 14,
          itemStyle: { color: "rgba(234,179,8,0.30)" },
          emphasis: { disabled: true },
          tooltip: { show: false },
        },
        {
          name: "fuerte",
          type: "bar",
          stack: "range",
          data: good,
          barWidth: 14,
          itemStyle: { color: "rgba(34,197,94,0.30)" },
          emphasis: { disabled: true },
          tooltip: { show: false },
        },
        {
          name: "valor",
          type: "bar",
          data: scores,
          barWidth: 8,
          z: 5,
          itemStyle: { color: "#ffffff" },
          label: {
            show: true,
            position: "right",
            color: "#cbd5e1",
            formatter: (p: any) => rows[p.dataIndex]?.display ?? "",
          },
        },
      ],
    };
  }, [rows]);

  return (
    <Card className="bg-tarjetas border-none h-[492px]">
      <CardHeader>
        <CardTitle className="text-orange-400 text-lg flex items-center gap-2">
          <div className="text-gray-400">
           Valoración
          </div>
           {symbol}
          </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-72 flex items-center justify-center text-gray-400">
            Cargando valoración…
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center text-red-400">{error}</div>
        ) : (
          <>
            <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-red-500/50 rounded-sm" /> Débil
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-yellow-500/50 rounded-sm" /> A vigilar
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-green-500/50 rounded-sm" /> Fuerte
              </span>
            </div>
            <ReactECharts
              echarts={echarts as any}
              option={option as any}
              notMerge
              lazyUpdate
              style={{ height: Math.max(260, rows.length * 28), width: "100%" }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Función para obtener el color del score
const getScoreColor = (score: number | null): string => {
  if (score == null) return "#94a3b8";
  if (score >= 70) return "#22c55e"; // Verde
  if (score >= 40) return "#eab308"; // Amarillo
  return "#ef4444"; // Rojo
};

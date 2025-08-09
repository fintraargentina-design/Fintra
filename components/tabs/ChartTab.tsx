"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import "chart.js/auto";
import { Chart } from "chart.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

// Chart wrappers
const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), { ssr: false });

// ─────────────────────────────────────────────
// Tipos y helpers
// ─────────────────────────────────────────────
type OHLC = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
type RangeKey = "1A" | "3A" | "5A" | "MAX";
type Market = "NASDAQ" | "NYSE" | "AMEX";

const formatMoney = (n: number | null | undefined) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  return `${sign}$${a.toLocaleString()}`;
};

const pct = (x: number) => x * 100;
const annualize = (ret: number, days: number) =>
  Math.pow(1 + ret, 252 / Math.max(1, days)) - 1;

const rolling = <T,>(arr: T[], win: number, f: (slice: T[], idx: number) => number) => {
  const out: number[] = new Array(arr.length).fill(NaN);
  for (let i = win - 1; i < arr.length; i++) out[i] = f(arr.slice(i - win + 1, i + 1), i);
  return out;
};
const sma = (x: number[], w: number) =>
  rolling(x, w, (s) => s.reduce((a, b: any) => a + (b as number), 0) / w);
const stdev = (x: number[], w: number) =>
  rolling(x, w, (s) => {
    const m = s.reduce((a, b: any) => a + (b as number), 0) / s.length;
    const v = s.reduce((a, b: any) => a + Math.pow((b as number) - m, 2), 0) / (s.length - 1 || 1);
    return Math.sqrt(v);
  });

const applyRange = (data: OHLC[], range: RangeKey) => {
  if (!data?.length) return [];
  const end = new Date(data[data.length - 1].date);
  const start = new Date(end);
  switch (range) {
    case "1A":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "3A":
      start.setFullYear(start.getFullYear() - 3);
      break;
    case "5A":
      start.setFullYear(start.getFullYear() - 5);
      break;
    case "MAX":
    default:
      return data;
  }
  return data.filter((d) => new Date(d.date) >= start);
};

const getBenchmarkTicker = (mkt: Market) => (mkt === "NASDAQ" ? "^NDX" : "^GSPC");

// ─────────────────────────────────────────────
// Mocks: reemplazá por tus fetch reales (Supabase/API)
// ─────────────────────────────────────────────
async function mockGetOHLC(symbol: string): Promise<OHLC[]> {
  const days = 1800; // ~7 años
  const out: OHLC[] = [];
  let price = 100;
  for (let i = days; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const drift = (Math.random() - 0.5) * 0.8;
    const open = price;
    price = Math.max(1, price + drift);
    const close = Number(price.toFixed(2));
    const high = Number((Math.max(open, close) + Math.random()).toFixed(2));
    const low = Number((Math.min(open, close) - Math.random()).toFixed(2));
    const volume = Math.floor(5e6 + Math.random() * 5e6);
    out.push({
      date: dt.toISOString().slice(0, 10),
      open: Number(open.toFixed(2)),
      high,
      low,
      close,
      volume,
    });
  }
  return out;
}

async function mockGetBenchmark(ticker: string): Promise<OHLC[]> {
  const base = await mockGetOHLC(ticker);
  // deformación para simular otro comportamiento
  return base.map((d, i) => ({
    ...d,
    close: Number((d.close * 0.97 + Math.sin(i / 100) * 0.8).toFixed(2)),
  }));
}

// ─────────────────────────────────────────────
// Explicaciones para tooltips
// ─────────────────────────────────────────────
export const CHART_EXPLAIN: Record<
  "precioLog" | "drawdown" | "rolling" | "volRealizada" | "relativa",
  { titulo: string; descripcion: string; casoPractico: string }
> = {
  precioLog: {
    titulo: "Log-scale en precio",
    descripcion:
      "Escala logarítmica para series largas: un +100% luce igual en 2005 y 2025. Evita distorsiones y permite comparar tendencias.",
    casoPractico:
      "Ver si la acción mantiene su canal de crecimiento de largo plazo o lo quiebra para ajustar exposición.",
  },
  drawdown: {
    titulo: "Drawdown desde máximos",
    descripcion:
      "Caída % desde el máximo histórico al mínimo posterior. Mide severidad y duración de pérdidas.",
    casoPractico:
      "Comparar drawdowns de la acción vs. índice para validar si el riesgo es aceptable para el mandato.",
  },
  rolling: {
    titulo: "Rolling returns 1/3/5 años",
    descripcion:
      "Retornos anualizados en ventanas móviles. Evalúa consistencia de performance y regímenes.",
    casoPractico:
      "Si el 3Y rolling positivo cae bajo 80% de los períodos, se reduce la posición por menor persistencia.",
  },
  volRealizada: {
    titulo: "Volatilidad realizada 30/90 días",
    descripcion:
      "Desvío estándar de retornos diarios (anualizado). 30d = táctico, 90d = régimen.",
    casoPractico:
      "Si 30d se dispara > 90d, se baja tamaño para mantener el riesgo total en rango.",
  },
  relativa: {
    titulo: "Performance relativa vs. benchmark",
    descripcion:
      "Rendimiento acumulado vs. índice desde un punto común. Detecta sobre/infra performance persistente.",
    casoPractico:
      "Si la acción arrastra -12% relativo por 3 años, se rota a un peer con mejor momentum.",
  },
};

function InfoBadge({ keyName }: { keyName: keyof typeof CHART_EXPLAIN }) {
  const info = CHART_EXPLAIN[keyName];
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="ml-2 text-xs text-gray-400 hover:text-gray-200">
          <Info className="w-4 h-4" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 bg-gray-900 border-gray-700">
        <div className="text-sm text-gray-200 font-semibold">{info.titulo}</div>
        <div className="text-xs text-gray-300 mt-1">{info.descripcion}</div>
        <div className="text-xs text-blue-300 mt-2">Caso práctico: {info.casoPractico}</div>
      </HoverCardContent>
    </HoverCard>
  );
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
type ChartsTabHistoricosProps = {
  symbol: string;
  companyName?: string;
  showBenchmark?: boolean; // default: true
  market?: Market; // default: "NASDAQ"
};

// ─────────────────────────────────────────────
// Component Chart tab Historicos
// ─────────────────────────────────────────────

export default function ChartsTabHistoricos({
  symbol,
  companyName,
  showBenchmark = true,
  market = "NASDAQ",
}: ChartsTabHistoricosProps) {
  const [loading, setLoading] = useState(true);
  const [ohlc, setOhlc] = useState<OHLC[]>([]);
  const [bench, setBench] = useState<OHLC[]>([]);
  const [range, setRange] = useState<RangeKey>("3A");

  // Carga de data
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const benchTicker = getBenchmarkTicker(market);
        const [px, bm] = await Promise.all([
          mockGetOHLC(symbol),
          showBenchmark ? mockGetBenchmark(benchTicker) : Promise.resolve([] as OHLC[]),
        ]);
        if (!mounted) return;
        setOhlc(px);
        setBench(bm);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [symbol, showBenchmark, market]);

  // Registrar el plugin de zoom solo en el cliente
  useEffect(() => {
    const registerZoomPlugin = async () => {
      if (typeof window !== 'undefined') {
        const { default: zoomPlugin } = await import('chartjs-plugin-zoom');
        Chart.register(zoomPlugin);
      }
    };
    
    registerZoomPlugin();
  }, []);

  // Aplicar rango
  const dataR = useMemo(() => applyRange(ohlc, range), [ohlc, range]);
  const benchR = useMemo(() => applyRange(bench, range), [bench, range]);

  const dates = useMemo(() => dataR.map((d) => d.date), [dataR]);
  const closes = useMemo(() => dataR.map((d) => d.close), [dataR]);
  const vols = useMemo(() => dataR.map((d) => d.volume), [dataR]);

  // ─────────────────────────────────────────────
  // 1) Precio (log) + SMA 50/200 + Volumen (promedio 20d)
  // ─────────────────────────────────────────────
  const sma50 = useMemo(() => sma(closes, 50), [closes]);
  const sma200 = useMemo(() => sma(closes, 200), [closes]);
  const vol20 = useMemo(() => sma(vols, 20), [vols]);

  const zoomPluginOptions = {
    zoom: {
      wheel: { enabled: true },
      pinch: { enabled: true },
      mode: "xy" as const,
      scaleMode: "xy" as const,
    },
    pan: {
      enabled: true,
      mode: "xy" as const,
      // Eliminar modifierKey para permitir paneo directo
      // modifierKey: "ctrl" as const,  // <-- Comentar o eliminar esta línea
    },
    limits: {
      x: { min: "original" as const, max: "original" as const },
      y: { min: "original" as const, max: "original" as const },
    },
  };

  const priceOptions: any = useMemo(
    () => ({
      responsive: true,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        title: {
          display: true,
          text: "Precio (log) + SMA 50/200 + Volumen",
          color: "#fff",
        },
        legend: { labels: { color: "#fff" } },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              if (ctx.dataset.yAxisID === "y-vol")
                return ` Vol 20d: ${formatMoney(ctx.parsed.y)}`;
              return ` ${ctx.dataset.label}: $${ctx.parsed.y}`;
            },
          },
        },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: { ticks: { color: "#fff" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: {
          type: "logarithmic",
          ticks: { color: "#fff", callback: (v: any) => `$${v}` },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        "y-vol": {
          type: "linear" as const,
          position: "right" as const,
          ticks: { color: "#fff", callback: (v: any) => formatMoney(v) },
          grid: { display: false },
        },
      },
    }),
    []
  );

  const priceData = useMemo(
    () => ({
      labels: dates,
      datasets: [
        {
          type: "line" as const,
          label: `${symbol} Close`,
          data: closes,
          borderColor: "rgba(34,197,94,1)",
          backgroundColor: "rgba(34,197,94,0.12)",
          fill: true,
          tension: 0.25,
        },
        {
          type: "line" as const,
          label: "SMA 50",
          data: sma50,
          borderColor: "rgba(59,130,246,0.9)",
          borderWidth: 1.5,
          pointRadius: 0,
        },
        {
          type: "line" as const,
          label: "SMA 200",
          data: sma200,
          borderColor: "rgba(250,204,21,0.9)",
          borderWidth: 1.5,
          pointRadius: 0,
        },
        {
          type: "bar" as const,
          label: "Volumen (prom. 20d)",
          data: vol20,
          yAxisID: "y-vol",
          backgroundColor: "rgba(148,163,184,0.25)",
          borderWidth: 0,
        },
      ],
    }),
    [dates, closes, sma50, sma200, vol20, symbol]
  );

  // ─────────────────────────────────────────────
  // 2) Drawdown comparativo (acción vs. benchmark)
  // ─────────────────────────────────────────────
  const mapClose = (arr: OHLC[]) =>
    Object.fromEntries(arr.map((d) => [d.date, d.close]));
  const symMap = useMemo(() => mapClose(dataR), [dataR]);
  const bmMap = useMemo(() => mapClose(benchR), [benchR]);

  const commonDatesDD = useMemo(
    () => Object.keys(symMap).filter((d) => d in bmMap).sort(),
    [symMap, bmMap]
  );

  const symClosesAligned = useMemo(
    () => commonDatesDD.map((d) => symMap[d]),
    [commonDatesDD, symMap]
  );
  const bmClosesAligned = useMemo(
    () => commonDatesDD.map((d) => bmMap[d]),
    [commonDatesDD, bmMap]
  );

  const computeDrawdown = (arr: number[]) => {
    let peak = -Infinity;
    return arr.map((v) => {
      peak = Math.max(peak, v);
      return pct((v - peak) / peak); // <= 0
    });
  };

  const symDD = useMemo(() => computeDrawdown(symClosesAligned), [symClosesAligned]);
  const benchDD = useMemo(() => computeDrawdown(bmClosesAligned), [bmClosesAligned]);

  const drawdownOptions: any = useMemo(
    () => ({
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Drawdown desde Máximos (%) — Acc. vs Índice",
          color: "#fff",
        },
        legend: { labels: { color: "#fff" } },
        tooltip: {
          callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%` },
        },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: { ticks: { color: "#fff" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: {
          ticks: { color: "#fff", callback: (v: any) => `${v}%` },
          grid: { color: "rgba(255,255,255,0.08)" },
          suggestedMax: 0,
          suggestedMin: -90,
        },
      },
    }),
    []
  );

  const drawdownData = useMemo(
    () => ({
      labels: commonDatesDD,
      datasets: [
        {
          label: `${symbol} DD%`,
          data: symDD,
          borderColor: "rgba(239,68,68,0.95)",
          backgroundColor: "rgba(239,68,68,0.15)",
          fill: true,
          tension: 0.2,
        },
        {
          label: "Benchmark DD%",
          data: benchDD,
          borderColor: "rgba(148,163,184,0.95)",
          backgroundColor: "rgba(148,163,184,0.12)",
          fill: true,
          tension: 0.2,
        },
      ],
    }),
    [commonDatesDD, symDD, benchDD, symbol]
  );

  // ─────────────────────────────────────────────
  // 3) Rolling returns (1/3/5 años) anualizados
  // ─────────────────────────────────────────────
  const roll1Y = useMemo(
    () => rolling(closes, 252, (s) => annualize(s[s.length - 1] / s[0] - 1, s.length)),
    [closes]
  );
  const roll3Y = useMemo(
    () =>
      rolling(closes, 252 * 3, (s) => annualize(s[s.length - 1] / s[0] - 1, s.length)),
    [closes]
  );
  const roll5Y = useMemo(
    () =>
      rolling(closes, 252 * 5, (s) => annualize(s[s.length - 1] / s[0] - 1, s.length)),
    [closes]
  );

  const rollingOptions: any = useMemo(
    () => ({
      responsive: true,
      plugins: {
        title: { display: true, text: "Rendimientos Rodantes Anualizados", color: "#fff" },
        legend: { labels: { color: "#fff" } },
        tooltip: { callbacks: { label: (ctx: any) => `${(ctx.parsed.y * 100).toFixed(2)}%` } },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: { ticks: { color: "#fff" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: {
          ticks: { color: "#fff", callback: (v: any) => `${(v * 100).toFixed(0)}%` },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    }),
    []
  );

  const rollingData = useMemo(
    () => ({
      labels: dates,
      datasets: [
        {
          label: "1Y",
          data: roll1Y,
          borderColor: "rgba(34,197,94,0.9)",
          backgroundColor: "rgba(34,197,94,0.12)",
          fill: false,
        },
        {
          label: "3Y",
          data: roll3Y,
          borderColor: "rgba(59,130,246,0.9)",
          backgroundColor: "rgba(59,130,246,0.12)",
          fill: false,
        },
        {
          label: "5Y",
          data: roll5Y,
          borderColor: "rgba(250,204,21,0.9)",
          backgroundColor: "rgba(250,204,21,0.12)",
          fill: false,
        },
      ],
    }),
    [dates, roll1Y, roll3Y, roll5Y]
  );

  // ─────────────────────────────────────────────
  // 4) Volatilidad realizada (30/90d) anualizada
  // ─────────────────────────────────────────────
  const dailyRet = useMemo(() => {
    const r: number[] = new Array(closes.length).fill(NaN);
    for (let i = 1; i < closes.length; i++) r[i] = closes[i] / closes[i - 1] - 1;
    return r;
  }, [closes]);

  const vol30 = useMemo(
    () => stdev(dailyRet, 30).map((v) => (v ?? NaN) * Math.sqrt(252)),
    [dailyRet]
  );
  const vol90 = useMemo(
    () => stdev(dailyRet, 90).map((v) => (v ?? NaN) * Math.sqrt(252)),
    [dailyRet]
  );

  const volOptions: any = useMemo(
    () => ({
      responsive: true,
      plugins: {
        title: { display: true, text: "Volatilidad Realizada (Anualizada)", color: "#fff" },
        legend: { labels: { color: "#fff" } },
        tooltip: { callbacks: { label: (ctx: any) => `${(ctx.parsed.y * 100).toFixed(2)}%` } },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: { ticks: { color: "#fff" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: {
          ticks: { color: "#fff", callback: (v: any) => `${(v * 100).toFixed(0)}%` },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    }),
    []
  );

  const volData = useMemo(
    () => ({
      labels: dates,
      datasets: [
        {
          label: "σ 30d",
          data: vol30,
          borderColor: "rgba(239,68,68,0.9)",
          backgroundColor: "rgba(239,68,68,0.12)",
          fill: false,
        },
        {
          label: "σ 90d",
          data: vol90,
          borderColor: "rgba(148,163,184,0.9)",
          backgroundColor: "rgba(148,163,184,0.12)",
          fill: false,
        },
      ],
    }),
    [dates, vol30, vol90]
  );

  // ─────────────────────────────────────────────
  // 5) Performance relativa (acumulada) vs benchmark
  // ─────────────────────────────────────────────
  const relData = useMemo(() => {
    if (!dataR.length || !benchR.length) return { labels: [], datasets: [] };

    const mSym = Object.fromEntries(dataR.map((d) => [d.date, d.close]));
    const mBm = Object.fromEntries(benchR.map((d) => [d.date, d.close]));
    const common = Object.keys(mSym).filter((d) => d in mBm).sort();
    if (!common.length) return { labels: [], datasets: [] };

    const s0 = mSym[common[0]] || 1;
    const b0 = mBm[common[0]] || 1;

    const sCum = common.map((d) => pct(mSym[d] / s0 - 1));
    const bCum = common.map((d) => pct(mBm[d] / b0 - 1));

    return {
      labels: common,
      datasets: [
        {
          label: `${symbol} %`,
          data: sCum,
          borderColor: "rgba(34,197,94,0.95)",
          backgroundColor: "rgba(34,197,94,0.12)",
          fill: false,
          tension: 0.2,
        },
        {
          label: "Benchmark %",
          data: bCum,
          borderColor: "rgba(250,204,21,0.95)",
          backgroundColor: "rgba(250,204,21,0.12)",
          fill: false,
          tension: 0.2,
        },
      ],
    };
  }, [dataR, benchR, symbol]);

  const relOptions: any = useMemo(
    () => ({
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Performance Relativa vs. Benchmark (Cumulative %)",
          color: "#fff",
        },
        legend: { labels: { color: "#fff" } },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          },
        },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: { ticks: { color: "#fff" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: {
          ticks: { color: "#fff", callback: (v: any) => `${v}%` },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    }),
    []
  );

  // Botón reset zoom (opcional)
  const resetAllZooms = () => {
    // Chart.js 4 + react-chartjs-2: el reset se hace mediante ref, acá usamos un truco simple:
    // Forzamos re-render cambiando el range (toggle) o podés manejar refs de cada gráfico y llamar chart.resetZoom()
    setRange((r) => (r === "3A" ? "3A" : r));
  };



  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gray-900/60 border-blue-500/30">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-blue-400">
            🧭 Análisis Histórico — {companyName || "—"}{" "}
            <Badge variant="outline" className="ml-2 border-blue-500/50 text-blue-400">
              {symbol}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-3">
            <button
              onClick={resetAllZooms}
              className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-400 hover:border-blue-400/50"
              title="Reset zoom"
            >
              Reset Zoom
            </button>
            <div className="text-xs text-gray-500">{loading ? "Cargando..." : "Listo"}</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {(["1A", "3A", "5A", "MAX"] as RangeKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 text-xs rounded border ${
                  range === r
                    ? "border-blue-400 text-blue-300"
                    : "border-gray-700 text-gray-400 hover:border-blue-400/50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Precio + MAs + Volumen */}
      <Card className="bg-gray-900/50 border-green-500/30 chart-container">
        <CardHeader>
          <CardTitle className="text-green-400 flex items-center">
            Precio (log) + SMA 50/200 + Volumen
            <InfoBadge keyName="precioLog" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-800/40 rounded-md" />
          ) : (
            <Line data={priceData as any} options={priceOptions} height={90} />
          )}
        </CardContent>
      </Card>

      {/* Drawdown comparativo */}
      <Card className="bg-gray-900/50 border-rose-500/30 chart-container">
        <CardHeader>
          <CardTitle className="text-rose-400 flex items-center">
            Drawdown desde Máximos (Acc. vs Índice)
            <InfoBadge keyName="drawdown" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-800/40 rounded-md" />
          ) : commonDatesDD.length ? (
            <Line data={drawdownData as any} options={drawdownOptions} height={90} />
          ) : (
            <div className="text-gray-500 text-sm">
              Sin datos suficientes para comparar drawdown.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rolling Returns */}
      <Card className="bg-gray-900/50 border-indigo-500/30 chart-container">
        <CardHeader>
          <CardTitle className="text-indigo-400 flex items-center">
            Rendimientos Rodantes (1/3/5 años, anualizados)
            <InfoBadge keyName="rolling" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-800/40 rounded-md" />
          ) : (
            <Line data={rollingData as any} options={rollingOptions} height={90} />
          )}
        </CardContent>
      </Card>

      {/* Volatilidad Realizada */}
      <Card className="bg-gray-900/50 border-yellow-500/30 chart-container">
        <CardHeader>
          <CardTitle className="text-yellow-400 flex items-center">
            Volatilidad Realizada (30/90d, anualizada)
            <InfoBadge keyName="volRealizada" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-800/40 rounded-md" />
          ) : (
            <Line data={volData as any} options={volOptions} height={90} />
          )}
        </CardContent>
      </Card>

      {/* Relative Performance */}
      <Card className="bg-gray-900/50 border-emerald-500/30 chart-container">
        <CardHeader>
          <CardTitle className="text-emerald-400 flex items-center">
            Performance Relativa vs Benchmark
            <InfoBadge keyName="relativa" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-800/40 rounded-md" />
          ) : showBenchmark ? (
            <Line data={relData as any} options={relOptions} height={90} />
          ) : (
            <div className="text-gray-500 text-sm">Sin benchmark configurado</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

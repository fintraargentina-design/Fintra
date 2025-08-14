"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { RadarChart as EchartsRadar } from "echarts/charts";
import { TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// registra lo que usa ECharts
echarts.use([EchartsRadar, TooltipComponent, LegendComponent, CanvasRenderer]);

const ReactEChartsCore = dynamic(() => import("echarts-for-react/lib/core"), {
  ssr: false,
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

function cagrFromRates(ratesPct: number[]): number | null {
  const valid = ratesPct.filter((r) => Number.isFinite(r));
  if (!valid.length) return null;
  const compounded = valid.reduce((acc, r) => acc * (1 + r / 100), 1);
  return (Math.pow(compounded, 1 / valid.length) - 1) * 100;
}

// mapea P/E, EV/EBITDA y P/B a [0–100]; más alto = más barato
function valuationTo01(pe?: number, evE?: number, pb?: number) {
  const pe01 = pe ? Math.max(0, Math.min(1, (35 - Math.min(pe, 35)) / 35)) : 0.5;
  const ev01 = evE ? Math.max(0, Math.min(1, (22 - Math.min(evE, 22)) / 22)) : 0.5;
  const pb01 = pb ? Math.max(0, Math.min(1, (6 - Math.min(pb, 6)) / 6)) : 0.5;
  return Math.round(100 * (0.5 * pe01 + 0.35 * ev01 + 0.15 * pb01));
}

// riesgo a partir de beta (1 es neutro; <1 mejor). 0–100 (más alto = menos riesgo)
function riskFromBeta(beta?: number) {
  if (!Number.isFinite(beta)) return 50;
  const capped = Math.min(Math.max(beta, 0), 2); // 0..2
  const score01 = (2 - capped) / 1; // 2→0, 1→1, 0→2 (cap tras clamp)
  return clamp(100 * Math.max(0, Math.min(1, score01)));
}

// solidez combinada (0–100)
function solidity(currentRatio?: number, debtToEquity?: number, interestCov?: number) {
  const cr01 = Number.isFinite(currentRatio) ? Math.min(currentRatio ?? 0, 4) / 4 : 0.5;
  const de01 =
    Number.isFinite(debtToEquity) ? (3 - Math.min(debtToEquity as number, 3)) / 2 : 0.5; // menor mejor
  const ic01 = Number.isFinite(interestCov) ? Math.min(interestCov as number, 20) / 20 : 0.5;
  return clamp(100 * (0.3 * cr01 + 0.4 * de01 + 0.3 * ic01));
}

// ─────────────────────────────────────────────
// Tipos de las mini-respuestas de nuestras API internas
// ─────────────────────────────────────────────
type Ratios = Array<{
  returnOnEquity?: number; // en fracción (0.28 = 28%)
  netProfitMargin?: number; // fracción
  freeCashFlowOperatingCashFlowRatio?: number; // fracción ~ proxy FCF margin
  currentRatio?: number;
  debtEquityRatio?: number;
  interestCoverage?: number;
  priceEarningsRatio?: number;
  enterpriseValueMultiple?: number;
  priceToBookRatio?: number;
}>;
type Profile = Array<{ symbol: string; companyName?: string; beta?: number }>;
type Growth = Array<{ growthRevenue?: number; growthEPS?: number }>;
type Peers = { symbol: string; peers: string[] };

// ─────────────────────────────────────────────
// Fetchers (consumen los route handlers /api/fmp/* que te pasé)
// ─────────────────────────────────────────────
async function fetchPeers(symbol: string): Promise<string[]> {
  const r = await fetch(`/api/fmp/peers?symbol=${encodeURIComponent(symbol)}`, {
    cache: "no-store",
  });
  if (!r.ok) return [];
  const json = (await r.json()) as Peers;
  return json.peers ?? [];
}

async function fetchFactors(symbol: string) {
  const [ratiosRes, profileRes, growthRes] = await Promise.all([
    fetch(`/api/fmp/ratios?symbol=${encodeURIComponent(symbol)}&limit=1`, { cache: "no-store" }),
    fetch(`/api/fmp/profile?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" }),
    fetch(`/api/fmp/growth?symbol=${encodeURIComponent(symbol)}&period=annual&limit=5`, {
      cache: "no-store",
    }),
  ]);

  const ratios = (ratiosRes.ok ? ((await ratiosRes.json()) as Ratios) : [])?.[0] || {};
  const profile = (profileRes.ok ? ((await profileRes.json()) as Profile) : [])?.[0] || {};
  const growth = (growthRes.ok ? ((await growthRes.json()) as Growth) : []) || [];

  // ── métricas “crudas”
  const roePct = ratios.returnOnEquity ? ratios.returnOnEquity * 100 : undefined;
  const netMarginPct = ratios.netProfitMargin ? ratios.netProfitMargin * 100 : undefined;
  const fcfMarginPct = ratios.freeCashFlowOperatingCashFlowRatio
    ? ratios.freeCashFlowOperatingCashFlowRatio * 100
    : undefined;

  const growthRevRates = growth.map((g) => (g.growthRevenue ?? 0) * 100);
  const growthEpsRates = growth.map((g) => (g.growthEPS ?? 0) * 100);
  const revCagr = cagrFromRates(growthRevRates) ?? undefined;
  const epsCagr = cagrFromRates(growthEpsRates) ?? undefined;
  const crecimiento = epsCagr ?? revCagr; // usa EPS si hay; si no, ingresos

  // ── construir el objeto de radar con TU shape
  const radarData = {
    Rentabilidad: clamp(((roePct ?? 0) / 40) * 100),
    Crecimiento: clamp(((crecimiento ?? 0) / 30) * 100),
    "Solidez Financiera": solidity(
      ratios.currentRatio,
      ratios.debtEquityRatio,
      ratios.interestCoverage
    ),
    "Generación de Caja": clamp(((fcfMarginPct ?? 0) / 30) * 100),
    Margen: clamp(((netMarginPct ?? 0) / 30) * 100),
    Valoración: valuationTo01(
      ratios.priceEarningsRatio,
      ratios.enterpriseValueMultiple,
      ratios.priceToBookRatio
    ),
    "Riesgo / Volatilidad": riskFromBeta(profile.beta),
    Dividendos: clamp(0), // si más adelante usas dividendYield, mapea aquí (÷8 *100)
  };

  const label = (profile.companyName || symbol).trim();
  return { symbol, label, radarData };
}

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────
export default function RadarPeersCard({ symbol = "NVDA" }: { symbol?: string }) {
  const [main, setMain] = useState<{ symbol: string; label: string; radarData: Record<string, number> } | null>(null);
  const [peer, setPeer] = useState<{ symbol: string; label: string; radarData: Record<string, number> } | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // carga símbolo principal
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [m, peerSymbols] = await Promise.all([fetchFactors(symbol), fetchPeers(symbol)]);
        if (!mounted) return;
        setMain(m);
        setPeers(peerSymbols);
        // selecciona un peer por defecto
        const firstPeer = peerSymbols.find((p) => p && p !== symbol) ?? null;
        setActivePeer(firstPeer);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [symbol]);

  // carga factores del peer activo
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!activePeer) {
        setPeer(null);
        return;
      }
      const p = await fetchFactors(activePeer);
      if (!mounted) return;
      setPeer(p);
    })();
    return () => {
      mounted = false;
    };
  }, [activePeer]);

  // prepara series para ECharts
  const option = useMemo(() => {
    const indicators =
      main?.radarData
        ? Object.keys(main.radarData).map((k) => ({ name: k, max: 100 }))
        : [];
    const mainVals = main?.radarData ? Object.values(main.radarData) : [];
    const peerVals = peer?.radarData ? Object.values(peer.radarData) : [];

    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "item" as const },
      legend: {
        bottom: 6,
        data: ["Data C", "Data D"],
        textStyle: { color: "#cbd5e1" },
      },
      radar: [
        {
          indicator: indicators,
          center: ["50%", "45%"],
          radius: "55%",
          axisName: { color: "#999", backgroundColor: "#3b3b3b", borderRadius: 4, padding: [2, 6] },
          splitArea: {
            areaStyle: {
              color: ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.04)"],
            },
          },
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        },
      ],
      series: [
        {
          name: main?.label ?? "Data C",
          type: "radar" as const,
          symbol: "rect",
          symbolSize: 8,
          lineStyle: { width: 2, type: "dashed", color: "#60a5fa" },
          itemStyle: { color: "#60a5fa" },
          data: [{ value: mainVals, name: "Data C" }],
        },
        {
          name: peer?.label ?? "Data D",
          type: "radar" as const,
          areaStyle: { color: "rgba(244, 114, 182, 0.35)" },
          lineStyle: { width: 2, color: "rgba(244, 114, 182, 1)" },
          itemStyle: { color: "rgba(244, 114, 182, 1)" },
          data: [{ value: peerVals, name: "Data D" }],
        },
      ],
    };
  }, [main, peer]);

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0b0f14]">
      {/* barra superior de peers */}
      <div className="flex gap-2 overflow-x-auto p-3 border-b border-gray-800">
        {peers.length === 0 ? (
          <span className="text-gray-400 text-sm">Sin peers</span>
        ) : (
          peers.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeer(p)}
              className={`px-3 py-1 rounded-full border text-sm ${
                p === activePeer
                  ? "bg-rose-500/20 border-rose-400/40 text-rose-300"
                  : "bg-emerald-500/10 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/20"
              }`}
            >
              {p}
            </button>
          ))
        )}
      </div>

      {/* radar */}
      <div style={{ height: 440, width: "100%" }}>
        {!loading && main ? (
          <ReactEChartsCore echarts={echarts as any} option={option as any} style={{ height: "100%", width: "100%" }} />
        ) : (
          <div className="h-full grid place-items-center text-gray-400 text-sm">Cargando…</div>
        )}
      </div>
    </div>
  );
}

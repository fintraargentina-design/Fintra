// /components/RadarPeersCard.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as echarts from 'echarts/core';
import { RadarChart as EchartsRadar } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartNoAxesCombined, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fmp } from '@/lib/fmp/client';

echarts.use([EchartsRadar, TooltipComponent, LegendComponent, CanvasRenderer]);

const ReactEChartsCore = dynamic(() => import('echarts-for-react/lib/core'), { ssr: false });

// Helpers
const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

function cagrFromRates(ratesPct: number[]): number | null {
  const valid = ratesPct.filter((r) => Number.isFinite(r));
  if (!valid.length) return null;
  const compounded = valid.reduce((acc, r) => acc * (1 + r / 100), 1);
  return (Math.pow(compounded, 1 / valid.length) - 1) * 100;
}

// más alto = más barato
function valuationTo01(pe?: number, evE?: number, pb?: number) {
  const pe01 = Number.isFinite(pe) ? Math.max(0, Math.min(1, (35 - Math.min(pe!, 35)) / 35)) : 0.5;
  const ev01 = Number.isFinite(evE) ? Math.max(0, Math.min(1, (22 - Math.min(evE!, 22)) / 22)) : 0.5;
  const pb01 = Number.isFinite(pb) ? Math.max(0, Math.min(1, (6 - Math.min(pb!, 6)) / 6)) : 0.5;
  return Math.round(100 * (0.5 * pe01 + 0.35 * ev01 + 0.15 * pb01));
}

// 0–100 (más alto = menos riesgo)
function riskFromBeta(beta?: number) {
  if (!Number.isFinite(beta)) return 50;
  const capped = Math.min(Math.max(beta!, 0), 2);
  const score01 = Math.max(0, Math.min(1, (2 - capped) / 1));
  return clamp(100 * score01);
}

// solidez combinada (0–100) — FIX: divisor /3 en D/E
function solidity(currentRatio?: number, debtToEquity?: number, interestCov?: number) {
  const cr01 = Number.isFinite(currentRatio) ? Math.min(currentRatio ?? 0, 4) / 4 : 0.5;
  const de01 = Number.isFinite(debtToEquity) ? (3 - Math.min(debtToEquity as number, 3)) / 3 : 0.5; // menor mejor
  const ic01 = Number.isFinite(interestCov) ? Math.min(interestCov as number, 20) / 20 : 0.5;
  return clamp(100 * (0.3 * cr01 + 0.4 * de01 + 0.3 * ic01));
}

type Ratios = Array<{
  returnOnEquity?: number;
  netProfitMargin?: number;
  freeCashFlowOperatingCashFlowRatio?: number;
  currentRatio?: number;
  debtEquityRatio?: number;
  interestCoverage?: number;
  priceEarningsRatio?: number;
  enterpriseValueMultiple?: number;
  priceToBookRatio?: number;
}>;

type Profile = Array<{ symbol: string; companyName?: string; beta?: number }>;
type Growth = Array<{ growthRevenue?: number; growthEPS?: number }>;

async function fetchFactors(symbol: string) {
  const [ratios, profile, growth] = await Promise.all([
    fmp.ratios(symbol, { limit: 1 }),
    fmp.profile(symbol),
    fmp.growth(symbol, { period: 'annual', limit: 5 }),
  ]);

  const { peers } = await fmp.peers(symbol);

  const ratios0 = (ratios?.[0] ?? {}) as Ratios[0];
  const profile0 = (profile?.[0] ?? {}) as Profile[0];
  const growthArr = (growth ?? []) as Growth;

  const roePct = Number.isFinite(ratios0.returnOnEquity) ? (ratios0.returnOnEquity as number) * 100 : undefined;
  const netMarginPct = Number.isFinite(ratios0.netProfitMargin) ? (ratios0.netProfitMargin as number) * 100 : undefined;
  const fcfMarginPct = Number.isFinite(ratios0.freeCashFlowOperatingCashFlowRatio)
    ? (ratios0.freeCashFlowOperatingCashFlowRatio as number) * 100
    : undefined;

  const growthRevRates = growthArr.map((g) => ((g.growthRevenue ?? 0) as number) * 100);
  const growthEpsRates = growthArr.map((g) => ((g.growthEPS ?? 0) as number) * 100);
  const revCagr = cagrFromRates(growthRevRates) ?? undefined;
  const epsCagr = cagrFromRates(growthEpsRates) ?? undefined;
  const crecimiento = epsCagr ?? revCagr;

  const radarData = {
    Rentabilidad: clamp(((roePct ?? 0) / 40) * 100),
    Crecimiento: clamp(((crecimiento ?? 0) / 30) * 100),
    'Solidez Financiera': solidity(ratios0.currentRatio, ratios0.debtEquityRatio, ratios0.interestCoverage),
    'Generación de Caja': clamp(((fcfMarginPct ?? 0) / 30) * 100),
    Margen: clamp(((netMarginPct ?? 0) / 30) * 100),
    Valoración: valuationTo01(ratios0.priceEarningsRatio, ratios0.enterpriseValueMultiple, ratios0.priceToBookRatio),
    'Riesgo / Volatilidad': riskFromBeta(profile0?.beta),
    Dividendos: clamp(0), // si sumás dividendYield, mapealo aquí
  };

  const label = (profile0?.companyName || symbol).trim();
  return { symbol, label, radarData };
}

export default function RadarPeersCard({ symbol }: { symbol?: string }) {
  const [main, setMain] = useState<{ symbol: string; label: string; radarData: Record<string, number> } | null>(null);
  const [peer, setPeer] = useState<{ symbol: string; label: string; radarData: Record<string, number> } | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // cache factor por symbol para evitar recomputar al cambiar dropdown
  const cacheRef = useRef<Map<string, Promise<{ symbol: string; label: string; radarData: Record<string, number> }>>>(new Map());

  useEffect(() => {
    let mounted = true;
    if (!symbol?.trim()) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        // carga principal + peers
        const [m, peersRes] = await Promise.all([
          fetchFactors(symbol),
          fmp.peers(symbol), // { symbol, peers }
        ]);
        if (!mounted) return;

        // dedupe y excluí el propio símbolo
        const cleaned = Array.from(new Set((peersRes?.peers ?? []).map((p) => p.toUpperCase()))).filter(
          (p) => p !== symbol.toUpperCase()
        );

        setMain(m);
        setPeers(cleaned);
        setActivePeer(cleaned[0] ?? null);
      } catch (e) {
        console.error('[RadarPeersCard] load main error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [symbol]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!activePeer) {
        setPeer(null);
        return;
      }
      try {
        const key = activePeer;
        if (!cacheRef.current.has(key)) {
          cacheRef.current.set(key, fetchFactors(key));
        }
        const p = await cacheRef.current.get(key)!;
        if (!mounted) return;
        setPeer(p);
      } catch (e) {
        console.error('[RadarPeersCard] load peer error:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activePeer]);

  const option = useMemo(() => {
    const indicators = main?.radarData ? Object.keys(main.radarData).map((k) => ({ name: k, max: 100 })) : [];
    const mainVals = main?.radarData ? Object.values(main.radarData) : [];
    const peerVals = peer?.radarData ? Object.values(peer.radarData) : [];

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' as const },
      legend: {
        bottom: 10,
        left: 20,
        data: [main?.label || 'Empresa Principal', peer?.label || 'Competidor'],
        textStyle: { color: '#9ca3af' },
      },
      radar: [
        {
          indicator: indicators,
          center: ['30%', '45%'],
          radius: '55%',
          axisName: { color: '#9ca3af', borderRadius: 8, padding: [2, 6] },
          splitArea: { areaStyle: { color: ['rgba(158,165,163,0.02)', 'rgba(158,165,163,0.04)'] } },
          axisLine: { lineStyle: { color: 'rgba(90,91,94,0.3)' } },
          splitLine: { lineStyle: { color: 'rgba(90,91,94,0.2)' } },
        },
      ],
      series: [
        {
          name: main?.label ?? 'Empresa Principal',
          type: 'radar' as const,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#ff917c' },
          itemStyle: { color: '#ff917c' },
          areaStyle: {
            color: new (echarts as any).graphic.RadialGradient(0.1, 0.6, 1, [
              { color: 'rgba(170,104,38,0.1)', offset: 0 },
              { color: 'rgba(170,104,38,0.9)', offset: 1 },
            ]),
          },
          data: [{ value: mainVals, name: main?.label || 'Empresa Principal' }],
        },
        {
          name: peer?.label ?? 'Competidor',
          type: 'radar' as const,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, type: 'dashed', color: '#60a5fa' },
          itemStyle: { color: '#60a5fa' },
          data: [{ value: peerVals, name: peer?.label || 'Competidor' }],
        },
      ],
    };
  }, [main, peer]);

  if (loading) {
    return (
      <Card className="bg-tarjetas border-none h-[492px]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-400">Cargando análisis de competidores...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-tarjetas border-none h-[492px]">
      <CardHeader className="pb-1">
        <CardTitle className="text-gray-400 text-lg flex items-center">
          <ChartNoAxesCombined className="mr-2 text-orange-400 w-5 h-5" />
          Análisis Comparativo
          {main && <span className="text-m text-orange-400 font-normal ml-2 mr-2">{main.symbol}</span>}
          {' '}vs{' '}
          <div className="flex gap-2">
            {peers.length === 0 ? (
              <span className="text-gray-500 text-sm">Sin competidores disponibles</span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 ml-2 rounded-lg text-blue-300 transition-colors min-w-[60px] justify-between"
                    aria-label="Seleccionar competidor"
                  >
                    <span>{activePeer || 'Seleccionar competidor'}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-800 border-gray-700 min-w-[120px]">
                  {peers.map((p) => (
                    <DropdownMenuItem
                      key={p}
                      onClick={() => setActivePeer(p)}
                      className={`cursor-pointer transition-colors ${
                        p === activePeer
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'text-gray-300 hover:bg-orange-500/10 hover:text-orange-400'
                      }`}
                      aria-label={`Comparar con ${p}`}
                    >
                      {p}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div style={{ height: 400, width: '100%' }}>
          {main ? (
            <ReactEChartsCore echarts={echarts as any} option={option as any} style={{ height: '100%', width: '100%' }} />
          ) : (
            <div className="h-full grid place-items-center text-gray-400 text-sm">No hay datos disponibles</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

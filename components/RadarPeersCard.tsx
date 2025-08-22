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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const clamp100 = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
const numOrNull = (x: any): number | null => {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

function cagrFromRates(ratesPct: number[]): number | null {
  const valid = ratesPct.filter((r) => Number.isFinite(r));
  if (!valid.length) return null;
  const compounded = valid.reduce((acc, r) => acc * (1 + r / 100), 1);
  return (Math.pow(compounded, 1 / valid.length) - 1) * 100;
}

// más alto = más barato (0–100)
function valuationScore(pe?: number | null, evE?: number | null, pb?: number | null) {
  // Solo calcular si tenemos al menos un valor válido
  const validMetrics = [pe, evE, pb].filter(x => x != null && x > 0);
  if (validMetrics.length === 0) return 50; // valor neutro si no hay datos
  
  const pe01 = pe != null && pe > 0 ? Math.max(0, Math.min(1, (35 - Math.min(pe, 35)) / 35)) : null;
  const ev01 = evE != null && evE > 0 ? Math.max(0, Math.min(1, (22 - Math.min(evE, 22)) / 22)) : null;
  const pb01 = pb != null && pb > 0 ? Math.max(0, Math.min(1, (6 - Math.min(pb, 6)) / 6)) : null;
  
  // Promediar solo los valores válidos
  const validScores = [pe01, ev01, pb01].filter(x => x != null) as number[];
  const avgScore = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
  
  return clamp100(100 * avgScore);
}

// 0–100 (más alto = menos riesgo)
function riskFromBeta(beta?: number | null) {
  if (!Number.isFinite(beta as number)) return 50;
  const capped = Math.min(Math.max(beta as number, 0), 2);
  const score01 = (2 - capped) / 2; // normalizado a 0..1
  return clamp100(100 * score01);
}

// solidez combinada (0–100) — divisor /3 en D/E (menor es mejor)
function solidity(currentRatio?: number | null, debtToEquity?: number | null, interestCov?: number | null) {
  const cr01 =
    !Number.isFinite(currentRatio as number) ? 0.5 : Math.min(Math.max(currentRatio as number, 0), 4) / 4;
  const de01 =
    !Number.isFinite(debtToEquity as number) ? 0.5 : (3 - Math.min(Math.max(debtToEquity as number, 0), 3)) / 3;
  const ic01 =
    !Number.isFinite(interestCov as number) ? 0.5 : Math.min(Math.max(interestCov as number, 0), 20) / 20;
  return clamp100(100 * (0.3 * cr01 + 0.4 * de01 + 0.3 * ic01));
}

// ─────────────────────────────────────────────
// Tipos mínimos locales (robustos)
// ─────────────────────────────────────────────
// En el tipo Ratios0, agregar:
type Ratios0 = {
  returnOnEquity?: number;
  netProfitMargin?: number;
  freeCashFlowOperatingCashFlowRatio?: number;
  currentRatio?: number;
  debtEquityRatio?: number;
  interestCoverage?: number;
  priceEarningsRatio?: number;
  enterpriseValueMultiple?: number;
  priceToBookRatio?: number;
  dividendYield?: number;
};

type Profile0 = { symbol?: string; companyName?: string; beta?: number };
type Growth0 = { revenueGrowth?: number; epsgrowth?: number };

// ─────────────────────────────────────────────
// Carga de factores por símbolo (defensiva)
// ─────────────────────────────────────────────
async function fetchFactors(symbol: string) {
  try {
    const [ratiosArr, profileArr, growthArrRaw, peersRes] = await Promise.all([
      fmp.ratios(symbol, { limit: 1, period: 'annual' }),
      fmp.profile(symbol),
      fmp.growth(symbol, { period: 'annual', limit: 5 }),
      fmp.peers(symbol),
    ]);

    // Validar que los datos llegaron correctamente
    if (!Array.isArray(ratiosArr) || ratiosArr.length === 0) {
      console.warn(`[RadarPeersCard] No ratios data for ${symbol}`);
    }
    if (!Array.isArray(growthArrRaw) || growthArrRaw.length < 2) {
      console.warn(`[RadarPeersCard] Insufficient growth data for ${symbol}: ${growthArrRaw?.length || 0} periods`);
    }
    
    // peers list - ahora accedemos correctamente a la respuesta de la API
    const peersList: string[] = Array.isArray(peersRes?.peers)
      ? peersRes.peers
      : [];

    // Extraer datos principales
    const r0: Ratios0 = ratiosArr[0] || {};
    const p0: Profile0 = profileArr[0] || {};
    const gArr: Growth0[] = growthArrRaw || [];

    // márgenes y rentabilidad (FMP en decimales → %)
    const roePct = numOrNull((r0.returnOnEquity ?? null)) != null ? (r0.returnOnEquity as number) * 100 : null;
    const netMarginPct = numOrNull((r0.netProfitMargin ?? null)) != null ? (r0.netProfitMargin as number) * 100 : null;
    const fcfMarginPct =
      numOrNull((r0.freeCashFlowOperatingCashFlowRatio ?? null)) != null
        ? (r0.freeCashFlowOperatingCashFlowRatio as number) * 100
        : null;

    // growth series (FMP: decimales → %)
    const growthRevRates = gArr
      .map((g) => numOrNull(g.revenueGrowth))
      .filter(rate => rate != null && Number.isFinite(rate))
      .map(rate => (rate as number) * 100);
    
    const growthEpsRates = gArr
      .map((g) => numOrNull(g.epsgrowth))
      .filter(rate => rate != null && Number.isFinite(rate))
      .map(rate => (rate as number) * 100);
    
    const revCagr = growthRevRates.length >= 2 ? cagrFromRates(growthRevRates) : null;
    const epsCagr = growthEpsRates.length >= 2 ? cagrFromRates(growthEpsRates) : null;
    const crecimiento = epsCagr ?? revCagr; // prioriza EPS
    
    // Validar que crecimiento no sea NaN o infinito
    const crecimientoFinal = (crecimiento != null && Number.isFinite(crecimiento)) ? crecimiento : 0;

    // valoración
    const pe = numOrNull(r0.priceEarningsRatio);
    const evE = numOrNull(r0.enterpriseValueMultiple);
    const pb = numOrNull(r0.priceToBookRatio);
    
    // Calcular dividendos antes del objeto radarData
    const dividendYieldPct = numOrNull(r0.dividendYield) != null ? (r0.dividendYield as number) * 100 : null;
    
    // Console.log para verificar los valores calculados
    console.log(`[RadarPeersCard] Valores calculados para ${symbol}:`);
    console.log('- ROE%:', roePct);
    console.log('- Net Margin%:', netMarginPct);
    console.log('- FCF Margin%:', fcfMarginPct);
    console.log('- Crecimiento (EPS/Revenue CAGR):', crecimiento, '→ Final:', crecimientoFinal);
    console.log('- PE:', pe, 'EV/E:', evE, 'PB:', pb);
    console.log('- Beta:', numOrNull(p0.beta));
    console.log('- Dividend Yield%:', dividendYieldPct);
    console.log('- Current Ratio:', numOrNull(r0.currentRatio));
    console.log('- Debt/Equity:', numOrNull(r0.debtEquityRatio));
    console.log('- Interest Coverage:', numOrNull(r0.interestCoverage));
    
    const radarData: Record<string, number> = {
      Rentabilidad: clamp100(((roePct ?? 0) / 40) * 100),
      Crecimiento: clamp100(((crecimientoFinal ?? 0) / 30) * 100), // usar crecimientoFinal
      'Solidez Financiera': solidity(numOrNull(r0.currentRatio), numOrNull(r0.debtEquityRatio), numOrNull(r0.interestCoverage)),
      'Generación de Caja': clamp100(((fcfMarginPct ?? 0) / 30) * 100),
      Margen: clamp100(((netMarginPct ?? 0) / 30) * 100),
      Valoración: valuationScore(pe, evE, pb),
      'Riesgo / Volatilidad': riskFromBeta(numOrNull(p0.beta)),
      Dividendos: clamp100(dividendYieldPct ? (dividendYieldPct / 8) * 100 : 0), // normalizado a 8% máximo
    };
    
    // Console.log para verificar los valores finales del radar (deben estar entre 0-100)
    console.log(`[RadarPeersCard] Valores finales del radar para ${symbol}:`);
    Object.entries(radarData).forEach(([key, value]) => {
      console.log(`- ${key}: ${value} (${value >= 0 && value <= 100 ? '✓' : '✗ FUERA DE RANGO'})`);
    });

    const label = (p0.companyName || symbol).trim();
    return { symbol, label, radarData, peersList };
    
  } catch (error) {
    console.error(`[RadarPeersCard] Error fetching data for ${symbol}:`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────
export default function RadarPeersCard({ symbol }: { symbol?: string }) {
  const [main, setMain] = useState<{ symbol: string; label: string; radarData: Record<string, number> } | null>(null);
  const [peer, setPeer] = useState<{ symbol: string; label: string; radarData: Record<string, number> } | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // cache para evitar recomputes
  const cacheRef = useRef<Map<string, Promise<{ symbol: string; label: string; radarData: Record<string, number> }>>>(new Map());

  // carga principal + peers
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!symbol?.trim()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const fac = await fetchFactors(symbol);
        if (!mounted) return;

        setMain({ symbol: fac.symbol, label: fac.label, radarData: fac.radarData });

        // peers limpios (excluye self, dedupe, mayúsculas)
        const cleaned = Array.from(
          new Set((fac.peersList || []).map((p: string) => String(p).toUpperCase()).filter((p) => p && p !== symbol.toUpperCase()))
        );

        setPeers(cleaned);
        setActivePeer(cleaned.length ? cleaned[0] : null);
      } catch (e) {
        console.error('[RadarPeersCard] main load error:', e);
        setPeers([]);
        setActivePeer(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [symbol]);

  // carga peer activo (con cache)
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!activePeer) {
        setPeer(null);
        return;
      }
      try {
        const key = activePeer;
        if (!cacheRef.current.has(key)) {
          cacheRef.current.set(key, fetchFactors(key).then((r) => ({ symbol: r.symbol, label: r.label, radarData: r.radarData })));
        }
        const p = await cacheRef.current.get(key)!;
        if (!mounted) return;
        setPeer(p);
      } catch (e) {
        console.error('[RadarPeersCard] peer load error:', e);
        if (mounted) setPeer(null);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [activePeer]);

  // opción de ECharts (defensiva)
  const option = useMemo(() => {
    const indicators =
      main?.radarData
        ? Object.keys(main.radarData).map((name) => ({ name, max: 100 }))
        : [];

    // valores alineados al orden de indicators
    const mainVals = indicators.map(({ name }) => (main?.radarData?.[name] ?? 0));
    const peerVals = indicators.map(({ name }) => (peer?.radarData?.[name] ?? 0));

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
          center: ['50%', '45%'],
          radius: '40%',
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

  // Remover esta línea (aproximadamente línea 282):
  // console.log('peers - Datos recibidos:', peers);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  // Estado de carga
  if (loading) {
    return (
      <Card className="bg-tarjetas border-none h-[492px]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-400">Evaluando competidores...</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-tarjetas border-none h-[492px]">
      <CardHeader className="pb-1">
        <CardTitle className="text-gray-400 text-lg flex items-center">
          Comparativo
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
            <ReactEChartsCore
              echarts={echarts as any}
              option={option as any}
              notMerge
              lazyUpdate
              style={{ height: '100%', width: '100%' }}
            />
          ) : (
            <div className="h-full grid place-items-center text-gray-400 text-sm">No hay datos disponibles</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


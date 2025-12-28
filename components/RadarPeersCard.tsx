// /components/RadarPeersCard.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as echarts from 'echarts/core';
import { RadarChart as EchartsRadar } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { graphic } from 'echarts/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartNoAxesCombined } from 'lucide-react';
import { fmp } from '@/lib/fmp/client';
import { useResponsive } from '@/hooks/use-responsive';

echarts.use([EchartsRadar, TooltipComponent, LegendComponent, CanvasRenderer]);

const ReactEChartsCore = dynamic(() => import('echarts-for-react/lib/core'), { ssr: false });

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const clamp100 = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
const numOrNull = (x: unknown): number | null => {
  if (x === null || x === undefined) return null;
  if (typeof x === 'string' && x.trim() === '') return null;
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
  const validMetrics = [pe, evE, pb].filter((x) => x != null && (x as number) > 0);
  if (validMetrics.length === 0) return 50; // valor neutro si no hay datos

  const pe01 = pe != null && pe > 0 ? Math.max(0, Math.min(1, (35 - Math.min(pe, 35)) / 35)) : null;
  const ev01 = evE != null && evE > 0 ? Math.max(0, Math.min(1, (22 - Math.min(evE, 22)) / 22)) : null;
  const pb01 = pb != null && pb > 0 ? Math.max(0, Math.min(1, (6 - Math.min(pb, 6)) / 6)) : null;

  const validScores = [pe01, ev01, pb01].filter((x) => x != null) as number[];
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
type Growth0 = { revenueGrowth?: number; epsGrowth?: number; epsgrowth?: number };

// ─────────────────────────────────────────────
// Carga de factores por símbolo (defensiva)
// ─────────────────────────────────────────────
async function fetchFactors(symbol: string, signal?: AbortSignal) {
  try {
    // Mantener la conexión como la tenés actualmente (cliente FMP):
    const [ratiosArr, profileArr, growthArrRaw, peersRes] = await Promise.all([
      fmp.ratios(symbol, { limit: 1, period: 'annual' }),
      fmp.profile(symbol),
      fmp.growth(symbol, { period: 'annual', limit: 5 }),
      fmp.peers(symbol),
    ]);

    // peers list (API de FMP suele retornar { peers: [...] })
    const peersList: string[] = Array.isArray((peersRes as any)?.peers) ? (peersRes as any).peers : [];

    // Extraer datos principales
    const r0: Ratios0 = (Array.isArray(ratiosArr) && ratiosArr[0]) || {};
    const p0: Profile0 = (Array.isArray(profileArr) && profileArr[0]) || {};
    const gArr: Growth0[] = (Array.isArray(growthArrRaw) ? growthArrRaw : []) as Growth0[];

    // márgenes y rentabilidad (FMP en decimales → %)
    const roePct = numOrNull(r0.returnOnEquity) != null ? (r0.returnOnEquity as number) * 100 : null;
    const netMarginPct = numOrNull(r0.netProfitMargin) != null ? (r0.netProfitMargin as number) * 100 : null;
    const fcfMarginPct =
      numOrNull(r0.freeCashFlowOperatingCashFlowRatio) != null
        ? (r0.freeCashFlowOperatingCashFlowRatio as number) * 100
        : null;

    // growth series (FMP: decimales → %). Aceptamos epsGrowth o epsgrowth por seguridad.
    const growthRevRates = gArr
      .map((g) => numOrNull(g.revenueGrowth))
      .filter((rate): rate is number => rate != null && Number.isFinite(rate))
      .map((rate) => rate * 100);

    const growthEpsRates = gArr
      .map((g) => numOrNull(g.epsGrowth ?? g.epsgrowth))
      .filter((rate): rate is number => rate != null && Number.isFinite(rate))
      .map((rate) => rate * 100);

    const revCagr = growthRevRates.length >= 2 ? cagrFromRates(growthRevRates) : null;
    const epsCagr = growthEpsRates.length >= 2 ? cagrFromRates(growthEpsRates) : null;
    const crecimiento = (epsCagr ?? revCagr) ?? 0;
    const crecimientoFinal = Number.isFinite(crecimiento) ? (crecimiento as number) : 0;

    // valoración
    const pe = numOrNull(r0.priceEarningsRatio);
    const evE = numOrNull(r0.enterpriseValueMultiple);
    const pb = numOrNull(r0.priceToBookRatio);

    // dividendos (%)
    const dividendYieldPct = numOrNull(r0.dividendYield) != null ? (r0.dividendYield as number) * 100 : null;

    const radarData: Record<string, number> = {
      Rentabilidad: clamp100(((roePct ?? 0) / 40) * 100),
      Crecimiento: clamp100(((crecimientoFinal ?? 0) / 30) * 100),
      'Solidez': solidity(numOrNull(r0.currentRatio), numOrNull(r0.debtEquityRatio), numOrNull(r0.interestCoverage)),
      'Flujo de caja': clamp100(((fcfMarginPct ?? 0) / 30) * 100),
      Margen: clamp100(((netMarginPct ?? 0) / 30) * 100),
      Valoración: valuationScore(pe, evE, pb),
      'Riesgo': riskFromBeta(numOrNull(p0.beta)),
      Dividendos: clamp100(dividendYieldPct ? (dividendYieldPct / 8) * 100 : 0),
    };

    const label = (p0.companyName || symbol).trim();
    return { symbol, label, radarData, peersList };
  } catch (error) {
    // Si se aborta la petición, que no rompa el flujo
    if ((error as any)?.name === 'AbortError') return null;
    console.error(`[RadarPeersCard] Error fetching data for ${symbol}:`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Interfaz para las props del componente
// ─────────────────────────────────────────────
interface RadarPeersCardProps {
  symbol?: string;
  selectedCompetitor?: string | null;
  embedded?: boolean;
}

// ─────────────────────────────────────────────
// Componente Principal (único)
// ─────────────────────────────────────────────
export default function RadarPeersCard({ symbol, selectedCompetitor, embedded = false }: RadarPeersCardProps) {
  // Primero verificar condiciones que podrían causar return temprano
  if (!symbol?.trim()) {
    return (
      <Card className="bg-tarjetas border-none min-h-[300px] responsive-container">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-400">No hay símbolo disponible</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // DESPUÉS declarar todos los hooks
  const { isMobile, isTablet } = useResponsive();

  // Estados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartInstance, setChartInstance] = useState<any>(null);

  const [main, setMain] = useState<{ symbol: string; label: string; radarData: Record<string, number> } | null>(null);
  const [peer, setPeer] = useState<{ symbol: string; label: string; radarData: Record<string, number> } | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);

  // cache para evitar recomputes
  const cacheRef = useRef<Map<string, Promise<{ symbol: string; label: string; radarData: Record<string, number> }>>>(new Map());

  // carga principal + peers
  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const fac = await fetchFactors(symbol, ac.signal);
        if (!mounted || !fac) return;

        setMain({ symbol: fac.symbol, label: fac.label, radarData: fac.radarData });

        // peers limpios (excluye self, dedupe, mayúsculas)
        const cleaned = Array.from(
          new Set((fac.peersList || []).map((p: string) => String(p).toUpperCase()).filter((p) => p && p !== symbol.toUpperCase())),
        );

        setPeers(cleaned);
        // Usar selectedCompetitor si está disponible y es válido, sino usar el primero
        const initialPeer = selectedCompetitor && cleaned.includes(selectedCompetitor.toUpperCase()) 
          ? selectedCompetitor.toUpperCase() 
          : (cleaned.length ? cleaned[0] : null);
        setActivePeer(initialPeer);
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || 'Error desconocido');
          setPeers([]);
          setActivePeer(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [symbol, selectedCompetitor]);

  // Efecto adicional para actualizar activePeer cuando cambie selectedCompetitor
  useEffect(() => {
    if (selectedCompetitor && peers.includes(selectedCompetitor.toUpperCase())) {
      setActivePeer(selectedCompetitor.toUpperCase());
    }
  }, [selectedCompetitor, peers]);

  // carga peer activo (con cache)
  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;

    (async () => {
      if (!activePeer) {
        setPeer(null);
        return;
      }
      try {
        const key = activePeer;
        if (!cacheRef.current.has(key)) {
          cacheRef.current.set(
            key,
            (async () => {
              const r = await fetchFactors(key, ac.signal);
              if (!r) throw new Error('Abortado');
              return { symbol: r.symbol, label: r.label, radarData: r.radarData };
            })(),
          );
        }
        const p = await cacheRef.current.get(key)!;
        if (!mounted) return;
        setPeer(p);
      } catch (e) {
        if (mounted) setPeer(null);
      }
    })();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [activePeer]);

  // Configuración responsiva del radar
  const option = useMemo(() => {
    const indicators = main?.radarData ? Object.keys(main.radarData).map((name) => ({ name, max: 100 })) : [];

    // valores alineados al orden de indicators
    const mainVals = indicators.map(({ name }) => main?.radarData?.[name] ?? 0);
    const peerVals = indicators.map(({ name }) => peer?.radarData?.[name] ?? 0);

    // Responsive configuration - Radio más pequeño para mejor visibilidad de labels
    const radius = isMobile ? '45%' : isTablet ? '50%' : '55%';
    const fontSize = isMobile ? 10 : isTablet ? 11 : 12;
    const legendFontSize = isMobile ? 10 : 12;
    const centerY = isMobile ? '50%' : '50%';

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#e5e7eb', fontSize },
      },
      legend: {
        top: 6,
        left: 'center',
        orient: 'horizontal',
        itemGap: 16,
        formatter: (name: string) => (name.length > 26 ? name.slice(0, 26) + '…' : name),
        data: [main?.label || 'Empresa Principal', peer?.label || 'Competidor'],
        textStyle: { color: '#9ca3af', fontSize: legendFontSize },
        itemWidth: isMobile ? 12 : 14,
        itemHeight: isMobile ? 8 : 10,
      },
      radar: [
        {
          indicator: indicators,
          center: ['50%', '55%'],
          radius,
          axisName: {
            color: '#9ca3af',
            borderRadius: 8,
            padding: [3, 4], // Aumentar padding para mejor legibilidad
            fontSize,
          },
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
          symbolSize: isMobile ? 4 : 6,
          lineStyle: { width: 2, color: '#ff917c' },
          itemStyle: { color: '#ff917c' },
          areaStyle: {
            color: new graphic.RadialGradient(0.1, 0.6, 1, [
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
          symbolSize: isMobile ? 4 : 6,
          lineStyle: { width: 2, type: 'dashed', color: '#60a5fa' },
          itemStyle: { color: '#60a5fa' },
          data: [{ value: peerVals, name: peer?.label || 'Competidor' }],
        },
      ],
    } as const;
  }, [main, peer, isMobile, isTablet]);

  // Calculate responsive height
  const chartHeight = embedded ? '100%' : (isMobile ? '300px' : isTablet ? '400px' : '500px');
  const cardHeight = embedded ? 'h-full' : (isMobile ? 'min-h-[300px]' : isTablet ? 'min-h-[400px]' : 'min-h-[500px]');

  // AHORA sí podemos hacer returns condicionales basados en estado
  if (loading) {
    if (embedded) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400">Evaluando competidores...</div>
        </div>
      );
    }
    return (
      <Card className={`bg-tarjetas border-none ${cardHeight} responsive-container`}>
        <CardContent className={`${isMobile ? 'p-3' : 'p-6'}`}>
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-400">Evaluando competidores...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    if (embedded) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-red-400">Error: {error}</div>
        </div>
      );
    }
    return (
      <Card className={`bg-tarjetas border-none ${cardHeight} responsive-container`}>
        <CardContent className={`${isMobile ? 'p-3' : 'p-6'}`}>
          <div className="flex items-center justify-center h-96">
            <div className="text-red-400">Error: {error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (embedded) {
    return (
      <div className="h-full">
        <div style={{ height: chartHeight, width: '100%' }}>
          <ReactEChartsCore
            echarts={echarts as any}
            option={option as any}
            notMerge
            lazyUpdate
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            onChartReady={(chart: any) => setChartInstance(chart)}
          />
        </div>
      </div>
    );
  }

  return (
    <Card className="bg-tarjetas border-none h-[492px] responsive-container">
      <CardHeader>
        {/* <CardTitle className="text-[#FFA028] text-lg flex items-center justify-center">
          <div className="flex items-center justify-center gap-2">
            <div className="text-gray-400">
              Comparativo
            </div>
            {main && <span className="text-[#FFA028] text-lg">{main.symbol}</span>}
            <span className="text-gray-400">vs</span>
            {peer && <span className="text-blue-300 text-lg">{peer.symbol}</span>}
          </div>
        </CardTitle> */}
      </CardHeader>

      <CardContent className='pl-0 pr-0 pb-0'>
        {/* <CardTitle className="text-[#FFA028] text-lg flex items-center justify-center">
          <div className="flex items-center justify-center gap-2">
            <div className="text-gray-400">
              Comparativo
            </div>
            {main && <span className="text-[#FFA028] text-lg">{main.symbol}</span>}
            <span className="text-gray-400">vs</span>
            {peer && <span className="text-blue-300 text-lg">{peer.symbol}</span>}
          </div>
        </CardTitle> */}
        {main ? (
          <div className="h-96 pl-0 pr-0">
            <ReactEChartsCore
              echarts={echarts}
              option={option}
              notMerge
              lazyUpdate
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
              onChartReady={(chart: any) => setChartInstance(chart)}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-400 text-sm">No hay datos disponibles</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

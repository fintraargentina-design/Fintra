'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, AlertTriangle, Star, Target, BarChart3, DollarSign, Shield, Users,
  ArrowUpCircle, ArrowDownCircle, Clock, LineChart, UserCheck
} from "lucide-react";

// Core (ya los tenías) - CORRECCIÓN AQUÍ
import { getAnalystEstimates } from "@/api/fmpAnalystEstimates";
import { getRatingsSnapshot } from "@/api/fmpRatingsSnapshot";

// NUEVO – APIs extra
import {
  getPriceTargetData,
  formatPriceTargetForDisplay,
  calculateUpside as calcPTUpside,
  getPriceTargetStats,
} from "@/api/fmpPriceTarget";

import {
  getUpgradesDowngradesData,
  formatUpgradesDowngradesForDisplay,
  getAnalystSentiment,
} from "@/api/fmpUpgradesDowngrades";

import {
  getEarnings,
  getUpcomingEarnings,
  calculateEarningsAccuracy,
} from "@/api/fmpEarnings";

import {
  getInsiderTradingBySymbol,
  analyzeInsiderTradingTrends,
} from "@/api/fmpInsiders";

import { compareWithPeers } from "@/api/fmpStockPeers";

/* =========================
   Tipos
   ========================= */
interface EstimacionCardProps {
  selectedStock?: { symbol?: string; name?: string; price?: number } | null;
}

interface AnalystEstimate {
  symbol: string;
  date: string;
  revenueLow: number;
  revenueHigh: number;
  revenueAvg: number;
  ebitdaLow: number;
  ebitdaHigh: number;
  ebitdaAvg: number;
  ebitLow?: number;
  ebitHigh?: number;
  ebitAvg?: number;
  netIncomeLow: number;
  netIncomeHigh: number;
  netIncomeAvg: number;
  sgaExpenseLow?: number;
  sgaExpenseHigh?: number;
  sgaExpenseAvg?: number;
  epsAvg: number;
  epsHigh: number;
  epsLow: number;
  numAnalystsRevenue?: number;
  numAnalystsEps?: number;
}

interface RatingsSnapshot {
  rating: string;
  overallScore: number;
  discountedCashFlowScore: number;
  returnOnEquityScore: number;
  returnOnAssetsScore: number;
  debtToEquityScore: number;
  priceToEarningsScore: number;
  priceToBookScore: number;
}

type RiskColor = 'green'|'yellow'|'red';

/* =========================
   Helpers de formato
   ========================= */
const formatBillions = (v?: number) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `$${(n / 1e9).toFixed(1)}B`;
};

const formatUSD = (v?: number) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
};

const formatEPS = (v?: number) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
};

const pct = (x?: number) => (Number.isFinite(x as number) ? `${(x as number).toFixed(1)}%` : '—');

/* =========================
   Factor scoring helpers
   ========================= */
function calculateQualityAndValuation(ratings: RatingsSnapshot | null) {
  if (!ratings) return { quality: 'N/A', valuation: 'N/A', qualityScore: 0, valuationScore: 0 };
  const qualityScore = (ratings.returnOnEquityScore + ratings.returnOnAssetsScore) / 2;
  const valuationScore = (ratings.discountedCashFlowScore + ratings.priceToEarningsScore + ratings.priceToBookScore) / 3;
  const quality = qualityScore >= 4 ? 'Alta' : qualityScore >= 3 ? 'Media' : 'Baja';
  const valuation = valuationScore > 3 ? 'Atractiva' : valuationScore > 2 ? 'Justa' : 'Exigente';
  return { quality, valuation, qualityScore, valuationScore };
}

function calculateRiskLevel(ratings: RatingsSnapshot | null, base: RiskColor='yellow'): RiskColor {
  if (!ratings) return base;
  let level: RiskColor = base;
  if (ratings.debtToEquityScore >= 4) level = level === 'yellow' ? 'green' : level; // deuda sana reduce riesgo
  if (ratings.priceToBookScore <= 2 && ratings.priceToEarningsScore <= 2) level = level === 'green' ? 'yellow' : 'red'; // múltiplos exigentes
  return level;
}

/* =========================
   Señales de consenso
   ========================= */
const spreadPct = (lo?: number, avg?: number, hi?: number) => {
  const l = Number(lo ?? 0), a = Number(avg ?? 0), h = Number(hi ?? 0);
  if (!a) return null;
  return ((h - l) / a) * 100;
};

function yearOf(est: AnalystEstimate) {
  return new Date(est.date).getFullYear();
}

function forwardPE(price?: number, eps?: number) {
  if (!price || !eps) return null;
  return +(price / eps).toFixed(1);
}

/* =========================
   UI small pieces
   ========================= */
function Stat({label, value, sub}:{label:string; value:React.ReactNode; sub?:string}) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
      <div className="text-xl font-semibold text-white">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function RiskBadge({ level }:{level:RiskColor}) {
  const map = { green: 'bg-green-600', yellow:'bg-yellow-600', red:'bg-red-600' } as const;
  const txt = { green:'Riesgo Bajo', yellow:'Riesgo Moderado', red:'Riesgo Alto' } as const;
  return <Badge className={`${map[level]} text-white`}>{txt[level]}</Badge>;
}

/* =========================
   Componente principal
   ========================= */
export default function EstimacionCard({ selectedStock }: EstimacionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [estimates, setEstimates] = useState<AnalystEstimate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ratingsData, setRatingsData] = useState<RatingsSnapshot | null>(null);

  // NUEVO – estados para módulos extra
  const [pt, setPT] = useState<any>(null);                // price target formatted
  const [ptStats, setPTStats] = useState<any>(null);      // stats de PT
  const [upg, setUpg] = useState<any>(null);              // upgrades/downgrades formatted
  const [earnAcc, setEarnAcc] = useState<any>(null);      // accuracy de earnings
  const [earnNext, setEarnNext] = useState<any>(null);    // próxima fecha de earnings
  const [insTrends, setInsTrends] = useState<any>(null);  // insiders trend
  const [peers, setPeers] = useState<any>(null);          // comparación con pares

  // Charts
  const chartRef1 = useRef<HTMLCanvasElement>(null);
  const chartRef2 = useRef<HTMLCanvasElement>(null);
  const chartRef3 = useRef<HTMLCanvasElement>(null);
  const chartRef4 = useRef<HTMLCanvasElement>(null);
  const chartInstance1 = useRef<any>(null);
  const chartInstance2 = useRef<any>(null);
  const chartInstance3 = useRef<any>(null);
  const chartInstance4 = useRef<any>(null);

  // === Fetch estimates ===
  useEffect(() => {
    if (!selectedStock?.symbol) { setEstimates([]); setError(null); return; }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAnalystEstimates(selectedStock.symbol, { period: 'annual', page: 0, limit: 10 });
        setEstimates(Array.isArray(data) ? data : []);
      } catch (e:any) {
        setError(e?.message || 'Error desconocido');
        setEstimates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedStock?.symbol]);

  // === Fetch ratings ===
  useEffect(() => {
    if (!selectedStock?.symbol) { setRatingsData(null); return; }
    (async () => {
      try { setRatingsData(await getRatingsSnapshot(selectedStock.symbol)); }
      catch { setRatingsData(null); }
    })();
  }, [selectedStock?.symbol]);

  // === NUEVO: fetch módulos extra en paralelo ===
  useEffect(() => {
    if (!selectedStock?.symbol) {
      setPT(null); setPTStats(null); setUpg(null); setEarnAcc(null); setEarnNext(null); setInsTrends(null); setPeers(null);
      return;
    }
    (async () => {
      try {
        const sym = selectedStock.symbol;

        // Price Targets
        const ptRaw = await getPriceTargetData(sym);
        const ptFmt = formatPriceTargetForDisplay(ptRaw);
        if (ptFmt?.consensus && selectedStock?.price) {
          ptFmt.consensus.upside = calcPTUpside(selectedStock.price, ptFmt.consensus.targetConsensus);
        }
        const ptStats_ = ptFmt?.summary && ptFmt?.consensus ? getPriceTargetStats(ptFmt.summary, ptFmt.consensus) : null;
        setPT(ptFmt);
        setPTStats(ptStats_);

        // Upgrades/Downgrades
        const upgRaw = await getUpgradesDowngradesData(sym);
        const upgFmt = formatUpgradesDowngradesForDisplay(upgRaw);
        setUpg(upgFmt);

        // Earnings (hist + próxima fecha + accuracy)
        const earningsHist = await getEarnings(sym);        // { data: [...] }
        const acc = calculateEarningsAccuracy(earningsHist?.data || []);
        setEarnAcc(acc);
        const nextE = await getUpcomingEarnings(sym);
        setEarnNext(nextE?.data?.[0] || null);

        // Insiders
        const insRaw = await getInsiderTradingBySymbol(sym, 0, 120);
        const insTrend = analyzeInsiderTradingTrends(insRaw?.data || []);
        setInsTrends(insTrend);

        // Peers
        const peersComp = await compareWithPeers(sym);
        setPeers(peersComp?.comparison || null);
      } catch (e) {
        // silencioso: si falla algo, solo omite la sección
        console.error(e);
      }
    })();
  }, [selectedStock?.symbol, selectedStock?.price]);

  // === Futuros (orden ascendente) ===
  const futureEstimates = useMemo(() => {
    const y0 = new Date().getFullYear();
    return estimates
      .filter(e => yearOf(e) >= y0)
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [estimates]);

  // === Snapshot previo para momentum (localStorage) ===
  const prevSnapshot = useMemo(() => {
    if (typeof window === 'undefined' || !selectedStock?.symbol) return null as any;
    try { return JSON.parse(localStorage.getItem(`estimates_snapshot_${selectedStock.symbol}`) || 'null'); }
    catch { return null as any; }
  }, [selectedStock?.symbol]);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedStock?.symbol || !futureEstimates.length) return;
    const payload = { ts: Date.now(), rows: futureEstimates };
    localStorage.setItem(`estimates_snapshot_${selectedStock.symbol}`, JSON.stringify(payload));
  }, [selectedStock?.symbol, futureEstimates]);

  // === Derivados clave ===
  const priceNow = selectedStock?.price ?? 0;
  const eps1y = futureEstimates[0]?.epsAvg ?? null;
  const peFwd1y = forwardPE(priceNow, eps1y ?? undefined);

  const peBase = peFwd1y ?? 20;
  const peCons = Math.max(10, peBase - 5);
  const peOpt  = peBase + 5;

  const ptByPE = eps1y ? {
    cons: +(eps1y * peCons).toFixed(2),
    base: +(eps1y * peBase).toFixed(2),
    opt:  +(eps1y * peOpt ).toFixed(2),
  } : null;

  const upside = ptByPE ? {
    cons: priceNow ? ((ptByPE.cons - priceNow)/priceNow*100) : 0,
    base: priceNow ? ((ptByPE.base - priceNow)/priceNow*100) : 0,
    opt:  priceNow ? ((ptByPE.opt  - priceNow)/priceNow*100) : 0,
  } : null;

  const eps1yPrev = useMemo(() => {
    if (!prevSnapshot?.rows?.length || !futureEstimates.length) return null as number|null;
    const y = yearOf(futureEstimates[0]);
    const prevRow = (prevSnapshot.rows as AnalystEstimate[]).find((r:any)=>yearOf(r)===y);
    return prevRow?.epsAvg ?? null;
  }, [prevSnapshot, futureEstimates]);

  const epsRevision = eps1y && eps1yPrev ? ((eps1y - eps1yPrev)/eps1yPrev*100) : null;

  const avgSpreadEPS = useMemo(() => {
    const vals = futureEstimates.map(e => spreadPct(e.epsLow, e.epsAvg, e.epsHigh)).filter(Boolean) as number[];
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  }, [futureEstimates]);

  const avgSpreadRev = useMemo(() => {
    const vals = futureEstimates.map(e => spreadPct(e.revenueLow, e.revenueAvg, e.revenueHigh)).filter(Boolean) as number[];
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  }, [futureEstimates]);

  const totalAnalysts = useMemo(() => {
    if (!futureEstimates.length) return 0;
    return Math.max(...futureEstimates.map(e => Math.max(e.numAnalystsRevenue||0, e.numAnalystsEps||0)));
  }, [futureEstimates]);

  const riskLevel: RiskColor = (() => {
    const years = futureEstimates.length;
    let base: RiskColor = years>=4 ? 'green' : years>=2 ? 'yellow' : 'red';
    return calculateRiskLevel(ratingsData, base);
  })();

  /* =========================
     Charts
     ========================= */
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || futureEstimates.length === 0) return;
    import("chart.js/auto").then((mod) => {
      const Chart = mod.default;
      const ctx1 = chartRef1.current?.getContext("2d");
      const ctx2 = chartRef2.current?.getContext("2d");
      const ctx3 = chartRef3.current?.getContext("2d");
      const ctx4 = chartRef4.current?.getContext("2d");
      if (!ctx1 || !ctx2 || !ctx3 || !ctx4) return;

      chartInstance1.current?.destroy();
      chartInstance1.current = new Chart(ctx1, {
        type: "line",
        data: {
          labels: futureEstimates.map(e => String(yearOf(e))),
          datasets: [
            { label: "Conservador", data: futureEstimates.map(e => e.revenueLow/1e9), borderColor:"rgba(239,68,68,0.8)", backgroundColor:"rgba(239,68,68,0.1)", tension:0.35 },
            { label: "Promedio",    data: futureEstimates.map(e => e.revenueAvg/1e9), borderColor:"rgba(59,130,246,0.8)",  backgroundColor:"rgba(59,130,246,0.1)", tension:0.35 },
            { label: "Optimista",   data: futureEstimates.map(e => e.revenueHigh/1e9), borderColor:"rgba(34,197,94,0.8)", backgroundColor:"rgba(34,197,94,0.1)", tension:0.35 },
          ]
        },
        options: {
          plugins:{ title:{display:true, text:"Proyecciones de Ingresos (Billions)", color:"white"}, legend:{labels:{color:"white"}} },
          scales:{ x:{ticks:{color:"white"}, grid:{color:"rgba(255,255,255,0.1)"}}, y:{ticks:{color:"white"}, grid:{color:"rgba(255,255,255,0.1)"}} }
        }
      });

      chartInstance2.current?.destroy();
      chartInstance2.current = new Chart(ctx2, {
        type: "bar",
        data: {
          labels: futureEstimates.map(e => String(yearOf(e))),
          datasets: [
            { label:"Conservador", data: futureEstimates.map(e => e.epsLow),  backgroundColor:"rgba(239,68,68,0.8)" },
            { label:"Promedio",    data: futureEstimates.map(e => e.epsAvg),  backgroundColor:"rgba(59,130,246,0.8)" },
            { label:"Optimista",   data: futureEstimates.map(e => e.epsHigh), backgroundColor:"rgba(34,197,94,0.8)" },
          ]
        },
        options: {
          plugins:{ title:{display:true, text:"Proyecciones de EPS", color:"white"}, legend:{labels:{color:"white"}} },
          scales:{ x:{ticks:{color:"white"}, grid:{color:"rgba(255,255,255,0.1)"}}, y:{ticks:{color:"white"}, grid:{color:"rgba(255,255,255,0.1)"}} }
        }
      });

      chartInstance3.current?.destroy();
      chartInstance3.current = new Chart(ctx3, {
        type: "line",
        data: {
          labels: futureEstimates.map(e => String(yearOf(e))),
          datasets: [
            { label:"Conservador", data: futureEstimates.map(e => e.ebitdaLow/1e9),  borderColor:"rgba(168,85,247,0.8)", backgroundColor:"rgba(168,85,247,0.1)", tension:0.35 },
            { label:"Promedio",    data: futureEstimates.map(e => e.ebitdaAvg/1e9),  borderColor:"rgba(236,72,153,0.8)", backgroundColor:"rgba(236,72,153,0.1)", tension:0.35 },
            { label:"Optimista",   data: futureEstimates.map(e => e.ebitdaHigh/1e9), borderColor:"rgba(14,165,233,0.8)",  backgroundColor:"rgba(14,165,233,0.1)", tension:0.35 },
          ]
        },
        options: {
          plugins:{ title:{display:true, text:"Proyecciones de EBITDA (Billions)", color:"white"}, legend:{labels:{color:"white"}} },
          scales:{ x:{ticks:{color:"white"}, grid:{color:"rgba(255,255,255,0.1)"}}, y:{ticks:{color:"white"}, grid:{color:"rgba(255,255,255,0.1)"}} }
        }
      });

      chartInstance4.current?.destroy();
      chartInstance4.current = new Chart(ctx4, {
        type: "bar",
        data: {
          labels: futureEstimates.map(e => String(yearOf(e))),
          datasets: [
            { label:"Conservador", data: futureEstimates.map(e => e.netIncomeLow/1e9),  backgroundColor:"rgba(251,146,60,0.8)" },
            { label:"Promedio",    data: futureEstimates.map(e => e.netIncomeAvg/1e9),  backgroundColor:"rgba(34,197,94,0.8)" },
            { label:"Optimista",   data: futureEstimates.map(e => e.netIncomeHigh/1e9), backgroundColor:"rgba(99,102,241,0.8)" },
          ]
        },
        options: {
          plugins:{ title:{display:true, text:"Proyecciones de Ingreso Neto (Billions)", color:"white"}, legend:{labels:{color:"white"}} },
          scales:{ x:{ticks:{color:"white"}, grid:{color:"rgba(255,255,255,0.1)"}}, y:{ticks:{color:"white"}, grid:{color:"rgba(255,255,255,0.1)"}} }
        }
      });
    });

    return () => {
      chartInstance1.current?.destroy();
      chartInstance2.current?.destroy();
      chartInstance3.current?.destroy();
      chartInstance4.current?.destroy();
    };
  }, [isOpen, futureEstimates]);

  // === Badges de calidad de datos ===
  const qualityBadge = useMemo(() => {
    const years = futureEstimates.length;
    const analysts = totalAnalysts;
    if (years >= 4 && analysts >= 20) return { text: "Excelente", color: "bg-green-600" };
    if (years >= 3 && analysts >= 10) return { text: "Buena", color: "bg-blue-600" };
    if (years >= 2 && analysts >= 5)  return { text: "Regular", color: "bg-yellow-600" };
    return { text: "Limitada", color: "bg-red-600" };
  }, [futureEstimates, totalAnalysts]);

  /* =========================
     Render
     ========================= */
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-blue-500/30 cursor-pointer transition-all duration-300 hover:border-[#00BFFF] hover:shadow-lg hover:shadow-[#00BFFF]/20">
          <CardHeader>
            <CardTitle className="text-blue-400 text-lg flex items-center gap-2">
              Estimaciones de Analistas
              <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                {loading ? "Cargando..." : "Análisis"}
              </Badge>
              <Badge className={`${qualityBadge.color} text-white text-xs`}>Datos: {qualityBadge.text}</Badge>
              {ratingsData && (
                <Badge className="bg-purple-600 text-white text-xs">{ratingsData.rating} ({ratingsData.overallScore}/5)</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-400">
            Click para ver detalle: P/E fwd, price targets, upgrades/downgrades, accuracy de earnings, insiders y pares.
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-400 flex items-center gap-3">
            Estimaciones de Analistas — {selectedStock?.symbol}
            <RiskBadge level={riskLevel} />
            <Badge className={`${qualityBadge.color} text-white`}>Datos: {qualityBadge.text}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="space-y-3">
              <div className="h-6 bg-gray-800 rounded animate-pulse" />
              <div className="h-6 bg-gray-800 rounded animate-pulse" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-400"><AlertTriangle className="h-5 w-5"/>{error}</div>
          ) : !futureEstimates.length ? (
            <div className="text-gray-400">No hay estimaciones disponibles</div>
          ) : (
            <>
              {/* KPIs de decisión rápidos */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Stat label="P/E forward 1Y" value={peFwd1y ? `${peFwd1y}×` : "—"} sub={eps1y ? `EPS 1Y ${formatEPS(eps1y)}` : undefined} />
                <Stat label="Momentum EPS 1Y" value={epsRevision !== null ? `${epsRevision>0?'+':''}${(epsRevision as number).toFixed(1)}%` : "—"} sub="vs. snapshot previo" />
                <Stat label="Spread medio EPS" value={avgSpreadEPS!==null ? `${(avgSpreadEPS as number).toFixed(1)}%` : "—"} sub="(High–Low)/Avg" />
                <Stat label="Spread medio Revenue" value={avgSpreadRev!==null ? `${(avgSpreadRev as number).toFixed(1)}%` : "—"} />
              </div>

              {/* Precio objetivo por múltiplos (tu base) */}
              <Card className="bg-gray-800/50 border-green-500/30">
                <CardHeader>
                  <CardTitle className="text-green-400 flex items-center gap-2">
                    <Target className="h-5 w-5" /> Precio Objetivo (múltiplos P/E sobre EPS 1Y)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ptByPE ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="bg-rose-900/30 p-4 rounded">
                        <div className="text-rose-400 text-xl font-bold">{formatUSD(ptByPE.cons)}</div>
                        <div className="text-xs text-gray-400">Conservador · PE {peCons.toFixed(1)}× · Upside {upside ? `${upside.cons>0?'+':''}${upside.cons.toFixed(1)}%` : '—'}</div>
                      </div>
                      <div className="bg-green-900/30 p-4 rounded border border-green-500/30">
                        <div className="text-green-400 text-xl font-bold">{formatUSD(ptByPE.base)}</div>
                        <div className="text-xs text-gray-400">Base · PE {peBase.toFixed(1)}× · Upside {upside ? `${upside.base>0?'+':''}${upside.base.toFixed(1)}%` : '—'}</div>
                      </div>
                      <div className="bg-blue-900/30 p-4 rounded">
                        <div className="text-blue-400 text-xl font-bold">{formatUSD(ptByPE.opt)}</div>
                        <div className="text-xs text-gray-400">Optimista · PE {peOpt.toFixed(1)}× · Upside {upside ? `${upside.opt>0?'+':''}${upside.opt.toFixed(1)}%` : '—'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">Sin EPS 1Y para calcular P/E.</div>
                  )}
                </CardContent>
              </Card>

              {/* NUEVO – Price Targets (consenso real) */}
              {pt?.consensus && (
                <Card className="bg-gray-800/50 border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="text-blue-400 flex items-center gap-2">
                      <LineChart className="h-5 w-5" /> Price Targets (consenso FMP)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Stat label="Consensus" value={formatUSD(pt.consensus.targetConsensus)} sub={`Median ${formatUSD(pt.consensus.targetMedian)}`} />
                    <Stat label="High / Low" value={`${formatUSD(pt.consensus.targetHigh)} / ${formatUSD(pt.consensus.targetLow)}`} />
                    <Stat label="Upside vs. precio" value={pt.consensus.upside !== null ? pct(pt.consensus.upside) : '—'} />
                    <Stat label="Cobertura 12m" value={ptStats?.coverage?.lastYear ?? 0} sub="Analistas (últ. 12m)" />
                  </CardContent>
                </Card>
              )}

              {/* NUEVO – Upgrades/Downgrades + Sentimiento */}
              {upg && (
                <Card className="bg-gray-800/50 border-amber-500/30">
                  <CardHeader>
                    <CardTitle className="text-amber-400 flex items-center gap-2">
                      <Users className="h-5 w-5" /> Upgrades & Downgrades (reciente)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {upg.consensus && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                        <Stat label="Strong Buy" value={upg.consensus.strongBuy} />
                        <Stat label="Buy" value={upg.consensus.buy} />
                        <Stat label="Hold" value={upg.consensus.hold} />
                        <Stat label="Sell" value={upg.consensus.sell} />
                        <Stat label="Strong Sell" value={upg.consensus.strongSell} />
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                      <div className="bg-gray-800/60 p-3 rounded-md border border-gray-700/50">
                        <div className="text-sm text-gray-400 mb-1">Actividad 10 más recientes</div>
                        <div className="flex items-center justify-center gap-4">
                          <span className="flex items-center gap-1 text-green-400"><ArrowUpCircle className="w-4 h-4"/>{upg.recentActivity.upgrades}</span>
                          <span className="flex items-center gap-1 text-yellow-400"><Clock className="w-4 h-4"/>{upg.recentActivity.maintains}</span>
                          <span className="flex items-center gap-1 text-red-400"><ArrowDownCircle className="w-4 h-4"/>{upg.recentActivity.downgrades}</span>
                        </div>
                      </div>
                      <div className="bg-gray-800/60 p-3 rounded-md border border-gray-700/50">
                        <div className="text-sm text-gray-400 mb-1">Tendencia histórica</div>
                        <div className="text-white">{upg.historicalTrend?.trend === 'improving' ? 'Mejora' : upg.historicalTrend?.trend === 'deteriorating' ? 'Deterioro' : 'Estable'}</div>
                      </div>
                      <div className="bg-gray-800/60 p-3 rounded-md border border-gray-700/50">
                        <div className="text-sm text-gray-400 mb-1">Sentimiento</div>
                        {(() => {
                          const s = getAnalystSentiment(upg.consensus);
                          return <div className="text-white font-semibold">{s.sentiment}</div>;
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* NUEVO – Earnings accuracy + próxima fecha */}
              {(earnAcc || earnNext) && (
                <Card className="bg-gray-800/50 border-violet-500/30">
                  <CardHeader>
                    <CardTitle className="text-violet-400 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" /> Earnings: precisión de estimaciones y calendario
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Stat label="Reports (históricos válidos)" value={earnAcc?.totalReports ?? 0} />
                    <Stat label="Accuracy (beats/total)" value={pct(earnAcc ? earnAcc.accuracyRate : undefined)} sub={`${earnAcc?.beatsCount ?? 0} beats · ${earnAcc?.missesCount ?? 0} misses`} />
                    <Stat label="Var. promedio EPS" value={pct(earnAcc ? earnAcc.averageVariance : undefined)} />
                    <Stat label="Próximo earnings" value={earnNext ? new Date(earnNext.date).toLocaleDateString() : '—'} sub={earnNext?.time ?? ''} />
                  </CardContent>
                </Card>
              )}

              {/* NUEVO – Insiders */}
              {insTrends && (
                <Card className="bg-gray-800/50 border-emerald-500/30">
                  <CardHeader>
                    <CardTitle className="text-emerald-400 flex items-center gap-2">
                      <UserCheck className="h-5 w-5" /> Insider Trading (tendencias)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
                    <Stat label="Transacciones" value={insTrends.totalTransactions} />
                    <Stat label="Compras" value={insTrends.buyTransactions} />
                    <Stat label="Ventas" value={insTrends.sellTransactions} />
                    <Stat label="Sentimiento Neto" value={insTrends.netSentiment} />
                    <Stat label="Actividad 30d" value={insTrends.recentActivity} />
                  </CardContent>
                </Card>
              )}

              {/* NUEVO – Comparación con pares */}
              {peers && (
                <Card className="bg-gray-800/50 border-sky-500/30">
                  <CardHeader>
                    <CardTitle className="text-sky-400 flex items-center gap-2">
                      <Users className="h-5 w-5" /> Comparación con Pares (mkt cap · beta · precio)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Stat label="Mkt Cap (ranking)" value={`#${peers.marketCap?.ranking ?? '-'}`} sub={`Prom. pares ${formatUSD(peers.marketCap?.peerAverage)}`} />
                    <Stat label="Precio prom. pares" value={formatUSD(peers.price?.peerAverage)} sub={`Rango ${formatUSD(peers.price?.peerMin)} – ${formatUSD(peers.price?.peerMax)}`} />
                    <Stat label="Beta vs pares" value={(peers.beta?.main ?? 0).toFixed(2)} sub={`Prom. pares ${(peers.beta?.peerAverage ?? 0).toFixed(2)}`} />
                  </CardContent>
                </Card>
              )}

              {/* Grids de stats básicas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Stat label="Años disponibles" value={futureEstimates.length} sub={`${yearOf(futureEstimates[0])}–${yearOf(futureEstimates[futureEstimates.length-1])}`} />
                <Stat label="Máx. analistas" value={totalAnalysts} />
                {ratingsData && (
                  <>
                    <Stat
                      label="Calidad negocio"
                      value={calculateQualityAndValuation(ratingsData).quality}
                      sub={`ROE ${ratingsData.returnOnEquityScore}/5 · ROA ${ratingsData.returnOnAssetsScore}/5`}
                    />
                    <Stat
                      label="Valuación"
                      value={calculateQualityAndValuation(ratingsData).valuation}
                      sub={`P/E ${ratingsData.priceToEarningsScore}/5 · P/B ${ratingsData.priceToBookScore}/5`}
                    />
                  </>
                )}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800/50 rounded-lg p-4"><canvas ref={chartRef1} className="w-full h-64" /></div>
                <div className="bg-gray-800/50 rounded-lg p-4"><canvas ref={chartRef2} className="w-full h-64" /></div>
                <div className="bg-gray-800/50 rounded-lg p-4"><canvas ref={chartRef3} className="w-full h-64" /></div>
                <div className="bg-gray-800/50 rounded-lg p-4"><canvas ref={chartRef4} className="w-full h-64" /></div>
              </div>

              {/* Tablas compactas (Revenue/EPS/EBITDA/NetIncome futuros) */}
              <div className="space-y-6">
                {/* Revenue */}
                <div>
                  <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Proyecciones de Ingresos</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-700"><th className="text-left py-2 text-gray-300">Año</th><th className="text-right py-2 text-gray-300">Conservador</th><th className="text-right py-2 text-gray-300">Promedio</th><th className="text-right py-2 text-gray-300">Optimista</th><th className="text-right py-2 text-gray-300">Analistas</th></tr></thead>
                      <tbody>
                        {futureEstimates.map(e=>(
                          <tr key={e.date} className="border-b border-gray-800">
                            <td className="py-2 text-white font-medium">{yearOf(e)}</td>
                            <td className="py-2 text-right text-red-400">{formatBillions(e.revenueLow)}</td>
                            <td className="py-2 text-right text-blue-400 font-semibold">{formatBillions(e.revenueAvg)}</td>
                            <td className="py-2 text-right text-green-400">{formatBillions(e.revenueHigh)}</td>
                            <td className="py-2 text-right text-gray-400">{e.numAnalystsRevenue ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* EPS */}
                <div>
                  <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2"><Target className="h-4 w-4" /> Proyecciones de EPS</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-700"><th className="text-left py-2 text-gray-300">Año</th><th className="text-right py-2 text-gray-300">Conservador</th><th className="text-right py-2 text-gray-300">Promedio</th><th className="text-right py-2 text-gray-300">Optimista</th><th className="text-right py-2 text-gray-300">Analistas</th></tr></thead>
                      <tbody>
                        {futureEstimates.map(e=>(
                          <tr key={e.date} className="border-b border-gray-800">
                            <td className="py-2 text-white font-medium">{yearOf(e)}</td>
                            <td className="py-2 text-right text-red-400">{formatEPS(e.epsLow)}</td>
                            <td className="py-2 text-right text-blue-400 font-semibold">{formatEPS(e.epsAvg)}</td>
                            <td className="py-2 text-right text-green-400">{formatEPS(e.epsHigh)}</td>
                            <td className="py-2 text-right text-gray-400">{e.numAnalystsEps ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* EBITDA */}
                <div>
                  <h4 className="text-blue-400 font-semibold mb-2">Proyecciones de EBITDA</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-700"><th className="text-left py-2 text-gray-300">Año</th><th className="text-right py-2 text-gray-300">Conservador</th><th className="text-right py-2 text-gray-300">Promedio</th><th className="text-right py-2 text-gray-300">Optimista</th></tr></thead>
                      <tbody>
                        {futureEstimates.map(e=>(
                          <tr key={e.date} className="border-b border-gray-800">
                            <td className="py-2 text-white font-medium">{yearOf(e)}</td>
                            <td className="py-2 text-right text-red-400">{formatBillions(e.ebitdaLow)}</td>
                            <td className="py-2 text-right text-blue-400 font-semibold">{formatBillions(e.ebitdaAvg)}</td>
                            <td className="py-2 text-right text-green-400">{formatBillions(e.ebitdaHigh)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Net Income */}
                <div>
                  <h4 className="text-blue-400 font-semibold mb-2">Proyecciones de Ingreso Neto</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-700"><th className="text-left py-2 text-gray-300">Año</th><th className="text-right py-2 text-gray-300">Conservador</th><th className="text-right py-2 text-gray-300">Promedio</th><th className="text-right py-2 text-gray-300">Optimista</th></tr></thead>
                      <tbody>
                        {futureEstimates.map(e=>(
                          <tr key={e.date} className="border-b border-gray-800">
                            <td className="py-2 text-white font-medium">{yearOf(e)}</td>
                            <td className="py-2 text-right text-red-400">{formatBillions(e.netIncomeLow)}</td>
                            <td className="py-2 text-right text-blue-400 font-semibold">{formatBillions(e.netIncomeAvg)}</td>
                            <td className="py-2 text-right text-green-400">{formatBillions(e.netIncomeHigh)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ChartsTabHistoricos from "@/components/tabs/ChartsTabHistoricos";
import PeersAnalysisPanel from "@/components/dashboard/PeersAnalysisPanel";
import { 
  FinancialSnapshot, 
  FundamentalsTimelineResponse, 
  PerformanceTimelineResponse 
} from "@/lib/engine/types";

// --- TYPES ---

interface SnapshotTabProps {
  stockAnalysis: FinancialSnapshot | any; // Contains snapshot data (relative_return, scores, etc.)
  stockPerformance?: any;
  stockBasicData?: any; // Contains market_cap, etc.
  symbol: string;
  peerTicker?: string | null;
  ratios?: any;
  metrics?: any;
}

// --- HELPER COMPONENTS ---

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-row justify-between items-baseline pb-3 border-b border-zinc-800 mb-4">
      <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider">
        {title}
      </h3>
      {subtitle && <span className="text-zinc-500 text-[10px]">{subtitle}</span>}
    </div>
  );
}



// --- FORMATTERS ---

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "N/D";
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
};

const formatNumber = (val: number | null | undefined, decimals = 2) => {
  if (val === null || val === undefined) return "N/D";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatPercent = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "-";
  const sign = val > 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(2)}%`;
};

// --- MAIN COMPONENT ---

export default function SnapshotTab({
  stockAnalysis,
  stockBasicData,
  symbol,
  ratios: ratiosProp,
  metrics: metricsProp,
}: SnapshotTabProps) {
  const [timelineData, setTimelineData] = useState<FundamentalsTimelineResponse | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceTimelineResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // 1. Fetch Fundamentals Timeline (for Financial Metrics)
  useEffect(() => {
    let active = true;
    async function fetchFundamentals() {
      try {
        const res = await fetch(`/api/analysis/fundamentals-timeline?ticker=${symbol}`);
        if (res.ok && active) {
          const json = await res.json();
          setTimelineData(json);
        }
      } catch (e) {
        console.warn("Fundamentals fetch failed", e);
      }
    }
    if (symbol) fetchFundamentals();
    return () => { active = false; };
  }, [symbol]);

  // 2. Fetch Performance Timeline (for Historical Chart)
  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    async function fetchPerformance() {
      try {
        const res = await fetch(`/api/analysis/performance-timeline?ticker=${symbol}`);
        if (res.ok && active) {
          const json = await res.json();
          setPerformanceData(json);
        }
      } catch (e) {
        console.warn("Performance fetch failed", e);
      } finally {
        if (active) setLoadingHistory(false);
      }
    }
    if (symbol) fetchPerformance();
    return () => { active = false; };
  }, [symbol]);

  // --- DATA PREPARATION ---

  // A) Relative Result
  const relativeReturn = stockAnalysis?.relative_return || {};
  const relativeRows = [
    { label: "1W", key: "1W" },
    { label: "1M", key: "1M" },
    { label: "YTD", key: "YTD" },
    { label: "1Y", key: "1Y" },
    { label: "3Y", key: "3Y" },
    { label: "5Y", key: "5Y" },
  ];

  // B) Historical Chart Data
  const chartSeries = useMemo(() => {
    if (!performanceData || !performanceData.years) return [];
    // Transform API structure to Recharts friendly array
    // We'll extract "Total Return" metric
    const totalReturnMetric = performanceData.metrics?.find((m) => m.key === "total_return" || m.label === "Total Return");
    if (!totalReturnMetric) return [];

    // Map years to data points
    return performanceData.years.map((y) => {
      const valObj = totalReturnMetric.values[y.year.toString()] || {};
      return {
        year: y.year.toString(),
        value: valObj.value,
      };
    }).sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [performanceData]);

  // C) Financial Metrics (Latest TTM or FY)
  const financialMetrics = useMemo(() => {
    if (!timelineData) return {};
    
    // Helper to find by fuzzy label
    const findByLabel = (labelPart: string) => {
       return timelineData.metrics?.find((m) => m.label.toLowerCase().includes(labelPart.toLowerCase()));
    };

    const extract = (labelPart: string) => {
       const m = findByLabel(labelPart);
       if (!m) return null;
       const periods = Object.keys(m.values);
       // We prefer TTM, then FY. 
       // The API usually keys by "2024", "2023".
       // We'll take the latest available key.
       const latestKey = periods.sort((a,b) => parseInt(b) - parseInt(a))[0];
       return m.values[latestKey];
    };

    return {
      revenue: extract("Revenue"),
      netIncome: extract("Net Income"),
      assets: extract("Total Assets"),
      liabilities: extract("Total Liabilities"),
      fcf: extract("Free Cash Flow"),
      debt: extract("Total Debt"),
      operatingMargin: extract("Operating Margin"),
      ebitda: extract("EBITDA")
    };
  }, [timelineData]);

  // Helper for EBIT calculation
  const ebitValue = useMemo(() => {
    if (financialMetrics.revenue?.value && financialMetrics.operatingMargin?.value) {
        return financialMetrics.revenue.value * (financialMetrics.operatingMargin.value / 100);
    }
    return financialMetrics.ebitda?.value || null;
  }, [financialMetrics]);

  // D) Technical Ratios
  // Prioritize Snapshot (stockAnalysis), then Live TTM (props), then Basic Data
  const ratios = {
    altman: stockAnalysis?.altman_z ?? stockAnalysis?.metrics?.altmanZScore ?? metricsProp?.altmanZScore,
    piotroski: stockAnalysis?.piotroski_score ?? stockAnalysis?.metrics?.piotroskiScore ?? metricsProp?.piotroskiScore,
    currentRatio: stockAnalysis?.metrics?.currentRatio ?? ratiosProp?.currentRatioTTM ?? stockBasicData?.current_ratio,
    debtEquity: stockAnalysis?.metrics?.debtEquityRatio ?? ratiosProp?.debtEquityRatioTTM ?? stockBasicData?.debt_equity,
    roe: stockAnalysis?.metrics?.roe ?? ratiosProp?.returnOnEquityTTM ?? stockBasicData?.roe,
  };

  const snapshotDate = stockAnalysis?.snapshot_date || new Date().toISOString().split('T')[0];
  const sectorRank = stockAnalysis?.sector_rank;
  const sectorRankTotal = stockAnalysis?.sector_rank_total;

  return (
    <div className="flex flex-col gap-1 p-1 bg-transparent min-h-screen text-zinc-200 font-sans">
      
      {/* 1) RESULTADO RELATIVO */}
      <section>
        <SectionHeader 
          title="Resultado Relativo" 
          subtitle={`Datos al snapshot: ${snapshotDate}${sectorRank && sectorRankTotal ? ` • Rank Sectorial: #${sectorRank} de ${sectorRankTotal}` : ''}`} 
        />
        <div className="grid grid-cols-[30%_70%] gap-2 bg-zinc-900/20 p-2">
          {/* LEFT: TABLE */}
          <div className="bg-[#0A0A0A] rounded overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-[#1D1D1D] sticky top-0">
                <tr className="border-0">
                  <th className="px-3 text-white text-[13px] py-0 h-5 text-left border-r border-black font-light">Ventana</th>
                  <th className="px-2 text-white text-[13px] py-0 h-5 text-right border-r border-black font-light">vs Peer</th>
                  <th className="px-2 text-white text-[13px] py-0 h-5 text-right font-light">vs Mercado</th>
                </tr>
              </thead>
              <tbody>
                {relativeRows.map((row) => {
                  const sectorKey = `relative_vs_sector_${row.key}` as keyof FinancialSnapshot;
                  const marketKey = `relative_vs_market_${row.key}` as keyof FinancialSnapshot;

                  const sectorVal = stockAnalysis?.[sectorKey] as number | null | undefined;
                  const marketVal = stockAnalysis?.[marketKey] as number | null | undefined;

                  const sectorColor = sectorVal && sectorVal > 0 ? 'text-green-400' : sectorVal && sectorVal < 0 ? 'text-red-400' : 'text-zinc-400';
                  const marketColor = marketVal && marketVal > 0 ? 'text-green-400' : marketVal && marketVal < 0 ? 'text-red-400' : 'text-zinc-400';

                  return (
                    <tr key={row.key} className="border-b border-[#484848] hover:bg-zinc-900/50 transition-colors h-5">
                      <td className="px-3 py-0 text-[13px] font-mono text-zinc-400 border-r border-black">{row.label}</td>
                      <td className={`px-2 py-0 text-[13px] font-mono text-right border-r border-black ${sectorColor}`}>
                        {formatPercent(sectorVal)}
                      </td>
                      <td className={`px-2 py-0 text-[13px] font-mono text-right ${marketColor}`}>
                        {formatPercent(marketVal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* RIGHT: CHART */}
          <div className="h-[280px] bg-[#0A0A0A] rounded overflow-hidden">
            <ChartsTabHistoricos 
              symbol={symbol}
              showBenchmark={true}
              isActive={true}
            />
          </div>
        </div>
      </section>

      {/* 2) PERFORMANCE RELATIVA VS SECTOR E INDUSTRIA */}
      <section>
        <SectionHeader title="Performance Relativa vs Sector e Industria" />
        <div className="grid grid-cols-[30%_70%] gap-2 bg-zinc-900/20 p-2">
          {/* LEFT: TABLE */}
          <div className="bg-[#0A0A0A] rounded overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-[#1D1D1D] sticky top-0">
                <tr className="border-0">
                  <th className="px-3 text-white text-[13px] py-0 h-5 text-left border-r border-black font-light">Ventana</th>
                  <th className="px-2 text-white text-[13px] py-0 h-5 text-right border-r border-black font-light">vs Sector</th>
                  <th className="px-2 text-white text-[13px] py-0 h-5 text-right font-light">vs Industry</th>
                </tr>
              </thead>
              <tbody>
                {relativeRows.map((row) => {
                  const sectorKey = `relative_vs_sector_${row.key}` as keyof FinancialSnapshot;
                  const industryKey = `relative_vs_industry_${row.key}` as keyof FinancialSnapshot;

                  const sectorVal = stockAnalysis?.[sectorKey] as number | null | undefined;
                  const industryVal = stockAnalysis?.[industryKey] as number | null | undefined;

                  const sectorColor = sectorVal && sectorVal > 0 ? 'text-green-400' : sectorVal && sectorVal < 0 ? 'text-red-400' : 'text-zinc-400';
                  const industryColor = industryVal && industryVal > 0 ? 'text-green-400' : industryVal && industryVal < 0 ? 'text-red-400' : 'text-zinc-400';

                  return (
                    <tr key={row.key} className="border-b border-[#484848] hover:bg-zinc-900/50 transition-colors h-5">
                      <td className="px-3 py-0 text-[13px] font-mono text-zinc-400 border-r border-black">{row.label}</td>
                      <td className={`px-2 py-0 text-[13px] font-mono text-right border-r border-black ${sectorColor}`}>
                        {formatPercent(sectorVal)}
                      </td>
                      <td className={`px-2 py-0 text-[13px] font-mono text-right ${industryColor}`}>
                        {formatPercent(industryVal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* RIGHT: CHART */}
          <div className="h-[280px] bg-[#0A0A0A] rounded overflow-hidden">
            <ChartsTabHistoricos 
              symbol={symbol}
              showBenchmark={true}
              isActive={true}
            />
          </div>
        </div>
      </section>

      {/* 3) PEERS TABLE */}
      <section>
        <SectionHeader title="Competidores Directos" subtitle={`Peers de ${symbol}`} />
        <div className="bg-zinc-900/20 rounded overflow-hidden" style={{ height: '400px' }}>
          <PeersAnalysisPanel 
            symbol={symbol}
            selectedPeer={null}
          />
        </div>
      </section>

      {/* Footer / Micro-copy */}
      <div className="pt-2 border-t border-zinc-900 mt-4">
        <p className="text-[10px] text-zinc-600 font-mono text-center">
            Ventanas de observación • Datos al snapshot: {snapshotDate}
        </p>
      </div>
    </div>
  );
}





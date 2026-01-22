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
import { FinancialSnapshot } from "@/lib/engine/types";

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
  const [timelineData, setTimelineData] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
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
    const totalReturnMetric = performanceData.metrics?.find((m: any) => m.key === "total_return" || m.label === "Total Return");
    if (!totalReturnMetric) return [];

    // Map years to data points
    return performanceData.years.map((y: any) => {
      const valObj = totalReturnMetric.values[y.year.toString()] || {};
      return {
        year: y.year.toString(),
        value: valObj.value,
      };
    }).sort((a: any, b: any) => parseInt(a.year) - parseInt(b.year));
  }, [performanceData]);

  // C) Financial Metrics (Latest TTM or FY)
  const financialMetrics = useMemo(() => {
    if (!timelineData) return {};
    
    // Helper to find by fuzzy label
    const findByLabel = (labelPart: string) => {
       return timelineData.metrics?.find((m: any) => m.label.toLowerCase().includes(labelPart.toLowerCase()));
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
    <div className="flex flex-col gap-4 p-2 bg-transparent min-h-screen text-zinc-200 font-sans">
      
      {/* 1) RESULTADO RELATIVO */}
      <section>
        <SectionHeader 
          title="Resultado Relativo" 
          subtitle={`Datos al snapshot: ${snapshotDate}${sectorRank && sectorRankTotal ? ` • Rank Sectorial: #${sectorRank} de ${sectorRankTotal}` : ''}`} 
        />
        <div className="border border-zinc-800 rounded-sm bg-zinc-900/20">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="h-6 text-[9px] uppercase tracking-wider text-zinc-500 font-medium">Ventana</TableHead>
                <TableHead className="h-6 text-[9px] uppercase tracking-wider text-zinc-500 font-medium text-right">vs Sector</TableHead>
                <TableHead className="h-6 text-[9px] uppercase tracking-wider text-zinc-500 font-medium text-right">vs Mercado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relativeRows.map((row) => {
                // Construct property names for explicit columns
                // e.g. relative_vs_sector_1w
                const sectorKey = `relative_vs_sector_${row.key}` as keyof FinancialSnapshot;
                const marketKey = `relative_vs_market_${row.key}` as keyof FinancialSnapshot;

                const sectorVal = stockAnalysis?.[sectorKey] as number | null | undefined;
                const marketVal = stockAnalysis?.[marketKey] as number | null | undefined;

                return (
                  <TableRow key={row.key} className="border-zinc-800/30 hover:bg-transparent">
                    <TableCell className="py-1 text-[11px] font-mono text-zinc-400">{row.label}</TableCell>
                    <TableCell className="py-1 text-[11px] font-mono text-right text-zinc-300">
                      {formatPercent(sectorVal)}
                    </TableCell>
                    <TableCell className="py-1 text-[11px] font-mono text-right text-zinc-300">
                      {formatPercent(marketVal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* 2) PERFORMANCE HISTÓRICA */}
      <section className="h-[300px] flex flex-col">
        <SectionHeader title="Performance Relativa vs Sector e Industria" />
        <div className="flex-1 w-full border border-zinc-800 rounded-sm bg-zinc-900/20 p-2 relative">
            {loadingHistory ? (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
                </div>
            ) : chartSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis 
                            dataKey="year" 
                            stroke="#52525b" 
                            tick={{fontSize: 10}} 
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis 
                            stroke="#52525b" 
                            tick={{fontSize: 10}} 
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '12px' }}
                            itemStyle={{ color: '#e4e4e7' }}
                            formatter={(val: number) => [`${(val * 100).toFixed(2)}%`, "Retorno"]}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#e4e4e7" 
                            strokeWidth={1.5} 
                            dot={{ r: 2, fill: '#e4e4e7' }} 
                            activeDot={{ r: 4 }} 
                        />
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                    Gráfico no disponible
                </div>
            )}
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





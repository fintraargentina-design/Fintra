"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";
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
import PeersAnalysisPanel from "@/components/dashboard/PeersAnalysisPanel";

// --- TYPES ---

interface SnapshotTabProps {
  stockAnalysis: FinancialSnapshot | any; // Read-only from fintra_snapshots
  symbol: string;
  peerTicker?: string | null;
  // Deprecated/Unused props kept for interface compatibility if needed, but ignored
  stockPerformance?: any;
  stockBasicData?: any;
  ratios?: any;
  metrics?: any;
}

// --- HELPER COMPONENTS ---

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-row justify-between items-baseline pb-1 ">
      <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider">
        {title}
      </h3>
      {subtitle && <span className="text-zinc-500 text-[10px]">{subtitle}</span>}
    </div>
  );
}

// --- MAIN COMPONENT ---

export default function SnapshotTab({
  stockAnalysis,
  symbol,
  peerTicker,
}: SnapshotTabProps) {
  
  // 1. Prepare Vs Market Data (Time Series / Windows)
  const marketChartData = useMemo(() => {
    const rr = stockAnalysis?.relative_return || {};
    const windows = ['1Y', '3Y', '5Y'];
    
    return windows.map(w => {
        const data = rr[w];
        if (!data) return null;
        return {
            window: w,
            Company: data.asset_return, // Capitalized for Legend
            Market: data.benchmark_return,
            drawdown: data.asset_max_drawdown
        };
    }).filter(item => item !== null && item.Company != null && item.Market != null);
  }, [stockAnalysis]);

  // 2. Prepare Vs Sector & Industry Data (Historical Comparison - Alphas)
  const sectorIndustryData = useMemo(() => {
    const windows = [
        { key: '1y', label: '1Y' }, 
        { key: '3y', label: '3Y' }, 
        { key: '5y', label: '5Y' }
    ];
    
    return windows.map(w => {
        // Explicit fields from snapshot
        const sectorAlpha = stockAnalysis?.[`relative_vs_sector_${w.key}`];
        const industryAlpha = stockAnalysis?.[`relative_vs_industry_${w.key}`];
        
        // If both are null, skip? Or show as 0? Better skip or show null.
        if (sectorAlpha == null && industryAlpha == null) return null;

        return {
            window: w.label,
            'vs Sector': sectorAlpha,
            'vs Industry': industryAlpha
        };
    }).filter(item => item !== null);
  }, [stockAnalysis]);

  const snapshotDate = stockAnalysis?.snapshot_date || new Date().toISOString().split('T')[0];
  const sectorRank = stockAnalysis?.sector_rank;
  const sectorRankTotal = stockAnalysis?.sector_rank_total;

  return (
    <div className="flex flex-col gap-2 p-1 bg-transparent min-h-screen text-zinc-200 font-sans">
      
      {/* A. VS MARKET */}
      <section className="flex flex-col h-[320px]">
        <SectionHeader 
          title="Vs Market (Contextual)" 
          subtitle={`Windows: 1Y, 3Y, 5Y • Neutral Colors`} 
        />
        <div className="flex-1 w-full bg-zinc-900/20 p-2 border border-zinc-800/30 rounded-sm">
            {marketChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marketChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis 
                            dataKey="window" 
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
                            tickFormatter={(val) => `${val}%`}
                        />
                        <Tooltip 
                            cursor={{ fill: '#27272a', opacity: 0.4 }}
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '12px' }}
                            itemStyle={{ color: '#e4e4e7' }}
                            formatter={(val: number) => [`${val.toFixed(2)}%`, "Return"]}
                            labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                        />
                        <Legend 
                            wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} 
                            iconSize={8}
                        />
                        <Bar dataKey="Company" fill="#e4e4e7" radius={[2, 2, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="Market" fill="#52525b" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                    Insufficient Market Comparison Data
                </div>
            )}
        </div>
      </section>

      {/* B. VS SECTOR & INDUSTRY */}
      <section className="flex flex-col h-[320px]">
        <SectionHeader 
            title="Vs Sector & Industry (Alpha)" 
            subtitle="Historical Outperformance/Underperformance"
        />
        <div className="flex-1 w-full bg-zinc-900/20 p-4 border border-zinc-800/30 rounded-sm">
            {sectorIndustryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sectorIndustryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSector" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorIndustry" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis 
                            dataKey="window" 
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
                            formatter={(val: number) => [`${(val * 100).toFixed(2)}%`, "Alpha"]}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} iconSize={8} />
                        <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
                        
                        <Area 
                            type="monotone" 
                            dataKey="vs Sector" 
                            stroke="#3b82f6" 
                            fillOpacity={1} 
                            fill="url(#colorSector)" 
                            strokeWidth={1.5}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="vs Industry" 
                            stroke="#8b5cf6" 
                            fillOpacity={1} 
                            fill="url(#colorIndustry)" 
                            strokeWidth={1.5}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                    Insufficient Sector/Industry Data
                </div>
            )}
        </div>
      </section>

      {/* C. PEERS */}
      <section className="flex flex-col pt-1">
        <SectionHeader 
            title="Peers Analysis" 
            subtitle={`Rank Sectorial: #${sectorRank || '-'} de ${sectorRankTotal || '-'}`}
        />
        <div className="h-[400px]">
            <PeersAnalysisPanel 
              symbol={symbol} 
              selectedPeer={peerTicker} 
            />
        </div>
      </section>

      {/* Footer */}
      <div className="pt-1 border-t border-zinc-900 mt-0.5">
        <p className="text-[10px] text-zinc-600 font-mono text-center">
            Source: fintra_snapshots • Snapshot Date: {snapshotDate} • No Real-time Recalculation
        </p>
      </div>
    </div>
  );
}





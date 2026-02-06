"use client";

import React, { useMemo, useState, useEffect } from "react";
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
  LineChart,
  Line,
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
import { useAlphaPerformance } from "@/lib/hooks/useAlphaPerformance";

// --- TYPES ---

interface SnapshotTabProps {
  stockAnalysis: FinancialSnapshot | null; // Read-only from fintra_snapshots
  symbol: string;
  peerTicker?: string | null;
  onPeerSelect?: (peer: string | null) => void;
  // Deprecated/Unused props kept for interface compatibility if needed, but ignored
  stockPerformance?: any;
  stockBasicData?: any;
  ratios?: any;
  metrics?: any;
}

// --- HELPER COMPONENTS ---

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col justify-between items-baseline pb-1 border-b border-[#222] mb-2">
      <h3 className="text-white text-xs font-semibold uppercase tracking-wider">
        {title}
      </h3>
      {subtitle && (
        <span className="text-zinc-500 text-[10px]">{subtitle}</span>
      )}
    </div>
  );
}

// --- MAIN COMPONENT ---

export default function SnapshotTab({
  stockAnalysis,
  symbol,
  peerTicker,
  onPeerSelect,
}: SnapshotTabProps) {
  // STATE: Selected peer for Alpha comparison (Local state for uncontrolled mode)
  const [localPeer, setLocalPeer] = useState<string | null>(null);

  // Determine effective peer (Controlled vs Uncontrolled)
  // If onPeerSelect is provided, we assume controlled mode via peerTicker
  const isControlled = onPeerSelect !== undefined;
  const selectedPeer = isControlled ? (peerTicker ?? null) : localPeer;

  const handlePeerSelect = (peer: string) => {
    const newPeer = selectedPeer === peer ? null : peer;
    if (isControlled) {
      onPeerSelect?.(newPeer);
    } else {
      setLocalPeer(newPeer);
    }
  };

  // Reset local state if symbol changes (defensive for uncontrolled mode)
  useEffect(() => {
    if (!isControlled) {
      setLocalPeer(null);
    }
  }, [symbol, isControlled]);

  // 2. Fetch Alpha Data (New Hook)
  const { data: alphaData, loading: alphaLoading } = useAlphaPerformance({
    ticker: symbol,
    peerTicker: selectedPeer ?? null,
  });

  const hasAlphaData = useMemo(() => {
    // VISIBILITY RULE: Chart renders if and only if the PRIMARY ticker has alpha data.
    // Peer data presence is irrelevant for chart visibility (it's an optional overlay).
    return alphaData.some(
      (d) => d.symbolVsSector !== null || d.symbolVsIndustry !== null,
    );
  }, [alphaData]);

  // Determine which peer series to show (only if data exists)
  const showPeerSector = useMemo(
    () =>
      selectedPeer &&
      alphaData.some((d) => d.peerVsSector != null && !isNaN(d.peerVsSector)),
    [alphaData, selectedPeer],
  );

  const showPeerIndustry = useMemo(
    () =>
      selectedPeer &&
      alphaData.some(
        (d) => d.peerVsIndustry != null && !isNaN(d.peerVsIndustry),
      ),
    [alphaData, selectedPeer],
  );

  // 3. Prepare Vs Market Data (Time Series / Windows)
  const marketChartData = useMemo(() => {
    // Safe navigation for deeply nested structure
    // Structure: relative_return -> components -> window_alpha -> { "1Y": ... }
    const rr = stockAnalysis?.relative_return?.components?.window_alpha || {};
    const windows = ["1Y", "3Y", "5Y"];

    return windows
      .map((w) => {
        const data = rr[w];
        if (!data) return null;
        return {
          window: w,
          Company: data.asset_return, // Capitalized for Legend
          Market: data.benchmark_return,
          drawdown: data.asset_max_drawdown,
        };
      })
      .filter(
        (item) => item !== null && item.Company != null && item.Market != null,
      );
  }, [stockAnalysis]);

  const snapshotDate =
    stockAnalysis?.snapshot_date || new Date().toISOString().split("T")[0];
  const sectorRank = stockAnalysis?.sector_rank;
  const sectorRankTotal = stockAnalysis?.sector_rank_total;

  return (
    <div className="flex flex-col gap-4 p-2 bg-[#0e0e0e] mt-2 text-zinc-200 font-sans h-[calc(100vh-150px)]">
      {/* A & B: MARKET + ALPHA PANEL (SIDE BY SIDE) */}
      <div className="flex flex-row gap-1 flex-1 min-h-0">
        {/* A. VS MARKET (40%) */}
        <section className="flex flex-col w-[40%]">
          <SectionHeader
            title="Vs Market (Contextual)"
            subtitle={`Windows: 1Y, 3Y, 5Y`}
          />
          <div className="flex-1 w-full bg-[#0e0e0e] p-2 border border-[#222] rounded-sm">
            {marketChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={marketChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#222"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="window"
                    stroke="#52525b"
                    tick={{ fontSize: 10, fill: "#666" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#52525b"
                    tick={{ fontSize: 10, fill: "#666" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    cursor={{ fill: "#222", opacity: 0.4 }}
                    contentStyle={{
                      backgroundColor: "#0e0e0e",
                      borderColor: "#333",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                    itemStyle={{ color: "#fff" }}
                    formatter={(val: number) => [
                      `${val.toFixed(2)}%`,
                      "Return",
                    ]}
                    labelStyle={{ color: "#888", marginBottom: "4px" }}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: "10px",
                      paddingTop: "10px",
                      color: "#888",
                    }}
                    iconSize={8}
                  />
                  <Bar
                    dataKey="Company"
                    fill="#fff"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="Market"
                    fill="#333"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                Insufficient Market Comparison Data
              </div>
            )}
          </div>
        </section>

        {/* B. VS SECTOR & INDUSTRY (ALPHA PANEL WITH PEER INTEGRATION) (60%) */}
        <section className="flex flex-col w-[60%]">
          <SectionHeader
            title="Vs Sector & Industry (Alpha)"
            subtitle={
              selectedPeer
                ? `Comparing ${symbol} vs ${selectedPeer}`
                : "Historical Outperformance/Underperformance"
            }
          />
          <div className="flex-1 w-full bg-[#0e0e0e] p-4 border border-[#222] rounded-sm">
            {hasAlphaData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={alphaData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#222"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="window"
                    stroke="#52525b"
                    tick={{ fontSize: 10, fill: "#666" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#52525b"
                    tick={{ fontSize: 10, fill: "#666" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val.toFixed(0)}%`}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0e0e0e",
                      borderColor: "#333",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                    itemStyle={{ color: "#fff" }}
                    formatter={(val: number, name: string) => [
                      `${val.toFixed(2)}%`,
                      name,
                    ]}
                    labelFormatter={(label) => `Window: ${label}`}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: "10px",
                      paddingTop: "10px",
                      color: "#888",
                    }}
                    iconSize={8}
                  />
                  <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />

                  {/* Primary ticker - visually dominant */}
                  <Line
                    type="monotone"
                    dataKey="symbolVsSector"
                    name={`${symbol} vs Sector`}
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#3b82f6" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="symbolVsIndustry"
                    name={`${symbol} vs Industry`}
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: "#8b5cf6" }}
                    activeDot={{ r: 6 }}
                  />

                  {/* Peer ticker - visually secondary (if selected AND data exists) */}
                  {showPeerSector && (
                    <Line
                      type="monotone"
                      dataKey="peerVsSector"
                      name={`${selectedPeer} vs Sector`}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      strokeOpacity={0.9}
                      dot={{ r: 3, fill: "#FFFFFF", strokeOpacity: 0.9 }}
                      activeDot={{ r: 5 }}
                      connectNulls={true}
                    />
                  )}
                  {showPeerIndustry && (
                    <Line
                      type="monotone"
                      dataKey="peerVsIndustry"
                      name={`${selectedPeer} vs Industry`}
                      stroke="#A1A1AA"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      strokeOpacity={0.9}
                      dot={{ r: 3, fill: "#A1A1AA", strokeOpacity: 0.9 }}
                      activeDot={{ r: 5 }}
                      connectNulls={true}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                {alphaLoading
                  ? "Loading Alpha Data..."
                  : "Insufficient Sector/Industry Data"}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* C. PEERS */}
      <section className="flex flex-col pt-1 flex-1 min-h-0">
        <SectionHeader
          title="Peers Analysis"
          subtitle={`Click peer to compare in Alpha chart • Snapshot Date: ${snapshotDate} • No Real-time Recalculation`}
        />
        <div className="flex-1 h-full min-h-0">
          <PeersAnalysisPanel
            symbol={symbol}
            selectedPeer={selectedPeer}
            onPeerSelect={handlePeerSelect}
          />
        </div>
      </section>
    </div>
  );
}

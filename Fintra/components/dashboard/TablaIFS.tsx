"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMarketCap } from "@/lib/utils";
import { AlertTriangle, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { FintraLoader } from "@/components/ui/FintraLoader";
import { IFSData, EnrichedStockData } from "@/lib/engine/types";
import { IFSDualCell } from "@/components/tables/IFSDualCell";
import { ValuationSignal, FGOSCell } from "@/components/shared/FinancialCells";

// Helper to map raw Supabase snapshot to EnrichedStockData
export const mapSnapshotToStockData = (row: any): EnrichedStockData => {
  // Strict mapping from fintra_snapshots flat columns or JSONB structures

  // IFS Construction
  const rawIfs = row.ifs || null;

  let ifsData: IFSData | null = null;
  if (rawIfs && rawIfs.position) {
    ifsData = {
      position: rawIfs.position,
      pressure: rawIfs.pressure ?? 0,
      confidence: rawIfs.confidence_label?.toLowerCase() as
        | "low"
        | "medium"
        | "high"
        | undefined,
    };
  }

  // Robust extraction for other fields (JSONB vs Flat)
  const marketPosition = row.market_position || {};
  const valuation = row.valuation || {};
  const marketSnapshot = row.market_snapshot || {};
  // market_state seems deprecated/unused in recent snapshots, using market_snapshot instead
  const profileStructural = row.profile_structural || {};
  const psMetrics = profileStructural.metrics || {};
  const financialScores = profileStructural.financial_scores || {};

  // FGOS Band: Check fgos_category (Table)
  // Strict rule: if not present in canonical path, use hyphen. DO NOT invent results.
  // We prioritize the deep JSONB path (Source of Truth) or the pre-processed field.
  // We explicitly IGNORE legacy columns like 'fgos_band' which might contain misplaced data (e.g. 'High' from confidence).
  const fgosBand = row.fgos_components?.competitive_advantage?.band || "-";

  // FGOS Details
  // Use fgos_maturity if available (Mature, Developing, etc.), fallback to fgos_status (computed/pending)
  const fgosStatus = row.fgos_maturity || row.fgos_status || null;
  const sentimentBand = row.fgos_components?.sentiment_details?.band || null;
  const qualityBrakes =
    row.quality_brakes || row.fgos_components?.quality_brakes || null; // Check for quality penalties

  // Sector Rank
  const sectorRank = row.sector_rank ?? marketPosition.sector_rank ?? null;
  const sectorRankTotal =
    row.sector_rank_total ?? marketPosition.sector_total_count ?? null;

  // Valuation Status
  const sectorValuationStatus =
    row.sector_valuation_status ?? valuation.valuation_status ?? null;

  // Price & Return
  // Priority: market_snapshot (numeric) > profile_structural.metrics (string) > row flat columns
  let priceEod = marketSnapshot.price;
  if (priceEod == null && psMetrics.price)
    priceEod = parseFloat(psMetrics.price);
  if (priceEod == null) priceEod = row.price ?? row.price_eod ?? null;

  // YTD Return
  let ytdReturn = marketSnapshot.ytd_percent;
  if (ytdReturn == null) ytdReturn = row.ytd_return ?? row.return_ytd ?? null;

  // Market Cap
  let marketCap = marketSnapshot.market_cap;
  if (marketCap == null && psMetrics.marketCap)
    marketCap = parseFloat(psMetrics.marketCap);
  if (marketCap == null && financialScores.marketCap)
    marketCap = Number(financialScores.marketCap);
  if (marketCap == null) marketCap = row.market_cap ?? null;

  const relativeReturn1Y = row.relative_vs_sector_1y ?? null;
  const alphaVsIndustry1Y = row.alpha_vs_industry_1y ?? null;
  const alphaVsSector1Y = row.alpha_vs_sector_1y ?? null;

  // Extract company name for display
  const companyName =
    row.company_name || profileStructural.identity?.name || null;

  return {
    ticker: row.ticker,
    companyName,
    sectorRank,
    sectorRankTotal,
    sectorValuationStatus,
    fgosBand,
    fgosScore: row.fgos_score ?? null,
    fgosStatus,
    sentimentBand,
    qualityBrakes,
    ifs: ifsData,
    ifs_fy: row.ifs_fy || null, // IQS - Industry Quality Score
    strategyState:
      row.strategy_state || row.market_position?.strategy_state || null,
    priceEod,
    ytdReturn,
    relativeReturn1Y,
    alphaVsIndustry1Y,
    alphaVsSector1Y,
    marketCap,
  };
};

// Helper Constants & Functions
const FGOS_BAND_ORDER: Record<string, number> = {
  strong: 1,
  defendable: 2,
  weak: 3,
};

const VALUATION_ORDER: Record<string, number> = {
  undervalued: 1,
  cheap_sector: 1,
  fairly_valued: 2,
  fair_sector: 2,
  overvalued: 3,
  expensive_sector: 3,
};

const getRankValue = (val: number | null | undefined) =>
  val == null ? Number.MAX_SAFE_INTEGER : val;

const getOrderValue = (
  val: string | null | undefined,
  map: Record<string, number>,
) => {
  if (!val) return Number.MAX_SAFE_INTEGER;
  const key = String(val).toLowerCase();
  return map[key] ?? Number.MAX_SAFE_INTEGER - 1;
};

const getMarketCapCategory = (marketCap: number): string => {
  const billion = 1_000_000_000;
  const million = 1_000_000;

  if (marketCap >= 200 * billion) return "Mega-Cap";
  if (marketCap >= 10 * billion) return "Large-Cap";
  if (marketCap >= 2 * billion) return "Mid-Cap";
  if (marketCap >= 300 * million) return "Small-Cap";
  if (marketCap >= 50 * million) return "Micro-Cap";
  return "Nano-Cap";
};

export const sortStocksBySnapshot = (
  a: EnrichedStockData,
  b: EnrichedStockData,
) => {
  const srA = getRankValue(a.sectorRank);
  const srB = getRankValue(b.sectorRank);
  if (srA !== srB) return srA - srB;

  const fbA = getOrderValue(a.fgosBand, FGOS_BAND_ORDER);
  const fbB = getOrderValue(b.fgosBand, FGOS_BAND_ORDER);
  if (fbA !== fbB) return fbA - fbB;

  const valA = getOrderValue(a.sectorValuationStatus, VALUATION_ORDER);
  const valB = getOrderValue(b.sectorValuationStatus, VALUATION_ORDER);
  if (valA !== valB) return valA - valB;

  return a.ticker.localeCompare(b.ticker);
};

interface TablaIFSProps {
  data: EnrichedStockData[];
  isLoading: boolean;
  isFetchingMore?: boolean;
  onRowClick?: (ticker: string) => void;
  onRowHover?: (ticker: string | null) => void;
  selectedTicker?: string | null;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  scrollRef?: React.Ref<HTMLDivElement>;
  emptyMessage?: string;
  selectionVariant?: "primary" | "secondary";
}

export default function TablaIFS({
  data,
  isLoading,
  isFetchingMore = false,
  onRowClick,
  onRowHover,
  selectedTicker,
  onScroll,
  scrollRef,
  emptyMessage = "No se encontraron resultados.",
  selectionVariant = "primary",
}: TablaIFSProps) {
  React.useEffect(() => {
    if (data && data.length > 0) {
      console.log(
        "📊 [DEBUG] TablaIFS Received Data (first 3):",
        data.slice(0, 3),
      );
    }
  }, [data]);

  return (
    <div
      ref={scrollRef}
      className="w-full h-full relative p-0 bg-[#0e0e0e] overflow-y-auto border-b border-[#2a2a2a] rounded-none scrollbar-thin scrollbar-thumb-[#2a2a2a] scrollbar-track-transparent scrollbar-thumb-rounded-full hover:scrollbar-thumb-[#444] transition-colors"
      onScroll={onScroll}
    >
      <table className="w-full text-sm border-collapse m-0 p-0 font-sans">
        <TableHeader className="sticky top-0 z-10 bg-[#0e0e0e]/95 backdrop-blur-sm border-b border-[#2a2a2a] shadow-sm">
          <TableRow className="border-none h-9 hover:bg-transparent transition-none">
            <TableHead className="h-9 px-3 py-1 text-[#a1a1aa] font-medium text-[11px] uppercase tracking-wider text-left w-[60px] whitespace-nowrap select-none">
              Ticker
            </TableHead>
            <TableHead className="h-9 px-1 py-1 text-[#a1a1aa] font-medium text-[11px] uppercase tracking-wider text-center w-[40px] whitespace-nowrap select-none">
              R. V.
            </TableHead>
            <TableHead className="h-9 px-3 py-1 text-[#a1a1aa] font-medium text-[11px] uppercase tracking-wider text-center w-[80px] whitespace-nowrap select-none">
              Competitive
            </TableHead>
            <TableHead className="h-9 px-3 py-1 text-[#a1a1aa] font-medium text-[11px] uppercase tracking-wider text-center w-[80px] whitespace-nowrap select-none">
              Stage
            </TableHead>
            <TableHead className="h-9 px-3 py-1 text-[#a1a1aa] font-medium text-[11px] uppercase tracking-wider text-center w-[80px] whitespace-nowrap select-none">
              F. H.
            </TableHead>
            <TableHead className="h-9 px-3 py-1 text-[#a1a1aa] font-medium text-[11px] uppercase tracking-wider text-right w-[60px] whitespace-nowrap select-none">
              EOD
            </TableHead>
            <TableHead className="h-9 px-3 py-1 text-[#a1a1aa] font-medium text-[11px] uppercase tracking-wider text-right w-[60px] whitespace-nowrap select-none">
              Mkt Cap
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="hover:bg-transparent border-none">
              <TableCell colSpan={7} className="h-24 text-center">
                <div className="flex justify-center items-center gap-2 text-[#a1a1aa] text-xs font-medium">
                  <FintraLoader size={16} /> Cargando datos...
                </div>
              </TableCell>
            </TableRow>
          ) : !data || data.length === 0 ? (
            <TableRow className="hover:bg-transparent border-none">
              <TableCell
                colSpan={7}
                className="text-center text-[#a1a1aa] py-12 text-xs font-medium"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((stock) => {
              const isSelected = selectedTicker === stock.ticker;
              const getStageConfig = (status: string | null | undefined) => {
                const s = status?.toLowerCase() || "";
                if (s.includes("early")) {
                  return {
                    label: "EARLY",
                    className: "text-zinc-400",
                  };
                }
                if (s.includes("developing")) {
                  return {
                    label: "DEVELOPING",
                    className: "text-orange-400",
                  };
                }
                if (s.includes("mature") || s.includes("established")) {
                  return {
                    label: "ESTABLISHED",
                    className: "text-cyan-400",
                  };
                }
                return {
                  label: "—",
                  className: "text-[#666]",
                };
              };

              const stageConfig = getStageConfig(stock.fgosStatus);

              // Determine selection style based on variant
              const selectionStyle = isSelected
                ? selectionVariant === "primary"
                  ? "border-l-4 border-[#00C0FF] bg-[#161616]" // Default Blue
                  : "border-l-4 border-[#FFFFFF] bg-[#161616]" // Secondary White (matching alpha chart peer line)
                : "bg-transparent";

              return (
                <TableRow
                  key={stock.ticker}
                  className={`border-b border-[#2a2a2a] h-10 hover:bg-[#161616] cursor-pointer transition-colors duration-150 group ${selectionStyle}`}
                  onClick={() => onRowClick?.(stock.ticker)}
                  onMouseEnter={() => onRowHover?.(stock.ticker)}
                  onMouseLeave={() => onRowHover?.(null)}
                >
                  <TableCell className="px-3 py-1 text-[#ededed] font-medium text-[12px] tracking-tight">
                    <div className="flex flex-col">
                      <span>{stock.ticker}</span>
                      {stock.companyName && (
                        <span className="text-[9px] text-[#666] font-normal truncate max-w-[80px] leading-none mt-0.5">
                          {stock.companyName}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="px-1 py-1">
                    <div className="flex justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                      {stock.sectorValuationStatus ? (
                        <ValuationSignal status={stock.sectorValuationStatus} />
                      ) : (
                        <span className="text-[#666] text-xs font-mono">—</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="px-3 py-1">
                    <div className="flex justify-center">
                      <IFSDualCell
                        ifs={stock.ifs}
                        ifs_fy={stock.ifs_fy ?? null}
                        size="compact"
                      />
                    </div>
                  </TableCell>

                  <TableCell className="px-3 py-1">
                    <span
                      className={`flex text-[10px] px-2 py-0.5 text-center justify-center font-mono font-medium tracking-wide ${stageConfig.className}`}
                    >
                      {stageConfig.label}
                    </span>
                  </TableCell>

                  <TableCell className="px-3 py-1">
                    <FGOSCell
                      score={stock.fgosScore}
                      status={stock.fgosStatus}
                      sentiment={stock.sentimentBand}
                      band={stock.fgosBand}
                      hasPenalty={stock.qualityBrakes?.applied ?? false}
                    />
                  </TableCell>

                  <TableCell className="px-3 py-1 text-right">
                    <span
                      className={`text-[12px] font-mono block w-full ${
                        stock.ytdReturn != null
                          ? stock.ytdReturn > 0
                            ? "text-emerald-500"
                            : "text-red-500"
                          : "text-[#a1a1aa]"
                      }`}
                    >
                      {stock.priceEod != null ? stock.priceEod.toFixed(2) : "—"}
                    </span>
                  </TableCell>

                  <TableCell className="px-3 py-1 text-right text-[12px] font-mono text-[#FFFFFF] tabular-nums">
                    <div className="flex flex-col items-end">
                      <span>
                        {stock.marketCap != null
                          ? formatMarketCap(Number(stock.marketCap))
                          : "—"}
                      </span>
                      {stock.marketCap != null && (
                        <span className="text-[9px] text-[#FFFFFF] font-normal truncate max-w-[80px] leading-none mt-0.5">
                          {getMarketCapCategory(Number(stock.marketCap))}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
          {isFetchingMore && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-10 text-center text-[#666] text-xs"
              >
                <div className="flex justify-center items-center gap-2 p-4 text-xs text-zinc-500">
                  <FintraLoader size={12} /> Cargando más...
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </table>
    </div>
  );
}

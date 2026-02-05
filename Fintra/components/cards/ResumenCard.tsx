"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { getResumenData, ResumenData } from "@/lib/repository/fintra-db";
import { fetchResumenDataServer } from "@/lib/actions/resumen";
import { IFSRadial } from "@/components/visuals/IFSRadial";
import { cn } from "@/lib/utils";
import DraggableWidget from "@/components/ui/draggable-widget";
import CompanyInfoWidget from "@/components/widgets/CompanyInfoWidget";
import { Info, AlertTriangle } from "lucide-react";
import { ValuationSignal, FGOSCell } from "@/components/shared/FinancialCells";
import { IFSDualCell } from "@/components/tables/IFSDualCell";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ResumenCardProps {
  symbol: string;
  stockBasicData?: any;
  onStockSearch?: (symbol: string) => Promise<any> | any;
  isParentLoading?: boolean;
}

function formatLargeNumber(num?: number) {
  if (!Number.isFinite(Number(num))) return "N/A";
  const n = Number(num);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toLocaleString()}`;
}

const AnalyticalAnchorCard = ({
  title,
  values,
  concept,
  metadata,
  alertData,
  hoverContent,
}: {
  title: string;
  values: React.ReactNode;
  concept: string;
  metadata?: React.ReactNode;
  alertData?: React.ReactNode;
  hoverContent: {
    scenario: string;
    meaning: string;
    activatingData: string[];
    suggestedFocus: string[];
  };
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="bg-[#0A0A0A] border border-[#222] rounded-md p-2.5 hover:border-[#333] transition-all cursor-pointer group relative h-full flex flex-col justify-between">
          {/* COLLAPSED VIEW CONTENT */}
          <div className="flex flex-col gap-1.5">
            {/* Title */}
            <h3 className="text-[9px] font-bold text-[#666] uppercase tracking-wider text-center">
              {title}
            </h3>

            {/* Values */}
            <div className="flex items-center justify-center py-1">{values}</div>

            {/* Metadata (confidence, etc) */}
            {metadata && (
              <div className="text-[9px] text-[#555] text-center">{metadata}</div>
            )}

            {/* Alert Data (quality_brakes, etc) */}
            {alertData && (
              <div className="mt-1 pt-1.5 border-t border-[#1A1A1A]">
                {alertData}
              </div>
            )}

            {/* One-line concept */}
            <p className="text-[10px] text-[#888] text-center leading-tight mt-1">
              {concept}
            </p>
          </div>

          {/* Expand indicator */}
          <div className="text-[8px] text-[#444] text-center mt-2 group-hover:text-[#666] transition-colors">
            {isOpen
              ? "▲ Click to collapse"
              : "▼ Click for analytical context"}
          </div>
        </div>
      </PopoverTrigger>

      {/* EXPANDED VIEW (POPOVER) */}
      <PopoverContent 
        className="w-[280px] bg-[#0A0A0A] border border-[#333] p-3 text-left shadow-2xl z-[100]" 
        side="bottom" 
        align="center"
        sideOffset={5}
      >
        <div className="space-y-3">
          <div>
            <span className="text-[8px] text-[#444] uppercase tracking-wider block mb-1">
              Scenario Described
            </span>
            <p className="text-[10px] text-[#AAA] leading-snug">
              {hoverContent.scenario}
            </p>
          </div>

          <div>
            <span className="text-[8px] text-[#444] uppercase tracking-wider block mb-1">
              What It Means
            </span>
            <p className="text-[9px] text-[#888] leading-snug">
              {hoverContent.meaning}
            </p>
          </div>

          <div>
            <span className="text-[8px] text-[#444] uppercase tracking-wider block mb-1">
              Activating Data
            </span>
            <ul className="text-[9px] text-[#777] leading-snug space-y-0.5">
              {hoverContent.activatingData.map((item, i) => (
                <li key={i}>· {item}</li>
              ))}
            </ul>
          </div>

          <div>
            <span className="text-[8px] text-[#444] uppercase tracking-wider block mb-1">
              Suggested Analytical Focus
            </span>
            <div className="flex flex-wrap gap-1.5">
              {hoverContent.suggestedFocus.map((focus, i) => (
                <span
                  key={i}
                  className="text-[9px] text-[#666] px-1.5 py-0.5 bg-[#0F0F0F] border border-[#1A1A1A] rounded hover:border-[#333] hover:text-[#888] transition-colors"
                >
                  {focus}
                </span>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Helpers for Analytical Context (Hover/Expand)
function getValuationHoverContent(status: string | null, percentile?: number) {
  const s = (status || "").toLowerCase();
  const p = percentile ?? 0;

  if (!s || s === "pending")
    return {
      scenario:
        "Insufficient historical data to establish reliable sector positioning.",
      meaning:
        "Statistical distribution requires minimum dataset completeness. Pending state indicates data collection in progress, not absence of value.",
      activatingData: [
        "Sector percentile: pending",
        "TTM benchmarks: incomplete",
        "Minimum 4 consecutive quarters required",
      ],
      suggestedFocus: [
        "Historical Price Evolution",
        "Peer Comparison Readiness",
        "Financial Statement Coverage",
      ],
    };

  return {
    scenario:
      "Statistical positioning of the asset's price relative to sector peers.",
    meaning:
      "Describes how the market is pricing the asset relative to its sector. Does not imply attractiveness, risk, or recommendation.",
    activatingData: [
      `Sector percentile: P${p}`,
      "TTM benchmarks (PE, EV/EBITDA, Price/Sales)",
      "Block voting across temporal windows",
    ],
    suggestedFocus: [
      "Consistency with Expected Growth",
      "Multiple Compression/Expansion Sensitivity",
      "Alignment with Fundamental Quality",
    ],
  };
}

function getIFSHoverContent(
  position: string | undefined,
  pressure?: number,
  confidence?: number,
) {
  const pos = position || "pending";
  const pr = pressure ?? 0;
  const conf = confidence ?? 0;

  if (!position)
    return {
      scenario: "Competitive relevance assessment in progress.",
      meaning:
        "Evaluating relative performance across multiple time horizons using block voting methodology. Pending state indicates insufficient temporal data.",
      activatingData: [
        "Time windows: 1M-5Y (incomplete)",
        "Block voting: pending",
        "Sector benchmark: establishing",
      ],
      suggestedFocus: [
        "Historical Performance Windows",
        "Sector Cycle Dependency",
        "Data Completeness",
      ],
    };

  return {
    scenario:
      "Competitive relevance of the asset within its industry across multiple time horizons.",
    meaning:
      "Indicates whether the company leads, follows, or lags its peers, without implying future outcomes. Classification based on temporal block voting. Non-predictive.",
    activatingData: [
      `Position: ${pos.toUpperCase()}`,
      `Block support: ${pr}/3`,
      `Confidence: ${conf}%`,
      "Time windows (1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y)",
    ],
    suggestedFocus: [
      "Structural Differences vs Peers",
      "Sector Cycle Dependency",
      "Historical Position Evolution",
    ],
  };
}

function getFGOSHoverContent(
  score?: number,
  altmanZ?: number,
  piotroski?: number,
  hasBrakes?: boolean,
) {
  const s = score ?? 0;

  if (s === 0)
    return {
      scenario: "Insufficient fundamental data for quality diagnosis.",
      meaning:
        "Quality assessment requires minimum financial statement coverage. Pending state indicates data collection, not fundamental weakness.",
      activatingData: [
        "FGOS score: pending",
        "Altman Z-Score: pending",
        "Piotroski F-Score: pending",
      ],
      suggestedFocus: [
        "Financial Statement Availability",
        "Audit Trail",
        "Reporting Frequency",
      ],
    };

  const activatingData = [
    `FGOS score: ${s}/100`,
    ...(altmanZ !== undefined ? [`Altman Z-Score: ${altmanZ.toFixed(2)}`] : []),
    ...(piotroski !== undefined ? [`Piotroski F-Score: ${piotroski}/9`] : []),
  ];

  if (hasBrakes) {
    activatingData.push("Quality brakes: ACTIVE");
  }

  return {
    scenario:
      "Structural quality level considering efficiency, growth, and financial risk.",
    meaning:
      "Synthesizes the company's ability to sustain returns, independent of market pricing. Captures operational robustness and capital discipline.",
    activatingData,
    suggestedFocus: [
      "Liquidity and Debt Maturities",
      "Interest Coverage",
      "Cash Generation Under Adverse Cycles",
    ],
  };
}

export default function ResumenCard({
  symbol,
  stockBasicData,
  onStockSearch,
  isParentLoading,
}: ResumenCardProps) {
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);

  const currentSymbol = useMemo(() => (symbol || "").toUpperCase(), [symbol]);

  // Data Normalization
  const data = useMemo(() => {
    // Helper to safely extract numbers
    const num = (x: any) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : undefined;
    };
    const str = (s: any) => (typeof s === "string" ? s.trim() : undefined);

    const baseData = resumen || stockBasicData || {};

    return {
      symbol: str(baseData.ticker || baseData.symbol) || currentSymbol,
      name:
        str(baseData.name || baseData.companyName || baseData.company_name) ||
        "",
      price: num(baseData.price),
      change: num(baseData.change_percentage || baseData.changesPercentage),
      marketCap: num(baseData.market_cap || baseData.mktCap),
      sector: str(baseData.sector),
      industry: str(baseData.industry),
      ceo: str(baseData.ceo),
      website: str(baseData.website),
      employees: num(baseData.employees || baseData.fullTimeEmployees),
      exchange: str(baseData.exchange || baseData.exchangeShortName),
      currency: str(baseData.currency) || "USD",
      logo_url:
        baseData.image ||
        baseData.logo_url ||
        `https://financialmodelingprep.com/image-stock/${currentSymbol}.png`,
      description: str(baseData.description),
    };
  }, [resumen, stockBasicData, currentSymbol]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (!currentSymbol) return;
      setLoading(true);
      setError(null);
      try {
        // Use Server Action to bypass RLS/Client limitations
        const fetchedResumen = await fetchResumenDataServer(currentSymbol);
        if (active && fetchedResumen) setResumen(fetchedResumen);
      } catch (err) {
        console.error("Error fetching resumen:", err);
        if (active) setError("Error cargando resumen");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [currentSymbol]);

  // Derived States for UI
  const ifsStatus = useMemo(() => {
    const pos = resumen?.ifs?.position;
    const rawData = resumen?.ifs
      ? {
          position: resumen.ifs.position,
        }
      : null;

    if (!pos) return { label: "PENDING", color: "gray" as const, raw: rawData };
    if (pos === "leader")
      return { label: "LEADER", color: "green" as const, raw: rawData };
    if (pos === "follower")
      return { label: "FOLLOWER", color: "yellow" as const, raw: rawData };
    return { label: "LAGGARD", color: "red" as const, raw: rawData };
  }, [resumen]);

  const valuationStatus = useMemo(() => {
    const status = resumen?.valuation?.canonical_status;
    const rawStatus = status || null;

    if (!status || status === "pending")
      return { label: "PENDING", color: "gray" as const, raw: rawStatus };
    if (status.includes("cheap"))
      return { label: "UNDERVALUED", color: "green" as const, raw: rawStatus };
    if (status.includes("fair"))
      return { label: "FAIR", color: "yellow" as const, raw: rawStatus };
    return { label: "OVERVALUED", color: "red" as const, raw: rawStatus };
  }, [resumen]);

  // Derived Hover Content
  const valuationHover = useMemo(
    () =>
      getValuationHoverContent(
        resumen?.valuation?.canonical_status || null,
        (resumen?.valuation as any)?.percentile,
      ),
    [resumen],
  );

  const ifsHover = useMemo(
    () =>
      getIFSHoverContent(
        resumen?.ifs?.position,
        resumen?.ifs?.pressure,
        (resumen?.ifs as any)?.confidence,
      ),
    [resumen],
  );

  const fgosHover = useMemo(
    () =>
      getFGOSHoverContent(
        resumen?.fgos_score ?? undefined,
        (resumen?.fgos_components?.quality_brakes as any)?.altman_z,
        (resumen?.fgos_components?.quality_brakes as any)?.piotroski,
        resumen?.fgos_components?.quality_brakes?.applied,
      ),
    [resumen],
  );

  return (
    <Card className="bg-transparent border-none shadow-none w-full flex flex-col overflow-hidden rounded-none h-auto min-h-0">
      <CardContent className="p-0 flex flex-col h-full bg-transparent">
        {/* SCROLLABLE CONTENT WITH NEW GRID LAYOUT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
          <div className="max-w-full mx-auto flex flex-col gap-3">
            {/* --- HEADER: Ticker & Name --- */}
            <div className="flex items-center justify-between pb-2 border-b border-[#222]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-md bg-transparent flex items-center justify-center overflow-hidden p-0.5 relative">
                  {data.logo_url ? (
                    <Image
                      src={data.logo_url}
                      alt={data.symbol}
                      width={44}
                      height={44}
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="text-xs font-medium text-[#666]">
                      {data.symbol.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[18px] font-semibold text-[#EDEDED] tracking-tight leading-none">
                      {data.symbol}
                    </h1>
                    <div
                      className="text-[#666] hover:text-[#EDEDED] transition-colors cursor-pointer p-0.5 rounded hover:bg-[#1A1A1A]"
                      onClick={() => setShowCompanyInfo(true)}
                    >
                      <Info size={12} />
                    </div>
                  </div>
                  <span className="text-[11px] text-[#888] font-medium truncate max-w-[300px]">
                    {data.name}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] self-end pb-0.5">
                <span className="text-zinc-500">Sector:</span>
                <span className="text-zinc-300 font-medium">
                  {data.sector || "-"}
                </span>
                <span className="text-zinc-700 mx-1">/</span>
                <span className="text-zinc-500">Industry:</span>
                <span className="text-zinc-300 font-medium">
                  {data.industry || "-"}
                </span>
              </div>
            </div>

            {/* ANALYTICAL ANCHOR CARDS */}
            <div className="grid grid-cols-3 gap-3">
              {/* 1. RELATIVE VALUATION */}
              <AnalyticalAnchorCard
                title="Relative Valuation"
                values={
                  <div className="flex flex-col items-center gap-1">
                    <ValuationSignal
                      status={resumen?.valuation?.canonical_status || null}
                    />
                    {(resumen?.valuation as any)?.percentile !== undefined && (
                      <span className="text-[10px] text-[#666]">
                        P{(resumen?.valuation as any)?.percentile}
                      </span>
                    )}
                  </div>
                }
                metadata={
                  (resumen?.valuation as any)?.confidence && (
                    <span>
                      Confidence:{" "}
                      {typeof (resumen?.valuation as any)?.confidence ===
                      "object"
                        ? (resumen?.valuation as any)?.confidence?.label ||
                          (resumen?.valuation as any)?.confidence?.percent + "%"
                        : (resumen?.valuation as any)?.confidence}
                    </span>
                  )
                }
                concept="Position within the sector valuation distribution."
                hoverContent={valuationHover}
              />

              {/* 2. COMPETITIVE POSITION */}
              <AnalyticalAnchorCard
                title="Competitive Position"
                values={
                  <div className="flex flex-col items-center gap-1">
                    <IFSDualCell
                      ifs={
                        resumen?.ifs
                          ? {
                              position: resumen.ifs.position,
                              pressure: resumen.ifs.pressure ?? 0,
                            }
                          : null
                      }
                      ifs_fy={resumen?.ifs_fy ?? null}
                      size="compact"
                    />
                    {resumen?.ifs?.position &&
                      resumen?.ifs?.pressure !== undefined && (
                        <span className="text-[10px] text-[#666]">
                          {resumen.ifs.pressure}/3
                        </span>
                      )}
                  </div>
                }
                metadata={
                  (resumen?.ifs as any)?.confidence !== undefined && (
                    <span>
                      Confidence:{" "}
                      {typeof (resumen?.ifs as any)?.confidence === "object"
                        ? (resumen?.ifs as any)?.confidence?.label ||
                          (resumen?.ifs as any)?.confidence?.percent + "%"
                        : (resumen?.ifs as any)?.confidence + "%"}
                    </span>
                  )
                }
                concept="Relative performance versus sector peers."
                hoverContent={ifsHover}
              />

              {/* 3. FUNDAMENTAL QUALITY */}
              <AnalyticalAnchorCard
                title="Fundamental Quality"
                values={
                  <FGOSCell
                    score={resumen?.fgos_score}
                    status={resumen?.fgos_maturity || resumen?.fgos_status}
                    sentiment={
                      resumen?.fgos_components?.sentiment_details?.band
                    }
                    band={resumen?.fgos_components?.competitive_advantage?.band}
                    hasPenalty={
                      !!resumen?.fgos_components?.quality_brakes?.applied
                    }
                  />
                }
                concept="Operational and financial robustness of the business."
                alertData={
                  resumen?.fgos_components?.quality_brakes?.applied && (
                    <div className="flex items-start gap-1.5 text-amber-500/90 bg-amber-950/20 px-2 py-1.5 rounded border border-amber-900/30">
                      <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                      <div className="flex flex-col gap-0.5 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap text-[9px]">
                          {(resumen.fgos_components.quality_brakes as any)
                            .altman_z !== undefined && (
                            <span>
                              Altman:{" "}
                              {(
                                resumen.fgos_components.quality_brakes as any
                              ).altman_z.toFixed(2)}
                            </span>
                          )}
                          {(resumen.fgos_components.quality_brakes as any)
                            .piotroski !== undefined && (
                            <span>
                              · Piotroski:{" "}
                              {
                                (resumen.fgos_components.quality_brakes as any)
                                  .piotroski
                              }
                              /9
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }
                hoverContent={fgosHover}
              />
            </div>
          </div>
        </div>
      </CardContent>

      <DraggableWidget
        title={`Company Info: ${data.symbol}`}
        isOpen={showCompanyInfo}
        onClose={() => setShowCompanyInfo(false)}
        width={800}
        height={600}
        initialPosition={{ x: 200, y: 150 }}
      >
        <CompanyInfoWidget data={resumen?.raw_profile_structural} />
      </DraggableWidget>
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getResumenData, ResumenData } from "@/lib/repository/fintra-db";
import { fetchResumenDataServer } from "@/lib/actions/resumen";
import { IFSRadial } from "@/components/visuals/IFSRadial";
import { cn } from "@/lib/utils";
import DraggableWidget from "@/components/ui/draggable-widget";
import CompanyInfoWidget from "@/components/widgets/CompanyInfoWidget";
import { 
  Activity, 
  BarChart3, Globe, Building2, User, 
  Info, AlertTriangle
} from "lucide-react";

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

function getMoatLabel(val: number | string | null | undefined): string {
  const score = Number(val);
  if (val == null || !Number.isFinite(score)) return '-';
  if (score < 40) return 'Débil';
  if (score < 65) return 'Moderada';
  return 'Fuerte';
}

const InfoLabel = ({ label, value, subtext, icon: Icon, className }: { label: string, value: React.ReactNode, subtext?: string, icon?: any, className?: string }) => (
    <div className={cn("flex flex-col", className)}>
        <span className="text-[10px] tracking-wider text-zinc-500 font-medium mb-0.5 flex items-center gap-1.5">
            {Icon && <Icon size={10} />}
            {label}
        </span>
        <span className="text-[11px] font-light text-zinc-200 font-mono tracking-tight">{value}</span>
        {subtext && <span className="text-[10px] text-zinc-500">{subtext}</span>}
    </div>
);

const ValuationSignal = ({ status }: { status: string | null }) => {
  if (!status) return <div className="w-3 h-3" />;

  const lower = status.toLowerCase();
  let colorClass = "bg-[#333]";
  let bars = 0;

  if (lower.includes("undervalued") || lower.includes("cheap")) {
    colorClass = "bg-emerald-500";
    bars = 3;
  } else if (lower.includes("fair")) {
    colorClass = "bg-amber-500";
    bars = 2;
  } else if (lower.includes("overvalued") || lower.includes("expensive")) {
    colorClass = "bg-red-500";
    bars = 1;
  }

  return (
    <div className="flex items-end gap-[1.5px] h-3.5 w-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-[3px] rounded-[1px] ${i <= bars ? colorClass : "bg-[#222]"}`}
          style={{ height: `${(i / 3) * 100}%` }}
        />
      ))}
    </div>
  );
};



// New Component for the Horizontal Bars (IFS, Valuation, Stage)
const MetricRowCard = ({ 
    label, 
    value, 
    icon: Icon, 
    color, 
    subtext, 
    customIndicator 
}: { 
    label: string, 
    value: string, 
    icon?: any, 
    color: "green" | "yellow" | "red" | "gray", 
    subtext?: string,
    customIndicator?: React.ReactNode 
}) => {
    const colorStyles = {
        green: "text-emerald-500",
        yellow: "text-amber-500",
        red: "text-red-500",
        gray: "text-[#666]"
    };
    
    return (
        <div className="bg-[#0A0A0A] border border-[#222] rounded-md px-3 py-2 flex items-center justify-between h-[42px] hover:border-[#333] transition-colors">
            <span className="text-[11px] font-medium text-[#888] w-1/3 truncate uppercase tracking-wider">{label}</span>
            <div className="flex items-center justify-center w-1/3">
                 {customIndicator ? customIndicator : (Icon && <Icon size={14} className={colorStyles[color]} />)}
            </div>
            <div className="flex flex-col items-end w-1/3">
                <span className={cn("text-[11px] font-mono font-medium", colorStyles[color])}>{value}</span>
                {subtext && <span className="text-[9px] text-[#555] uppercase tracking-tighter">{subtext}</span>}
            </div>
        </div>
    );
};

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
        name: str(baseData.name || baseData.companyName || baseData.company_name) || "",
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
        logo_url: baseData.image || baseData.logo_url || `https://financialmodelingprep.com/image-stock/${currentSymbol}.png`,
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
    return () => { active = false; };
  }, [currentSymbol]);

  // Derived States for UI
  const ifsStatus = useMemo(() => {
      const pos = resumen?.ifs?.position;
      const rawData = resumen?.ifs ? { 
          position: resumen.ifs.position, 
      } : null;

      if (!pos) return { label: "PENDING", color: "gray" as const, raw: rawData };
      if (pos === 'leader') return { label: "LEADER", color: "green" as const, raw: rawData };
      if (pos === 'follower') return { label: "FOLLOWER", color: "yellow" as const, raw: rawData };
      return { label: "LAGGARD", color: "red" as const, raw: rawData };
  }, [resumen]);

  const valuationStatus = useMemo(() => {
      const status = resumen?.valuation?.canonical_status;
      const rawStatus = status || null;

      if (!status || status === 'pending') return { label: "PENDING", color: "gray" as const, raw: rawStatus };
      if (status.includes('cheap')) return { label: "UNDERVALUED", color: "green" as const, raw: rawStatus };
      if (status.includes('fair')) return { label: "FAIR", color: "yellow" as const, raw: rawStatus };
      return { label: "OVERVALUED", color: "red" as const, raw: rawStatus };
  }, [resumen]);

  const stageStatus = useMemo(() => {
      const state = resumen?.attention_state;
      if (!state) return { label: "ANALYZING", color: "gray" as const };
      if (state === 'structural_compounder') return { label: "COMPOUNDER", color: "green" as const };
      if (state === 'quality_in_favor') return { label: "MOMENTUM", color: "green" as const };
      if (state === 'quality_misplaced') return { label: "TURNAROUND", color: "yellow" as const };
      return { label: "HEADWIND", color: "red" as const };
  }, [resumen]);

  return (
    <Card className="bg-transparent border-none shadow-none w-full flex flex-col overflow-hidden rounded-none h-auto min-h-0">
      <CardContent className="p-0 flex flex-col h-full bg-transparent">
        
        {/* SCROLLABLE CONTENT WITH NEW GRID LAYOUT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            <div className="max-w-full mx-auto flex flex-col gap-3">
                
                {/* --- HEADER: Ticker & Name --- */}
                <div className="flex items-center justify-between pb-2 border-b border-[#222]">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-md bg-transparent flex items-center justify-center overflow-hidden p-0.5">
                            {data.logo_url ? (
                                <img src={data.logo_url} alt={data.symbol} className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-xs font-medium text-[#666]">{data.symbol.slice(0,2)}</span>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-[18px] font-semibold text-[#EDEDED] tracking-tight leading-none">{data.symbol}</h1>
                            <span className="text-[11px] text-[#888] font-medium truncate max-w-[300px]">{data.name}</span>
                        </div>
                    </div>
                    <div 
                        className="flex items-center gap-1.5 text-[#666] hover:text-[#EDEDED] transition-colors cursor-pointer px-2 py-1 rounded hover:bg-[#1A1A1A]"
                        onClick={() => setShowCompanyInfo(true)}
                    >
                        <span className="text-[10px] uppercase tracking-wider font-medium">Info</span>
                        <Info size={12} />
                    </div>
                </div>

                {/* --- METRICS GRID --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                    {/* COLUMNA 1: CORE METRICS */}
                    <div className="flex flex-col gap-2">
                        <MetricRowCard 
                            label="IFS" 
                            value={ifsStatus.label} 
                            color={ifsStatus.color} 
                            customIndicator={<IFSRadial ifs={ifsStatus.raw} ifsMemory={resumen?.ifs_memory} size={24} />}                                    
                        />
                        <MetricRowCard 
                            label="Valuation" 
                            value={valuationStatus.label} 
                            color={valuationStatus.color} 
                            customIndicator={<ValuationSignal status={valuationStatus.raw} />}
                        />
                        <MetricRowCard 
                            label="Stage" 
                            value={stageStatus.label} 
                            color={stageStatus.color} 
                            icon={Activity}
                        />
                    </div>

                    {/* COLUMNA 2: FGOS (QUALITY) */}
                    <div className="h-full bg-[#0A0A0A] border border-[#222] rounded-md p-3 flex flex-col justify-between hover:border-[#333] transition-colors min-h-[130px]">
                        <h3 className="text-[10px] font-bold text-[#666] uppercase tracking-wider mb-2">Quality (FGOS)</h3>
                        <div className="flex flex-col flex-1 justify-center gap-1.5">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-medium text-[#888]">Score</span>
                                <span className="font-mono font-medium text-[#EDEDED]">{resumen?.fgos_score ?? '-'}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-medium text-[#888] flex items-center gap-1">Ventaja vs Peers</span>
                                <span className="font-mono font-medium text-[#EDEDED]">
                                    {getMoatLabel(resumen?.fgos_components?.moat)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-medium text-[#888]">Sentiment</span>
                                <span className={cn("font-medium", 
                                    resumen?.fgos_components?.sentiment_details?.band === 'optimistic' ? 'text-emerald-500' : 
                                    resumen?.fgos_components?.sentiment_details?.band === 'pessimistic' ? 'text-red-500' : 'text-[#888]'
                                )}>
                                    {resumen?.fgos_components?.sentiment_details?.band === 'optimistic' ? '▲' : 
                                     resumen?.fgos_components?.sentiment_details?.band === 'pessimistic' ? '▼' : '-'}
                                </span>
                            </div>
                            {resumen?.fgos_components?.quality_brakes?.applied && (
                                <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-[#222]">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-medium text-amber-500">Quality Warning</span>
                                        <AlertTriangle size={12} className="text-amber-500" />
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {resumen.fgos_components.quality_brakes.reasons.map((reason: string, idx: number) => (
                                            <span key={idx} className="text-[9px] text-[#888] bg-[#1A1A1A] px-1 rounded border border-[#333]">
                                                {reason.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUMNA 3: PROFILE */}
                    <div className="h-full bg-[#0A0A0A] border border-[#222] rounded-md p-3 flex flex-col justify-between hover:border-[#333] transition-colors min-h-[130px]">
                        <h3 className="text-[10px] font-bold text-[#666] uppercase tracking-wider mb-2">Profile</h3>
                        <div className="flex flex-col flex-1 justify-center gap-1.5">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-medium text-[#888]">Sector</span>
                                <span className="font-medium text-[#EDEDED] text-right truncate max-w-[100px]">{data.sector || "N/A"}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-medium text-[#888]">Industry</span>
                                <span className="font-medium text-[#EDEDED] text-right truncate max-w-[100px]">{data.industry || "N/A"}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-medium text-[#888]">CEO</span>
                                <span className="font-medium text-[#EDEDED] text-right truncate max-w-[100px]">{data.ceo || "N/A"}</span>
                            </div>
                        </div>
                    </div>

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

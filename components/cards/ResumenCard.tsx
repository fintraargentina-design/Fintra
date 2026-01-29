"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getResumenData, ResumenData } from "@/lib/repository/fintra-db";
import FinancialsHistoryChart from "@/components/charts/FinancialsHistoryChart";
import { cn } from "@/lib/utils";
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
  if (!status) return <div className="w-4 h-4" />;

  const lower = status.toLowerCase();
  let colorClass = "bg-zinc-700";
  let bars = 0;

  // Logic: Cheap = High Signal (Green), Fair = Med (Orange), Expensive = Low (Red)
  if (lower.includes("undervalued") || lower.includes("cheap")) {
    colorClass = "bg-green-500";
    bars = 4;
  } else if (lower.includes("fair")) {
    colorClass = "bg-orange-500";
    bars = 3;
  } else if (lower.includes("overvalued") || lower.includes("expensive")) {
    colorClass = "bg-red-500";
    bars = 2;
  }

  return (
    <div className="flex items-end gap-[1px] h-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-[2px] rounded-sm ${i <= bars ? colorClass : "bg-zinc-800"}`}
          style={{ height: `${i * 25}%` }}
        />
      ))}
    </div>
  );
};

const IFSRadial = ({ ifs }: { ifs?: { position: string, pressure: number } | null }) => {
  if (!ifs) return <div className="w-4 h-4 rounded-full border border-zinc-800" />;

  const { position, pressure } = ifs;
  const totalSegments = 8; // Simplified to 8 for symmetry in radial
  const filled = Math.min(totalSegments, Math.ceil((pressure / 9) * totalSegments));
  
  let color = "#71717a"; // zinc-500
  if (position === "leader") color = "#10b981"; // emerald-500
  else if (position === "follower") color = "#f59e0b"; // amber-500
  else if (position === "laggard") color = "#ef4444"; // red-500

  // Generate segments
  const segments = [];
  const cx = 10;
  const cy = 10;
  const r = 8;
  
  for (let i = 0; i < totalSegments; i++) {
    const startAngle = (i * 360) / totalSegments;
    const endAngle = ((i + 1) * 360) / totalSegments - 8; // 8 deg gap
    
    // Polar to Cartesian
    const x1 = cx + r * Math.cos((startAngle - 90) * (Math.PI / 180));
    const y1 = cy + r * Math.sin((startAngle - 90) * (Math.PI / 180));
    const x2 = cx + r * Math.cos((endAngle - 90) * (Math.PI / 180));
    const y2 = cy + r * Math.sin((endAngle - 90) * (Math.PI / 180));
    
    const d = [
      "M", cx, cy,
      "L", x1, y1,
      "A", r, r, 0, 0, 1, x2, y2,
      "Z"
    ].join(" ");

    segments.push(
      <path
        key={i}
        d={d}
        fill={i < filled ? color : "#27272a"} // zinc-800 empty
        stroke="none"
      />
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      {segments}
    </svg>
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
        green: "text-emerald-400",
        yellow: "text-amber-400",
        red: "text-rose-400",
        gray: "text-zinc-400"
    };
    
    // Simple visual indicator for the middle column
    const renderIndicator = () => {
        if (color === 'green') return <div className="flex gap-0.5"><div className="w-1 h-3 bg-emerald-500 rounded-sm" /><div className="w-1 h-2 bg-emerald-500/50 rounded-sm" /><div className="w-1 h-1 bg-emerald-500/30 rounded-sm" /></div>;
        if (color === 'yellow') return <div className="flex gap-0.5"><div className="w-1 h-2 bg-amber-500/50 rounded-sm" /><div className="w-1 h-3 bg-amber-500 rounded-sm" /><div className="w-1 h-2 bg-amber-500/50 rounded-sm" /></div>;
        if (color === 'red') return <div className="flex gap-0.5"><div className="w-1 h-1 bg-rose-500/30 rounded-sm" /><div className="w-1 h-2 bg-rose-500/50 rounded-sm" /><div className="w-1 h-3 bg-rose-500 rounded-sm" /></div>;
        return <div className="w-3 h-3 rounded-full border border-zinc-600" />;
    };

    return (
        <div className="bg-[#121212] rounded px-2 py-1 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300 w-1/3 truncate">{label}</span>
            <div className="flex items-center justify-center w-1/3">
                 {customIndicator ? customIndicator : (Icon ? <Icon size={16} className={colorStyles[color]} /> : renderIndicator())}
            </div>
            <div className="flex flex-col items-end w-1/3">
                <span className={cn("text-xs font-bold font-mono", colorStyles[color])}>{value}</span>
                {subtext && <span className="text-[9px] text-zinc-600 uppercase tracking-tighter">{subtext}</span>}
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
        const fetchedResumen = await getResumenData(currentSymbol);
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
      const rawData = resumen?.ifs ? { position: resumen.ifs.position, pressure: resumen.ifs.pressure } : null;

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
    <Card className="bg-transparent border-none shadow-lg w-full flex flex-col overflow-hidden rounded-none h-auto min-h-0">
      <CardContent className="p-0 flex flex-col h-full bg-zinc-950">
        
        {/* HEADER - DO NOT MODIFY */}
        <div className="h-[20px] border-b border-zinc-800 bg-[#103765] flex items-center justify-center shrink-0">
          <span className="text-[14px] font-medium text-white tracking-wide">Overview</span>
        </div>

        {/* SCROLLABLE CONTENT WITH NEW GRID LAYOUT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
            <div className="max-w-[1600px] mx-auto flex flex-col gap-1">
                
                {/* --- MAIN GRID CONTAINER --- */}
                <div className="grid grid-cols-[3fr_1fr] gap-1">

                    {/* --- LEFT COLUMN (75%) --- */}
                    <div className="flex flex-col gap-1">
                        
                        {/* FILA 1: COMPANY INFO CARD */}
                        <div className="bg-[#A2A2A2]/20 rounded-lg px-2 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md flex items-center justify-center p-0">
                                    {data.logo_url ? (
                                        <img src={data.logo_url} alt={data.symbol} className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-lg font-light text-zinc-500">{data.symbol.slice(0,2)}</span>
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-[16px] font-medium text-white tracking-tight leading-none">{data.name}</h1>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-zinc-300 transition-colors cursor-pointer">
                                <span className="text-[10px] tracking-wider font-light">more info about the company</span>
                                <Info size={23} />
                            </div>
                        </div>

                        {/* FILA 2: NESTED GRID (METRICS + FGOS) */}
                        <div className="grid grid-cols-[2fr_1fr] gap-1">
                            
                            {/* COLUMNA IZQUIERDA: STACK OF 3 */}
                            <div className="flex flex-col gap-1">
                                <MetricRowCard 
                                    label="IFS" 
                                    value={ifsStatus.label} 
                                    color={ifsStatus.color} 
                                    customIndicator={<IFSRadial ifs={ifsStatus.raw} />}                                    
                                />
                                <MetricRowCard 
                                    label="Relative valuation" 
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

                            {/* COLUMNA DERECHA: FGOS (TALL) */}
                            <div className="h-full bg-[#121212] rounded-lg p-1 flex flex-col justify-between">
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">FGOS</h3>
                                <div className="flex flex-col flex-1 justify-center">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-light text-zinc-300">Calidad fundamental</span>
                                        <span className="font-mono font-light text-zinc-200">{resumen?.fgos_score ?? '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-light text-zinc-300 flex items-center gap-1">Moat <Info size={12}/></span>
                                        <span className="font-mono font-light text-zinc-200">{resumen?.fgos_components?.moat ?? '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-light text-zinc-300">Sentiment</span>
                                        <span className={cn("font-light", 
                                            resumen?.fgos_components?.sentiment_details?.band === 'optimistic' ? "text-emerald-400" : 
                                            resumen?.fgos_components?.sentiment_details?.band === 'pessimistic' ? "text-red-400" : 
                                            "text-zinc-400"
                                        )}>
                                            {resumen?.fgos_components?.sentiment_details?.band 
                                                ? resumen.fgos_components.sentiment_details.band.charAt(0).toUpperCase() + resumen.fgos_components.sentiment_details.band.slice(1) 
                                                : "Neutral"}
                                        </span>
                                    </div>
                                    {/* Alert / Brake */}
                                    {(resumen?.fgos_maturity === "Developing" || resumen?.fgos_maturity === "Incomplete" || resumen?.fgos_maturity === "Early-stage") && (
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="font-light text-zinc-300">Z Score / F Score - alert</span>
                                            <AlertTriangle size={12} className="text-yellow-500" />
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* --- RIGHT COLUMN (25%) --- */}
                    <div className="flex flex-col gap-1 pl-2 py-2 align-center justify-center bg-[#121212]">
                        <InfoLabel label="Sector" value={data.sector || "N/A"} />
                        <InfoLabel label="Industria" value={data.industry || "N/A"} />
                        <InfoLabel label="CEO" value={data.ceo || "N/A"} />                        
                    </div>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

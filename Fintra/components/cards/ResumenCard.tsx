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
  Info, AlertTriangle
} from "lucide-react";
import { ValuationSignal, FGOSCell } from "@/components/shared/FinancialCells";
import { IFSDualCell } from "@/components/tables/IFSDualCell";

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

const ScenarioCard = ({ 
    title, 
    scenario, 
    implication, 
    metric, 
    suggestedViews,
    warning
}: { 
    title: string, 
    scenario: string, 
    implication: string, 
    metric: React.ReactNode, 
    suggestedViews: string[],
    warning?: React.ReactNode
}) => (
    <div className="h-full bg-[#0A0A0A] border border-[#222] rounded-md p-3 flex flex-col justify-between hover:border-[#333] transition-colors min-h-[140px]">
        {/* HEADER & METRIC */}
        <div className="flex flex-col items-center gap-2 mb-3">
            <h3 className="text-[10px] font-bold text-[#666] uppercase tracking-wider">{title}</h3>
            <div className="transform scale-110">
                {metric}
            </div>
        </div>
        {/* SCENARIO NARRATIVE */}
        <div className="flex-1 flex flex-col gap-2 mb-2 text-center">
            <div>
                <span className="text-[9px] text-[#444] uppercase tracking-wider block mb-0.5">Escenario</span>
                <p className="text-[11px] text-[#EDEDED] leading-snug font-medium">
                    {scenario}
                </p>
            </div>
            <div>
                <span className="text-[9px] text-[#444] uppercase tracking-wider block mb-0.5">Significado</span>
                <p className="text-[10px] text-[#888] leading-snug">
                    {implication}
                </p>
            </div>
            {warning && (
                <div className="mt-1 pt-1 border-t border-[#1A1A1A] text-left">
                     {warning}
                </div>
            )}
        </div>
        {/* SUGGESTED VIEWS */}
        <div className="pt-2 mt-auto border-t border-[#1A1A1A]">
            <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="text-[9px] text-[#444] uppercase tracking-wider">Miradas:</span>
                <div className="flex gap-2 flex-wrap justify-center">
                    {suggestedViews.map((view, i) => (
                        <span key={i} className="text-[9px] text-[#666] hover:text-[#888] cursor-pointer border-b border-transparent hover:border-[#444] transition-colors">
                            {view}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

// Helpers for Scenario Data
function getValuationScenarioData(status: string | null) {
    const s = (status || '').toLowerCase();
    if (!s || s === 'pending') return {
        scenario: "Datos insuficientes para determinar un escenario de valoración confiable.",
        implication: "Se requiere mayor histórico o normalización de métricas para emitir juicio.",
        views: ["Evolución de Precio"]
    };
    if (s.includes('undervalued') || s.includes('cheap')) return {
        scenario: "Cotización en zona de oportunidad histórica con margen de seguridad implícito.",
        implication: "El mercado podría estar subestimando la capacidad de generación de caja futura.",
        views: ["Múltiplos Históricos", "DCF Inverso"]
    };
    if (s.includes('fair')) return {
        scenario: "Valoración alineada con los promedios históricos y la calidad del activo.",
        implication: "El retorno esperado depende puramente del crecimiento de beneficios.",
        views: ["PEG Ratio", "Yield vs Bonos"]
    };
    // Overvalued
    return {
        scenario: "Precio incorpora expectativas de crecimiento superiores a la media histórica.",
        implication: "Riesgo asimétrico negativo si la ejecución no es perfecta.",
        views: ["Revisiones de EPS", "Momentum"]
    };
}

function getIFSScenarioData(position: string | undefined) {
    if (!position) return {
        scenario: "Evaluando la posición competitiva relativa al sector.",
        implication: "Recopilando métricas de eficiencia comparada.",
        views: ["Márgenes Operativos"]
    };
    if (position === 'leader') return {
        scenario: "Dominancia estructural con métricas de eficiencia y rentabilidad superiores a pares.",
        implication: "Dicta condiciones de mercado y posee ventajas competitivas duraderas.",
        views: ["ROIC vs WACC", "Market Share"]
    };
    if (position === 'follower') return {
        scenario: "Competidor funcional que replica estándares sin liderar la innovación.",
        implication: "Rentabilidad ligada al ciclo del sector más que a méritos propios.",
        views: ["Eficiencia de Capital", "Benchmarking"]
    };
    // Laggard
    return {
        scenario: "Posición defensiva con métricas inferiores que sugieren desventajas estructurales.",
        implication: "Vulnerable a guerras de precios; requiere catalizadores de cambio.",
        views: ["Deuda Neta/EBITDA", "Cash Burn"]
    };
}

function getFGOSScenarioData(score: number | undefined) {
    const s = score ?? 0;
    if (s === 0) return { 
         scenario: "Información fundamental insuficiente para diagnóstico de calidad.",
         implication: "Verificar disponibilidad de estados financieros auditados.",
         views: ["Estados Financieros"]
    };
    if (s >= 80) return {
        scenario: "Fortaleza financiera integral con asignación de capital disciplinada.",
        implication: "Bajo riesgo de quiebra; alta capacidad para sostener dividendos.",
        views: ["Piotroski Breakdown", "Dupont"]
    };
    if (s >= 65) return {
        scenario: "Operación sólida con fricciones menores o dependencia del ciclo económico.",
        implication: "Requiere monitoreo de márgenes y apalancamiento en trimestres recesivos.",
        views: ["Tendencia de Márgenes", "Ciclo Conversión"]
    };
    // Low
    return {
        scenario: "Deterioro en la calidad fundamental o estructura de capital agresiva.",
        implication: "Riesgo elevado de dilución o problemas de liquidez si el entorno empeora.",
        views: ["Altman Z-Score", "Vencimientos"]
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

  // Derived Scenario Data
  const valuationScenario = useMemo(() => getValuationScenarioData(resumen?.valuation?.canonical_status || null), [resumen]);
  const ifsScenario = useMemo(() => getIFSScenarioData(resumen?.ifs?.position), [resumen]);
  const fgosScenario = useMemo(() => getFGOSScenarioData(resumen?.fgos_score ?? undefined), [resumen]);

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
                            <div className="flex items-center gap-2">
                                <h1 className="text-[18px] font-semibold text-[#EDEDED] tracking-tight leading-none">{data.symbol}</h1>
                                <div 
                                    className="text-[#666] hover:text-[#EDEDED] transition-colors cursor-pointer p-0.5 rounded hover:bg-[#1A1A1A]"
                                    onClick={() => setShowCompanyInfo(true)}
                                >
                                    <Info size={12} />
                                </div>
                            </div>
                            <span className="text-[11px] text-[#888] font-medium truncate max-w-[300px]">{data.name}</span>
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

                {/* SCENARIO ANALYSIS CARDS */}
                <div className="grid grid-cols-3 gap-3">
                    {/* 1. VALORACIÓN RELATIVA */}
                    <ScenarioCard 
                        title="Valoración Relativa"
                        scenario={valuationScenario.scenario}
                        implication={valuationScenario.implication}
                        metric={
                            <ValuationSignal status={resumen?.valuation?.canonical_status || null} />
                        }
                        suggestedViews={["Discounted Cash Flow", "Multiple Analysis", "Historical Range"]}
                    />

                    {/* 2. POSICIÓN COMPETITIVA */}
                    <ScenarioCard 
                        title="Posición Competitiva"
                        scenario={ifsScenario.scenario}
                        implication={ifsScenario.implication}
                        metric={
                            <IFSDualCell
                                ifs={resumen?.ifs ? { position: resumen.ifs.position, pressure: 0 } : null}
                                ifs_fy={null}
                                size="compact"
                            />
                        }
                        suggestedViews={["Industry Quality Score", "Moat Analysis", "Market Share"]}
                    />

                    {/* 3. CALIDAD FUNDAMENTAL */}
                    <ScenarioCard 
                        title="Calidad Fundamental"
                        scenario={fgosScenario.scenario}
                        implication={fgosScenario.implication}
                        metric={
                            <FGOSCell
                                score={resumen?.fgos_score}
                                status={resumen?.fgos_maturity || resumen?.fgos_status}
                                sentiment={resumen?.fgos_components?.sentiment_details?.band}
                                band={resumen?.fgos_components?.competitive_advantage?.band}
                                hasPenalty={!!resumen?.fgos_components?.quality_brakes}
                            />
                        }
                        suggestedViews={["FGOS Framework", "Balance Sheet Health", "Cash Flow Quality"]}
                        warning={
                            resumen?.fgos_components?.quality_brakes && (
                                <div className="flex items-start gap-1.5 text-amber-500/90 bg-amber-950/20 p-1.5 rounded border border-amber-900/30">
                                    <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                                    <div className="flex flex-col">
                                         <span className="text-[9px] font-bold uppercase tracking-wider">Quality Warning</span>
                                         <span className="text-[9px] leading-tight opacity-80">
                                             {resumen.fgos_components.quality_brakes.reasons?.length > 0 
                                                ? resumen.fgos_components.quality_brakes.reasons.map(r => r.replace(/_/g, ' ')).join(', ')
                                                : "Frenos de calidad activos"}
                                         </span>
                                     </div>
                                </div>
                            )
                        }
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

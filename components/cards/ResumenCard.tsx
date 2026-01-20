"use client";
// Fintra/components/cards/ResumenCard.tsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getResumenData, ResumenData } from "@/lib/repository/fintra-db";
import FintraStructuralProfile from "./FintraStructuralProfile";
import FgosAnalysisBlock from "../dashboard/FgosAnalysisBlock";
import SectorValuationBlock from "../dashboard/SectorValuationBlock";

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

const getFgosBand = (bucket?: string): "high" | "medium" | "low" | "not_classified" => {
  if (!bucket || bucket === 'unknown') return 'not_classified';
  if (['elite', 'strong'].includes(bucket)) return 'high';
  if (bucket === 'average') return 'medium';
  if (bucket === 'weak') return 'low';
  return 'not_classified';
};

const getRelativeValuation = (status?: string): "cheap" | "fair" | "expensive" | "not_classifiable" => {
  if (!status || status === 'pending') return 'not_classifiable';
  if (status === 'cheap_sector') return 'cheap';
  if (status === 'fair_sector') return 'fair';
  if (status === 'expensive_sector') return 'expensive';
  return 'not_classifiable';
};

export default function ResumenCard({
  symbol,
  stockBasicData,
  onStockSearch,
  isParentLoading,
}: ResumenCardProps) {
  // Resumen state
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSymbol = useMemo(() => (symbol || "").toUpperCase(), [symbol]);

  const data = useMemo(() => {
    // 1. Priority: Resumen Data
    if (resumen) {
        const num = (x: any) => {
            const n = Number(x);
            return Number.isFinite(n) ? n : undefined;
        };
        
        const str = (s: any) => (typeof s === "string" ? s.trim() : undefined);

        return {
            symbol: str(resumen.ticker) || currentSymbol,
            companyName: str(resumen.name),
            sector: str(resumen.sector),
            industry: str(resumen.industry),
            ceo: str(resumen.ceo),
            country: str(resumen.country),
            website: str(resumen.website),
            marketCap: num(resumen.market_cap),
            fullTimeEmployees: num(resumen.employees),
            beta: num(resumen.beta),
            volume: num(resumen.volume),
            lastDividend: num(resumen.last_dividend),
            range: str(resumen.range),
            ipoDate: str(resumen.ipo_date),
            exchange: str(resumen.exchange),
            description: str(resumen.description),
        };
    }

    // 2. Fallback: Props Data
    if (stockBasicData && typeof stockBasicData === "object") {
      return {
        ...stockBasicData,
        symbol: (stockBasicData.symbol || currentSymbol || "").toUpperCase(),
      };
    }

    // 3. Default Empty
    return {
      symbol: currentSymbol,
      companyName: "",
      sector: "",
      industry: "",
      ceo: "",
      country: "",
      website: "",
      marketCap: undefined,
      fullTimeEmployees: undefined,
      beta: undefined,
      volume: undefined,
      lastDividend: undefined,
      range: "",
      ipoDate: "",
      exchange: "",
      description: "",
    };
  }, [stockBasicData, currentSymbol, resumen]);

  // Combined Effect: Fetch Resumen Data
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!currentSymbol) return;

      // 1. Init Loading States
      setLoading(true);
      setError(null);
      setResumen(null); 

      try {
        // 2. Fetch Resumen
        const fetchedResumen = await getResumenData(currentSymbol);
        if (active && fetchedResumen) {
            setResumen(fetchedResumen);
        }
      } catch (err) {
        console.error("Error fetching resumen:", err);
        if (active) setError("Error cargando resumen");
      } finally {
        if (active) {
            setLoading(false);
        }
      }
    };

    loadData();
    return () => { active = false; };
  }, [currentSymbol]);

  const renderField = (value: any) => {
    if (value === undefined || value === null || value === "N/A" || value === "") {
      return (
        <span className="text-gray-500 text-xs italic">
          N/D
        </span>
      );
    }
    return <span className="text-zinc-200 text-xs font-medium truncate">{value}</span>;
  };

  // We rely on loading state only if we don't have resumen data either.
  const hasData = Boolean(resumen);
  const isLoading = loading && !hasData;

  return (
    <Card className="bg-tarjetas border-none shadow-lg w-full flex flex-col overflow-hidden rounded-none">
      <CardContent className="p-0">
        <div className="p-2 bg-black/20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-none border-zinc-800 overflow-hidden">
            <div className="lg:col-span-3 flex flex-col p-4 bg-tarjetas border-r border-zinc-800 gap-4">
              <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider">Perfil Corporativo</h3>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Sector</span>
                  {renderField(data.sector)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Industria</span>
                  {renderField(data.industry)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">CEO</span>
                  {renderField(data.ceo)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">País</span>
                  {renderField(data.country)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Sitio Web</span>
                  {data.website ? (
                    <a
                      href={String(data.website).startsWith("http") ? String(data.website) : `https://${data.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FFA028] hover:underline truncate text-xs font-medium"
                    >
                      {String(data.website).replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  ) : (
                    renderField(null)
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col p-4 bg-tarjetas border-r border-zinc-800 gap-4">
              <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider">Métricas Clave</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Cap. Mercado</span>
                  <span className="text-white font-mono text-xs font-medium">{formatLargeNumber(data.marketCap)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Empleados</span>
                  {renderField(
                    Number.isFinite(Number(data.fullTimeEmployees))
                      ? Number(data.fullTimeEmployees).toLocaleString()
                      : undefined
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Beta</span>
                  <span className="text-white font-mono text-xs font-medium">
                    {Number.isFinite(Number(data.beta)) ? Number(data.beta).toFixed(3) : "N/D"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Volumen</span>
                  <span className="text-white font-mono text-xs font-medium">
                    {Number.isFinite(Number(data.volume)) ? Number(data.volume).toLocaleString() : "N/D"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Dividendo</span>
                  <span className="text-white font-mono text-xs font-medium">
                    {Number.isFinite(Number(data.lastDividend)) ? `$${Number(data.lastDividend).toFixed(2)}` : "N/D"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Rango 52s</span>
                  <span className="text-zinc-300 font-mono text-[10px]">{data.range || "N/D"}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col p-4 bg-tarjetas gap-4">
              <div className="flex justify-between items-center">
                <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider">Sobre la Empresa</h3>
                <div className="flex gap-3 text-[10px] text-zinc-500">
                  <span>
                    IPO: <span className="text-zinc-300">{data.ipoDate || "N/D"}</span>
                  </span>
                  <span>
                    Bolsa: <span className="text-zinc-300">{data.exchange || "N/D"}</span>
                  </span>
                </div>
              </div>
              <div className="max-h-[160px] pr-2 overflow-y-auto">
                <p className="text-zinc-400 text-xs leading-relaxed text-justify font-mono">
                  {data.description || "Descripción no disponible."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="border-t border-zinc-800 bg-black/40 px-4 py-3">
            <div className="text-xs text-zinc-500">Cargando puntajes...</div>
          </div>
        )}
        {error && !isLoading && !hasData && (
          <div className="border-t border-zinc-800 bg-black/40 px-4 py-3">
            <div className="text-xs text-red-400">{error}</div>
          </div>
        )}

        {hasData && (
          <div className="border-t border-zinc-800 bg-zinc-900/40 p-6">
            <FintraStructuralProfile
              ifsPosition={resumen?.ifs?.position || 'not_classified'}
              ifsPressure={resumen?.ifs?.pressure}
              sectorRank={resumen?.sector_rank || undefined}
              sectorRankTotal={resumen?.sector_rank_total || undefined}
              fgosBand={getFgosBand(resumen?.fgos_state?.quality?.bucket)}
              relativeValuation={getRelativeValuation(resumen?.valuation?.canonical_status)}
              attentionState={resumen?.attention_state || "inconclusive"}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FgosAnalysisBlock fgosState={resumen?.fgos_state} />
              <SectorValuationBlock valuation={resumen?.valuation} />
            </div>
          </div>
        )}

        {isParentLoading && (
          <div className="border-t border-zinc-800 bg-black/40 px-4 py-2">
            <div className="text-[10px] text-zinc-600">Actualizando datos...</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


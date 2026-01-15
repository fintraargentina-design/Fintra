"use client";
// Fintra/components/cards/ResumenCard.tsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getResumenData, ResumenData } from "@/lib/repository/fintra-db";
import FgosAnalysisBlock from "@/components/dashboard/FgosAnalysisBlock";
import SectorValuationBlock from "@/components/dashboard/SectorValuationBlock";

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
          N/A
        </span>
      );
    }
    return <span className="text-zinc-200 text-xs font-medium truncate">{value}</span>;
  };

  const scoreAltman = resumen?.altman_z;
  const scorePiotroski = resumen?.piotroski_score;
  
  // Raw financial values
  const valTotalAssets = resumen?.total_assets;
  const valTotalLiabilities = resumen?.total_liabilities;
  const valRevenue = resumen?.revenue;
  const valEbit = resumen?.ebit;
  // Note: ResumenData uses 'market_cap' but previous UI used 'marketCap' alias in getScore. 
  // We'll use resumen.market_cap
  const valMarketCap = resumen?.market_cap; 
  const valWorkingCapital = resumen?.working_capital;

  // We rely on loading state only if we don't have resumen data either.
  const hasData = Boolean(resumen);
  const isLoading = loading && !hasData;

  return (
    <Card className="bg-tarjetas border-none shadow-lg w-full flex flex-col overflow-hidden rounded-none">
      <CardContent className="p-0">
        <div className="p-2 bg-black/20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-none border-zinc-800 overflow-hidden">
            <div className="lg:col-span-3 flex flex-col p-4 bg-tarjetas border-r border-zinc-800 gap-4">
              <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider">Corporate Profile</h3>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Sector</span>
                  {renderField(data.sector)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Industry</span>
                  {renderField(data.industry)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">CEO</span>
                  {renderField(data.ceo)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Country</span>
                  {renderField(data.country)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Website</span>
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
              <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider">Key Metrics</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Market Cap</span>
                  <span className="text-white font-mono text-xs font-medium">{formatLargeNumber(data.marketCap)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Employees</span>
                  {renderField(
                    Number.isFinite(Number(data.fullTimeEmployees))
                      ? Number(data.fullTimeEmployees).toLocaleString()
                      : undefined
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Beta</span>
                  <span className="text-white font-mono text-xs font-medium">
                    {Number.isFinite(Number(data.beta)) ? Number(data.beta).toFixed(3) : "N/A"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Volumen</span>
                  <span className="text-white font-mono text-xs font-medium">
                    {Number.isFinite(Number(data.volume)) ? Number(data.volume).toLocaleString() : "N/A"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Dividend</span>
                  <span className="text-white font-mono text-xs font-medium">
                    {Number.isFinite(Number(data.lastDividend)) ? `$${Number(data.lastDividend).toFixed(2)}` : "N/A"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Range 52w</span>
                  <span className="text-zinc-300 font-mono text-[10px]">{data.range || "N/A"}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col p-4 bg-tarjetas gap-4">
              <div className="flex justify-between items-center">
                <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider">About</h3>
                <div className="flex gap-3 text-[10px] text-zinc-500">
                  <span>
                    IPO: <span className="text-zinc-300">{data.ipoDate || "N/A"}</span>
                  </span>
                  <span>
                    EX: <span className="text-zinc-300">{data.exchange || "N/A"}</span>
                  </span>
                </div>
              </div>
              <div className="max-h-[160px] pr-2 overflow-y-auto">
                <p className="text-zinc-400 text-xs leading-relaxed text-justify font-mono">
                  {data.description || "No description available."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="border-t border-zinc-800 bg-black/40 px-4 py-3">
            <div className="text-xs text-zinc-500">Cargando scores...</div>
          </div>
        )}
        {error && !isLoading && !hasData && (
          <div className="border-t border-zinc-800 bg-black/40 px-4 py-3">
            <div className="text-xs text-red-400">{error}</div>
          </div>
        )}

        {hasData && (
          <div className="border-t border-zinc-800 bg-black/40 px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {[
                { label: "Altman Z", value: scoreAltman, kind: "altman" },
                { label: "Piotroski", value: scorePiotroski, kind: "piotroski" },
                { label: "Activos", value: valTotalAssets, kind: "money" },
                { label: "Pasivos", value: valTotalLiabilities, kind: "money" },
                { label: "Ingresos", value: valRevenue, kind: "money" },
                { label: "EBIT", value: valEbit, kind: "money" },
                { label: "Mkt Cap", value: valMarketCap, kind: "money" },
                { label: "Working Cap", value: valWorkingCapital, kind: "money" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-center items-center border-r last:border-r-0 border-zinc-800 px-2"
                >
                  <span className="text-zinc-500 text-[9px] uppercase tracking-wider mb-0.5">{item.label}</span>
                  <span
                    className={`font-mono font-medium text-xs ${
                      item.kind === "altman"
                        ? "text-green-400"
                        : item.kind === "piotroski"
                        ? "text-blue-400"
                        : "text-zinc-300"
                    }`}
                  >
                    {item.kind === "altman" && Number.isFinite(Number(item.value))
                      ? Number(item.value).toFixed(2)
                      : item.kind === "piotroski" && Number.isFinite(Number(item.value))
                      ? `${Number(item.value)}/9`
                      : item.kind === "money"
                      ? item.value
                        ? formatLargeNumber(Number(item.value))
                        : "N/A"
                      : "N/A"}
                  </span>
                </div>
              ))}
            </div>

            {/* FGOS Analysis Block (Phase 4) */}
            {resumen && (
              <FgosAnalysisBlock
                fgosState={resumen.fgos_state}
                fgosScore={resumen.fgos_score}
                confidenceLabel={resumen.fgos_confidence_label}
                confidencePercent={resumen.fgos_confidence_percent}
                fgosStatus={resumen.fgos_status}
              />
            )}

            {/* Sector Relative Valuation Block */}
            {resumen && (
              <SectorValuationBlock valuation={resumen.valuation} />
            )}
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


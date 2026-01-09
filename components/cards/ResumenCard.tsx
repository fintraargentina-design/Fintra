"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search } from "lucide-react";
import { fmp } from "@/lib/fmp/client";

interface ResumenCardProps {
  symbol: string;
  stockBasicData?: any;
  onStockSearch?: (symbol: string) => Promise<any> | any;
  onOpenSearchModal?: () => void;
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
  onOpenSearchModal,
  isParentLoading,
}: ResumenCardProps) {
  const [scoresData, setScoresData] = useState<any>(null);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoresError, setScoresError] = useState<string | null>(null);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const currentSymbol = useMemo(() => (symbol || "").toUpperCase(), [symbol]);

  const data = useMemo(() => {
    if (stockBasicData && typeof stockBasicData === "object") {
      return {
        ...stockBasicData,
        symbol: (stockBasicData.symbol || currentSymbol || "").toUpperCase(),
      };
    }
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
  }, [stockBasicData, currentSymbol]);

  useEffect(() => {
    let active = true;
    const fetchScores = async () => {
      if (!currentSymbol) return;
      setScoresLoading(true);
      setScoresError(null);
      try {
        const response = await fmp.scores(currentSymbol);
        const scores = Array.isArray(response) ? response[0] : response;
        if (!active) return;
        setScoresData(scores || null);
      } catch (e: any) {
        if (!active) return;
        setScoresError(e?.message || "Error al cargar scores");
        setScoresData(null);
      } finally {
        if (active) setScoresLoading(false);
      }
    };
    fetchScores();
    return () => {
      active = false;
    };
  }, [currentSymbol]);

  const handleNAClick = (fieldName: string) => {
    setEditingField(fieldName);
    setSearchValue("");
  };

  const handleSearch = async () => {
    if (!searchValue.trim() || !onStockSearch) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      await onStockSearch(searchValue.trim().toUpperCase());
      setEditingField(null);
      setSearchValue("");
    } catch (error: any) {
      setSearchError(error?.message || "Error al buscar");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") {
      setEditingField(null);
      setSearchValue("");
      setSearchError(null);
    }
  };

  const renderEditableField = (value: any, fieldName: string) => {
    if (editingField === fieldName) {
      if (searchLoading) {
        return (
          <div className="px-2 py-1 bg-black/20 text-[#FFA028] text-xs flex items-center space-x-2 rounded">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Cargando...</span>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-1 min-w-[150px]">
          <div className="flex items-center gap-2">
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ticker..."
              className="h-6 text-xs bg-black/40 border-zinc-700"
              autoFocus
            />
            <Search
              className="w-3 h-3 text-gray-400 cursor-pointer hover:text-[#FFA028]"
              onClick={handleSearch}
            />
          </div>
          {searchError && <span className="text-red-400 text-[10px]">{searchError}</span>}
        </div>
      );
    }

    if (value === undefined || value === null || value === "N/A" || value === "") {
      return (
        <span
          className="text-gray-500 cursor-pointer hover:text-[#FFA028] transition-colors text-xs italic"
          onClick={() => {
            handleNAClick(fieldName);
            setSearchError(null);
          }}
        >
          N/A
        </span>
      );
    }

    return <span className="text-zinc-200 text-xs font-medium truncate">{value}</span>;
  };

  const scoreAltman = scoresData?.altmanZScore ?? scoresData?.altmanZ ?? scoresData?.altmanZscore ?? null;
  const scorePiotroski = scoresData?.piotroskiScore ?? scoresData?.piotroski ?? null;
  const scoresRaw = scoresData?.raw ?? scoresData ?? {};

  return (
    <Card className="bg-tarjetas border-none shadow-lg w-full flex flex-col overflow-hidden rounded-none">
      <CardContent className="p-0">
        <div className="p-4 bg-black/20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border border-zinc-800 rounded-sm overflow-hidden">
            <div className="lg:col-span-3 flex flex-col p-4 bg-tarjetas border-r border-zinc-800 gap-4">
              <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider">Corporate Profile</h3>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Sector</span>
                  {renderEditableField(data.sector, "sector")}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Industry</span>
                  {renderEditableField(data.industry, "industry")}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">CEO</span>
                  {renderEditableField(data.ceo, "ceo")}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Country</span>
                  {renderEditableField(data.country, "country")}
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
                    renderEditableField(null, "website")
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
                  {renderEditableField(
                    Number.isFinite(Number(data.fullTimeEmployees))
                      ? Number(data.fullTimeEmployees).toLocaleString()
                      : undefined,
                    "employees",
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
              <p className="text-zinc-400 text-xs leading-relaxed text-justify overflow-y-auto max-h-[160px] pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {data.description || "No description available."}
              </p>
            </div>
          </div>
        </div>

        {scoresLoading && (
          <div className="border-t border-zinc-800 bg-black/40 px-4 py-3">
            <div className="text-xs text-zinc-500">Cargando scores...</div>
          </div>
        )}
        {scoresError && !scoresLoading && (
          <div className="border-t border-zinc-800 bg-black/40 px-4 py-3">
            <div className="text-xs text-red-400">{scoresError}</div>
          </div>
        )}

        {scoresData && !scoresLoading && (
          <div className="border-t border-zinc-800 bg-black/40 px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {[
                { label: "Altman Z", value: scoreAltman, kind: "altman" },
                { label: "Piotroski", value: scorePiotroski, kind: "piotroski" },
                { label: "Activos", value: scoresRaw.totalAssets, kind: "money" },
                { label: "Pasivos", value: scoresRaw.totalLiabilities, kind: "money" },
                { label: "Ingresos", value: scoresRaw.revenue, kind: "money" },
                { label: "EBIT", value: scoresRaw.ebit, kind: "money" },
                { label: "Mkt Cap", value: scoresRaw.marketCap, kind: "money" },
                { label: "Working Cap", value: scoresRaw.workingCapital, kind: "money" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-center items-center border-r last:border-r-0 border-zinc-800/50 px-2"
                >
                  <span className="text-zinc-600 text-[9px] uppercase tracking-wider mb-0.5">{item.label}</span>
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


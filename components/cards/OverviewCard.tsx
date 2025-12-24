// components/cards/OverviewCard.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  TrendingUp,
  DollarSign,
  TrendingUpDown,
  Building2,
  Percent,
  SquareArrowOutUpRight,
  User,
  FileText,
  BarChart3,
  Search,
  TextCursorInput,
  RefreshCw,
} from "lucide-react";

import { fmp } from "@/lib/fmp/client";
import { getConclusionColors } from "@/lib/conclusionColors";
import { useResponsive } from "@/hooks/use-responsive";

interface OverviewCardProps {
  selectedStock: any; // string ("AAPL") o { symbol: "AAPL", ... }
  stockConclusion?: any;
  onStockSearch?: (symbol: string) => Promise<any> | any;
  isParentLoading?: boolean; // Nueva prop para el estado de carga del padre
  analysisData?: any;
}

type Profile = Record<string, any>;

/** Normaliza/defiende los campos del profile de FMP */
function normalizeProfile(p: Profile | null): Profile {
  if (!p) return {};
  const numOrUndef = (x: any) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : undefined;
  };
  const boolOrFalse = (x: any) => (typeof x === "boolean" ? x : false);

  const rawMkt = p.mktCap ?? p.marketCap;
  const rawAvgVol = p.volAvg ?? p.averageVolume;

  return {
    // Básicos
    symbol: typeof p.symbol === "string" ? p.symbol.toUpperCase() : undefined,
    companyName: p.companyName,
    sector: p.sector,
    industry: p.industry,
    country: p.country,
    description: p.description,
    ceo: p.ceo,
    fullTimeEmployees:
      typeof p.fullTimeEmployees === "number"
        ? p.fullTimeEmployees
        : numOrUndef(p.fullTimeEmployees),
    ipoDate: p.ipoDate,
    exchange: p.exchangeShortName ?? p.exchange ?? p.exchangeFullName,
    exchangeFullName: p.exchangeFullName ?? p.exchangeShortName ?? p.exchange,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    phone: typeof p.phone === "string" ? p.phone : undefined,
    isEtf: boolOrFalse(p.isEtf),
    isActivelyTrading: boolOrFalse(p.isActivelyTrading),
    cik: p.cik,
    isin: p.isin,
    cusip: p.cusip,
    currency: p.currency,

    // Números / mercado
    price: typeof p.price === "number" ? p.price : numOrUndef(p.price),
    marketCap:
      typeof rawMkt === "number" ? rawMkt : numOrUndef(rawMkt),
    beta: typeof p.beta === "number" ? p.beta : numOrUndef(p.beta),
    lastDividend:
      typeof p.lastDiv === "number"
        ? p.lastDiv
        : typeof p.lastDividend === "number"
        ? p.lastDividend
        : numOrUndef(p.lastDiv ?? p.lastDividend),
    range: typeof p.range === "string" ? p.range : undefined,

    // Cambios (FMP puede traer "1.23%" como string)
    change:
      typeof p.changes === "number" ? p.changes : numOrUndef(p.changes) ||
      typeof p.change === "number" ? p.change : numOrUndef(p.change),
    changePercentage:
      typeof p.changePercentage === "number"
        ? p.changePercentage   // Convertir decimal a porcentaje
        : typeof p.changePercentage === "string"
        ? Number(p.changePercentage.replace("%", ""))
        : typeof p.changesPercentage === "number"
        ? p.changesPercentage 
        : typeof p.changesPercentage === "string"
        ? Number(p.changesPercentage.replace("%", ""))
        : undefined,

    volume:
      typeof p.volume === "number" ? p.volume : numOrUndef(p.volume),
    averageVolume:
      typeof rawAvgVol === "number" ? rawAvgVol : numOrUndef(rawAvgVol),
    website: typeof p.website === "string" ? p.website.trim() : undefined,
    image: p.image,
  };
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

function formatPercentage(value?: number) {
  if (!Number.isFinite(Number(value))) return "N/A";
  const v = Number(value);
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export default function OverviewCard({
  selectedStock,
  stockConclusion,
  onStockSearch,
  isParentLoading = false,
  analysisData,
}: OverviewCardProps) {
  // Primero declarar TODOS los hooks
  const { isMobile, isTablet } = useResponsive();
  
  // ── estado
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scoresData, setScoresData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "analysis">(
    "overview",
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [tickerInput, setTickerInput] = useState("");
  const [isTickerFocused, setIsTickerFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // símbolo actual robusto
  const currentSymbol = useMemo(() => {
    if (typeof selectedStock === "string")
      return selectedStock?.toUpperCase?.() || "";
    return (selectedStock?.symbol || "").toUpperCase();
  }, [selectedStock]);

  // input ticker
  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTickerInput(e.target.value.toUpperCase());
  };
  const handleTickerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tickerInput.trim() && onStockSearch) {
      onStockSearch(tickerInput.trim());
      setTickerInput("");
      setIsTickerFocused(false);
    }
  };
  const handleTickerFocus = () => {
    setIsTickerFocused(true);
    setTickerInput("");
  };
  const handleTickerBlur = () => {
    setIsTickerFocused(false);
    if (!tickerInput.trim()) setTickerInput("");
  };

  const [chartType, setChartType] = useState<"line" | "area">("area");
  const [chartRange, setChartRange] = useState<"1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "ALL">("1Y");

  // Helper functions for analysis display
  const fgos = analysisData?.fgos_score || 0;
  const valStatus = (analysisData?.valuation_status || "Fair").toLowerCase();
  const ehs = analysisData?.ecosystem_score || 0;

  const getVerdict = (score: number, v: string) => {
    const isCheap = v.includes("under") || v.includes("barata");
    const isFair = v.includes("fair") || v.includes("justa");
    
    if (score >= 70) { // Calidad Alta
        if (isCheap) return "⭐ Alta oportunidad a largo plazo";
        if (isFair) return "Empresa sólida, buen negocio";
        return "Excelente empresa, precio exigente";
    }
    if (score >= 40) { // Calidad Media
        if (isCheap) return "Potencial selectivo, requiere análisis";
        return "Sin ventaja clara";
    }
    // Calidad Baja
    if (isCheap) return "Barata por una razón (Cuidado)";
    return "❌ Riesgo elevado";
  };

  const verdict = getVerdict(fgos, valStatus);
  const getScoreColor = (s: number) => s >= 70 ? "text-green-400" : s >= 40 ? "text-yellow-400" : "text-red-400";
  const getValBadge = (v: string) => {
    if (v.includes("under") || v.includes("barata")) return <Badge className="text-green-400 bg-green-400/10 border-green-400 px-2 py-0.5 text-xs" variant="outline">Infravalorada</Badge>;
    if (v.includes("over") || v.includes("cara")) return <Badge className="text-red-400 bg-red-400/10 border-red-400 px-2 py-0.5 text-xs" variant="outline">Sobrevalorada</Badge>;
    return <Badge className="text-yellow-400 bg-yellow-400/10 border-yellow-400 px-2 py-0.5 text-xs" variant="outline">Justa</Badge>;
  };

  // carga profile desde /api/fmp/profile
  useEffect(() => {
    let active = true;
    (async () => {
      if (!currentSymbol) return;
      setLoading(true);
      setError(null);
      try {
        // Obtener profile, quote y scores en paralelo
        const [profileArr, quoteArr, scores] = await Promise.all([
          fmp.profile(currentSymbol),
          fmp.quote(currentSymbol),
          fmp.scores(currentSymbol)
        ]);
        
        const rawProfile = Array.isArray(profileArr) && profileArr.length ? profileArr[0] : null;
        const rawQuote = Array.isArray(quoteArr) && quoteArr.length ? quoteArr[0] : null;
        
        // Combinar datos de profile y quote
        const combinedData = {
          ...rawProfile,
          // Sobrescribir con datos de quote si están disponibles
          ...(rawQuote && {
            price: rawQuote.price,
            change: rawQuote.change,
            changePercentage: rawQuote.changesPercentage,
            volume: rawQuote.volume,
          })
        };
        
        if (!active) return;
        setProfile(normalizeProfile(combinedData));
        setScoresData(scores);
      } catch (err: any) {
        console.error("Error fetching company data:", err);
        if (active) setError("Error al cargar los datos de la empresa");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentSymbol]);

  // edición inline de campos N/A → buscador ticker
  const handleNAClick = (fieldName: string) => {
    setEditingField(fieldName);
    setSearchValue("");
  };
  
  /**
   * Maneja la búsqueda de acciones con mejor manejo de errores
   */
  const handleSearch = async () => {
    if (searchValue.trim() && onStockSearch) {
      setSearchLoading(true);
      setSearchError(null);
      try {
        await onStockSearch(searchValue.trim().toUpperCase());
        setEditingField(null);
        setSearchValue("");
      } catch (error) {
        console.error('Error en búsqueda de ticker:', error);
        
        // Proporcionar mensajes de error más específicos
        let errorMessage = "Error al buscar el ticker";
        
        if (error instanceof Error) {
          if (error.message.includes('API key')) {
            errorMessage = "Error de configuración de API";
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = "Error de conexión";
          } else if (error.message.includes('not found') || error.message.includes('no encontrado')) {
            errorMessage = "Ticker no encontrado";
          } else if (error.message.includes('rate limit') || error.message.includes('límite')) {
            errorMessage = "Límite de consultas excedido";
          } else {
            errorMessage = error.message;
          }
        }
        
        setSearchError(errorMessage);
      } finally {
        setSearchLoading(false);
      }
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

  // análisis IA
  const conclusion = stockConclusion?.conclusion?.Conclusión;
  const colors = getConclusionColors(conclusion);

  // AHORA sí podemos hacer returns condicionales basados en estado
  if (loading || isParentLoading) {
    return (
      <Card className="bg-tarjetas border-none flex items-center justify-center w-full h-[52px]">
        <CardContent className="p-0 flex items-center justify-center w-full h-full">
          <div className="h-32 grid place-items-center text-gray-500 text-sm">
            Cargando ticker...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-tarjetas flex items-center flex-col w-full justify-between p-0 max-h-[36px]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-red-400">{error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = profile || {};

  // campo editable con buscador
  const renderEditableField = (value: any, fieldName: string) => {
    if (editingField === fieldName) {
      if (searchLoading) {
        return (
          <div className="px-3 py-2 bg-Tarjeta text-orange-400 text-sm flex items-center space-x-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Cargando Ticker...</span>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Buscar ticker..."
              className="h-32 grid place-items-center text-gray-500 text-sm"
              autoFocus
            />
            <Search
              className="w-4 h-4 text-gray-400 cursor-pointer hover:text-orange-400"
              onClick={handleSearch}
            />
          </div>
          {searchError && (
            <span className="text-red-400 text-xs">{searchError}</span>
          )}
        </div>
      );
    }

    if (value === undefined || value === null || value === "N/A" || value === "") {
      return (
        <span
          className="text-gray-500 cursor-pointer hover:text-orange-400 transition-colors"
          onClick={() => {
            handleNAClick(fieldName);
            setSearchError(null);
          }}
        >
          N/A
        </span>
      );
    }

    return <span className="text-white">{value}</span>;
  };

  // tabs
  const renderOverviewContent = () => (
    <div className="space-y-6">
      {/* Información de la Empresa */}
      <div className="bg-tarjetas rounded-lg p-4 border-gray-700/30">
        <h3 className="text-orange-400 text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Información de la Empresa
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Nombre:</span>
              {renderEditableField(data.companyName, "companyName")}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Sector:</span>
              {renderEditableField(data.sector, "sector")}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Industria:</span>
              {renderEditableField(data.industry, "industry")}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">CEO:</span>
              {renderEditableField(data.ceo, "ceo")}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fundada (IPO):</span>
              {renderEditableField(data.ipoDate, "ipoDate")}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Empleados:</span>
              {renderEditableField(
                Number.isFinite(Number(data.fullTimeEmployees))
                  ? Number(data.fullTimeEmployees).toLocaleString()
                  : undefined,
                "employees",
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Sitio web:</span>
              {data.website ? (
                <span className="text-orange-400">
                  <a
                    href={
                      data.website.startsWith("http")
                        ? data.website
                        : `https://${data.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-orange-300 underline"
                  >
                    {String(data.website).replace(/^https?:\/\//, "").trim()}
                  </a>
                </span>
              ) : (
                renderEditableField(null, "website")
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Intercambio:</span>
              {renderEditableField(data.exchange, "exchange")}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">País:</span>
              {renderEditableField(data.country, "country")}
            </div>
          </div>
        </div>
      </div>

      {/* Descripción */}
      <div className="bg-tarjetas rounded-lg p-4 border-gray-700/30">
        <h3 className="text-orange-400 text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Descripción
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed text-justify">
          {data.description || "No hay descripción disponible."}
        </p>
      </div>

      {/* Métricas */}
      <div className="bg-tarjetas rounded-lg p-4 border-gray-700/30">
        <h3 className="text-orange-400 text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Métricas Financieras Clave
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">
              Valoración
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Cap. de Mercado:</span>
                <span className="text-orange-400 font-mono">
                  {formatLargeNumber(data.marketCap)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Precio Actual:</span>
                <span className="text-orange-400 font-mono">
                  {Number.isFinite(Number(data.price))
                    ? `$${Number(data.price).toFixed(2)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Moneda:</span>
                <span className="text-orange-400 font-mono">
                  {data.currency || "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">
              Rendimiento
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Variación en $:</span>
                <span
                  className={`font-mono ${
                    Number(data.change) >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {Number.isFinite(data.change)
                    ? `$${Number(data.change).toFixed(2)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Variación en %:</span>
                <span
                  className={`font-mono ${
                    Number(data.changePercentage) >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatPercentage(data.changePercentage)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Beta:</span>
                <span className="text-orange-400 font-mono">
                  {Number.isFinite(Number(data.beta))
                    ? Number(data.beta).toFixed(3)
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">
              Volumen y Dividendos
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Último Dividendo:</span>
                <span className="text-orange-400 font-mono">
                  {Number.isFinite(Number(data.lastDividend))
                    ? `$${Number(data.lastDividend).toFixed(2)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Volumen:</span>
                <span className="text-orange-400 font-mono">
                  {Number.isFinite(Number(data.volume))
                    ? Number(data.volume).toLocaleString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Vol. Promedio:</span>
                <span className="text-orange-400 font-mono">
                  {Number.isFinite(Number(data.averageVolume))
                    ? Number(data.averageVolume).toLocaleString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rango 52 sem:</span>
                <span className="text-orange-400 font-mono text-xs">
                  {data.range || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Scores Financieros */}
      {scoresData && (
        <div className="bg-tarjetas rounded-lg p-4 border-gray-700/30">
          <h3 className="text-orange-400 text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Scores Financieros y Activos
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {/* Altman Z-Score */}
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-gray-400">Altman Z-Score</div>
              <div className="text-green-400 font-mono text-lg">
                {scoresData.altmanZ !== undefined && scoresData.altmanZ !== null
                  ? Number(scoresData.altmanZ).toFixed(2)
                  : "N/A"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {(() => {
                  const val = Number(scoresData.altmanZ);
                  if (!scoresData.altmanZ && scoresData.altmanZ !== 0) return "Sin datos";
                  return val > 3 ? "Zona Segura" : val > 1.8 ? "Zona Gris" : "Zona de Riesgo";
                })()}
              </div>
            </div>

            {/* Piotroski Score */}
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-gray-400">Piotroski Score</div>
              <div className="text-blue-400 font-mono text-lg">
                {scoresData.piotroski !== undefined && scoresData.piotroski !== null
                  ? `${scoresData.piotroski}/9`
                  : "N/A"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {(() => {
                  const val = Number(scoresData.piotroski);
                  if (!scoresData.piotroski && scoresData.piotroski !== 0) return "Sin datos";
                  return val >= 7 ? "Excelente" : val >= 5 ? "Bueno" : "Débil";
                })()}
              </div>
            </div>

            {/* Total Assets */}
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-gray-400">Total Assets</div>
              <div className="text-purple-400 font-mono text-lg">
                {formatLargeNumber(scoresData.raw?.totalAssets)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Activos totales</div>
            </div>

            {/* Total Liabilities */}
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-gray-400">Total Liabilities</div>
              <div className="text-yellow-400 font-mono text-lg">
                {formatLargeNumber(scoresData.raw?.totalLiabilities)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Pasivos totales</div>
            </div>

            {/* Revenue */}
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-gray-400">Revenue</div>
              <div className="text-cyan-400 font-mono text-lg">
                {formatLargeNumber(scoresData.raw?.revenue)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Ingresos totales</div>
            </div>

            {/* EBIT */}
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-gray-400">EBIT</div>
              <div className="text-lime-400 font-mono text-lg">
                {formatLargeNumber(scoresData.raw?.ebit)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Ganancias operativas</div>
            </div>

            {/* Market Cap (desde scores) */}
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-gray-400">Market Cap</div>
              <div className="text-pink-400 font-mono text-lg">
                {formatLargeNumber(scoresData.raw?.marketCap)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Capitalización</div>
            </div>

            {/* Working Capital */}
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-gray-400">Working Capital</div>
              <div className="text-indigo-400 font-mono text-lg">
                {formatLargeNumber(scoresData.raw?.workingCapital)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Capital de trabajo</div>
            </div>
          </div>
        </div>
      )}

      {/* Info adicional */}
      <div className="bg-gray-800/30 rounded-lg p-4 border-gray-700/30">
        <h3 className="text-orange-400 text-lg font-semibold mb-4">
          Información Adicional
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">CIK:</span>
              <span className="text-orange-400 font-mono">
                {data.cik || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ISIN:</span>
              <span className="text-orange-400 font-mono">
                {data.isin || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">CUSIP:</span>
              <span className="text-orange-400 font-mono">
                {data.cusip || "N/A"}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Teléfono:</span>
              <span className="text-orange-400">{data.phone || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Es ETF:</span>
              <span className="text-orange-400">
                {data.isEtf ? "Sí" : "No"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Activamente negociado:</span>
              <span className="text-orange-400">
                {data.isActivelyTrading ? "Sí" : "No"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );


  return (
    <Dialog>
      <Card className="w-full bg-tarjetas border-none px-4 py-3">
        <CardContent className="p-0">
           <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center h-full">
              {/* 1. STOCK: Logo, Ticker, Nombre, CEO */}
              <div className="flex items-center gap-3">
                  <DialogTrigger asChild>
                    <img 
                      src={data.image} 
                      alt={data.symbol} 
                      className="w-12 h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity rounded-md bg-white/5 p-1"
                      onError={(e: any) => e.currentTarget.style.display = 'none'}
                    />
                  </DialogTrigger>
                  <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xl leading-none">{data.symbol}</span>
                      </div>
                      <span className="text-gray-400 text-xs truncate max-w-[140px] leading-tight font-medium" title={data.companyName}>
                          {data.companyName}
                      </span>
                       <span className="text-[10px] text-gray-500 uppercase tracking-wider truncate max-w-[140px]">
                          {data.ceo || "CEO N/A"}
                       </span>
                  </div>
              </div>

              {/* 2. FGOS */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-gray-800/50 md:pl-4">
                  <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-0.5">FGOS</span>
                  <div className={`text-2xl font-black ${getScoreColor(fgos)}`}>{fgos}</div>
              </div>

              {/* 3. VALUACIÓN */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-gray-800/50 md:pl-4">
                  <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1.5">Valuación</span>
                  {getValBadge(valStatus)}
              </div>

              {/* 4. VEREDICTO */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-gray-800/50 md:pl-4 text-center">
                  <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Veredicto</span>
                  <span className="text-white font-medium text-xs leading-tight max-w-[180px]">{verdict}</span>
              </div>

              {/* 5. EHS */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-gray-800/50 md:pl-4">
                  <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center gap-1 mb-0.5">
                      E.H.S. <Activity className="w-3 h-3 text-blue-400"/>
                  </span>
                  <div className="text-2xl font-mono text-blue-400 font-bold">{ehs}</div>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* Modal - Responsive */}
      <DialogContent className="bg-tarjetas border-gray-700 w-[95vw] max-w-4xl max-h-[85vh] overflow-y-auto">
        {/* Hidden accessible title to satisfy Radix requirement */}
        <DialogHeader className="sr-only">
          <DialogTitle>Datos de la empresa</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-responsive">
          {renderOverviewContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}


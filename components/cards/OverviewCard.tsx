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
import { getLatestSnapshot } from "@/lib/repository/fintra-db";
import { FintraSnapshotDB } from "@/lib/engine/types";
import { useResponsive } from "@/hooks/use-responsive";
import { Skeleton } from "@/components/ui/skeleton";

interface OverviewCardProps {
  selectedStock: any; // string ("AAPL") o { symbol: "AAPL", ... }
  onStockSearch?: (symbol: string) => Promise<any> | any;
  onOpenSearchModal?: () => void;
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
    companyName: p.companyName || p.name,
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
  onStockSearch,
  onOpenSearchModal,
  isParentLoading = false,
  analysisData
}: OverviewCardProps) {
  // Primero declarar TODOS los hooks
  const { isMobile, isTablet } = useResponsive();
  
  // ── estado
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scoresData, setScoresData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para Snapshot de Supabase
  const [snapshot, setSnapshot] = useState<FintraSnapshotDB | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

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

  const data = useMemo(() => {
    // Si tenemos profile y tiene símbolo válido, lo usamos
    if (profile && profile.symbol) {
      // Si falta la imagen, ponemos fallback
      if (!profile.image) {
        return {
          ...profile,
          image: `https://financialmodelingprep.com/image-stock/${currentSymbol}.png`
        };
      }
      return profile;
    }
    
    // Si profile existe pero está vacío o sin símbolo (caso de error silencioso),
    // mezclamos lo que haya con los defaults.
    if (profile) {
        return {
            ...profile,
            symbol: profile.symbol || currentSymbol,
            image: profile.image || `https://financialmodelingprep.com/image-stock/${currentSymbol}.png`,
            companyName: profile.companyName || "",
            price: profile.price || 0,
            change: profile.change || 0,
            changePercentage: profile.changePercentage || 0,
        };
    }
    
    // Fallback básico si no hay profile
    return {
        symbol: currentSymbol,
        image: `https://financialmodelingprep.com/image-stock/${currentSymbol}.png`,
        companyName: "",
        sector: "",
        industry: "",
        ceo: "",
        description: "",
        price: 0,
        change: 0,
        changePercentage: 0,
        marketCap: 0,
        beta: 0,
        lastDividend: 0,
        volume: 0,
        averageVolume: 0,
        range: "",
        currency: "USD",
        website: "",
        exchange: "",
        country: "",
        ipoDate: "",
        fullTimeEmployees: 0,
        isEtf: false,
        isActivelyTrading: true,
        cik: "",
        isin: "",
        cusip: "",
        phone: ""
    };
  }, [profile, currentSymbol]);

  const [chartType, setChartType] = useState<"line" | "area">("area");
  const [chartRange, setChartRange] = useState<"1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "ALL">("1Y");

  // Fetch Snapshot from Supabase
  useEffect(() => {
    let active = true;
    const fetchSnapshot = async () => {
      if (!currentSymbol) return;
      setSnapshotLoading(true);
      try {
        const data = await getLatestSnapshot(currentSymbol);
        if (active) setSnapshot(data);
      } catch (err) {
        console.error("Error fetching snapshot:", err);
      } finally {
        if (active) setSnapshotLoading(false);
      }
    };
    fetchSnapshot();
    return () => { active = false; };
  }, [currentSymbol]);

  // Helpers de visualización
  const getScoreColor = (s: number) => {
    if (s >= 70) return "text-green-400";
    if (s >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const getValBadge = (v: string | null | undefined) => {
    if (!v) return <Badge className="text-gray-400 bg-gray-400/10 border-gray-400 px-2 py-0.5 text-xs" variant="outline">N/A</Badge>;
    
    const lowerV = v.toLowerCase();
    if (lowerV.includes("under") || lowerV.includes("infra") || lowerV.includes("barata")) {
      return <Badge className="text-green-400 bg-green-400/10 border-green-400 px-2 py-0.5 text-xs" variant="outline">Infravalorada</Badge>;
    }
    if (lowerV.includes("over") || lowerV.includes("sobre") || lowerV.includes("cara")) {
      return <Badge className="text-red-400 bg-red-400/10 border-red-400 px-2 py-0.5 text-xs" variant="outline">Sobrevalorada</Badge>;
    }
    return <Badge className="text-yellow-400 bg-yellow-400/10 border-yellow-400 px-2 py-0.5 text-xs" variant="outline">Justa</Badge>;
  };

  // carga profile desde /api/fmp/profile
  useEffect(() => {
    let active = true;
    (async () => {
      if (!currentSymbol) {
        console.log("[OverviewCard] No currentSymbol, skipping fetch");
        return;
      }
      console.log(`[OverviewCard] Starting fetch for symbol: ${currentSymbol}`);
      setLoading(true);
      setError(null);
      try {
        // Obtener profile, quote y scores en paralelo
        const [profileArr, quoteArr, scores] = await Promise.all([
          fmp.profile(currentSymbol),
          fmp.quote(currentSymbol),
          fmp.scores(currentSymbol)
        ]);
        
        console.log("[OverviewCard] API Responses:", { 
            profileLength: Array.isArray(profileArr) ? profileArr.length : 'not-array', 
            quoteLength: Array.isArray(quoteArr) ? quoteArr.length : 'not-array',
            scores: scores ? 'present' : 'missing'
        });

        // Asegurarse de que rawProfile y rawQuote sean objetos válidos
        // La API puede devolver [ {...} ] o simplemente {...} a veces si hay proxies intermedios, aunque fmp client suele normalizar.
        // Pero aquí profileArr viene de fmp.profile que devuelve T (que es any[] según client.ts si no se especifica)
        
        let rawProfile = null;
        if (Array.isArray(profileArr)) {
             rawProfile = profileArr.length > 0 ? profileArr[0] : null;
        } else if (profileArr && typeof profileArr === 'object') {
             rawProfile = profileArr;
        }

        let rawQuote = null;
        if (Array.isArray(quoteArr)) {
             rawQuote = quoteArr.length > 0 ? quoteArr[0] : null;
        } else if (quoteArr && typeof quoteArr === 'object') {
             rawQuote = quoteArr;
        }

        console.log("[OverviewCard] Raw Data:", { rawProfile, rawQuote });

        // Combinar datos de profile y quote
        const combinedData = {
          ...(rawProfile || {}),
          // Sobrescribir con datos de quote si están disponibles
          ...(rawQuote && {
            price: rawQuote.price,
            change: rawQuote.change,
            changePercentage: rawQuote.changesPercentage,
            volume: rawQuote.volume,
          })
        };
        
        console.log("[OverviewCard] Combined Data for Normalize:", combinedData);

        if (!active) return;
        const normalized = normalizeProfile(combinedData);
        console.log("[OverviewCard] Normalized Data:", normalized);
        
        setProfile(normalized);
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

  // AHORA sí podemos hacer returns condicionales basados en estado
  if ((loading || isParentLoading) && !data.symbol) {
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

  // campo editable con buscador
  const renderEditableField = (value: any, fieldName: string) => {
    if (editingField === fieldName) {
      if (searchLoading) {
        return (
          <div className="px-3 py-2 bg-Tarjeta text-[#FFA028] text-sm flex items-center space-x-2">
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
              className="w-4 h-4 text-gray-400 cursor-pointer hover:text-[#FFA028]"
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
          className="text-gray-500 cursor-pointer hover:text-[#FFA028] transition-colors"
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
    <div className="space-y-0 bg-black">
      {/* Información de la Empresa */}
      <div className="bg-tarjetas p-1 border-gray-700/30">
        <h3 className="text-[#FFA028] text-lg font-semibold mb-1 flex items-center gap-1 justify-center">
          {/* <Building2 className="w-5 h-5" /> */}
          Información de la Empresa
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          <div className="space-y-3">
            <div className="flex justify-center gap-2 text-xs">
              <span className="text-gray-400">Nombre:</span>
              {renderEditableField(data.companyName, "companyName")}
            </div>
            <div className="flex justify-center gap-2 text-xs">
              <span className="text-gray-400">Sector:</span>
              {renderEditableField(data.sector, "sector")}
            </div>
            <div className="flex justify-center gap-2 text-xs">
              <span className="text-gray-400">Industria:</span>
              {renderEditableField(data.industry, "industry")}
            </div>
            <div className="flex justify-center gap-2 text-xs">
              <span className="text-gray-400">CEO:</span>
              {renderEditableField(data.ceo, "ceo")}
            </div>
            {/* <div className="flex justify-center gap-2 text-xs">
              <span className="text-gray-400">Fundada (IPO):</span>
              {renderEditableField(data.ipoDate, "ipoDate")}
            </div> */}
          </div>
          <div className="space-y-3">
            <div className="flex justify-center gap-2 text-xs"> 
              <span className="text-gray-400">Empleados:</span>
              {renderEditableField(
                Number.isFinite(Number(data.fullTimeEmployees))
                  ? Number(data.fullTimeEmployees).toLocaleString()
                  : undefined,
                "employees",
              )}
            </div>
            <div className="flex justify-center gap-2 text-xs">     
              <span className="text-gray-400">Sitio web:</span>
              {data.website ? (
                <span className="text-[#FFA028]">
                  <a
                    href={
                      data.website.startsWith("http")
                        ? data.website
                        : `https://${data.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#FFA028] underline"
                  >
                    {String(data.website).replace(/^https?:\/\//, "").trim()}
                  </a>
                </span>
              ) : (
                renderEditableField(null, "website")
              )}
            </div>
            <div className="flex justify-center gap-2 text-xs">
              <span className="text-gray-400">Intercambio:</span>
              {renderEditableField(data.exchange, "exchange")}
            </div>
            <div className="flex justify-center gap-2 text-xs">
              <span className="text-gray-400">País:</span>
              {renderEditableField(data.country, "country")}
            </div>
          </div>
        </div>
      </div>

      {/* Descripción */}
      <div className="bg-tarjetas p-2 border-gray-700/30">
        <h3 className="text-[#FFA028] text-lg font-semibold mb-1 flex items-center gap-1 justify-center">
          {/* <FileText className="w-5 h-5" /> */}
          Descripción
        </h3>
        <p className="text-gray-300 text-xs leading-relaxed text-left">
          {data.description || "No hay descripción disponible."}
        </p>
        <div className="flex justify-center gap-2 text-xs">
              <span className="text-gray-400">Fundada (IPO):</span>
              {renderEditableField(data.ipoDate, "ipoDate")}
        </div>
      </div>

      {/* Métricas */}
      <div className="bg-tarjetas p-2 border-gray-700/30">
        <h3 className="text-[#FFA028] text-lg font-semibold mb-1 flex items-center gap-1 justify-center">
          {/* <DollarSign className="w-5 h-5" /> */}
          Métricas Financieras Clave
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="space-y-3">
            <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">
              Valoración
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-start gap-4">
                <span className="text-gray-400 min-w-[100px]">Cap. de Mercado:</span>
                <span className="text-[#FFA028] font-mono">
                  {formatLargeNumber(data.marketCap)}
                </span>
              </div>
              <div className="flex justify-start gap-4">
                <span className="text-gray-400 min-w-[100px]">Precio Actual:</span>
                <span className="text-[#FFA028] font-mono">
                  {Number.isFinite(Number(data.price))
                    ? `$${Number(data.price).toFixed(2)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-start gap-4">
                <span className="text-gray-400 min-w-[100px]">Moneda:</span>
                <span className="text-[#FFA028] font-mono">
                  {data.currency || "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">
              Rendimiento
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-start gap-4">
                <span className="text-gray-400 min-w-[100px]">Variación en $:</span>
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
              <div className="flex justify-start gap-4">
                <span className="text-gray-400 min-w-[100px]">Variación en %:</span>
                <span
                  className={`font-mono ${
                    Number(data.changePercentage) >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatPercentage(data.changePercentage)}
                </span>
              </div>
              <div className="flex justify-start gap-4">
                <span className="text-gray-400 min-w-[100px]">Beta:</span>
                <span className="text-[#FFA028] font-mono">
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
            <div className="space-y-2 text-xs">
              <div className="flex justify-start gap-4">
                <span className="text-gray-400 min-w-[100px]">Último Dividendo:</span>
                <span className="text-[#FFA028] font-mono">
                  {Number.isFinite(Number(data.lastDividend))
                    ? `$${Number(data.lastDividend).toFixed(2)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-start gap-4">
                <span className="text-gray-400 min-w-[100px]">Volumen:</span>
                <span className="text-[#FFA028] font-mono">
                  {Number.isFinite(Number(data.volume))
                    ? Number(data.volume).toLocaleString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-start gap-4">
                <span className="text-gray-400 min-w-[100px]">Vol. Promedio:</span>
                <span className="text-[#FFA028] font-mono">
                  {Number.isFinite(Number(data.averageVolume))
                    ? Number(data.averageVolume).toLocaleString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-start gap-4">
                <span className="text-gray-400 min-w-[100px]">Rango 52 sem:</span>
                <span className="text-[#FFA028] font-mono text-xs">
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
          <h3 className="text-[#FFA028] text-lg font-semibold mb-4 flex items-center gap-2 justify-center">
            {/* <BarChart3 className="w-5 h-5" /> */}
            Scores Financieros y Activos
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Altman Z-Score */}
            <div className="bg-gray-800/50 p-2">
              <div className="text-gray-400">Altman Z-Score</div>
              <div className="text-green-400 font-mono text-sm">
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
            <div className="bg-gray-800/50 p-2">
              <div className="text-gray-400">Piotroski Score</div>
              <div className="text-blue-400 font-mono text-sm"> 
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
            <div className="bg-gray-800/50 p-2">
              <div className="text-gray-400">Total Assets</div>
              <div className="text-purple-400 font-mono text-sm">
                {formatLargeNumber(scoresData.raw?.totalAssets)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Activos totales</div>
            </div>

            {/* Total Liabilities */}
            <div className="bg-gray-800/50 p-2">
              <div className="text-gray-400">Total Liabilities</div>
              <div className="text-yellow-400 font-mono text-sm">
                {formatLargeNumber(scoresData.raw?.totalLiabilities)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Pasivos totales</div>
            </div>

            {/* Revenue */}
            <div className="bg-gray-800/50 p-2">
              <div className="text-gray-400">Revenue</div>
              <div className="text-cyan-400 font-mono text-sm">
                {formatLargeNumber(scoresData.raw?.revenue)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Ingresos totales</div>
            </div>

            {/* EBIT */}
            <div className="bg-gray-800/50 p-2">
              <div className="text-gray-400">EBIT</div>
              <div className="text-lime-400 font-mono text-sm">
                {formatLargeNumber(scoresData.raw?.ebit)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Ganancias operativas</div>
            </div>

            {/* Market Cap (desde scores) */}
            <div className="bg-gray-800/50 p-2">
              <div className="text-gray-400">Market Cap</div>
              <div className="text-pink-400 font-mono text-sm">
                {formatLargeNumber(scoresData.raw?.marketCap)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Capitalización</div>
            </div>

            {/* Working Capital */}
            <div className="bg-gray-800/50 p-2">
              <div className="text-gray-400">Working Capital</div>
              <div className="text-indigo-400 font-mono text-sm">
                {formatLargeNumber(scoresData.raw?.workingCapital)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Capital de trabajo</div>
            </div>
          </div>
        </div>
      )}

      {/* Info adicional */}
      <div className="bg-black p-2 border-gray-700/30">
        <h3 className="text-[#FFA028] text-lg font-semibold mb-4 flex justify-center items-center">
          Información Adicional
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">CIK:</span>
              <span className="text-[#FFA028] font-mono">
                {data.cik || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ISIN:</span>
              <span className="text-[#FFA028] font-mono">
                {data.isin || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">CUSIP:</span>
              <span className="text-[#FFA028] font-mono">
                {data.cusip || "N/A"}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Teléfono:</span>
              <span className="text-[#FFA028]">{data.phone || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Es ETF:</span>
              <span className="text-[#FFA028]">
                {data.isEtf ? "Sí" : "No"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Activamente negociado:</span>
              <span className="text-[#FFA028]">
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
      <Card className="w-full bg-tarjetas border-none rounded-none overflow-hidden shadow-sm px-0 py-0">
        <CardContent className="p-0">
          {/* Header Row - Visible on Desktop */}
          {/* <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center bg-[#1D1D1D] px-4 py-1 border-b border-white/10 sticky top-0 z-10">
            <div className="text-[10px] text-gray-200">Ticker</div>
            <div className="text-[10px] text-gray-200 text-center">Último Precio</div>
            <div className="text-[10px] text-gray-200 text-center">Ranking Sectorial</div>
            <div className="text-[10px] text-gray-200 text-center">Valuación</div>
            <div className="text-[10px] text-gray-200 text-center">Conclusión</div>
            <div className="text-[10px] text-gray-200 text-center">Ecosistema</div>
          </div> */}

          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center h-full p-1 md:p-1 md:px-1 md:py-1">
              {/* 1. STOCK: Logo, Ticker, Nombre, CEO */}
              <div className="flex items-center gap-3">
                  <DialogTrigger asChild>
                    <div className="relative w-12 h-12 flex items-center justify-center bg-white/5 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                      <img 
                        src={data.image} 
                        alt={data.symbol} 
                        className="w-full h-full object-contain"
                        onError={(e: any) => {
                           e.currentTarget.style.display = 'none';
                           // Mostrar el span hermano
                           const span = e.currentTarget.parentNode.querySelector('span');
                           if (span) span.style.display = 'block';
                        }}
                      />
                      <span className="hidden text-white font-bold text-sm" style={{ display: 'none' }}>
                        {data.symbol?.slice(0, 2)}
                      </span>
                    </div>
                  </DialogTrigger>
                  <div className="flex flex-col min-w-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={onOpenSearchModal}>
                      <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-lg leading-none">{data.symbol}</span>
                      </div>
                      <span className="text-gray-400 text-xs leading-tight font-medium" title={data.companyName}>
                          {data.companyName}
                      </span>
                     {/*  <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                        CEO: {data.ceo || "CEO N/A"}
                      </span> */}
                  </div>
              </div>

              {/* 2. PRECIO */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-gray-800/50 md:pl-4">
                  <span className="md:hidden text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-0.5">PRECIO</span>
                  <div className="text-lg font-bold text-white">
                    {Number.isFinite(Number(data.price)) ? `$${Number(data.price).toFixed(2)}` : "N/A"}
                  </div>
                  <div className={`text-xs font-medium ${Number(data.change) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {Number(data.change) >= 0 ? "+" : ""}{Number(data.changePercentage).toFixed(2)}%
                  </div>
              </div>

              {/* 3. FGOS */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-gray-800/50 md:pl-4">
                  <span className="md:hidden text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-0.5">FGOS SCORE</span>
                  {snapshotLoading ? (
                    <Skeleton className="h-6 w-10 bg-white/10 rounded-sm" />
                  ) : (
                    <div className={`text-xl font-black ${getScoreColor(snapshot?.fgos_score ?? 0)}`}>{snapshot?.fgos_score ?? "-"}</div>
                  )}
              </div>

              {/* 4. VALUACIÓN */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-gray-800/50 md:pl-4">
                  <span className="md:hidden text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1.5">VALUACIÓN</span>
                  {snapshotLoading ? (
                    <Skeleton className="h-5 w-20 bg-white/10 rounded-full" />
                  ) : (
                    getValBadge(snapshot?.valuation_status)
                  )}
              </div>

              {/* 5. VEREDICTO */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-gray-800/50 md:pl-4 text-center">
                  <span className="md:hidden text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">VERDICT FINTRA</span>
                  {snapshotLoading ? (
                    <Skeleton className="h-4 w-32 bg-white/10 rounded-sm" />
                  ) : (
                    <span className="text-white font-medium text-xs leading-tight max-w-[180px] line-clamp-2" title={snapshot?.verdict_text || "N/A"}>
                        {snapshot?.verdict_text || "N/A"}
                    </span>
                  )}
              </div>

              {/* 6. EHS */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-gray-800/50 md:pl-4">
                  <span className="md:hidden text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center gap-1 mb-0.5">
                      E.H.S. <Activity className="w-3 h-3 text-blue-400"/>
                  </span>
                  {snapshotLoading ? (
                    <Skeleton className="h-6 w-10 bg-white/10 rounded-sm" />
                  ) : (
                     <>
                        <div className="text-xl font-mono text-blue-400 font-bold">{snapshot?.ecosystem_score ?? "-"}</div>
                        <span className="text-[9px] text-gray-500 font-medium mt-[-2px]">Salud del ecosistema</span>
                     </>
                  )}
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
        <div className="space-responsive">
          {renderOverviewContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}


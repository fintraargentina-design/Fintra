// components/cards/OverviewCard.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Sync data with selectedStock prop changes
  useEffect(() => {
    if (selectedStock && typeof selectedStock === 'object') {
       setProfile(normalizeProfile(selectedStock));
    }
  }, [selectedStock]);

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

      // Check if we already have full data from props (selectedStock)
      // If selectedStock is an object and has companyName/price, we assume it's the full profile.
      // We still need to fetch scores.
      const hasFullProfile = selectedStock && typeof selectedStock === 'object' && 'companyName' in selectedStock;

      console.log(`[OverviewCard] Starting fetch for symbol: ${currentSymbol}. Has full profile? ${hasFullProfile}`);
      
      // If we don't have profile, show loading. If we do, we might just be updating scores in background.
      if (!hasFullProfile) {
          setLoading(true);
      }
      
      setError(null);
      try {
        // Prepare promises
        const promises: Promise<any>[] = [
          fmp.scores(currentSymbol)
        ];

        // Only fetch profile/quote if we don't have it from props
        if (!hasFullProfile) {
            promises.push(fmp.profile(currentSymbol));
            promises.push(fmp.quote(currentSymbol));
        }

        // Execute fetches
        const results = await Promise.all(promises);
        const scores = results[0];
        
        if (!active) return;

        setScoresData(scores);

        if (!hasFullProfile) {
            const profileArr = results[1];
            const quoteArr = results[2];
            
            console.log("[OverviewCard] API Responses:", { 
                profileLength: Array.isArray(profileArr) ? profileArr.length : 'not-array', 
                quoteLength: Array.isArray(quoteArr) ? quoteArr.length : 'not-array'
            });

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

            // Combinar datos de profile y quote
            const combinedData = {
                ...(rawProfile || {}),
                ...(rawQuote && {
                    price: rawQuote.price,
                    change: rawQuote.change,
                    changePercentage: rawQuote.changesPercentage,
                    volume: rawQuote.volume,
                })
            };
            
            const normalized = normalizeProfile(combinedData);
            setProfile(normalized);
        }

      } catch (err: any) {
        console.error("Error fetching company data:", err);
        // Only set error if we don't have profile data to show
        if (active && !hasFullProfile) setError("Error al cargar los datos de la empresa");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentSymbol, selectedStock]);

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
    <div className="flex flex-col gap-2 p-2 bg-black/40">
      
      {/* Fila Superior: Perfil y Descripción */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* Columna Izquierda: Información Corporativa (Combinada) */}
        <div className="lg:col-span-4 bg-tarjetas p-3 rounded-md border border-gray-700/30 flex flex-col gap-3">
          <h3 className="text-[#FFA028] text-sm font-semibold flex items-center gap-2 border-b border-gray-800 pb-1">
            Perfil Corporativo
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
             <div className="flex flex-col">
                <span className="text-gray-500 text-[10px]">Sector</span>
                {renderEditableField(data.sector, "sector")}
             </div>
             <div className="flex flex-col">
                <span className="text-gray-500 text-[10px]">Industria</span>
                {renderEditableField(data.industry, "industry")}
             </div>
             <div className="flex flex-col">
                <span className="text-gray-500 text-[10px]">CEO</span>
                {renderEditableField(data.ceo, "ceo")}
             </div>
             <div className="flex flex-col">
                <span className="text-gray-500 text-[10px]">Empleados</span>
                {renderEditableField(
                  Number.isFinite(Number(data.fullTimeEmployees))
                    ? Number(data.fullTimeEmployees).toLocaleString()
                    : undefined,
                  "employees",
                )}
             </div>
             <div className="flex flex-col">
                <span className="text-gray-500 text-[10px]">País</span>
                {renderEditableField(data.country, "country")}
             </div>
             <div className="flex flex-col">
                <span className="text-gray-500 text-[10px]">Sitio Web</span>
                {data.website ? (
                  <a
                    href={data.website.startsWith("http") ? data.website : `https://${data.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FFA028] hover:underline truncate"
                  >
                    {String(data.website).replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                ) : renderEditableField(null, "website")}
             </div>
             {/* Info Adicional Compacta */}
             <div className="flex flex-col">
                <span className="text-gray-500 text-[10px]">ISIN</span>
                <span className="text-zinc-300 font-mono">{data.isin || "N/A"}</span>
             </div>
             <div className="flex flex-col">
                <span className="text-gray-500 text-[10px]">CIK</span>
                <span className="text-zinc-300 font-mono">{data.cik || "N/A"}</span>
             </div>
          </div>
        </div>

        {/* Columna Derecha: Descripción */}
        <div className="lg:col-span-8 bg-tarjetas p-3 rounded-md border border-gray-700/30 flex flex-col">
           <div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-1">
              <h3 className="text-[#FFA028] text-sm font-semibold">Descripción</h3>
              <div className="flex gap-4 text-xs">
                 <div className="flex gap-1">
                    <span className="text-gray-500">Fundada:</span>
                    {renderEditableField(data.ipoDate, "ipoDate")}
                 </div>
                 <div className="flex gap-1">
                    <span className="text-gray-500">Exchange:</span>
                    {renderEditableField(data.exchange, "exchange")}
                 </div>
              </div>
           </div>
           <p className="text-gray-300 text-xs leading-relaxed text-justify overflow-y-auto max-h-[140px] pr-1 scrollbar-thin">
              {data.description || "No hay descripción disponible."}
           </p>
        </div>
      </div>

      {/* Fila Media: Métricas Financieras (Grid de 3 columnas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Valoración */}
          <div className="bg-tarjetas p-2 rounded-md border border-gray-700/30">
            <h4 className="text-gray-400 text-xs font-medium border-b border-gray-800 pb-1 mb-2 text-center">Valoración</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
               <div className="flex flex-col items-center">
                  <span className="text-gray-500 text-[10px]">Market Cap</span>
                  <span className="text-[#FFA028] font-mono font-medium">{formatLargeNumber(data.marketCap)}</span>
               </div>
               <div className="flex flex-col items-center">
                  <span className="text-gray-500 text-[10px]">Precio</span>
                  <span className="text-[#FFA028] font-mono font-medium">
                    {Number.isFinite(Number(data.price)) ? `$${Number(data.price).toFixed(2)}` : "N/A"}
                  </span>
               </div>
               <div className="flex flex-col items-center col-span-2">
                  <span className="text-gray-500 text-[10px]">Moneda</span>
                  <span className="text-zinc-300">{data.currency || "N/A"}</span>
               </div>
            </div>
          </div>

          {/* Rendimiento */}
          <div className="bg-tarjetas p-2 rounded-md border border-gray-700/30">
            <h4 className="text-gray-400 text-xs font-medium border-b border-gray-800 pb-1 mb-2 text-center">Rendimiento</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
               <div className="flex flex-col items-center">
                  <span className="text-gray-500 text-[10px]">Var. $</span>
                  <span className={`font-mono font-medium ${Number(data.change) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {Number.isFinite(data.change) ? `$${Number(data.change).toFixed(2)}` : "N/A"}
                  </span>
               </div>
               <div className="flex flex-col items-center">
                  <span className="text-gray-500 text-[10px]">Var. %</span>
                  <span className={`font-mono font-medium ${Number(data.changePercentage) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {formatPercentage(data.changePercentage)}
                  </span>
               </div>
               <div className="flex flex-col items-center col-span-2">
                  <span className="text-gray-500 text-[10px]">Beta</span>
                  <span className="text-[#FFA028] font-mono">{Number.isFinite(Number(data.beta)) ? Number(data.beta).toFixed(3) : "N/A"}</span>
               </div>
            </div>
          </div>

          {/* Volumen y Dividendos */}
          <div className="bg-tarjetas p-2 rounded-md border border-gray-700/30">
            <h4 className="text-gray-400 text-xs font-medium border-b border-gray-800 pb-1 mb-2 text-center">Volumen y Dividendos</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
               <div className="flex flex-col items-center">
                  <span className="text-gray-500 text-[10px]">Volumen</span>
                  <span className="text-[#FFA028] font-mono">{Number.isFinite(Number(data.volume)) ? Number(data.volume).toLocaleString() : "N/A"}</span>
               </div>
               <div className="flex flex-col items-center">
                  <span className="text-gray-500 text-[10px]">Dividendo</span>
                  <span className="text-[#FFA028] font-mono">{Number.isFinite(Number(data.lastDividend)) ? `$${Number(data.lastDividend).toFixed(2)}` : "N/A"}</span>
               </div>
               <div className="flex flex-col items-center col-span-2">
                  <span className="text-gray-500 text-[10px]">Rango 52s</span>
                  <span className="text-zinc-300 font-mono text-[10px]">{data.range || "N/A"}</span>
               </div>
            </div>
          </div>
      </div>

      {/* Fila Inferior: Scores y Fundamentales */}
      {scoresData && (
        <div className="bg-tarjetas p-3 rounded-md border border-gray-700/30">
          <h3 className="text-[#FFA028] text-sm font-semibold mb-2 flex items-center gap-2 border-b border-gray-800 pb-1">
            Scores Financieros y Fundamentales
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
            {/* Items compactos */}
            {[
              { label: "Altman Z", value: scoresData.altmanZ, isScore: true, type: "altman" },
              { label: "Piotroski", value: scoresData.piotroski, isScore: true, type: "piotroski" },
              { label: "Activos", value: scoresData.raw?.totalAssets, isCurrency: true },
              { label: "Pasivos", value: scoresData.raw?.totalLiabilities, isCurrency: true },
              { label: "Ingresos", value: scoresData.raw?.revenue, isCurrency: true },
              { label: "EBIT", value: scoresData.raw?.ebit, isCurrency: true },
              { label: "Mkt Cap", value: scoresData.raw?.marketCap, isCurrency: true },
              { label: "Working Cap", value: scoresData.raw?.workingCapital, isCurrency: true },
            ].map((item, idx) => (
              <div key={idx} className="bg-gray-800/40 p-1.5 rounded text-center flex flex-col justify-center min-h-[50px]">
                <span className="text-gray-500 text-[10px] leading-tight mb-0.5">{item.label}</span>
                <span className={`font-mono font-medium text-xs ${
                    item.type === 'altman' ? 'text-green-400' : 
                    item.type === 'piotroski' ? 'text-blue-400' : 
                    'text-zinc-300'
                }`}>
                  {item.isScore 
                    ? (item.value !== undefined && item.value !== null 
                        ? (item.type === 'piotroski' ? `${item.value}/9` : Number(item.value).toFixed(2)) 
                        : "N/A")
                    : (item.value ? formatLargeNumber(item.value) : "N/A")
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );


  return (
    <Card className="w-full bg-tarjetas border-none rounded-none overflow-hidden shadow-sm px-0 py-0">
      <CardContent className="p-0 flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center h-full p-1 md:p-1 md:px-1 md:py-1">
            {/* 1. STOCK: Logo, Ticker, Nombre, CEO */}
            <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 flex items-center justify-center bg-white/5 overflow-hidden rounded-md">
                    {data.image ? (
                      <img 
                        src={data.image} 
                        alt={data.symbol || "Logo"} 
                        className="w-full h-full object-contain p-1"
                        onError={(e: any) => {
                           e.currentTarget.style.display = 'none';
                           const span = e.currentTarget.parentElement?.querySelector('.fallback-text') as HTMLElement;
                           if (span) span.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <span className="fallback-text text-white font-bold text-sm" style={{ display: data.image ? 'none' : 'block' }}>
                      {(data.symbol || currentSymbol)?.slice(0, 2) || "??"}
                    </span>
                  </div>
                <div className="flex flex-col min-w-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={onOpenSearchModal}>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-lg leading-none">{data.symbol || currentSymbol || "N/A"}</span>
                    </div>
                    <span className="text-gray-400 text-xs leading-tight font-medium" title={data.companyName}>
                        {data.companyName || (loading || isParentLoading ? "Cargando..." : "N/A")}
                    </span>
                    {data.ceo && <span className="text-zinc-500 text-[10px] leading-tight truncate max-w-[150px] block">{data.ceo}</span>}
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

         {/* Detailed Information (Always visible) */}
         <div className="w-full border-t border-gray-800">
            {renderOverviewContent()}
         </div>
      </CardContent>
    </Card>
  );
}


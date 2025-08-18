// components/cards/OverviewCard.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import {
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
  RefreshCw
} from "lucide-react";

import { fmp } from "@/lib/fmp/client"; // ✅ cliente que pega a /api/fmp/*
import { getConclusionColors } from "@/lib/conclusionColors";

interface OverviewCardProps {
  selectedStock: any;                   // puede ser string ("AAPL") o { symbol: "AAPL", ... }
  stockConclusion?: any;
  onStockSearch?: (symbol: string) => Promise<any> | any;
}

type Profile = Record<string, any>;

function normalizeProfile(p: Profile | null): Profile {
  if (!p) return {};
  return {
    // Básicos
    symbol: p.symbol,
    companyName: p.companyName,
    sector: p.sector,
    industry: p.industry,
    country: p.country,
    description: p.description,
    ceo: p.ceo,
    fullTimeEmployees: p.fullTimeEmployees,
    ipoDate: p.ipoDate,
    exchange: p.exchange,
    exchangeFullName: p.exchangeShortName ?? p.exchangeFullName,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    phone: p.phone,
    isEtf: p.isEtf,
    isActivelyTrading: p.isActivelyTrading,
    cik: p.cik,
    isin: p.isin,
    cusip: p.cusip,
    currency: p.currency,

    // Números / mercado
    price: typeof p.price === "number" ? p.price : Number(p.price) || undefined,
    marketCap: p.mktCap ?? p.marketCap,
    beta: typeof p.beta === "number" ? p.beta : Number(p.beta) || undefined,
    lastDividend: p.lastDiv ?? p.lastDividend,
    range: p.range,

    // Cambios y volúmenes (FMP suele dar changesPercentage como "1.23%" o fracción)
    change:
      typeof p.changes === "number"
        ? p.changes
        : typeof p.change === "number"
        ? p.change
        : p.changes
        ? Number(p.changes)
        : undefined,

    changePercentage:
      typeof p.changesPercentage === "number"
        ? p.changesPercentage
        : typeof p.changePercentage === "number"
        ? p.changePercentage
        : typeof p.changesPercentage === "string"
        ? Number(p.changesPercentage.replace("%", ""))
        : typeof p.changePercentage === "string"
        ? Number(p.changePercentage.replace("%", ""))
        : undefined,

    volume: p.volume,
    averageVolume: p.volAvg ?? p.averageVolume,

    // Website limpio
    website: typeof p.website === "string" ? p.website.trim() : undefined,
    image: p.image,
  };
}

function formatLargeNumber(num?: number) {
  if (!num) return "N/A";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toLocaleString()}`;
}

function formatPercentage(value?: number) {
  if (value === null || value === undefined || isNaN(value)) return "N/A";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function OverviewCard({ selectedStock, stockConclusion, onStockSearch }: OverviewCardProps) {
  // ── estado
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "analysis">("overview");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [tickerInput, setTickerInput] = useState("");
  const [isTickerFocused, setIsTickerFocused] = useState(false);

  // faltaban estos estados y handler en tu versión
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // símbolo actual robusto
  const currentSymbol = useMemo(() => {
    if (typeof selectedStock === "string") return selectedStock?.toUpperCase?.() || "";
    return (selectedStock?.symbol || "").toUpperCase();
  }, [selectedStock]);

  // input ticker
  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTickerInput(e.target.value.toUpperCase());
  };
  const handleTickerKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  // carga profile desde /api/fmp/profile
  useEffect(() => {
    let active = true;
    (async () => {
      if (!currentSymbol) return;
      setLoading(true);
      setError(null);
      try {
        const arr = await fmp.profile(currentSymbol); // ← usa tu SDK /lib/fmp/client (browser-safe)
        const raw = Array.isArray(arr) && arr.length ? arr[0] : null;
        if (!active) return;
        setProfile(normalizeProfile(raw));
      } catch (err: any) {
        console.error("Error fetching company profile:", err);
        if (active) setError("Error al cargar el perfil de la empresa");
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
  const handleSearch = async () => {
    if (searchValue.trim() && onStockSearch) {
      setSearchLoading(true);
      setSearchError(null);
      try {
        await onStockSearch(searchValue.trim().toUpperCase());
        setEditingField(null);
        setSearchValue("");
      } catch (error) {
        setSearchError("Ticker no encontrado");
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

  const analysisData = {
    queHace: stockConclusion?.conclusion?.["¿Qué hace la empresa?"] || "No disponible",
    ventajaCompetitiva: stockConclusion?.conclusion?.["¿Tiene una ventaja clara frente a la competencia?"] || "No disponible",
    ganaDinero: stockConclusion?.conclusion?.["¿Gana dinero de verdad y lo sigue haciendo crecer?"] || "No disponible",
    crecimientoFuturo: stockConclusion?.conclusion?.["¿El negocio puede seguir creciendo en 5 o 10 años?"] || "No disponible",
    precioSentido: stockConclusion?.conclusion?.["¿El precio tiene sentido o está inflado?"] || "No disponible",
  };

  // loading / error
  if (loading) {
    return (
      <Card className="bg-tarjetas flex items-center flex-col w-full justify-between p-0 max-h-[36px]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-400">Cargando perfil de la empresa...</div>
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
          <div className="px-3 py-2 text-orange-400 text-sm flex items-center space-x-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Cargando...</span>
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
              className="h-8 w-32 bg-tarjetas text-orange-400"
              autoFocus
            />
            <Search className="w-4 h-4 text-gray-400 cursor-pointer hover:text-orange-400" onClick={handleSearch} />
          </div>
          {searchError && <span className="text-red-400 text-xs">{searchError}</span>}
        </div>
      );
    }

    if (!value || value === "N/A") {
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
              {renderEditableField(data.fullTimeEmployees?.toLocaleString(), "employees")}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Sitio web:</span>
              {data.website ? (
                <span className="text-orange-400">
                  <a
                    href={data.website.startsWith("http") ? data.website : `https://${data.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-orange-300 underline"
                  >
                    {data.website.replace(/^https?:\/\//, "").trim()}
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

      {/* Métricas */}
      <div className="bg-tarjetas rounded-lg p-4 border-gray-700/30">
        <h3 className="text-orange-400 text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Métricas Financieras Clave
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">Valoración</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Cap. de Mercado:</span>
                <span className="text-orange-400 font-mono">{formatLargeNumber(data.marketCap)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Precio Actual:</span>
                <span className="text-orange-400 font-mono">
                  {typeof data.price === "number" ? `$${data.price.toFixed(2)}` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Moneda:</span>
                <span className="text-orange-400 font-mono">{data.currency || "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">Rendimiento</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Cambio Diario:</span>
                <span className={`font-mono ${Number(data.change) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {Number.isFinite(Number(data.change)) ? `$${Number(data.change).toFixed(2)}` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">% Cambio:</span>
                <span
                  className={`font-mono ${
                    Number(data.changePercentage) >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {Number.isFinite(Number(data.changePercentage))
                    ? formatPercentage(Number(data.changePercentage))
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Beta:</span>
                <span className="text-green-400 font-mono">
                  {typeof data.beta === "number" ? data.beta.toFixed(3) : "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">Volumen y Dividendos</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Último Dividendo:</span>
                <span className="text-green-400 font-mono">
                  {Number.isFinite(Number(data.lastDividend)) ? `$${Number(data.lastDividend).toFixed(2)}` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Volumen:</span>
                <span className="text-green-400 font-mono">
                  {Number.isFinite(Number(data.volume)) ? Number(data.volume).toLocaleString() : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Vol. Promedio:</span>
                <span className="text-green-400 font-mono">
                  {Number.isFinite(Number(data.averageVolume)) ? Number(data.averageVolume).toLocaleString() : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rango 52 sem:</span>
                <span className="text-green-400 font-mono text-xs">{data.range || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Descripción */}
      <div className="bg-gray-800/30 rounded-lg p-4 border-gray-700/30">
        <h3 className="text-green-400 text-lg font-semibold mb-3">Descripción del Negocio</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          {data.description || "No hay descripción disponible para esta empresa."}
        </p>
      </div>

      {/* Info adicional */}
      <div className="bg-gray-800/30 rounded-lg p-4 border-gray-700/30">
        <h3 className="text-green-400 text-lg font-semibold mb-4">Información Adicional</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">CIK:</span>
              <span className="text-green-400 font-mono">{data.cik || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ISIN:</span>
              <span className="text-green-400 font-mono">{data.isin || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">CUSIP:</span>
              <span className="text-green-400 font-mono">{data.cusip || "N/A"}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Teléfono:</span>
              <span className="text-green-400">{data.phone || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Es ETF:</span>
              <span className="text-green-400">{data.isEtf ? "Sí" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Activamente negociado:</span>
              <span className="text-green-400">{data.isActivelyTrading ? "Sí" : "No"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAnalysisContent = () => {
    if (!stockConclusion) {
      return <div className="text-gray-400 text-center py-8">No hay información de análisis disponible</div>;
    }
    return (
      <div className="space-y-6">
        <div className={`${colors.bgColor} ${colors.borderColor} p-6 rounded-lg border-2`}>
          <h3 className={`${colors.textColor} text-xl font-bold mb-4`}>¿Es una buena compra?</h3>
          <div className={`${colors.textColor} text-lg leading-relaxed`}>{conclusion || "No hay conclusión disponible"}</div>
        </div>
        <div className="space-y-4">
          <div className="bg-tarjetas p-4 rounded border-l-4 border-green-500/50">
            <h4 className="text-green-400 text-lg font-semibold mb-3">¿Qué hace la empresa?</h4>
            <p className="text-gray-200 leading-relaxed">{analysisData.queHace}</p>
          </div>
          <div className="bg-tarjetas p-4 rounded border-l-4 border-blue-500/50">
            <h4 className="text-blue-400 text-lg font-semibold mb-3">¿Tiene una ventaja clara frente a la competencia?</h4>
            <p className="text-gray-200 leading-relaxed">{analysisData.ventajaCompetitiva}</p>
          </div>
          <div className="bg-tarjetas p-4 rounded border-l-4 border-yellow-500/50">
            <h4 className="text-yellow-400 text-lg font-semibold mb-3">¿Gana dinero de verdad y lo sigue haciendo crecer?</h4>
            <p className="text-gray-200 leading-relaxed">{analysisData.ganaDinero}</p>
          </div>
          <div className="bg-tarjetas p-4 rounded border-l-4 border-purple-500/50">
            <h4 className="text-purple-400 text-lg font-semibold mb-3">¿El negocio puede seguir creciendo en 5 o 10 años?</h4>
            <p className="text-gray-200 leading-relaxed">{analysisData.crecimientoFuturo}</p>
          </div>
          <div className="bg-tarjetas p-4 rounded border-l-4 border-red-500/50">
            <h4 className="text-red-400 text-lg font-semibold mb-3">¿El precio tiene sentido o está inflado?</h4>
            <p className="text-gray-200 leading-relaxed">{analysisData.precioSentido}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog>
      <Card className="w-full flex items-center bg-tarjetas border-none">
        <CardHeader className="flex items-center flex-col w-full justify-between p-0 min-h-[36px]">
          <CardTitle className="flex text-green-400 text-md w-full grid-cols-8 min-h-[36px] gap-6 justify-between pr-1 pl-3">
            {/* Ticker */}
            <div className="flex">
              <div className="flex items-center gap-2 mr-4 justify-end">
                <TextCursorInput className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Ticker</span>
              </div>
              <div className="flex items-center text-sm font-semibold text-green-400">
                <input
                  type="text"
                  value={isTickerFocused ? tickerInput : tickerInput || data.symbol || ""}
                  onChange={handleTickerChange}
                  onKeyPress={handleTickerKeyPress}
                  onFocus={handleTickerFocus}
                  onBlur={handleTickerBlur}
                  placeholder={data.symbol || "Buscar..."}
                  className="focus:placeholder:text-transparent bg-transparent border-none outline-none text-orange-400 text-lg font-medium cursor-text transition-colors"
                  style={{ width: "fit-content", minWidth: "50px", maxWidth: "70px" }}

                />
              </div>
            </div>

            {/* Logo */}
            <div className="flex items-center">
              {data.image && (
                <img
                  src={data.image}
                  alt={`Logo de ${data.companyName || data.symbol}`}
                  className="w-5 h-5 object-contain rounded"
                  onError={(e: any) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>

            {/* Precio */}
            <div className="flex">
              <div className="flex items-center gap-2 mr-4">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Precio</span>
              </div>
              <div className="flex items-center text-sm font-semibold text-green-400">
                {typeof data.price === "number" ? `${Math.round(data.price)}` : "N/A"}
              </div>
            </div>

            {/* % cambio */}
            <div className="flex">
              <div className="flex items-center gap-2 mr-4">
                <Percent className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Cambio</span>
              </div>
              <p
                className={`flex items-center text-sm font-semibold ${
                  Number(data.changePercentage) >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {Number.isFinite(Number(data.changePercentage))
                  ? formatPercentage(Number(data.changePercentage))
                  : "N/A"}
              </p>
            </div>

            {/* Beta */}
            <div className="flex">
              <div className="flex items-center gap-2 mr-4">
                <TrendingUpDown className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Beta</span>
              </div>
              <p className="flex items-center text-sm font-semibold text-green-400">
                {typeof data.beta === "number" ? data.beta.toFixed(2) : "N/A"}
              </p>
            </div>

            {/* Market Cap */}
            <div className="flex">
              <div className="flex items-center gap-2 mr-4">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Market Cap</span>
              </div>
              <p className="flex items-center text-sm font-semibold text-green-400">
                {formatLargeNumber(data.marketCap)}
              </p>
            </div>

            {/* CEO */}
            <div className="flex">
              <div className="flex items-center gap-2 mr-4">
                <span className="text-sm text-gray-400">CEO</span>
                <User className="w-4 h-4 text-green-400" />
              </div>
              <p className="flex items-center text-sm font-semibold text-green-400">
                {data.ceo || "N/A"}
              </p>
            </div>

            {/* Abrir modal */}
            <div className="flex items-center justify-end pb-3">
              <DialogTrigger asChild>
                <p>
                  <SquareArrowOutUpRight className="w-4 h-4 text-green-400 hover:text-green-600 cursor-pointer" />
                </p>
              </DialogTrigger>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Modal de detalle */}
      <DialogContent className="bg-tarjetas border-gray-700 max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-orange-400 text-xl flex items-center gap-2">
            {data.image ? (
              <img
                src={data.image}
                alt={`Logo de ${data.companyName || data.symbol}`}
                className="w-5 h-5 object-contain rounded"
                onError={(e: any) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <Building2 className="w-5 h-5" />
            )}
            {data.companyName || currentSymbol || "Empresa"}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="border-b border-gray-700">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === "overview"
                  ? "bg-orange-500/20 text-orange-400 border-b-2 border-orange-500"
                  : "text-gray-400 hover:text-orange-300 hover:bg-fondoDeTarjetas"
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab("analysis")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === "analysis"
                  ? "bg-orange-500/20 text-orange-400 border-b-2 border-orange-500"
                  : "text-gray-400 hover:text-orange-300 hover:bg-gray-800/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Análisis Estratégico
              </div>
            </button>
          </div>
        </div>

        <div className="mt-4">
          {activeTab === "overview" && renderOverviewContent()}
          {activeTab === "analysis" && renderAnalysisContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

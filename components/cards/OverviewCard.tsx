"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import {
  Activity,
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

  // símbolo actual robusto
  const currentSymbol = useMemo(() => {
    if (typeof selectedStock === "string")
      return selectedStock?.toUpperCase?.() || "";
    return (selectedStock?.symbol || "").toUpperCase();
  }, [selectedStock]);

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
      const hasFullProfile = selectedStock && typeof selectedStock === 'object' && 'companyName' in selectedStock;

      console.log(`[OverviewCard] Starting fetch for symbol: ${currentSymbol}. Has full profile? ${hasFullProfile}`);
      
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
        if (active && !hasFullProfile) setError("Error al cargar los datos de la empresa");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentSymbol, selectedStock]);

  if ((loading || isParentLoading) && !data.symbol) {
    return (
      <Card className="bg-tarjetas border-none flex items-center justify-center w-full h-full">
        <CardContent className="p-0 flex items-center justify-center w-full h-full">
          <div className="text-gray-500 text-sm">
            Cargando ticker...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-tarjetas flex items-center flex-col w-full justify-between p-0 h-full">
        <CardContent className="p-0 flex items-center justify-center w-full h-full">
          <div className="text-red-400">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-tarjetas border-none shadow-lg w-full h-full flex flex-col group relative overflow-hidden rounded-none">
      <CardContent className="p-0 flex flex-col h-full">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-0 items-center border-b border-zinc-800 bg-black/10 h-full">
            {/* 1. STOCK: Logo, Ticker, Nombre */}
            <div className="flex items-center gap-3 px-1 border-r border-zinc-800 h-full">
                  <div className="relative h-10 max-h-10 aspect-square flex items-center justify-center overflow-hidden border-none rounded-none shrink-0">
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
                    <span className="fallback-text text-white font-bold text-xs" style={{ display: data.image ? 'none' : 'block' }}>
                      {(data.symbol || currentSymbol)?.slice(0, 2) || "??"}
                    </span>
                  </div>
                <div className="flex flex-col min-w-0 justify-center">
                    {/* <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base leading-none">{data.symbol || currentSymbol || "N/A"}</span>
                    </div> */}
                    <span className="text-gray-400 text-[10px] leading-tight font-medium truncate max-w-[150px]" title={data.companyName}>
                        {data.companyName || (loading || isParentLoading ? "Cargando..." : "N/A")}
                    </span>
                </div>
            </div>

            {/* 2. PRECIO */}
            <div className="flex  items-center gap-1 justify-center px-1 border-r border-zinc-800 h-full">
                {/* <span className="text-[9px] uppercase text-zinc-600 font-bold ">PRECIO</span> */}
                <div className="text-base text-white leading-none">
                  {Number.isFinite(Number(data.price)) ? `$${Number(data.price).toFixed(2)}` : "N/A"}
                </div>
                <div className={`text-[10px] font-medium ${Number(data.change) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {Number(data.change) >= 0 ? "+" : ""}{Number(data.changePercentage).toFixed(2)}%
                </div>
            </div>

            {/* 3. FGOS */}
            <div className="flex items-center justify-center px-1 gap-1 border-r border-zinc-800 h-full">
                <span className="text-[9px] uppercase text-zinc-600 font-bold">FSS</span>
                {snapshotLoading ? (
                  <Skeleton className="h-6 w-10 bg-white/10 rounded-sm" />
                ) : (
                  <div className={`text-lg font-black leading-none ${getScoreColor(snapshot?.fgos_score ?? 0)}`}>{snapshot?.fgos_score ?? "-"}</div>
                )}
            </div>

            {/* 4. VALUACIÓN */}
            <div className="flex flex-col items-center justify-center px-2 border-r border-zinc-800 h-full">
                <span className="text-[9px] uppercase text-zinc-600 font-bold tracking-widest mb-1.5">VALUACIÓN</span>
                {snapshotLoading ? (
                  <Skeleton className="h-5 w-20 bg-white/10 rounded-full" />
                ) : (
                  getValBadge(snapshot?.valuation_status)
                )}
            </div>

            {/* 5. VEREDICTO */}
            <div className="flex flex-col items-center justify-center px-2 border-r border-zinc-800 h-full text-center">
                <span className="text-[9px] uppercase text-zinc-600 font-bold tracking-widest mb-1">VERDICT FINTRA</span>
                {snapshotLoading ? (
                  <Skeleton className="h-4 w-24 bg-white/10 rounded-sm" />
                ) : (
                  <span className="text-white font-medium text-[10px] leading-tight max-w-[150px] line-clamp-2" title={snapshot?.verdict_text || "N/A"}>
                      {snapshot?.verdict_text || "N/A"}
                  </span>
                )}
            </div>

            {/* 6. EHS */}
            <div className="flex flex-col items-center justify-center px-2 h-full">
                <span className="text-[9px] uppercase text-zinc-600 font-bold tracking-widest flex items-center gap-1 mb-0.5">
                    E.H.S. <Activity className="w-3 h-3 text-blue-400"/>
                </span>
                {snapshotLoading ? (
                  <Skeleton className="h-6 w-10 bg-white/10 rounded-sm" />
                ) : (
                   <div className="flex flex-col items-center">
                      <div className="text-lg font-mono text-blue-400 font-bold leading-none">{snapshot?.ecosystem_score ?? "-"}</div>
                      <span className="text-[8px] text-gray-500 font-medium mt-0.5 leading-none">Eco Health</span>
                   </div>
                )}
            </div>
        </div>

        {/* The Detailed Grid */}

      </CardContent>
    </Card>
  );
}

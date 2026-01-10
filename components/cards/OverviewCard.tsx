"use client";
// Fintra/components/cards/OverviewCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { Activity } from "lucide-react";

import { getLatestSnapshot } from "@/lib/repository/fintra-db";
import { FintraSnapshotDB, ProfileStructural } from "@/lib/engine/types";
import { FMPCompanyProfile } from "@/lib/fmp/types";
import { Skeleton } from "@/components/ui/skeleton";

interface OverviewCardProps {
  selectedStock: FMPCompanyProfile | string | null;
  onStockSearch?: (symbol: string) => Promise<any> | any;
  onOpenSearchModal?: () => void;
  isParentLoading?: boolean;
  analysisData?: any;
}

/** Helper: Normaliza valores numéricos */
const num = (x: any) => {
  if (x === null || x === undefined || x === "") return undefined;
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
};

/** Helper: Normaliza booleanos */
const bool = (x: any) => (typeof x === "boolean" ? x : false);

type UIProfile = Partial<FMPCompanyProfile> & {
  change?: number;
  marketCap?: number;
  averageVolume?: number;
  volume?: number;
};

/** Normaliza/defiende los campos del profile de FMP */
function normalizeProfile(p: Partial<FMPCompanyProfile> | null): UIProfile {
  if (!p) return {};

  const rawMkt = p.mktCap;
  const rawAvgVol = p.volAvg;

  // Normalización de cambio porcentual
  let changePercentage: number | undefined = p.changePercentage;
  
  // Handle case where it might be a string (defensive coding against bad API data)
  if (typeof p.changePercentage === "string") {
    changePercentage = Number((p.changePercentage as string).replace("%", ""));
  } else if ('changesPercentage' in p) {
    // Legacy/Alternative field support
    const alt = (p as any).changesPercentage;
    if (typeof alt === "number") changePercentage = alt;
    if (typeof alt === "string") changePercentage = Number(alt.replace("%", ""));
  }

  // Normalización de cambio absoluto
  let change: number | undefined;
  if ('changes' in p && typeof (p as any).changes === "number") {
    change = (p as any).changes;
  } else if ('change' in p && typeof (p as any).change === "number") {
    change = (p as any).change;
  } else {
    change = num((p as any).changes) || num((p as any).change);
  }

  const mktCap = typeof rawMkt === "number" ? rawMkt : num(rawMkt);
  const volAvg = typeof rawAvgVol === "number" ? rawAvgVol : num(rawAvgVol);

  return {
    // Básicos
    symbol: typeof p.symbol === "string" ? p.symbol.toUpperCase() : undefined,
    companyName: p.companyName,
    sector: p.sector,
    industry: p.industry,
    country: p.country,
    description: p.description,
    ceo: p.ceo,
    fullTimeEmployees: typeof p.fullTimeEmployees === "number" ? String(p.fullTimeEmployees) : String(num(p.fullTimeEmployees) || ""),
    ipoDate: p.ipoDate,
    exchange: p.exchangeShortName ?? p.exchange,
    exchangeShortName: p.exchangeShortName ?? p.exchange,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    phone: typeof p.phone === "string" ? p.phone : undefined,
    isEtf: bool(p.isEtf),
    isActivelyTrading: bool(p.isActivelyTrading),
    cik: p.cik,
    isin: p.isin,
    cusip: p.cusip,
    currency: p.currency,

    // Números / mercado
    price: typeof p.price === "number" ? p.price : num(p.price),
    mktCap,
    // Alias legacy para UI
    marketCap: mktCap,
    beta: typeof p.beta === "number" ? p.beta : num(p.beta),
    lastDiv: typeof p.lastDiv === "number" ? p.lastDiv : num(p.lastDiv),
    range: typeof p.range === "string" ? p.range : undefined,

    // Mapped fields
    change,
    changePercentage,
    
    volume: typeof (p as any).volume === "number" ? (p as any).volume : num((p as any).volume),
    volAvg,
    // Alias legacy
    averageVolume: volAvg,
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
  // ── Estados ──
  const [profile, setProfile] = useState<UIProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para Snapshot de Supabase
  const [snapshot, setSnapshot] = useState<FintraSnapshotDB | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotChecked, setSnapshotChecked] = useState(false);

  // Símbolo actual robusto
  const currentSymbol = useMemo(() => {
    if (typeof selectedStock === "string")
      return selectedStock?.toUpperCase?.() || "";
    return (selectedStock?.symbol || "").toUpperCase();
  }, [selectedStock]);

  // Data memoizada para render
  const data = useMemo(() => {
    // Valores por defecto
    const defaults = {
        symbol: currentSymbol,
        image: `https://financialmodelingprep.com/image-stock/${currentSymbol}.png`,
        companyName: "",
        sector: "",
        industry: "",
        ceo: "",
        description: "",
        price: undefined,
        change: undefined,
        changePercentage: undefined,
        marketCap: undefined,
        beta: undefined,
        lastDividend: undefined,
        volume: undefined,
        averageVolume: undefined,
        range: "",
        currency: "USD",
        website: "",
        exchange: "",
        country: "",
        ipoDate: "",
        fullTimeEmployees: undefined,
        isEtf: false,
        isActivelyTrading: true,
        cik: "",
        isin: "",
        cusip: "",
        phone: ""
    };

    if (profile) {
        return {
            ...defaults,
            ...profile,
            symbol: profile.symbol || currentSymbol,
            image: profile.image || defaults.image,
            companyName: profile.companyName || "",
        };
    }
    
    return defaults;
  }, [profile, currentSymbol]);

  // Sincronizar datos iniciales desde props
  useEffect(() => {
    if (selectedStock && typeof selectedStock === 'object') {
       setProfile(normalizeProfile(selectedStock));
    }
  }, [selectedStock]);

  // 1. Fetch Snapshot (Primary Source)
  useEffect(() => {
    let active = true;
    const fetchSnapshot = async () => {
      if (!currentSymbol) return;
      
      setSnapshotLoading(true);
      setSnapshotChecked(false);
      // setSnapshot(null); // Principio: Nunca borrar datos previos mientras carga
      
      try {
        const data = await getLatestSnapshot(currentSymbol);
        if (active && data) {
           setSnapshot(data);
        }
      } catch (err) {
        console.error("Error fetching snapshot:", err);
      } finally {
        if (active) {
            setSnapshotLoading(false);
            setSnapshotChecked(true);
        }
      }
    };
    fetchSnapshot();
    return () => { active = false; };
  }, [currentSymbol]);

  // 2. Sync Profile from Snapshot (Priority)
  useEffect(() => {
    // Si no hay snapshot, no hacemos nada (mantenemos lo que venía de props)
    if (!snapshot) return;

    if (snapshot.profile_structural) {
      const ps = snapshot.profile_structural as any; 
      const metrics = ps.metrics || ps.Metrics || {};
      const identity = ps.identity || ps.Identity || {};
      const classification = ps.classification || ps.Classification || {};

      const mktCap = num(metrics.marketCap) ?? num(metrics.MarketCap);
      const volAvg = num(metrics.averageVolume) ?? num(metrics.AverageVolume);
      const lastDiv = num(metrics.lastDividend) ?? num(metrics.LastDividend);

      const mappedProfile: UIProfile = {
        symbol: identity.ticker || identity.symbol,
        companyName: identity.name || identity.companyName,
        sector: classification.sector,
        industry: classification.industry,
        country: identity.country,
        description: identity.description,
        ceo: identity.ceo,
        fullTimeEmployees: identity.fullTimeEmployees ? String(identity.fullTimeEmployees) : undefined,
        ipoDate: identity.founded || identity.ipoDate, 
        exchange: identity.exchange,
        exchangeShortName: identity.exchange,
        phone: identity.phone,
        isEtf: String(identity.isEtf) === 'true',
        isActivelyTrading: String(identity.isActivelyTrading) === 'true',
        cik: identity.cik,
        isin: identity.isin,
        cusip: identity.cusip,
        currency: identity.currency,
        website: identity.website ? identity.website.trim() : undefined,
        image: identity.logo ? identity.logo.trim() : undefined,

        price: num(metrics.price) ?? num(metrics.Price),
        mktCap,
        marketCap: mktCap,
        beta: num(metrics.beta) ?? num(metrics.Beta),
        lastDiv,
        range: metrics.range ?? metrics.Range,
        change: num(metrics.change) ?? num(metrics.Change),
        changePercentage: num(metrics.changePercentage) ?? num(metrics.ChangePercentage) ?? num(metrics.changesPercentage),
        volume: num(metrics.volume) ?? num(metrics.Volume),
        volAvg,
        averageVolume: volAvg,
      };

      console.log(`[OverviewCard] Using profile_structural from snapshot for ${currentSymbol}`, {
        metrics,
        market_snapshot: snapshot.market_snapshot
      });
      setProfile(prev => {
        // IMPORTANTE: Si prev tiene datos y mappedProfile tiene undefined, NO sobrescribir con undefined.
        // Pero si mappedProfile trae datos nuevos, usarlos.
        const next = prev ? { ...prev } : {};
        
        // Volatile fields that we prefer to keep from "live" data (props/FMP) if available
        // "no importa que estos valores se tomen directamente de la api de fmp" -> Preferimos la data fresca
        const volatileFields = ['price', 'change', 'changePercentage', 'volume'];

        // Merge explícito: Solo sobrescribir si el nuevo valor es válido (no null/undefined)
        for (const [key, value] of Object.entries(mappedProfile)) {
          if (value !== undefined && value !== null) {
            // Si es un campo volátil y ya tenemos un valor (presumiblemente fresco de props), no lo sobrescribimos con el snapshot (histórico)
            if (volatileFields.includes(key) && (next as any)[key] !== undefined && (next as any)[key] !== null) {
                continue;
            }
            (next as any)[key] = value;
          }
        }

        // Fallback robusto para el precio: si metrics.price falló, intentar market_snapshot
        if ((next.price === undefined || next.price === null) && snapshot.market_snapshot?.price) {
           next.price = num(snapshot.market_snapshot.price);
        }

        return next;
      });
      setLoading(false); 
    }
  }, [snapshot, currentSymbol]);

  // 3. Fetch FMP Data (Fallback) - REMOVED per Fintra Architecture (Supabase Only)
  // El frontend nunca habla con FMP. Supabase decide.



  // ── Render Helpers ──
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

  // ── Render Principal ──

  if ((loading || isParentLoading) && !data.symbol) {
    return (
      <Card className="bg-tarjetas border-none flex items-center justify-center w-full h-full">
        <CardContent className="p-0 flex items-center justify-center w-full h-full">
          <div className="text-gray-500 text-sm">Cargando ticker...</div>
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
            <div className="flex items-center gap-3 px-0 border-r border-zinc-800 h-full">
                  <div className="relative h-12 max-h-12 aspect-square flex items-center justify-center overflow-hidden border-none rounded-none shrink-0">
                    {data.image ? (
                      <img 
                        src={data.image} 
                        alt={data.symbol || "Logo"} 
                        className="w-full h-full object-contain p-0"
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
                    <span className="text-gray-400 text-[10px] leading-tight font-medium truncate max-w-[150px]" title={snapshot?.profile_structural?.identity?.name || data.companyName}>
                        {snapshot?.profile_structural?.identity?.name || data.companyName || (loading || isParentLoading ? "Cargando..." : "N/A")}
                    </span>
                </div>
            </div>

            {/* 2. PRECIO */}
            <div className="flex  items-center gap-1 justify-center px-1 border-r border-zinc-800 h-full">
                <div className="text-base text-white leading-none">
                  {Number.isFinite(Number(data.price)) ? `$${Number(data.price).toFixed(2)}` : "N/A"}
                </div>
                <div className={`text-[10px] font-medium ${Number(data.change ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {Number(data.change ?? 0) >= 0 ? "+" : ""}{Number.isFinite(Number(data.changePercentage)) ? Number(data.changePercentage).toFixed(2) : "0.00"}%
                </div>
            </div>

            {/* 3. FGOS */}
            <div className="flex items-center justify-center px-1 gap-1 border-r border-zinc-800 h-full">
                <span className="text-[9px] uppercase text-zinc-600 font-bold">FSS</span>
                {/* Principio: Si hay dato se muestra. Si no hay y carga -> Skeleton */}
                {Number.isFinite(snapshot?.fgos_score) ? (
                   <div className={`text-lg font-black leading-none ${getScoreColor(snapshot!.fgos_score!)}`}>{snapshot!.fgos_score}</div>
                ) : snapshotLoading ? (
                  <Skeleton className="h-6 w-10 bg-white/10 rounded-sm" />
                ) : (
                  <div className="text-lg font-black leading-none text-zinc-700">-</div>
                )}
            </div>

            {/* 4. VALUACIÓN */}
            <div className="flex flex-col items-center justify-center px-2 border-r border-zinc-800 h-full">
                <span className="text-[9px] uppercase text-zinc-600 font-bold tracking-widest mb-1.5">VALUACIÓN</span>
                {snapshot?.valuation_status ? (
                   getValBadge(snapshot.valuation_status)
                ) : snapshotLoading ? (
                  <Skeleton className="h-5 w-20 bg-white/10 rounded-full" />
                ) : (
                   getValBadge(null)
                )}
            </div>

            {/* 5. VEREDICTO */}
            <div className="flex flex-col items-center justify-center px-2 border-r border-zinc-800 h-full text-center">
                <span className="text-[9px] uppercase text-zinc-600 font-bold tracking-widest mb-1">VERDICT FINTRA</span>
                {snapshot?.verdict_text ? (
                  <span className="text-white font-medium text-[10px] leading-tight max-w-[150px] line-clamp-2" title={snapshot.verdict_text}>
                      {snapshot.verdict_text}
                  </span>
                ) : snapshotLoading ? (
                  <Skeleton className="h-4 w-24 bg-white/10 rounded-sm" />
                ) : (
                   <span className="text-zinc-600 text-[10px]">N/A</span>
                )}
            </div>

            {/* 6. EHS */}
            <div className="flex flex-col items-center justify-center px-2 h-full">
                <span className="text-[9px] uppercase text-zinc-600 font-bold tracking-widest flex items-center gap-1 mb-0.5">
                    E.H.S. <Activity className="w-3 h-3 text-blue-400"/>
                </span>
                {Number.isFinite(snapshot?.ecosystem_score) ? (
                   <div className="flex flex-col items-center">
                      <div className="text-lg font-mono text-blue-400 font-bold leading-none">{snapshot!.ecosystem_score}</div>
                      <span className="text-[8px] text-gray-500 font-medium mt-0.5 leading-none">Eco Health</span>
                   </div>
                ) : snapshotLoading ? (
                  <Skeleton className="h-6 w-10 bg-white/10 rounded-sm" />
                ) : (
                   <div className="text-lg font-mono text-zinc-700 font-bold leading-none">-</div>
                )}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

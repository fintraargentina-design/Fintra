"use client";
// Fintra/components/dashboard/SectorAnalysisPanel.tsx
// VERSIÓN CORREGIDA - Orchestrates Table and Chart
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, AlertCircle } from "lucide-react";
import TablaIFS, { 
  sortStocksBySnapshot, 
  mapSnapshotToStockData 
} from "./TablaIFS";
import SectorScatterChart from "./SectorScatterChart";
import { EnrichedStockData } from "@/lib/engine/types";
import { MOCK_DATA } from "./mock-data";

interface SectorAnalysisPanelProps {
  onStockSelect?: (symbol: string) => void;
  selectedTicker?: string;
  sectors?: any[];
  selectedSector?: string;
  industries?: any[];
  selectedIndustry?: string;
  selectedCountry?: string;
}

interface DataQuality {
  marketDataCount: number;
  snapshotDataCount: number;
  completeness: number;
}

export default function SectorAnalysisPanel({ 
  onStockSelect, 
  selectedTicker,
  sectors = [],
  selectedSector,
  industries = [],
  selectedIndustry = "Todas",
  selectedCountry,
}: SectorAnalysisPanelProps) {

  const [stocks, setStocks] = useState<EnrichedStockData[]>([]);
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQuality>({
    marketDataCount: 0,
    snapshotDataCount: 0,
    completeness: 100
  });
  
  // Pagination State
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const PAGE_SIZE = 1000;

  // Scroll Ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // AbortController Ref para cancelar requests obsoletos
  const abortControllerRef = useRef<AbortController | null>(null);

  // MOCK MODE TOGGLE
  const USE_MOCK = false;

  /**
   * Fetch optimizado con AbortController y mejor manejo de snapshots
   */
  const fetchData = async (
    pageNum: number, 
    isNewFetch: boolean, 
    signal?: AbortSignal
  ) => {
    // Requires at least a Country to be selected (default is US)
    if (!selectedCountry) return;
    
    const currentIndustry = selectedIndustry;
    
    if (isNewFetch) {
      setLoading(true);
      setStocks([]);
      setError(null);
    } else {
      setIsFetchingMore(true);
    }
    
    // MOCK DATA RETURN
    if (USE_MOCK) {
      setTimeout(() => {
        const sortedMock = [...MOCK_DATA].sort(
          (a, b) => (b.fgosScore || 0) - (a.fgosScore || 0)
        );
        setStocks(sortedMock);
        setLoading(false);
        setIsFetchingMore(false);
        setHasMore(false);
      }, 600);
      return;
    }

    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // ===== STEP 1: Fetch Market State (Optimizado - SOLO COLUMNAS QUE EXISTEN) =====
      let query = supabase
        .from('fintra_market_state')
        .select(`
          ticker,
          company_name,
          sector,
          industry,
          country,
          market_cap,
          fgos_score,
          price,
          ytd_return,
          change_percentage,
          volume,
          fgos_confidence_label,
          fgos_confidence_percent,
          valuation_status,
          verdict_text
        `); // Solo campos que EXISTEN en la tabla
        
      if (selectedCountry && selectedCountry !== 'All Countries') {
        query = query.eq('country', selectedCountry);
      }

      // Aplicar filtros cascading
      if (selectedSector && selectedSector !== 'All Sectors') {
        query = query.eq('sector', selectedSector);
      }

      if (selectedIndustry && 
          selectedIndustry !== 'All Industries' && 
          selectedIndustry !== 'Todas') {
        query = query.eq('industry', selectedIndustry);
      }

      // Sort by FGOS Score (usa índice si existe)
      query = query
        .order('fgos_score', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (signal) {
        query = query.abortSignal(signal);
      }

      const { data: marketData, error: marketError } = await query;
      
      // Check si request fue cancelado
      if (signal?.aborted) {
        console.log('🚫 Request cancelled');
        return;
      }
      
      if (marketError) throw marketError;

      if (!marketData || marketData.length === 0) {
        console.warn(
          `⚠️ No market data for: ${selectedCountry}/${selectedSector}/${selectedIndustry}`
        );
        setHasMore(false);
        if (isNewFetch) {
          setStocks([]);
          setDataQuality({
            marketDataCount: 0,
            snapshotDataCount: 0,
            completeness: 0
          });
        }
        return;
      }
      
      if (marketData.length < PAGE_SIZE) {
        setHasMore(false);
      }

      const tickers = marketData.map(m => m.ticker);
      
      // ===== STEP 2: Fetch Latest Snapshots (Optimizado) =====
      
      let snapshots: any[] = [];
      
      try {
        // Opción A: Si la función RPC get_latest_snapshots() existe
        let rpcQuery = supabase
          .rpc('get_latest_snapshots', { ticker_list: tickers });

        if (signal) {
          rpcQuery = rpcQuery.abortSignal(signal);
        }

        const { data: rpcSnapshots, error: rpcError } = await rpcQuery;

        if (!rpcError && rpcSnapshots) {
          snapshots = rpcSnapshots;
        } else {
          throw new Error('RPC not available');
        }
      } catch (rpcErr) {
        // Opción B: Fallback a query tradicional optimizada
        
        let fallbackQuery = supabase
          .from('fintra_snapshots')
          .select(`
            ticker,
            snapshot_date,
            fgos_score,
            fgos_confidence,
            fgos_category,
            fgos_components,
            valuation,
            market_position,
            investment_verdict,
            ifs,
            ifs_memory,
            sector_rank,
            sector_rank_total,
            fgos_maturity,
            fgos_status,
            market_snapshot,
            relative_vs_sector_1y
          `) // Solo campos necesarios (NO SELECT *)
          .in('ticker', tickers)
          .order('ticker', { ascending: true })
          .order('snapshot_date', { ascending: false });

        if (signal) {
          fallbackQuery = fallbackQuery.abortSignal(signal);
        }

        const { data: fallbackSnapshots, error: snapError } = await fallbackQuery;

        if (signal?.aborted) return;
        
        if (snapError) {
          console.error('❌ Error fetching snapshots:', snapError);
          // No lanzar error, continuar sin snapshots
        } else {
          snapshots = fallbackSnapshots || [];
        }
      }

      // ===== STEP 3: Map Snapshots by Ticker (solo el más reciente) =====
      const snapshotMap = new Map<string, any>();
      
      if (snapshots && snapshots.length > 0) {
        snapshots.forEach((s: any) => {
          if (!snapshotMap.has(s.ticker)) {
            snapshotMap.set(s.ticker, s);
          }
        });
      }

      // ===== STEP 4: Validación y Data Quality =====
      const completeness = marketData.length > 0 
        ? (snapshotMap.size / marketData.length) * 100 
        : 0;

      setDataQuality({
        marketDataCount: marketData.length,
        snapshotDataCount: snapshotMap.size,
        completeness
      });

      if (completeness < 50) {
        console.warn(
          `⚠️ Low data completeness: ${completeness.toFixed(1)}% ` +
          `(${snapshotMap.size}/${marketData.length} have snapshots)`
        );
      }

      // ===== STEP 5: Merge Market Data + Snapshots =====
      const mergedData = marketData.map((m: any) => {
        const snap = snapshotMap.get(m.ticker);
        
        if (!snap) {
          // Si no hay snapshot, devolver solo market data con valores por defecto
          return {
            ticker: m.ticker,
            company_name: m.company_name || m.ticker,
            sector: m.sector,
            industry: m.industry,
            country: m.country,
            price: m.price,
            market_cap: m.market_cap,
            fgos_score: m.fgos_score,
            fgos_confidence: m.fgos_confidence_percent,
            fgos_category: null,
            fgos_components: null,
            valuation_status: m.valuation_status || 'pending',
            competitive_advantage: null,
            investment_verdict: null,
            snapshot_date: null,
            // Market state fields
            ytd_return: m.ytd_return,
            change_percentage: m.change_percentage,
            volume: m.volume,
            fgos_confidence_label: m.fgos_confidence_label,
            verdict_text: m.verdict_text,
            _hasSnapshot: false
          };
        }
        
        // Merge: Snapshot como base, Market data override para valores más frescos
        return {
          ...snap,
          // Override con valores más recientes de market_state
          price: m.price ?? snap.price,
          market_cap: m.market_cap ?? snap.market_cap,
          fgos_score: m.fgos_score ?? snap.fgos_score,
          ytd_return: m.ytd_return,
          change_percentage: m.change_percentage,
          volume: m.volume,
          company_name: m.company_name || snap.company_name,
          sector: m.sector || snap.sector,
          industry: m.industry || snap.industry,
          country: m.country || snap.country,
          fgos_confidence_label: m.fgos_confidence_label,
          valuation_status: m.valuation_status || snap.valuation_status,
          verdict_text: m.verdict_text,
          _hasSnapshot: true
        };
      });

      // Debug: mostrar primeros 3 registros
      // if (isNewFetch && mergedData.length > 0) {
      //   console.log('🔍 [DEBUG] Merged Data (first 3):', mergedData.slice(0, 3));
      // }

      // ===== STEP 6: Transform to EnrichedStockData =====
      const enriched: EnrichedStockData[] = mergedData.map(mapSnapshotToStockData);

      // ===== STEP 7: Update State =====
      // 5. Sort
      const sorted = enriched.sort(sortStocksBySnapshot);
      
      setStocks(prev => {
        if (isNewFetch) {
          return sorted;
        }
        
        // Evitar duplicados al paginar
        const existingTickers = new Set(prev.map(p => p.ticker));
        const newUnique = sorted.filter(e => !existingTickers.has(e.ticker));
        
        return [...prev, ...newUnique];
      });
      
      setHasMore(marketData.length === PAGE_SIZE);

    } catch (err: any) {
      // No mostrar error si fue cancelación
      if (err.name === 'AbortError' || signal?.aborted) {
        console.log('🚫 Request aborted');
        return;
      }
      
      console.error("❌ Error loading sector data:", err);
      setError(err.message || 'Failed to load data');
      
      if (isNewFetch) {
        setStocks([]);
      }
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  /**
   * Effect: Filter Change → Reload Data
   * Incluye AbortController para cancelar requests anteriores
   */
  useEffect(() => {
    if (!selectedSector) return;
    
    // Cancelar request anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Crear nuevo AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    let mounted = true;

    const loadData = async () => {
      if (!mounted) return;
      
      setStocks([]); 
      setLoading(true);
      setPage(0);
      setHasMore(true);
      setError(null);
      
      if (mounted && !abortController.signal.aborted) {
        await fetchData(0, true, abortController.signal);
      }
    };
    
    loadData();
    
    return () => { 
      mounted = false;
      abortController.abort();
    };
  }, [selectedSector, selectedIndustry, selectedCountry]);

  // Handle row hover from Table
  const handleRowHover = (ticker: string | null) => {
    setHoveredTicker(ticker);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0A0A0A]">
      {/* Top Section: Table (60%) */}
      <div className="h-[60%] w-full flex flex-col min-h-0 border-b border-zinc-800">
        
        {error ? (
          <div className="p-4 text-red-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        ) : (
          <TablaIFS
            data={stocks}
            isLoading={loading && page === 0}
            isFetchingMore={isFetchingMore}
            onRowClick={(ticker) => onStockSelect?.(ticker)}
            onRowHover={handleRowHover}
            selectedTicker={selectedTicker}
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMore && !isFetchingMore && !loading) {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchData(nextPage, false);
              }
            }}
            scrollRef={scrollContainerRef}
          />
        )}
      </div>

      {/* Bottom Section: Chart (40%) */}
      <div className="h-[40%] w-full min-h-0 relative">
        <SectorScatterChart 
          data={stocks}
          hoveredTicker={hoveredTicker}
          activeTicker={selectedTicker}
        />
      </div>
    </div>
  );
}
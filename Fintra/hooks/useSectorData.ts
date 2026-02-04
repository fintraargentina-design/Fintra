// Fintra/hooks/useSectorData.ts
import { useState, useEffect } from "react";
import { EnrichedStockData } from "@/lib/engine/types";
import { fetchSectorStocks } from "@/lib/actions/sector-analysis";
import { mapSnapshotToStockData } from "@/components/dashboard/TablaIFS";

interface FilterOptions {
  selectedSector?: string;
  selectedIndustry?: string;
  selectedCountry?: string;
}

interface DataQuality {
  marketDataCount: number;
  snapshotDataCount: number;
  completeness: number;
}

interface UseSectorDataReturn {
  stocks: EnrichedStockData[];
  loading: boolean;
  isFetchingMore: boolean;
  error: string | null;
  dataQuality: DataQuality;
  hasMore: boolean;
  fetchMore: () => void;
}

const PAGE_SIZE = 1000;

/**
 * Custom hook for fetching sector analysis data
 * Uses Server Action (fetchSectorStocks) for optimized server-side queries
 */
export function useSectorData(filters: FilterOptions): UseSectorDataReturn {
  const { selectedSector, selectedIndustry, selectedCountry } = filters;

  const [stocks, setStocks] = useState<EnrichedStockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQuality>({
    marketDataCount: 0,
    snapshotDataCount: 0,
    completeness: 100,
  });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = async (pageNum: number, isNewFetch: boolean) => {
    if (!selectedCountry) return;

    if (isNewFetch) {
      setLoading(true);
      setStocks([]);
      setError(null);
    } else {
      setIsFetchingMore(true);
    }

    try {
      console.log("🔍 [useSectorData] Fetching with filters:", {
        selectedCountry,
        selectedSector,
        selectedIndustry,
        page: pageNum,
        pageSize: PAGE_SIZE,
      });

      // Call Server Action (runs on server with admin privileges)
      const result = await fetchSectorStocks({
        selectedCountry,
        selectedSector,
        selectedIndustry,
        page: pageNum,
        pageSize: PAGE_SIZE,
      });

      console.log("📦 [useSectorData] Server Action returned:", {
        stocksCount: result.stocks?.length || 0,
        hasMore: result.hasMore,
        dataQuality: result.dataQuality,
        firstStock: result.stocks?.[0],
      });

      // Map raw snapshots to EnrichedStockData using TablaIFS mapper
      const mappedStocks = result.stocks.map(mapSnapshotToStockData);
      console.log("✅ [useSectorData] Mapped stocks:", mappedStocks.length);

      // Update state with server response
      setDataQuality(result.dataQuality);
      setHasMore(result.hasMore);

      setStocks((prev) => {
        if (isNewFetch) {
          return mappedStocks;
        }

        // Avoid duplicates when paginating
        const existingTickers = new Set(prev.map((p) => p.ticker));
        const newUnique = mappedStocks.filter(
          (e) => !existingTickers.has(e.ticker),
        );

        return [...prev, ...newUnique];
      });
    } catch (err: any) {
      console.error("❌ Error loading sector data:", err);
      setError(err.message || "Failed to load data");

      if (isNewFetch) {
        setStocks([]);
      }
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  // Effect: Filter Change → Reload Data
  useEffect(() => {
    if (!selectedSector) return;

    let mounted = true;

    const loadData = async () => {
      if (!mounted) return;

      setStocks([]);
      setLoading(true);
      setPage(0);
      setHasMore(true);
      setError(null);

      if (mounted) {
        await fetchData(0, true);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSector, selectedIndustry, selectedCountry]);

  // Fetch more (pagination)
  const fetchMore = () => {
    if (!hasMore || isFetchingMore || loading) return;

    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage, false);
  };

  return {
    stocks,
    loading,
    isFetchingMore,
    error,
    dataQuality,
    hasMore,
    fetchMore,
  };
}

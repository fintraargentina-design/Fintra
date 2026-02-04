// Fintra/hooks/usePeersData.ts
import { useState, useEffect } from "react";
import { EnrichedStockData } from "@/lib/engine/types";
import { fetchPeersData } from "@/lib/actions/peers-analysis";
import { mapSnapshotToStockData } from "@/components/dashboard/TablaIFS";

interface UsePeersDataReturn {
  peers: EnrichedStockData[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook for fetching peer companies data
 * Uses Server Action (fetchPeersData) for optimized server-side queries
 */
export function usePeersData(symbol: string): UsePeersDataReturn {
  const [peers, setPeers] = useState<EnrichedStockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPeersData = async () => {
      if (!symbol) {
        if (mounted) {
          setPeers([]);
          setLoading(false);
        }
        return;
      }

      if (mounted) {
        setLoading(true);
        setPeers([]);
        setError(null);
      }

      try {
        // Call Server Action (runs on server with admin privileges)
        const rawSnapshots = await fetchPeersData(symbol);

        // Map raw snapshots to EnrichedStockData using TablaIFS mapper
        const mappedPeers = rawSnapshots.map(mapSnapshotToStockData);

        if (mounted) {
          setPeers(mappedPeers);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("❌ Error loading peers data:", err);

        if (mounted) {
          setError(err.message || "Failed to load peers");
          setPeers([]);
          setLoading(false);
        }
      }
    };

    loadPeersData();

    return () => {
      mounted = false;
    };
  }, [symbol]);

  return {
    peers,
    loading,
    error,
  };
}

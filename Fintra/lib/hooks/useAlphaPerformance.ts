import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Canonical list of sectors (GICS-aligned) used to distinguish Sector vs Industry
const KNOWN_SECTORS = new Set([
  "Technology",
  "Financial Services",
  "Healthcare",
  "Consumer Cyclical",
  "Industrials",
  "Energy",
  "Utilities",
  "Real Estate",
  "Basic Materials",
  "Communication Services",
  "Consumer Defensive",
]);

export interface AlphaWindow {
  window: "1Y" | "3Y" | "5Y";
  symbolVsSector: number | null;
  symbolVsIndustry: number | null;
  peerVsSector?: number | null;
  peerVsIndustry?: number | null;
}

export interface UseAlphaPerformanceResult {
  data: AlphaWindow[];
  loading: boolean;
  error: string | null;
}

interface UseAlphaPerformanceProps {
  ticker: string;
  peerTicker?: string | null;
}

export function useAlphaPerformance({
  ticker,
  peerTicker,
}: UseAlphaPerformanceProps): UseAlphaPerformanceResult {
  const [data, setData] = useState<AlphaWindow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!ticker) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const tickersToFetch = [ticker];
        if (peerTicker) {
          tickersToFetch.push(peerTicker);
        }

        const windowsToFetch = ["1Y", "3Y", "5Y"];

        // Query performance_windows directly
        // Strictly READ-ONLY from canonical source
        const { data: rawData, error: supabaseError } = await supabase
          .from("performance_windows")
          .select("ticker, benchmark_ticker, window_code, alpha")
          .in("ticker", tickersToFetch)
          .in("window_code", windowsToFetch);

        if (supabaseError) {
          throw supabaseError;
        }

        if (!isMounted) return;

        // Process data into the required shape
        const windows: ("1Y" | "3Y" | "5Y")[] = ["1Y", "3Y", "5Y"];

        const shapedData: AlphaWindow[] = windows.map((win) => {
          // Helper to find alpha
          const findAlpha = (t: string, checkIsSector: boolean) => {
            const row = rawData?.find((r) => {
              if (r.ticker !== t || r.window_code !== win) return false;
              
              const isSector = KNOWN_SECTORS.has(r.benchmark_ticker);
              return checkIsSector ? isSector : !isSector;
            });

            return row?.alpha != null ? Number(row.alpha) : null;
          };

          return {
            window: win,
            symbolVsSector: findAlpha(ticker, true),
            symbolVsIndustry: findAlpha(ticker, false),
            peerVsSector: peerTicker ? findAlpha(peerTicker, true) : undefined,
            peerVsIndustry: peerTicker
              ? findAlpha(peerTicker, false)
              : undefined,
          };
        });

        setData(shapedData);
      } catch (err: any) {
        console.error("Error fetching alpha performance:", err);
        if (isMounted) {
          setError(err.message || "Failed to fetch alpha data");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [ticker, peerTicker]);

  return { data, loading, error };
}

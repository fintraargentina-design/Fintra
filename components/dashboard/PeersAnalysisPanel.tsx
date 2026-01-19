"use client";
// Fintra/components/dashboard/PeersAnalysisPanel.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import TablaIFS, { EnrichedStockData, sortStocksBySnapshot } from "./TablaIFS";

interface PeersAnalysisPanelProps {
  symbol: string;
  onPeerSelect?: (ticker: string) => void;
  selectedPeer?: string | null;
}

export default function PeersAnalysisPanel({ symbol, onPeerSelect, selectedPeer }: PeersAnalysisPanelProps) {
  const [peers, setPeers] = useState<EnrichedStockData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchPeersData = async () => {
      if (!symbol) {
        if (active) {
          setPeers([]);
          setIsLoading(false);
        }
        return;
      }

      if (active) {
        setIsLoading(true);
        setPeers([]);
      }

      try {
        // 1. Get peers list from Supabase
        const { data: peerRows, error: peerError } = await supabase
          .from('stock_peers')
          .select('peer_ticker')
          .eq('ticker', symbol)
          .limit(20);

        if (peerError) {
          console.error("Error fetching peers from Supabase:", peerError);
          if (active) {
            setPeers([]);
            setIsLoading(false);
          }
          return;
        }

        let peersList: string[] = peerRows ? peerRows.map((r: any) => r.peer_ticker) : [];
        
        // Filter out invalid tickers
        peersList = peersList.filter(p => {
          if (!p || typeof p !== 'string') return false;
          const clean = p.trim();
          return clean.length > 0 && /^[A-Z0-9.\-\^]+$/i.test(clean);
        });

        // Limit to 8 after filtering
        peersList = peersList.slice(0, 8);

        if (peersList.length === 0) {
          if (active) {
            setPeers([]);
            setIsLoading(false);
          }
          return;
        }

        // 2. Fetch Snapshots for peers (Source of Truth)
        // Note: fintra_snapshots contains history. We need the latest snapshot for each peer.
        // We fetch by ticker IN (...) and order by date desc.
        // Then we deduplicate keeping the first (latest).
        const { data: snapshots, error: snapError } = await supabase
          .from('fintra_snapshots')
          .select('*')
          .in('ticker', peersList)
          .order('snapshot_date', { ascending: false })
          .limit(50); // Fetch recent snapshots (enough to cover the list of peers)

        if (snapError) {
          console.error("Error fetching peer snapshots:", snapError);
          if (active) {
             setPeers([]);
             setIsLoading(false);
          }
          return;
        }

        const snapshotsArray = (snapshots || []) as any[];

        const enriched: EnrichedStockData[] = snapshotsArray.map((row: any) => {
          const marketSnapshot = row.market_snapshot || {};
          const valuation = row.valuation || {};
          const profileStructural = row.profile_structural || {};
          const financialScores = profileStructural.financial_scores || {};
          const fgosComponents = row.fgos_components || {};
          const competitiveAdvantage = fgosComponents.competitive_advantage || {};
          const marketPosition = row.market_position || {};

          return {
            ticker: row.ticker,
            sectorRank: marketPosition.sector_rank ?? null,
            sectorRankTotal: marketPosition.sector_total_count ?? null,
            sectorValuationStatus: valuation.valuation_status ?? null,
            fgosBand: row.fgos_category ?? null,
            competitiveStructureBand: competitiveAdvantage.band ?? null,
            relativeResultBand: row.relative_return?.band ?? null,
            strategyState: row.investment_verdict?.verdict_label ?? null,
            priceEod: marketSnapshot.price ?? marketSnapshot.price_eod ?? null,
            ytdReturn: marketSnapshot.ytd_percent ?? null,
            marketCap: marketSnapshot.market_cap ?? financialScores.marketCap ?? null,
          } as EnrichedStockData;
        });

        // Deduplicate enriched based on ticker (keep the first one encountered = latest date)
        const uniqueEnrichedMap = new Map<string, EnrichedStockData>();
        enriched.forEach(item => {
          if (!uniqueEnrichedMap.has(item.ticker)) {
            uniqueEnrichedMap.set(item.ticker, item);
          }
        });
        const uniqueEnriched = Array.from(uniqueEnrichedMap.values());

        // Sort using the same logic as SectorAnalysisPanel
        uniqueEnriched.sort(sortStocksBySnapshot);

        if (active) {
          setPeers(uniqueEnriched);
          setIsLoading(false);
        }

      } catch (e) {
        console.error(e);
        if (active) setIsLoading(false);
      }
    };

    fetchPeersData();

    return () => { active = false; };
  }, [symbol]);

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden mt-0">
      
      <div className="px-1 py-1 bg-white/[0.02] shrink-0">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Competidores directos de <span className="text-[#FFA028]">{symbol}</span>
        </h4>
      </div>

      <TablaIFS 
        data={peers}
        isLoading={isLoading}
        onRowClick={(ticker) => onPeerSelect?.(selectedPeer === ticker ? "" : ticker)}
        selectedTicker={selectedPeer}
        emptyMessage={`No se encontraron competidores para ${symbol}.`}
      />
    </div>
  );
}


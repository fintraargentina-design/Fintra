"use client";
// Fintra/components/dashboard/PeersAnalysisPanel.tsx
import { usePeersData } from "@/hooks/usePeersData";
import TablaIFS from "./TablaIFS";

interface PeersAnalysisPanelProps {
  symbol: string;
  onPeerSelect?: (ticker: string) => void;
  selectedPeer?: string | null;
}

export default function PeersAnalysisPanel({
  symbol,
  onPeerSelect,
  selectedPeer,
}: PeersAnalysisPanelProps) {
  // Use custom hook for data fetching (includes AbortController)
  const { peers, loading, error } = usePeersData(symbol);

  return (
    <div className="w-full h-full flex flex-col bg-[#0e0e0e] rounded-none overflow-hidden mt-0 border border-[#333]">
      <div className="px-3 py-2 bg-[#0e0e0e] border-b border-[#333] shrink-0 flex items-center justify-between">
        <h4 className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider">
          Competidores Directos
        </h4>
        <span className="text-[11px] font-semibold text-[#ededed] tracking-tight">
          {symbol}
        </span>
      </div>

      <TablaIFS
        data={peers}
        isLoading={loading}
        onRowClick={(ticker) => onPeerSelect?.(ticker)}
        selectedTicker={selectedPeer}
        emptyMessage={`No se encontraron competidores para ${symbol}.`}
        selectionVariant="secondary"
      />
    </div>
  );
}

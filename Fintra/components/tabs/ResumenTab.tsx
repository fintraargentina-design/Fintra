import ResumenCard from "@/components/cards/ResumenCard";

interface ResumenTabProps {
  stockBasicData: any;
  stockAnalysis?: any;
  symbol: string;
  onPeerSelect?: (ticker: string) => void;
  selectedPeer?: string | null;
  onStockSearch?: (symbol: string) => void;
  isLoading?: boolean;
  onSectorChange?: (sector: string) => void;
  onIndustryChange?: (industry: string) => void;
}

export default function ResumenTab({ 
  stockBasicData, 
  stockAnalysis,
  symbol, 
  onPeerSelect, 
  selectedPeer,
  onStockSearch,
  isLoading,
  onSectorChange,
  onIndustryChange
}: ResumenTabProps) {
  return (
    <div className="w-full h-full flex flex-col gap-1 p-1 overflow-hidden">
      <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
        <div className="shrink-0">
          <ResumenCard
            symbol={symbol}
            stockBasicData={stockBasicData}
            onStockSearch={onStockSearch}
            isParentLoading={isLoading}
            onSectorSelect={onSectorChange}
            onIndustrySelect={onIndustryChange}
          />
        </div>
      </div>
    </div>
  );
}

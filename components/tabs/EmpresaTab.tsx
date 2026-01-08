import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PeersAnalysisPanel from "@/components/dashboard/PeersAnalysisPanel";
import OverviewCard from "@/components/cards/OverviewCard";
import ChartsTabHistoricos from "@/components/tabs/ChartsTabHistoricos";
import FGOSRadarChart from "@/components/charts/FGOSRadarChart";

interface EmpresaTabProps {
  stockBasicData: any;
  stockAnalysis?: any;
  symbol: string;
  onPeerSelect?: (ticker: string) => void;
  selectedPeer?: string | null;
  onStockSearch?: (symbol: string) => void;
  onOpenSearchModal?: () => void;
  isLoading?: boolean;
}

export default function EmpresaTab({ 
  stockBasicData, 
  stockAnalysis,
  symbol, 
  onPeerSelect, 
  selectedPeer,
  onStockSearch,
  onOpenSearchModal,
  isLoading
}: EmpresaTabProps) {
  // Safe destructuring with fallback
  const {
    description,
    sector,
    industry,
    ceo,
    website,
    fullTimeEmployees,
    country,
    city,
    state,
    address,
    ipoDate,
    image,
    exchange,
    currency,
    companyName
  } = stockBasicData || {};

  return (
    <div className="w-full h-full flex flex-col gap-1 p-1 overflow-hidden">
      <div className="flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
        {/* Overview Section */}
        <div className="shrink-0 w-full border border-zinc-800 overflow-hidden py-4 bg-tarjetas">
          <OverviewCard
              selectedStock={stockBasicData || symbol}
              onStockSearch={onStockSearch || (() => {})}
              onOpenSearchModal={onOpenSearchModal || (() => {})}
              isParentLoading={isLoading || false}
              analysisData={stockAnalysis}
          />
        </div>

        {stockBasicData && (
          <Card className="bg-tarjetas border-none shadow-none shrink-0 rounded-none">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-4">
                    {image && <img src={image} alt="Logo" className="w-12 h-12 rounded-md object-contain bg-white/5 p-1" />}
                    <div>
                        <CardTitle className="text-[#FFA028] text-xl">{companyName}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {sector && <Badge variant="outline" className="text-zinc-400 border-zinc-700">{sector}</Badge>}
                            {industry && <Badge variant="outline" className="text-zinc-400 border-zinc-700">{industry}</Badge>}
                            {country && <Badge variant="outline" className="text-zinc-400 border-zinc-700">{country}</Badge>}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-zinc-300">Descripción</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed text-justify">
                        {description || "No hay descripción disponible."}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-zinc-800 pt-4">
                    <InfoItem label="CEO" value={ceo} />
                    <InfoItem label="Empleados" value={fullTimeEmployees && parseInt(fullTimeEmployees).toLocaleString()} />
                    <InfoItem label="Website" value={website} isLink />
                    <InfoItem label="Fecha IPO" value={ipoDate} />
                    <InfoItem label="Exchange" value={exchange} />
                    <InfoItem label="Moneda" value={currency} />
                    <InfoItem label="Dirección" value={address} />
                    <InfoItem label="Ciudad / Estado" value={[city, state].filter(Boolean).join(', ')} />
                </div>
            </CardContent>
          </Card>
        )}

        {/* Peers Analysis Section */}
        <div className="shrink-0 h-[220px] border border-zinc-800 overflow-hidden">
            <PeersAnalysisPanel 
                symbol={symbol} 
                onPeerSelect={onPeerSelect}
                selectedPeer={selectedPeer}
            />
        </div>

        {/* Charts Section */}
        <div className="flex flex-col lg:flex-row w-full h-[350px] gap-1 shrink-0">
            <div className="w-full lg:w-3/5 h-full border border-zinc-800 bg-tarjetas overflow-hidden">
                <ChartsTabHistoricos
                    symbol={symbol}
                    companyName={companyName}
                    comparedSymbols={selectedPeer ? [selectedPeer] : []}
                />
            </div>
            <div className="w-full lg:w-2/5 h-full border border-zinc-800 bg-tarjetas overflow-hidden">
                <FGOSRadarChart 
                    symbol={symbol} 
                    data={stockAnalysis?.fgos_breakdown} 
                    comparedSymbol={selectedPeer}
                />
            </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, isLink = false }: { label: string, value?: string | number, isLink?: boolean }) {
    if (!value) return null;
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</span>
            {isLink ? (
                <a href={value as string} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline truncate">
                    {value}
                </a>
            ) : (
                <span className="text-sm text-zinc-300 truncate" title={String(value)}>{value}</span>
            )}
        </div>
    );
}

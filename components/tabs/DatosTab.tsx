import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosCard from "@/components/cards/DividendosCard";

interface DatosTabProps {
  stockAnalysis: any;
  stockPerformance: any;
  stockBasicData: any;
}

export default function DatosTab({ stockAnalysis, stockPerformance, stockBasicData }: DatosTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FundamentalCard stockBasicData={stockBasicData} />
      <ValoracionCard stockAnalysis={stockAnalysis} />
      <DesempenoCard stockPerformance={stockPerformance} />
      <DividendosCard stockAnalysis={stockAnalysis} />
    </div>
  );
}
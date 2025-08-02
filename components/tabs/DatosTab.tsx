import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosCard from "@/components/cards/DividendosCard";


interface DatosTabProps {
  stockAnalysis: any;
  stockPerformance: any;
  stockBasicData: any;
  stockReport?: any;
}

export default function DatosTab({ stockAnalysis, stockPerformance, stockBasicData, stockReport }: DatosTabProps) {
  return (
    <div className="flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FundamentalCard 
            stockBasicData={stockBasicData} 
            stockAnalysis={stockAnalysis} 
            stockReport={stockReport} 
          />
          <ValoracionCard 
            stockAnalysis={stockAnalysis} 
            stockBasicData={stockBasicData}
            stockReport={stockReport}
          />
          <DesempenoCard 
            stockPerformance={stockPerformance} 
            stockBasicData={stockBasicData}
            stockReport={stockReport}
          />
          <DividendosCard 
            stockAnalysis={stockAnalysis} 
            stockBasicData={stockBasicData}  // Asegúrate de que esta línea esté presente
            stockReport={stockReport}
          /> 
        </div>
      </div>
  );
}
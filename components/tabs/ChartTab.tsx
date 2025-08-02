import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RadarChart from "@/components/charts/RadarChart";

interface ChartTabProps {
  selectedStock: any;
  stockBasicData?: any;
  stockAnalysis?: any;
}

export default function ChartTab({ selectedStock, stockBasicData, stockAnalysis }: ChartTabProps) {
  return (
    <div className="space-y-6">
      {/* Main Chart */}
      <Card className="bg-gray-900/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 text-lg">Análisis Financiero Multidimensional</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div className="flex flex-col h-1/2 w-1/2">
                  <RadarChart 
                    stockBasicData={stockBasicData || selectedStock}
                    stockAnalysis={stockAnalysis}
                  />
                </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
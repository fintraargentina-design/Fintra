import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

interface DividendosCardProps {
  stockAnalysis: any;
}

export default function DividendosCard({ stockAnalysis }: DividendosCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-green-500/30 cursor-pointer transition-all duration-300 hover:border-[#00FF00] hover:shadow-lg hover:shadow-[#00FF00]/20">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Dividendos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Dividend Yield:</span>
                  <span className="text-green-400 font-mono">
                    {stockAnalysis?.dividend_yield ? `${stockAnalysis.dividend_yield.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Dividendo por acción (12M):</span>
                  <span className="text-blue-400 font-mono">
                    {stockAnalysis?.dividend_per_share_12m ? `$${stockAnalysis.dividend_per_share_12m.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Crecimiento 5 años:</span>
                  <span className={`font-mono ${
                    stockAnalysis?.dividend_growth_5y >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {stockAnalysis?.dividend_growth_5y ? `${stockAnalysis.dividend_growth_5y > 0 ? '+' : ''}${stockAnalysis.dividend_growth_5y.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Payout Ratio:</span>
                  <span className="text-yellow-400 font-mono">
                    {stockAnalysis?.payout_ratio ? `${stockAnalysis.payout_ratio.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Frecuencia de pago:</span>
                  <span className="text-purple-400 font-mono">
                    {stockAnalysis?.dividend_frequency || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Último pago:</span>
                  <span className="text-cyan-400 font-mono text-sm">
                    {stockAnalysis?.last_dividend_date && stockAnalysis?.last_dividend_amount 
                      ? `${stockAnalysis.last_dividend_date} - $${stockAnalysis.last_dividend_amount.toFixed(2)}` 
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-gray-900 border-green-500/30">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-2xl">Análisis de Dividendos Detallado</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="space-y-4">
            <h3 className="text-green-400 text-lg font-semibold">Rendimiento de Dividendos</h3>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Dividend Yield Actual:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockAnalysis?.dividend_yield ? `${stockAnalysis.dividend_yield.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Dividendo por Acción (12M):</span>
                <span className="text-blue-400 font-mono text-lg">
                  {stockAnalysis?.dividend_per_share_12m ? `$${stockAnalysis.dividend_per_share_12m.toFixed(2)}` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Crecimiento 5 Años:</span>
                <span className={`font-mono text-lg ${
                  stockAnalysis?.dividend_growth_5y >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stockAnalysis?.dividend_growth_5y ? `${stockAnalysis.dividend_growth_5y > 0 ? '+' : ''}${stockAnalysis.dividend_growth_5y.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Crecimiento 10 Años:</span>
                <span className={`font-mono text-lg ${
                  stockAnalysis?.dividend_growth_10y >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stockAnalysis?.dividend_growth_10y ? `${stockAnalysis.dividend_growth_10y > 0 ? '+' : ''}${stockAnalysis.dividend_growth_10y.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-green-400 text-lg font-semibold">Política de Dividendos</h3>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Payout Ratio:</span>
                <span className="text-yellow-400 font-mono text-lg">
                  {stockAnalysis?.payout_ratio ? `${stockAnalysis.payout_ratio.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Frecuencia de Pago:</span>
                <span className="text-purple-400 font-mono text-lg">
                  {stockAnalysis?.dividend_frequency || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Último Pago:</span>
                <span className="text-cyan-400 font-mono text-lg">
                  {stockAnalysis?.last_dividend_date && stockAnalysis?.last_dividend_amount 
                    ? `${stockAnalysis.last_dividend_date}` 
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Monto Último Pago:</span>
                <span className="text-cyan-400 font-mono text-lg">
                  {stockAnalysis?.last_dividend_amount 
                    ? `$${stockAnalysis.last_dividend_amount.toFixed(2)}` 
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
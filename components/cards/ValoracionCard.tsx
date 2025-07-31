import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

interface ValoracionCardProps {
  stockAnalysis: any;
}

export default function ValoracionCard({ stockAnalysis }: ValoracionCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-green-500/30 cursor-pointer transition-all duration-300 hover:border-[#00FF00] hover:shadow-lg hover:shadow-[#00FF00]/20">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Valoración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">P/E Ratio:</span>
                  <span className="text-green-400 font-mono">
                    {stockAnalysis?.pe_ratio || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">PEG Ratio:</span>
                  <span className="text-green-400 font-mono">
                    {stockAnalysis?.peg_ratio || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">P/BV Ratio:</span>
                  <span className="text-green-400 font-mono">
                    {stockAnalysis?.pbv_ratio || stockAnalysis?.pb_ratio || 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Valor Intrínseco Estimado:</span>
                  <span className="text-green-400 font-mono">
                    {stockAnalysis?.intrinsic_value ? `$${stockAnalysis.intrinsic_value}` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Market Cap:</span>
                  <span className="text-green-400 font-mono">
                    {stockAnalysis?.market_cap ? `$${(stockAnalysis.market_cap / 1000000000).toFixed(1)}B` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">EV/EBITDA:</span>
                  <span className="text-green-400 font-mono">
                    {stockAnalysis?.ev_ebitda || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-gray-900 border-green-500/30">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-2xl">Análisis de Valoración Detallado</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="space-y-4">
            <h3 className="text-green-400 text-lg font-semibold">Múltiplos de Valoración</h3>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Price to Earnings (P/E):</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockAnalysis?.pe_ratio || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">PEG Ratio:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockAnalysis?.peg_ratio || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Price to Book Value (P/BV):</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockAnalysis?.pbv_ratio || stockAnalysis?.pb_ratio || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">EV/EBITDA:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockAnalysis?.ev_ebitda || 'N/A'}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-green-400 text-lg font-semibold">Valoración y Capitalización</h3>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Market Capitalization:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockAnalysis?.market_cap ? `$${(stockAnalysis.market_cap / 1000000000).toFixed(1)}B` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Enterprise Value:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockAnalysis?.enterprise_value ? `$${(stockAnalysis.enterprise_value / 1000000000).toFixed(1)}B` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Valor Intrínseco Estimado:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockAnalysis?.intrinsic_value ? `$${stockAnalysis.intrinsic_value}` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Price to Sales (P/S):</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockAnalysis?.ps_ratio || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
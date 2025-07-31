import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

interface DesempenoCardProps {
  stockPerformance: any;
}

export default function DesempenoCard({ stockPerformance }: DesempenoCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-green-500/30 cursor-pointer transition-all duration-300 hover:border-[#00FF00] hover:shadow-lg hover:shadow-[#00FF00]/20">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Desempeño de la acción</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Precio actual:</span>
                  <span className="font-mono text-green-400">
                    {stockPerformance?.current_price ? `$${stockPerformance.current_price.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Beta:</span>
                  <span className="font-mono text-blue-400">
                    {stockPerformance?.beta ? stockPerformance.beta.toFixed(2) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rendimiento 1 año:</span>
                  <span className={`font-mono ${
                    stockPerformance?.year_return >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {stockPerformance?.year_return ? `${stockPerformance.year_return > 0 ? '+' : ''}${stockPerformance.year_return.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Rendimiento 5 años:</span>
                  <span className={`font-mono ${
                    stockPerformance?.five_year_return >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {stockPerformance?.five_year_return ? `${stockPerformance.five_year_return > 0 ? '+' : ''}${stockPerformance.five_year_return.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">52 sem. mín/máx:</span>
                  <span className="font-mono text-yellow-400">
                    {stockPerformance?.week_52_low && stockPerformance?.week_52_high 
                      ? `$${stockPerformance.week_52_low.toFixed(2)} / $${stockPerformance.week_52_high.toFixed(2)}` 
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Máximo histórico:</span>
                  <span className="font-mono text-purple-400">
                    {stockPerformance?.all_time_high ? `$${stockPerformance.all_time_high.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-gray-900 border-green-500/30">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-2xl">Análisis de Desempeño Detallado</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="space-y-4">
            <h3 className="text-green-400 text-lg font-semibold">Rendimiento Histórico</h3>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Rendimiento 1 Mes:</span>
                <span className={`font-mono text-lg ${
                  stockPerformance?.month_return >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stockPerformance?.month_return ? `${stockPerformance.month_return > 0 ? '+' : ''}${stockPerformance.month_return.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Rendimiento 3 Meses:</span>
                <span className={`font-mono text-lg ${
                  stockPerformance?.quarter_return >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stockPerformance?.quarter_return ? `${stockPerformance.quarter_return > 0 ? '+' : ''}${stockPerformance.quarter_return.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Rendimiento 1 Año:</span>
                <span className={`font-mono text-lg ${
                  stockPerformance?.year_return >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stockPerformance?.year_return ? `${stockPerformance.year_return > 0 ? '+' : ''}${stockPerformance.year_return.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Rendimiento 5 Años:</span>
                <span className={`font-mono text-lg ${
                  stockPerformance?.five_year_return >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stockPerformance?.five_year_return ? `${stockPerformance.five_year_return > 0 ? '+' : ''}${stockPerformance.five_year_return.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-green-400 text-lg font-semibold">Métricas de Riesgo y Precio</h3>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Precio Actual:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockPerformance?.current_price ? `$${stockPerformance.current_price.toFixed(2)}` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Beta (Riesgo Sistemático):</span>
                <span className="text-blue-400 font-mono text-lg">
                  {stockPerformance?.beta ? stockPerformance.beta.toFixed(2) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Rango 52 Semanas:</span>
                <span className="text-yellow-400 font-mono text-lg">
                  {stockPerformance?.week_52_low && stockPerformance?.week_52_high 
                    ? `$${stockPerformance.week_52_low.toFixed(2)} - $${stockPerformance.week_52_high.toFixed(2)}` 
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Máximo Histórico:</span>
                <span className="text-purple-400 font-mono text-lg">
                  {stockPerformance?.all_time_high ? `$${stockPerformance.all_time_high.toFixed(2)}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
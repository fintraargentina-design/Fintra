import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, Users, Building2, Calendar } from 'lucide-react';

interface OverviewCardProps {
  stockBasicData: any;
  stockAnalysis: any;
  selectedStock: any;
}

export default function OverviewCard({ stockBasicData, stockAnalysis, selectedStock }: OverviewCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Formatear números grandes
  const formatLargeNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num?.toFixed(2) || 'N/A'}`;
  };

  // Formatear porcentajes
  const formatPercentage = (value: number) => {
    if (value === undefined || value === null) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Datos principales para la vista resumida
  const overviewData = {
    marketCap: stockBasicData?.market_cap || stockAnalysis?.market_cap,
    peRatio: stockBasicData?.valoracion_pe || stockBasicData?.pe_ratio,
    dividendYield: Number(stockBasicData?.dividend_yield || stockBasicData?.datos?.dividendos?.dividendYield),
    beta: stockBasicData?.datos?.desempeno?.beta || stockAnalysis?.datos?.desempeno?.beta,
    eps: Number(stockBasicData?.datos?.valoracion?.eps || stockAnalysis?.datos?.valoracion?.eps),
    revenue: stockBasicData?.datos?.valoresHistoricos?.revenue?.[0]?.value || stockAnalysis?.datos?.valoresHistoricos?.revenue?.[0]?.value,
    employees: stockBasicData?.employees || stockAnalysis?.employees,
    founded: stockBasicData?.founded || stockAnalysis?.founded,
    sector: stockBasicData?.sector || stockAnalysis?.sector,
    industry: stockBasicData?.industry || stockAnalysis?.industry
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-green-500/30 cursor-pointer transition-all duration-300 hover:border-[#00FF00] hover:shadow-lg hover:shadow-[#00FF00]/20">
          <CardHeader>
            <CardTitle className="text-green-400 flex items-center justify-between">
                <span>{selectedStock.symbol} - {selectedStock.company_name || selectedStock.name}</span>
                <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold">${selectedStock.current_price || selectedStock.price}</span>
                {selectedStock.change !== undefined && (
                    <span className={`text-sm ${
                    selectedStock.change >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                    {formatPercentage(selectedStock.change)}
                    </span>
                )}
                </div>
            </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-400">Cap. Mercado:</span>
                    <span className="text-green-400 font-mono">
                    {overviewData.marketCap ? formatLargeNumber(overviewData.marketCap) : 'N/A'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">P/E:</span>
                    <span className="text-green-400 font-mono">
                    {overviewData.peRatio || 'N/A'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Div. Yield:</span>
                    <span className="text-green-400 font-mono">
                      {overviewData.dividendYield ? `${(overviewData.dividendYield * 100).toFixed(2)}%` : 'N/A'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Beta:</span>
                    <span className="text-green-400 font-mono">
                    {overviewData.beta || 'N/A'}
                    </span>
                </div>
                </div>
            </CardContent>
        </Card>
      </DialogTrigger>
      
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto bg-gray-900 border-green-500/30">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-xl mb-4 flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Resumen General - {selectedStock?.symbol || 'N/A'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Información Básica de la Empresa */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
            <h3 className="text-green-400 text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Información de la Empresa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Nombre:</span>
                  <span className="text-green-400 font-medium">
                    {selectedStock?.company_name || selectedStock?.name || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sector:</span>
                  <span className="text-green-400">
                    {overviewData.sector || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Industria:</span>
                  <span className="text-green-400">
                    {overviewData.industry || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fundada:</span>
                  <span className="text-green-400">
                    {overviewData.founded || 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Empleados:</span>
                  <span className="text-green-400">
                    {overviewData.employees ? overviewData.employees.toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sitio web:</span> 
                  <span className="text-green-400">
                    {selectedStock?.website ? (
                      <a 
                        href={selectedStock.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-green-300 underline"
                      >
                        {selectedStock.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Intercambio:</span>
                  <span className="text-green-400">
                    {selectedStock?.exchange || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">País:</span>
                  <span className="text-green-400">
                    {selectedStock?.country || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Métricas Financieras Clave */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
            <h3 className="text-green-400 text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Métricas Financieras Clave
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">Valoración</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cap. de Mercado:</span>
                    <span className="text-green-400 font-mono">
                      {overviewData.marketCap ? formatLargeNumber(overviewData.marketCap) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">P/E Ratio:</span>
                    <span className="text-green-400 font-mono">
                      {overviewData.peRatio || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">EPS:</span>
                    <span className="text-green-400 font-mono">
                      {overviewData.eps ? `$${overviewData.eps.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">Rendimiento</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Precio Actual:</span>
                    <span className="text-green-400 font-mono">
                      ${selectedStock?.current_price || selectedStock?.price || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cambio Diario:</span>
                    <span className={`font-mono ${
                      selectedStock?.change >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {selectedStock?.change !== undefined ? formatPercentage(selectedStock.change) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Beta:</span>
                    <span className="text-green-400 font-mono">
                      {overviewData.beta || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">Dividendos</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Dividend Yield:</span>
                    <span className="text-green-400 font-mono">
                      {overviewData.dividendYield ? `${(overviewData.dividendYield * 100).toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Ingresos:</span>
                    <span className="text-green-400 font-mono">
                      {overviewData.revenue ? formatLargeNumber(overviewData.revenue) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Descripción del Negocio */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
            <h3 className="text-green-400 text-lg font-semibold mb-3">Descripción del Negocio</h3>
            <p className="text-gray-200 text-sm leading-relaxed">
              {selectedStock?.description || stockAnalysis?.description || 
               'No hay descripción disponible para esta empresa.'}
            </p>
          </div>

          {/* Acciones */}
          {/* <div className="flex justify-end gap-4 pt-4 border-t border-gray-700/50">
            <button className="text-sm text-green-300 hover:underline transition-colors">
              Ver análisis completo
            </button>
            <button className="text-sm text-green-300 hover:underline transition-colors">
              Comparar con sector
            </button>
            <button className="text-sm text-green-300 hover:underline transition-colors">
              Ver noticias recientes
            </button>
          </div> */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
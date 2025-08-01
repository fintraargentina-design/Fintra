import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

interface FundamentalCardProps {
  stockBasicData: any;
  stockAnalysis?: any;
}

// Función para determinar el color del indicador
const getIndicatorColor = (indicator: string, value: number | string) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  switch (indicator) {
    case 'ROE':
      if (numValue >= 15) return 'text-green-400';
      if (numValue >= 10) return 'text-yellow-400';
      return 'text-red-400';
    case 'ROIC':
      if (numValue >= 15) return 'text-green-400';
      if (numValue >= 10) return 'text-yellow-400';
      return 'text-red-400';
    case 'Margen bruto':
      if (numValue >= 40) return 'text-green-400';
      if (numValue >= 25) return 'text-yellow-400';
      return 'text-red-400';
    case 'Margen neto':
      if (numValue >= 15) return 'text-green-400';
      if (numValue >= 8) return 'text-yellow-400';
      return 'text-red-400';
    case 'Deuda/Capital':
      if (numValue <= 0.4) return 'text-green-400';
      if (numValue <= 0.7) return 'text-yellow-400';
      return 'text-red-400';
    case 'Current Ratio':
      if (numValue >= 1.5) return 'text-green-400';
      if (numValue >= 1.0) return 'text-yellow-400';
      return 'text-red-400';
    case 'CAGR ingresos':
    case 'CAGR beneficios':
      if (numValue >= 10) return 'text-green-400';
      if (numValue >= 5) return 'text-yellow-400';
      return 'text-red-400';
    default:
      return 'text-green-400';
  }
};

// Función para obtener comentario del indicador
const getIndicatorComment = (indicator: string, value: number | string) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  switch (indicator) {
    case 'ROE':
      if (numValue >= 15) return 'Excelente (supera 15%)';
      if (numValue >= 10) return 'Bueno';
      return 'Débil';
    case 'ROIC':
      if (numValue >= 15) return 'Alta eficiencia';
      if (numValue >= 10) return 'Eficiencia moderada';
      return 'Baja eficiencia';
    case 'Margen bruto':
      if (numValue >= 40) return 'Muy saludable';
      if (numValue >= 25) return 'Aceptable';
      return 'Preocupante';
    case 'Margen neto':
      if (numValue >= 15) return 'Rentable';
      if (numValue >= 8) return 'Moderado';
      return 'Bajo';
    case 'Deuda/Capital':
      if (numValue <= 0.4) return 'Conservadora';
      if (numValue <= 0.7) return 'Moderada';
      return 'Alta';
    case 'Current Ratio':
      if (numValue >= 1.5) return 'Buena liquidez';
      if (numValue >= 1.0) return 'Liquidez justa';
      return 'Liquidez baja';
    case 'Free Cash Flow':
      return 'Genera caja';
    case 'CAGR ingresos':
      if (numValue >= 10) return 'Crecimiento constante';
      if (numValue >= 5) return 'Crecimiento moderado';
      return 'Crecimiento lento';
    case 'CAGR beneficios':
      if (numValue >= 10) return 'Bien sustentado';
      if (numValue >= 5) return 'Crecimiento moderado';
      return 'Crecimiento débil';
    default:
      return '';
  }
};

// Componente para fila de indicador
const IndicatorRow = ({ label, value, unit = '', comment }: {
  label: string;
  value: any;
  unit?: string;
  comment?: string;
}) => {
  const displayValue = value || 'N/A';
  const colorClass = value ? getIndicatorColor(label, value) : 'text-gray-400';
  const autoComment = value ? getIndicatorComment(label, value) : 'Sin datos';
  
  return (
    <tr className="border-b border-gray-700/50">
      <td className="py-3 px-4 text-gray-300">{label}</td>
      <td className={`py-3 px-4 font-mono text-lg ${colorClass}`}>
        {typeof displayValue === 'number' ? displayValue.toFixed(1) : displayValue}{unit}
      </td>
      <td className={`py-3 px-4 text-sm ${colorClass}`}>
        {comment || autoComment}
      </td>
    </tr>
  );
};

export default function FundamentalCard({ stockBasicData, stockAnalysis }: FundamentalCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-green-500/30 cursor-pointer transition-all duration-300 hover:border-[#00FF00] hover:shadow-lg hover:shadow-[#00FF00]/20">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Fundamental</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">ROE:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.roe ? `${stockBasicData.roe}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">ROIC:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.roic ? `${stockBasicData.roic}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Net Margin:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.net_margin ? `${stockBasicData.net_margin}%` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Debt/Equity:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.debt_equity ? stockBasicData.debt_equity : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Free Cash Flow:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.free_cash_flow ? `$${(stockBasicData.free_cash_flow / 1000000).toFixed(1)}M` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Gross Margin:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.gross_margin ? `${stockBasicData.gross_margin}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      
      <DialogContent className="max-w-5xl bg-gray-900 border-green-500/30 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-2xl">Análisis Fundamental Detallado</DialogTitle>
        </DialogHeader>

        {/* 1. RESUMEN EJECUTIVO */}
        <div className="mt-4 p-4 bg-gray-800/60 rounded-lg border border-green-500/20">
          <h3 className="text-green-400 text-lg font-semibold mb-2">Resumen Ejecutivo</h3>
          <p className="text-gray-200 text-sm leading-relaxed">
            {stockAnalysis?.resumen_fundamental || 
             "Empresa altamente rentable, con márgenes sólidos y crecimiento sostenido. Baja deuda. Buen punto de entrada si se mantiene el precio."}
          </p>
        </div>

        {/* 2. TABLA DE INDICADORES CLAVE */}
        <div className="mt-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4">Indicadores Clave</h3>
          
          {/* Leyenda de colores */}
          <div className="flex gap-6 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded"></div>
              <span className="text-gray-300">Excelente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded"></div>
              <span className="text-gray-300">A vigilar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-400 rounded"></div>
              <span className="text-gray-300">Débil</span>
            </div>
          </div>

          <div className="bg-gray-800/30 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Indicador</th>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Valor</th>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Comentario</th>
                </tr>
              </thead>
              <tbody>
                <IndicatorRow 
                  label="ROE" 
                  value={stockBasicData?.roe} 
                  unit="%" 
                />
                <IndicatorRow 
                  label="ROIC" 
                  value={stockBasicData?.roic} 
                  unit="%" 
                />
                <IndicatorRow 
                  label="Margen bruto" 
                  value={stockBasicData?.gross_margin} 
                  unit="%" 
                />
                <IndicatorRow 
                  label="Margen neto" 
                  value={stockBasicData?.net_margin} 
                  unit="%" 
                />
                <IndicatorRow 
                  label="Deuda/Capital" 
                  value={stockBasicData?.debt_equity} 
                />
                <IndicatorRow 
                  label="Current Ratio" 
                  value={stockBasicData?.current_ratio} 
                />
                <IndicatorRow 
                  label="Free Cash Flow" 
                  value={stockBasicData?.free_cash_flow ? (stockBasicData.free_cash_flow / 1000000).toFixed(0) : null} 
                  unit=" $M" 
                />
                <IndicatorRow 
                  label="CAGR ingresos" 
                  value={stockBasicData?.revenue_growth_5y} 
                  unit="%" 
                />
                <IndicatorRow 
                  label="CAGR beneficios" 
                  value={stockBasicData?.earnings_growth_5y} 
                  unit="%" 
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. INTERPRETACIÓN AUTOMÁTICA (IA) */}
        <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/20">
          <h3 className="text-blue-400 text-lg font-semibold mb-2">Interpretación Automática (IA)</h3>
          <p className="text-gray-200 text-sm leading-relaxed italic">
            {stockAnalysis?.interpretacion_ia || 
             "La empresa genera retornos muy altos sobre su capital y mantiene márgenes operativos consistentes. Su nivel de endeudamiento es bajo, lo cual le otorga resiliencia."}
          </p>
        </div>

        {/* ACCIONES OPCIONALES */}
        <div className="mt-6 flex justify-end gap-4 pt-4 border-t border-gray-700/50">
          <button className="text-sm text-green-300 hover:underline transition-colors">
            Ver análisis completo
          </button>
          <button className="text-sm text-green-300 hover:underline transition-colors">
            Comparar con competidores
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
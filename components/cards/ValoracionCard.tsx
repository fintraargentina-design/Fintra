import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

interface ValoracionCardProps {
  stockAnalysis: any;
  stockBasicData: any;
  stockReport?: any;
}

// Función para determinar el color del indicador
const getIndicatorColor = (indicator: string, value: number | string) => {
  const numValue = typeof value === 'string' ? parseFloat(value.toString().replace('%', '')) : value;
  
  switch (indicator) {
    case 'P/E (PER)':
      if (numValue <= 15) return 'text-green-400';
      if (numValue <= 25) return 'text-yellow-400';
      return 'text-red-400';
    case 'PEG':
      if (numValue <= 1) return 'text-green-400';
      if (numValue <= 1.5) return 'text-yellow-400';
      return 'text-red-400';
    case 'P/Book (P/B)':
      if (numValue <= 1.5) return 'text-green-400';
      if (numValue <= 3) return 'text-yellow-400';
      return 'text-red-400';
    case 'P/FCF':
      if (numValue <= 15) return 'text-green-400';
      if (numValue <= 25) return 'text-yellow-400';
      return 'text-red-400';
    case 'Dividend Yield':
      if (numValue >= 2) return 'text-green-400';
      if (numValue >= 1) return 'text-yellow-400';
      return 'text-red-400';
    case 'Crecimiento implícito':
      if (numValue >= 7) return 'text-green-400';
      if (numValue >= 4) return 'text-yellow-400';
      return 'text-red-400';
    default:
      return 'text-green-400';
  }
};

// Función para obtener comentario del indicador
const getIndicatorComment = (indicator: string, value: number | string) => {
  const numValue = typeof value === 'string' ? parseFloat(value.toString().replace('%', '')) : value;
  
  switch (indicator) {
    case 'P/E (PER)':
      if (numValue <= 15) return 'Atractivo (menor a 20)';
      if (numValue <= 25) return 'Aceptable';
      return 'Caro (mayor a 25)';
    case 'PEG':
      if (numValue <= 1) return 'Subvalorado';
      if (numValue <= 1.5) return 'Justo';
      return 'Sobrevalorado';
    case 'P/Book (P/B)':
      if (numValue <= 1.5) return 'Atractivo';
      if (numValue <= 3) return 'Aceptable';
      return 'Caro';
    case 'P/FCF':
      if (numValue <= 15) return 'Atractivo';
      if (numValue <= 25) return 'Aceptable';
      return 'Caro';
    case 'Dividend Yield':
      if (numValue >= 2) return 'Atractivo';
      if (numValue >= 1) return 'Aceptable';
      return 'Bajo';
    case 'Crecimiento implícito':
      if (numValue >= 7) return 'Alto';
      if (numValue >= 4) return 'Moderado';
      return 'Bajo';
    default:
      return 'N/A';
  }
};

// Componente IndicatorRow
const IndicatorRow = ({ label, value, unit = '', comment }: {
  label: string;
  value: any;
  unit?: string;
  comment?: string;
}) => {
  const displayValue = value === 'N/A' ? 'N/A' : `${value}${unit}`;
  const colorClass = value === 'N/A' ? 'text-gray-400' : getIndicatorColor(label, value);
  const evaluationText = comment || (value === 'N/A' ? 'N/A' : getIndicatorComment(label, value));
  
  return (
    <tr className="border-b border-gray-700/30">
      <td className="py-3 px-4 text-gray-200">{label}</td>
      <td className={`py-3 px-4 font-mono ${colorClass}`}>{displayValue}</td>
      <td className={`py-3 px-4 text-sm ${colorClass}`}>{evaluationText}</td>
    </tr>
  );
};

export default function ValoracionCard({ stockAnalysis, stockBasicData, stockReport }: ValoracionCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Usar los campos procesados directamente o acceder al objeto datos
  const valoracionData = {
    pe: stockBasicData?.valoracion_pe || stockBasicData?.datos?.valoracion?.pe,
    peg: stockBasicData?.valoracion_peg || stockBasicData?.datos?.valoracion?.peg,
    pbv: stockBasicData?.valoracion_pbv || stockBasicData?.datos?.valoracion?.pbv,
    impliedGrowth: stockBasicData?.valoracion_implied_growth || stockBasicData?.datos?.valoracion?.impliedGrowth
  };
  
  const dividendYield = stockBasicData?.dividend_yield || stockBasicData?.datos?.dividendos?.dividendYield;
  
  // Calcular P/FCF (MarketCap / FreeCashFlow)
  const marketCap = stockBasicData?.market_cap;
  const freeCashFlow = stockBasicData?.free_cash_flow || stockBasicData?.datos?.fundamentales?.freeCashFlow;
  const pFCF = (marketCap && freeCashFlow && freeCashFlow !== 0) 
    ? (marketCap / freeCashFlow).toFixed(2) 
    : 'N/A';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-green-500/30 hover:border-green-400/50 transition-all duration-300 cursor-pointer group">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-400 text-lg group-hover:text-green-300 transition-colors">
              Valoración
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">P/E (PER):</span>
                <span className={`font-mono ${getIndicatorColor('P/E (PER)', valoracionData.pe || 'N/A')}`}>
                  {valoracionData.pe || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">PEG:</span>
                <span className={`font-mono ${getIndicatorColor('PEG', valoracionData.peg || 'N/A')}`}>
                  {valoracionData.peg || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">P/Book (P/B):</span>
                <span className={`font-mono ${getIndicatorColor('P/Book (P/B)', valoracionData.pbv || 'N/A')}`}>
                  {valoracionData.pbv || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">P/FCF:</span>
                <span className={`font-mono ${getIndicatorColor('P/FCF', pFCF || 'N/A')}`}>
                  {pFCF || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dividend Yield:</span>
                <span className={`font-mono ${getIndicatorColor('Dividend Yield', dividendYield ? parseFloat(dividendYield) * 100 : 'N/A')}`}>
                  {dividendYield ? `${(parseFloat(dividendYield) * 100).toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Crecimiento implícito:</span>
                <span className={`font-mono ${getIndicatorColor('Crecimiento implícito', valoracionData.impliedGrowth ? parseFloat(valoracionData.impliedGrowth) * 100 : 'N/A')}`}>
                  {valoracionData.impliedGrowth ? `${(parseFloat(valoracionData.impliedGrowth) * 100).toFixed(2)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      
      <DialogContent className="max-w-5xl bg-gray-900 border-green-500/30 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-2xl">Análisis de Valoración Detallado</DialogTitle>
        </DialogHeader>

        {/* 1. RESUMEN EJECUTIVO */}
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-green-400 text-lg font-semibold mb-2">Resumen Ejecutivo</h3>
          <p className="text-gray-200 text-sm leading-relaxed">
            {stockAnalysis?.resumen_valoracion || 
             "La acción parece subvaluada en relación a sus ganancias y flujo de caja, con múltiplos atractivos frente a su promedio histórico y sector."}
          </p>
        </div>

        {/* 2. TABLA DE MÚLTIPLOS CLAVE */}
        <div className="mt-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4">Múltiplos Clave</h3>
          
          {/* Leyenda de colores */}
          <div className="flex gap-6 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded"></div>
              <span className="text-gray-300">Bueno</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded"></div>
              <span className="text-gray-300">Neutral</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-400 rounded"></div>
              <span className="text-gray-300">Negativo</span>
            </div>
          </div>

          <div className="bg-gray-800/30 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Indicador</th>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Valor</th>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Evaluación</th>
                </tr>
              </thead>
              <tbody>
                <IndicatorRow 
                  label="P/E (PER)" 
                  value={valoracionData.pe || 'N/A'} 
                />
                <IndicatorRow 
                  label="PEG" 
                  value={valoracionData.peg || 'N/A'} 
                />
                <IndicatorRow 
                  label="P/Book (P/B)" 
                  value={valoracionData.pbv || 'N/A'} 
                />
                <IndicatorRow 
                  label="P/FCF" 
                  value={pFCF} 
                />
                <IndicatorRow 
                  label="Dividend Yield" 
                  value={dividendYield ? `${(parseFloat(dividendYield) * 100).toFixed(2)}%` : 'N/A'} 
                />
                <IndicatorRow 
                  label="Crecimiento implícito" 
                  value={valoracionData.impliedGrowth ? `${(parseFloat(valoracionData.impliedGrowth) * 100).toFixed(2)}%` : 'N/A'} 
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. INTERPRETACIÓN AUTOMÁTICA (IA) */}
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-blue-400 text-lg font-semibold mb-2">Interpretación Automática (IA)</h3>
          <p className="text-gray-200 text-sm leading-relaxed italic">
            {stockReport?.analisisValoracion?.["Conclusión para inversores"] || "No hay datos suficientes"}
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

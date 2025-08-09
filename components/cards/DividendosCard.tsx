import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

interface DividendosCardProps {
  stockAnalysis: any;
  stockBasicData: any;
  stockReport: any; // Agregar esta prop
}

export default function DividendosCard({ stockAnalysis, stockBasicData, stockReport }: DividendosCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Extraer datos de dividendos
  const dividendos = stockBasicData?.datos?.dividendos || {};
  const dividendYieldRaw = stockBasicData?.dividend_yield ?? stockBasicData?.datos?.dividendos?.dividendYield;
  const dividendYield = dividendYieldRaw !== undefined && dividendYieldRaw !== null ? Number(dividendYieldRaw) : null;
  
  // Función para formatear valores
  const formatValue = (field: string, value: any) => {
    if (value === null || value === undefined) return "N/A";
    
    switch (field) {
      case 'dividendYield':
        const yieldValue = Number(value) * 100;
        return `${yieldValue.toFixed(2)}%`;
      case 'dividendPerShare':
        return `$${Number(value).toFixed(2)}`;
      case 'frequency':
        return String(value);
      case 'payoutRatio':
      case 'fcfPayoutRatio':
        return `${Math.round(Number(value))}%`;
      case 'growth5Y':
        const num = Number(value);
        return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
      case 'ultimoPago':
        return value?.date || "N/A";
      default:
        return String(value);
    }
  };

  // Función para obtener el color del indicador de dividendos
  function getDividendColor(metric: string, value: number | string): string {
    switch (metric) {
      case 'dividend_yield':
        if (typeof value === 'number') {
          if (value >= 3) return 'text-green-400'; // Fuerte
          if (value >= 1.5) return 'text-yellow-400'; // Neutral
          return 'text-red-400'; // Débil
        }
        break;
      case 'payout_ratio':
        if (typeof value === 'number') {
          if (value <= 50) return 'text-green-400'; // Sano
          if (value <= 70) return 'text-yellow-400'; // Neutral
          return 'text-red-400'; // Alto riesgo
        }
        break;
      case 'fcf_payout_ratio':
        if (typeof value === 'number') {
          if (value <= 40) return 'text-green-400'; // Sustentable
          if (value <= 60) return 'text-yellow-400'; // Neutral
          return 'text-red-400'; // Riesgoso
        }
        break;
      case 'dividend_growth':
        if (typeof value === 'number') {
          if (value >= 5) return 'text-green-400'; // En expansión
          if (value >= 0) return 'text-yellow-400'; // Estable
          return 'text-red-400'; // Decreciente
        }
        break;
      default:
        return 'text-green-400';
    }
    return 'text-gray-400';
  }

  // Función para obtener el comentario del indicador de dividendos
  function getDividendComment(metric: string, value: number | string): string {
    switch (metric) {
      case 'dividend_yield':
        if (typeof value === 'number') {
          if (value >= 3) return 'Atractivo';
          if (value >= 1.5) return 'Interesante (superior a inflación)';
          return 'Bajo';
        }
        break;
      case 'dividend_per_share':
        return 'Consistente';
      case 'frequency':
        return 'Ideal para ingresos regulares';
      case 'payout_ratio':
        if (typeof value === 'number') {
          if (value <= 50) return 'Sano (menos del 50%)';
          if (value <= 70) return 'Moderado';
          return 'Alto riesgo';
        }
        break;
      case 'fcf_payout_ratio':
        if (typeof value === 'number') {
          if (value <= 40) return 'Sustentable';
          if (value <= 60) return 'Aceptable';
          return 'Riesgoso';
        }
        break;
      case 'dividend_growth':
        if (typeof value === 'number') {
          if (value >= 5) return 'En expansión';
          if (value >= 0) return 'Estable';
          return 'Decreciente';
        }
        break;
      case 'last_payment':
        return 'Reciente';
      default:
        return 'N/A';
    }
    return 'N/A';
  }

  // Componente para las filas de la tabla de dividendos
  function DividendRow({ 
    label, 
    value, 
    metric, 
    icon 
  }: { 
    label: string; 
    value: string; 
    metric: string; 
    icon: string; 
  }) {
    const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
    const colorClass = getDividendColor(metric, numericValue);
    const comment = getDividendComment(metric, numericValue);
    
    return (
      <tr className="border-b border-gray-700/50">
        <td className="py-3 px-4 text-gray-300">{label}</td>
        <td className={`py-3 px-4 font-mono text-lg ${colorClass}`}>
          {value}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <span className={`text-sm ${colorClass}`}>
              {comment}
            </span>
          </div>
        </td>
      </tr>
    );
  }

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
                    {dividendYield !== null ? `${(dividendYield * 100).toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Dividendo anual por acción:</span>
                  <span className="text-blue-400 font-mono">
                    {dividendos.dividendPerShare !== null ? `${dividendos.dividendPerShare}` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Crecimiento 5 años:</span>
                  <span className={`font-mono ${
                    stockAnalysis?.dividend_growth_5y >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {dividendos.growth5Y !== null ? `${dividendos.growth5Y }` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Payout Ratio:</span>
                  <span className="text-yellow-400 font-mono">
                    {dividendos.payoutRatio !== null ? `${dividendos.payoutRatio }` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Frecuencia de pago:</span>
                  <span className="text-purple-400 font-mono">
                    {dividendos.frequency !== null ? `${dividendos.frequency}` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Último pago:</span>
                  <span className="text-cyan-400 font-mono text-sm">
                    {dividendos?.ultimoPago?.date && dividendos?.ultimoPago?.amount
                      ? `${dividendos.ultimoPago.date} - $${Number(dividendos.ultimoPago.amount).toFixed(2)}`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gray-900 border-green-500/30">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-2xl">Análisis de Dividendos Detallado</DialogTitle>
        </DialogHeader>
        
        {/* Resumen Ejecutivo */}
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-green-400 text-lg font-semibold mb-2 flex items-center gap-2">
            Resumen Ejecutivo
          </h3>
          <p className="text-gray-200 text-sm leading-relaxed">
            {stockReport?.analisisDividendos?.["Resumen Ejecutivo"] || "N/A"}
          </p>
        </div>

        {/* Tabla de Métricas Clave */}
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-6 mb-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4 flex items-center gap-2">
            Métricas Clave de Dividendos
          </h3>
          
          {/* Leyenda de colores */}
          <div className="flex gap-6 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-400">Fuerte</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-gray-400">Neutral</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-400">Débil</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Indicador</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Valor</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Evaluación</th>
                </tr>
              </thead>
              <tbody>
                <DividendRow 
                  label="Dividend Yield" 
                  value={formatValue('dividendYield', dividendYield)} 
                  metric="dividend_yield" 
                  icon="💵" 
                />
                <DividendRow 
                  label="Dividendo por acción" 
                  value={formatValue('dividendPerShare', dividendos.dividendPerShare)} 
                  metric="dividend_per_share" 
                  icon="💵" 
                />
                <DividendRow 
                  label="Frecuencia" 
                  value={formatValue('frequency', dividendos.frequency)} 
                  metric="frequency" 
                  icon="💵" 
                />
                <DividendRow 
                  label="Payout Ratio (%)" 
                  value={formatValue('payoutRatio', dividendos.payoutRatio)} 
                  metric="payout_ratio" 
                  icon="💵" 
                />
                <DividendRow 
                  label="FCF Payout Ratio (%)" 
                  value={formatValue('fcfPayoutRatio', dividendos.fcfPayoutRatio)} 
                  metric="fcf_payout_ratio" 
                  icon="💵" 
                />
                <DividendRow 
                  label="Crecimiento 5 años" 
                  value={formatValue('growth5Y', dividendos.growth5Y)} 
                  metric="dividend_growth" 
                  icon="💵" 
                />
                <DividendRow 
                  label="Último pago" 
                  value={formatValue('ultimoPago', dividendos.ultimoPago)} 
                  metric="last_payment" 
                  icon="💵" 
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* Interpretación de IA */}
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-blue-400 text-lg font-semibold mb-2 flex items-center gap-2">
            Interpretación Automática (IA)
          </h3>
          <p className="text-gray-200 text-sm leading-relaxed italic">
            {stockReport?.analisisDividendos?.analisisDividendos?.["Conclusión para inversores"] || "No hay datos suficientes"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
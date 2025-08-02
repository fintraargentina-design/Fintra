import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

interface DesempenoCardProps {
  stockPerformance: any;
  stockBasicData: any; // Agregar esta prop
  stockReport: any;
}

// Función para determinar el color del indicador de rendimiento
const getPerformanceColor = (indicator: string, value: number | string) => {
  const numValue = typeof value === 'string' ? parseFloat(value.toString().replace('%', '')) : value;
  
  switch (indicator) {
    case '1 mes':
      if (numValue >= 3) return 'text-green-400';
      if (numValue >= -3) return 'text-yellow-400';
      return 'text-red-400';
    case '3 meses':
      if (numValue >= 8) return 'text-green-400';
      if (numValue >= -5) return 'text-yellow-400';
      return 'text-red-400';
    case '1 año':
      if (numValue >= 15) return 'text-green-400';
      if (numValue >= -10) return 'text-yellow-400';
      return 'text-red-400';
    case 'YTD (año actual)':
      if (numValue >= 15) return 'text-green-400';
      if (numValue >= -5) return 'text-yellow-400';
      return 'text-red-400';
    case '3 años':
      if (numValue >= 30) return 'text-green-400';
      if (numValue >= -15) return 'text-yellow-400';
      return 'text-red-400';
    case '5 años':
      if (numValue >= 50) return 'text-green-400';
      if (numValue >= -25) return 'text-yellow-400';
      return 'text-red-400';
    default:
      return 'text-green-400';
  }
};

// Función para obtener comentario del indicador de rendimiento
const getPerformanceComment = (indicator: string, value: number | string) => {
  const numValue = typeof value === 'string' ? parseFloat(value.toString().replace('%', '')) : value;
  
  switch (indicator) {
    case '1 mes':
      if (numValue >= 5) return 'Fuerte recuperación';
      if (numValue >= 0) return 'Tendencia positiva';
      if (numValue >= -5) return 'Corrección leve';
      if (numValue >= -15) return 'Caída moderada';
      return 'Caída abrupta';
    case '3 meses':
      if (numValue >= 10) return 'Crecimiento sostenido';
      if (numValue >= 0) return 'Tendencia alcista';
      if (numValue >= -10) return 'Volatilidad normal';
      return 'Tendencia bajista';
    case 'YTD (año actual)':
      if (numValue >= 15) return 'Excelente desempeño anual';
      if (numValue >= 5) return 'Buen rendimiento';
      if (numValue >= 0) return 'Estabilidad';
      if (numValue >= -10) return 'Año difícil';
      return 'Año muy negativo';
    case '1 año':
      if (numValue >= 20) return 'Rendimiento excepcional';
      if (numValue >= 10) return 'Buen desempeño';
      if (numValue >= 0) return 'Rendimiento positivo';
      if (numValue >= -20) return 'Año complicado';
      return 'Pérdidas significativas';
    case '3 años':
      if (numValue >= 40) return 'Crecimiento excepcional a largo plazo';
      if (numValue >= 15) return 'Buen crecimiento sostenido';
      if (numValue >= 0) return 'Crecimiento moderado';
      if (numValue >= -30) return 'Período desafiante';
      return 'Declive prolongado';
    case '5 años':
      if (numValue >= 60) return 'Inversión extraordinaria';
      if (numValue >= 25) return 'Sólido crecimiento histórico';
      if (numValue >= 0) return 'Estabilidad a largo plazo';
      if (numValue >= -40) return 'Período muy difícil';
      return 'Declive severo histórico';
    default:
      return 'Análisis en progreso';
  }
};

// Función para obtener ícono de tendencia
const getTrendIcon = (value: number) => {
  return value >= 0 ? '📈' : '📉';
};

// Función para determinar el color de las métricas de riesgo
const getRiskColor = (indicator: string, value: number | string) => {
  if (value === 'N/A' || value === 'Dato no disponible') return 'text-gray-400';
  
  const numValue = typeof value === 'string' ? parseFloat(value.toString()) : value;
  
  switch (indicator) {
    case 'Volatilidad 1 año (%)':
      return 'text-gray-400'; // Dato no disponible
    case 'Beta':
      if (numValue >= 0.8 && numValue <= 1.2) return 'text-yellow-400'; // Similar al mercado
      if (numValue < 0.8) return 'text-green-400'; // Estable
      return 'text-red-400'; // Volátil
    case 'Máxima caída 1 año':
      if (numValue > -15) return 'text-green-400'; // Controlada
      if (numValue >= -30) return 'text-yellow-400'; // Volátil
      return 'text-red-400'; // Riesgosa
    default:
      return 'text-gray-400';
  }
};

const getRiskComment = (indicator: string, value: number | string) => {
  if (value === 'N/A' || value === 'Dato no disponible') return 'Datos no disponibles';
  
  const numValue = typeof value === 'string' ? parseFloat(value.toString()) : value;
  
  switch (indicator) {
    case 'Volatilidad 1 año (%)':
      return 'Datos no disponibles';
    case 'Beta':
      if (numValue >= 0.8 && numValue <= 1.2) return 'Similar al mercado';
      if (numValue < 0.8) return 'Estable';
      return 'Volátil';
    case 'Máxima caída 1 año':
      if (numValue > -15) return 'Controlada';
      if (numValue >= -30) return 'Volátil';
      return 'Riesgosa';
    default:
      return 'Análisis en progreso';
  }
};

// Componente para fila de rendimiento
const PerformanceRow = ({ label, value, unit = '%', comment }: {
  label: string;
  value: any;
  unit?: string;
  comment?: string;
}) => {
  const displayValue = value || 'N/A';
  const colorClass = value ? getPerformanceColor(label, value) : 'text-gray-400';
  const autoComment = value ? getPerformanceComment(label, value) : 'Sin datos';
  const icon = typeof value === 'number' ? getTrendIcon(value) : '';
  
  return (
    <tr className="border-b border-gray-700/50">
      <td className="py-3 px-4 text-gray-300">{label}</td>
      <td className={`py-3 px-4 font-mono text-lg ${colorClass}`}>
        {icon} {typeof displayValue === 'number' ? `${displayValue > 0 ? '+' : ''}${displayValue.toFixed(1)}` : displayValue}{unit}
      </td>
      <td className={`py-3 px-4 text-sm ${colorClass}`}>
        {comment || autoComment}
      </td>
    </tr>
  );
};

// Componente para fila de riesgo
const RiskRow = ({ label, value, unit = '', comment }: {
  label: string;
  value: any;
  unit?: string;
  comment?: string;
}) => {
  const displayValue = value || 'N/A';
  const colorClass = value ? getRiskColor(label, value) : 'text-gray-400';
  const autoComment = value ? getRiskComment(label, value) : 'Sin datos';
  
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

export default function DesempenoCard({ stockPerformance, stockBasicData, stockReport }: DesempenoCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Extraer datos de performance desde stockBasicData.datos.desempeno.performance
  const performanceData = stockBasicData?.datos?.desempeno?.performance || {};
  const desempenoData = stockBasicData?.datos?.desempeno || {};
  
  // Calcular métricas de riesgo
  const beta = parseFloat(desempenoData.beta || '0');
  const low52w = parseFloat(desempenoData.low52w || '0');
  const high52w = parseFloat(desempenoData.high52w || '0');
  
  // Calcular máxima caída 1 año
  const maxDrawdown = high52w > 0 ? ((low52w - high52w) / high52w * 100) : null;
  
  console.log('Performance data from desempeno.performance:', performanceData);
  console.log('Desempeno data:', desempenoData);
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-green-500/30 cursor-pointer transition-all duration-300 hover:border-[#00FF00] hover:shadow-lg hover:shadow-[#00FF00]/20">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Desempeño</CardTitle>
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
      
      <DialogContent className="max-w-5xl bg-gray-900 border-green-500/30 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-2xl">Análisis de Desempeño Detallado</DialogTitle>
        </DialogHeader>

        {/* 1. RESUMEN EJECUTIVO */}
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-green-400 text-lg font-semibold mb-2">Resumen Ejecutivo</h3>
          <p className="text-gray-200 text-sm leading-relaxed">
            {stockPerformance?.resumen_desempeno || 
             "La acción ha mostrado un rendimiento superior al mercado en el último año, con una tendencia positiva sostenida y baja volatilidad relativa."}
          </p>
        </div>

        {/* 2. TABLA DE RETORNOS POR PERÍODO */}
        <div className="mt-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4">Retornos por Período</h3>
          
          {/* Leyenda de colores */}
          <div className="flex gap-6 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded"></div>
              <span className="text-gray-300">Positivo</span>
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
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Período</th>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Rendimiento</th>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Evaluación</th>
                </tr>
              </thead>
              <tbody>
                <PerformanceRow 
                  label="1 mes" 
                  value={performanceData["1M"]}
                />
                <PerformanceRow 
                  label="3 meses" 
                  value={performanceData["3M"]}
                />
                <PerformanceRow 
                  label="YTD (año actual)" 
                  value={performanceData["YTD"]}
                />
                <PerformanceRow 
                  label="1 año" 
                  value={performanceData["1Y"]}
                />
                <PerformanceRow 
                  label="3 años" 
                  value={performanceData["3Y"]}
                />
                <PerformanceRow 
                  label="5 años" 
                  value={performanceData["5Y"]}
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. VOLATILIDAD Y RIESGO RELATIVO */}
        <div className="mt-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4">Volatilidad y Riesgo Relativo</h3>
          
          <div className="bg-gray-800/30 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Métrica</th>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Valor</th>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Comentario</th>
                </tr>
              </thead>
              <tbody>
                <RiskRow 
                  label="Volatilidad 1 año (%)" 
                  value="Dato no disponible"
                  unit=""
                />
                <RiskRow 
                  label="Beta" 
                  value={beta || 'N/A'}
                  unit=""
                />
                <RiskRow 
                  label="Máxima caída 1 año" 
                  value={maxDrawdown ? maxDrawdown.toFixed(1) : 'N/A'}
                  unit="%" 
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. INTERPRETACIÓN AUTOMÁTICA (IA) */}
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-blue-400 text-lg font-semibold mb-2">Interpretación Automática (IA)</h3>
          <p className="text-gray-200 text-sm leading-relaxed italic">
            {stockReport?.analisisDesempeno?.["Conclusión para inversores"] || "No hay datos suficientes"}
          </p>
        </div>

        {/* ACCIONES OPCIONALES */}
        <div className="mt-6 flex justify-end gap-4 pt-4 border-t border-gray-700/50">
          <button className="text-sm text-green-300 hover:underline transition-colors">
            Ver análisis completo
          </button>
          <button className="text-sm text-green-300 hover:underline transition-colors">
            Comparar con índices
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
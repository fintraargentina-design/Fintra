import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getStockAnalysisData } from "@/lib/stockQueries";
import { useState } from "react";

interface FundamentalCardProps {
  stockBasicData: any;
  stockAnalysis: any;
  stockReport?: any;
}

// --- Helpers de validación y parseo ---
const isValidValue = (val: any) => {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") {
    return val.trim() !== "" && val.toLowerCase() !== "n/a" && val !== "-";
  }
  if (typeof val === "number") return !isNaN(val);
  return false;
};

const parseValue = (val: any) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^\d.-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? val : parsed;
  }
  return val;
};

// --- Color por indicador ---
const getIndicatorColor = (indicator: string, value: number | string) => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  switch (indicator) {
    case "ROE":
      if (numValue >= 15) return "text-green-400";
      if (numValue >= 10) return "text-yellow-400";
      return "text-red-400";

    case "ROIC":
      if (numValue >= 12) return "text-green-400";
      if (numValue >= 8) return "text-yellow-400";
      return "text-red-400";

    case "Margen bruto":
    case "Margen neto":
      if (numValue >= 20) return "text-green-400";
      if (numValue >= 10) return "text-yellow-400";
      return "text-red-400";

    case "Deuda/Capital":
      if (numValue <= 0.3) return "text-green-400";
      if (numValue <= 0.6) return "text-yellow-400";
      return "text-red-400";

    case "Current Ratio":
      if (numValue >= 2) return "text-green-400";
      if (numValue >= 1.2) return "text-yellow-400";
      return "text-red-400";

    case "CAGR ingresos":
    case "CAGR beneficios":
      if (numValue >= 15) return "text-green-400";
      if (numValue >= 5) return "text-yellow-400";
      return "text-red-400";

    case 'Flujo de Caja Libre':
      if (numValue < 0) return 'text-red-400';
      if (numValue >= 1000) return 'text-green-400'; // >= $1B
      if (numValue >= 100) return 'text-yellow-400';  // >= $100M
      if (numValue > 0) return 'text-blue-400';       // Positivo pero bajo
      return 'text-red-400';                          // Negativo

    default:
      return "text-gray-300";
  }
};

// --- Comentario por indicador ---
const getIndicatorComment = (indicator: string, value: number | string) => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  switch (indicator) {
    case "ROE":
      if (numValue >= 15) return "Excelente";
      if (numValue >= 10) return "Bueno";
      return "Bajo";

    case "ROIC":
      if (numValue >= 12) return "Excelente";
      if (numValue >= 8) return "Bueno";
      return "Bajo";

    case "Margen bruto":
    case "Margen neto":
      if (numValue >= 20) return "Alto";
      if (numValue >= 10) return "Moderado";
      return "Bajo";

    case "Deuda/Capital":
      if (numValue <= 0.3) return "Conservador";
      if (numValue <= 0.6) return "Moderado";
      return "Alto riesgo";

    case "Current Ratio":
      if (numValue >= 2) return "Sólido";
      if (numValue >= 1.2) return "Aceptable";
      return "Riesgo";

    case "CAGR ingresos":
    case "CAGR beneficios":
      if (numValue >= 15) return "Crecimiento alto";
      if (numValue >= 5) return "Crecimiento moderado";
      return "Crecimiento bajo";

    case "Flujo de Caja Libre":
    case "Free Cash Flow":
      if (numValue >= 1000) return "Excelente generación";
      if (numValue >= 100) return "Buena generación";
      if (numValue > 0) return "Generación positiva";
      return "Flujo negativo";

    default:
      return "";
  }
};

const formatFCF = (value: any) => {
  if (!isValidValue(value)) return "N/A";
  const numValue = parseValue(value) / 1_000_000; // Convertir a millones

  const isNegative = numValue < 0;
  const absValue = Math.abs(numValue);

  let formatted = "";
  if (absValue >= 1000) {
    formatted = `${isNegative ? "-$" : "$"}${(absValue / 1000).toFixed(1)}B`;
  } else {
    formatted = `${isNegative ? "-$" : "$"}${absValue.toFixed(1)}M`;
  }

  return formatted;
};

// --- Fila de indicador en tabla modal ---
const IndicatorRow = ({
  label,
  value,
  unit = "",
  comment,
}: {
  label: string;
  value: any;
  unit?: string;
  comment?: string;
}) => {
  const hasValue = isValidValue(value);
  const parsedValue = hasValue ? parseValue(value) : null;
  const displayValue = hasValue ? parsedValue : "N/A";
  const colorClass = hasValue ? getIndicatorColor(label, parsedValue!) : "text-gray-400";
  const autoComment = hasValue ? getIndicatorComment(label, parsedValue!) : "Sin datos";

  return (
    <tr className="border-b border-gray-700/50">
      <td className="py-3 px-4 text-gray-300">{label}</td>
      <td className={`py-3 px-4 font-mono text-lg ${colorClass}`}>
        {hasValue && typeof parsedValue === "number" ? parsedValue.toFixed(1) : (displayValue as any)}
        {hasValue ? unit : ""}
      </td>
      <td className={`py-3 px-4 text-sm ${colorClass}`}>
        {comment || autoComment}
      </td>
    </tr>
  );
};

export default function FundamentalCard({ stockBasicData, stockAnalysis, stockReport }: FundamentalCardProps) {
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
                  <span
                    className={`font-mono ${
                      isValidValue(stockBasicData?.roe)
                        ? getIndicatorColor("ROE", parseValue(stockBasicData.roe))
                        : "text-gray-400"
                    }`}
                  >
                    {isValidValue(stockBasicData?.roe) ? `${parseValue(stockBasicData.roe)}%` : "N/A"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">ROIC:</span>
                  <span
                    className={`font-mono ${
                      isValidValue(stockBasicData?.roic)
                        ? getIndicatorColor("ROIC", parseValue(stockBasicData.roic))
                        : "text-gray-400"
                    }`}
                  >
                    {isValidValue(stockBasicData?.roic) ? `${parseValue(stockBasicData.roic)}%` : "N/A"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Margen neto:</span>
                  <span
                    className={`font-mono ${
                      isValidValue(stockBasicData?.net_margin)
                        ? getIndicatorColor("Margen neto", parseValue(stockBasicData.net_margin))
                        : "text-gray-400"
                    }`}
                  >
                    {isValidValue(stockBasicData?.net_margin) ? `${parseValue(stockBasicData.net_margin)}%` : "N/A"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Deuda/Capital:</span>
                  <span
                    className={`font-mono ${
                      isValidValue(stockBasicData?.debt_equity)
                        ? getIndicatorColor("Deuda/Capital", parseValue(stockBasicData.debt_equity))
                        : "text-gray-400"
                    }`}
                  >
                    {isValidValue(stockBasicData?.debt_equity) ? parseValue(stockBasicData.debt_equity) : "N/A"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Flujo de Caja Libre:</span>
                  <span
                    className={`font-mono ${
                      isValidValue(stockBasicData?.free_cash_flow)
                        ? getIndicatorColor("Flujo de Caja Libre", parseValue(stockBasicData.free_cash_flow) / 1_000_000)
                        : "text-gray-400"
                    }`}
                  >
                    {formatFCF(stockBasicData?.free_cash_flow)}
                  </span>
                </div>  

                <div className="flex justify-between">
                  <span className="text-gray-400">Margen bruto:</span>
                  <span
                    className={`font-mono ${
                      isValidValue(stockBasicData?.gross_margin)
                        ? getIndicatorColor("Margen bruto", parseValue(stockBasicData.gross_margin))
                        : "text-gray-400"
                    }`}
                  >
                    {isValidValue(stockBasicData?.gross_margin) ? `${parseValue(stockBasicData.gross_margin)}%` : "N/A"}
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
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-green-400 text-lg font-semibold mb-2">Resumen Ejecutivo</h3>
          <p className="text-gray-200 text-sm leading-relaxed">
            {stockReport?.analisisFundamental?.["Resumen Ejecutivo"] || "N/A"}
          </p>
        </div>

        {/* 2. TABLA DE INDICADORES CLAVE */}
        <div className="mt-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4">Indicadores Clave</h3>

          {/* Leyenda de colores */}
          <div className="flex gap-6 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded" />
              <span className="text-gray-300">Excelente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded" />
              <span className="text-gray-300">A vigilar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-400 rounded" />
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
                <IndicatorRow label="ROE" value={stockBasicData?.roe} unit="%" />
                <IndicatorRow label="ROIC" value={stockBasicData?.roic} unit="%" />
                <IndicatorRow label="Margen bruto" value={stockBasicData?.gross_margin} unit="%" />
                <IndicatorRow label="Margen neto" value={stockBasicData?.net_margin} unit="%" />
                <IndicatorRow label="Deuda/Capital" value={stockBasicData?.debt_equity} />
                <IndicatorRow label="Current Ratio" value={stockBasicData?.current_ratio} />
                <IndicatorRow
                  label="Flujo de Caja Libre"
                  value={
                    isValidValue(stockBasicData?.free_cash_flow)
                      ? formatFCF(stockBasicData.free_cash_flow)
                      : null
                  }
                  unit=" $M"
                />
                <IndicatorRow
                  label="CAGR ingresos"
                  value={
                    stockBasicData?.datos?.valoracion?.revenueCAGR?.value ||
                    stockBasicData?.datos?.valoracion?.revenueCAGR?.value
                  }
                  unit="%"
                />
                <IndicatorRow
                  label="CAGR beneficios"
                  value={
                    stockBasicData?.datos?.valoracion?.netIncomeCAGR?.value ||
                    stockBasicData?.datos?.valoracion?.netIncomeCAGR?.value
                  }
                  unit="%"
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. INTERPRETACIÓN AUTOMÁTICA (IA) */}
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-blue-400 text-lg font-semibold mb-2">Interpretación Automática (IA)</h3>
          <p className="text-gray-300 leading-relaxed">
            {stockReport?.analisisFundamental?.["Conclusión para inversores"] || "No hay datos suficientes"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

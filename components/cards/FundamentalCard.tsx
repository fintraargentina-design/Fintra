import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMemo, useState } from "react";

/** 
 * Props:
 * - stockAnalysis puede venir del agregador: getAllCardsData(symbol)
 *   => stockAnalysis.cards.fundamental.indicadores.*
 * - Conservamos compatibilidad con tu objeto anterior (stockBasicData)
 */
interface FundamentalCardProps {
  stockBasicData?: any;
  stockAnalysis?: any;  // ideal: salida de getAllCardsData
  stockReport?: any;
}

/* =========================
   Helpers de validación/parseo
   ========================= */
const isValidValue = (val: any) => {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (!s || s === "n/a" || s === "-") return false;
    const n = Number(val.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n);
  }
  if (typeof val === "number") return Number.isFinite(val);
  return false;
};

const parseValue = (val: any): number | null => {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^\d.-]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const fmtPercent = (v?: number | null, d = 1) =>
  v === null || v === undefined ? "N/A" : `${(v as number).toFixed(d)}%`;

const fmtRatio = (v?: number | null, d = 2) =>
  v === null || v === undefined ? "N/A" : (v as number).toFixed(d);

const formatFCFCompact = (raw?: number | null) => {
  if (!Number.isFinite(raw as number)) return "N/A";
  const n = raw as number;
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(1)}T`;
  if (a >= 1e9)  return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6)  return `${sign}$${(a / 1e6).toFixed(1)}M`;
  return `${sign}$${a.toFixed(0)}`;
};

/* =========================
   Colores y comentarios por indicador
   ========================= */
const getIndicatorColor = (indicator: string, value: number) => {
  switch (indicator) {
    case "ROE":
      return value >= 15 ? "text-green-400" : value >= 10 ? "text-yellow-400" : "text-red-400";
    case "ROIC":
      return value >= 12 ? "text-green-400" : value >= 8 ? "text-yellow-400" : "text-red-400";
    case "Margen bruto":
    case "Margen neto":
      return value >= 20 ? "text-green-400" : value >= 10 ? "text-yellow-400" : "text-red-400";
    case "Deuda/Capital":
      return value <= 0.3 ? "text-green-400" : value <= 0.6 ? "text-yellow-400" : "text-red-400";
    case "Cobertura de intereses":
      return value >= 8 ? "text-green-400" : value >= 4 ? "text-yellow-400" : "text-red-400";
    case "Current Ratio":
      return value >= 2 ? "text-green-400" : value >= 1.2 ? "text-yellow-400" : "text-red-400";
    case "CAGR ingresos":
    case "CAGR beneficios":
    case "CAGR patrimonio":
      return value >= 15 ? "text-green-400" : value >= 5 ? "text-yellow-400" : "text-red-400";
    case "Flujo de Caja Libre":
      return value < 0 ? "text-red-400" : value >= 1e9 ? "text-green-400" : value >= 1e8 ? "text-yellow-400" : "text-blue-400";
    default:
      return "text-gray-300";
  }
};

const getIndicatorComment = (indicator: string, value: number) => {
  switch (indicator) {
    case "ROE":
    case "ROIC":
      return value >= 12 ? "Excelente" : value >= 8 ? "Bueno" : "Bajo";
    case "Margen bruto":
    case "Margen neto":
      return value >= 20 ? "Alto" : value >= 10 ? "Moderado" : "Bajo";
    case "Deuda/Capital":
      return value <= 0.3 ? "Conservador" : value <= 0.6 ? "Moderado" : "Alto riesgo";
    case "Cobertura de intereses":
      return value >= 8 ? "Sólida" : value >= 4 ? "Aceptable" : "Riesgosa";
    case "Current Ratio":
      return value >= 2 ? "Sólido" : value >= 1.2 ? "Aceptable" : "Riesgo";
    case "CAGR ingresos":
    case "CAGR beneficios":
    case "CAGR patrimonio":
      return value >= 15 ? "Crecimiento alto" : value >= 5 ? "Crecimiento moderado" : "Crecimiento bajo";
    case "Flujo de Caja Libre":
      return value >= 1e9 ? "Excelente generación" : value >= 1e8 ? "Buena generación" : value > 0 ? "Positiva" : "Negativa";
    default:
      return "";
  }
};

/* =========================
   Fila de tabla
   ========================= */
function IndicatorRow({
  label,
  rawValue,
  render,
  unit,
}: {
  label: string;
  rawValue: any;
  render?: (n: number) => string; // para formatos custom (ej: FCF compacto)
  unit?: string;
}) {
  const has = isValidValue(rawValue);
  const n = has ? parseValue(rawValue)! : null;
  const isNum = typeof n === "number" && Number.isFinite(n as number);
  const color = isNum ? getIndicatorColor(label, n as number) : "text-gray-400";
  const comment = isNum ? getIndicatorComment(label, n as number) : "Sin datos";

  return (
    <tr className="border-b border-gray-700/50">
      <td className="py-3 px-4 text-gray-300">{label}</td>
      <td className={`py-3 px-4 font-mono text-lg ${color}`}>
        {!isNum
          ? "N/A"
          : render
          ? render(n as number)
          : unit === "%"
          ? fmtPercent(n, 1)
          : unit === "x"
          ? `${fmtRatio(n, 2)}x`
          : unit === "$"
          ? formatFCFCompact(n)
          : fmtRatio(n, 2)}
      </td>
      <td className={`py-3 px-4 text-sm ${color}`}>{comment}</td>
    </tr>
  );
}

/* =========================
   Normalización de entrada
   ========================= */
function useNormalizedData(stockBasicData?: any, stockAnalysis?: any) {
  // Agregador (preferido)
  const agg = stockAnalysis?.cards?.fundamental?.indicadores;

  // Fallback a tu estructura anterior (stockBasicData)
  const data = {
    roe: agg?.ROE ?? stockBasicData?.roe ?? null,                           // %
    roic: agg?.ROIC ?? stockBasicData?.roic ?? null,                        // %
    grossMargin: agg?.grossMargin ?? stockBasicData?.gross_margin ?? null,  // %
    netMargin: agg?.netMargin ?? stockBasicData?.net_margin ?? null,        // %
    debtToEquity: agg?.debtToEquity ?? stockBasicData?.debt_equity ?? null, // ratio
    currentRatio: agg?.currentRatio ?? stockBasicData?.current_ratio ?? null, // ratio
    interestCoverage: agg?.interestCoverage ?? stockBasicData?.interest_coverage ?? null, // x
    freeCashFlow: agg?.freeCashFlow ?? stockBasicData?.free_cash_flow ?? null, // $
    revenueCAGR_5Y:
      agg?.revenueCAGR_5Y ??
      stockBasicData?.datos?.valoracion?.revenueCAGR?.value ??
      null, // %
    netIncomeCAGR_5Y:
      agg?.netIncomeCAGR_5Y ??
      stockBasicData?.datos?.valoracion?.netIncomeCAGR?.value ??
      null, // %
    equityCAGR_5Y: agg?.equityCAGR_5Y ?? stockBasicData?.equity_cagr_5y ?? null, // %
    bookValuePerShare:
      agg?.bookValuePerShare ?? stockBasicData?.book_value_per_share ?? null, // $
    sharesOutstanding:
      agg?.sharesOutstanding ?? stockBasicData?.shares_outstanding ?? null, // #
  };

  // Calidad (para badge si quisieras)
  const availableCount = Object.values(data).filter(isValidValue).length;
  const quality =
    availableCount >= 10 ? "Excelente" : availableCount >= 7 ? "Buena" : availableCount >= 4 ? "Regular" : "Limitada";

  return { data, quality };
}

/* =========================
   Componente principal
   ========================= */
export default function FundamentalCard({ stockBasicData, stockAnalysis, stockReport }: FundamentalCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data, quality } = useNormalizedData(stockBasicData, stockAnalysis);

  // KPIs rápidos para la card
  const quick = useMemo(() => {
    return [
      { label: "ROE", value: data.roe, unit: "%", colorKey: "ROE" },
      { label: "ROIC", value: data.roic, unit: "%", colorKey: "ROIC" },
      { label: "Margen neto", value: data.netMargin, unit: "%", colorKey: "Margen neto" },
      { label: "Deuda/Capital", value: data.debtToEquity, unit: "x", colorKey: "Deuda/Capital" },
      { label: "FCF", value: data.freeCashFlow, unit: "$", colorKey: "Flujo de Caja Libre" },
      { label: "Margen bruto", value: data.grossMargin, unit: "%", colorKey: "Margen bruto" },
    ];
  }, [data]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-green-500/30 cursor-pointer transition-all duration-300 hover:border-[#00FF00] hover:shadow-lg hover:shadow-[#00FF00]/20">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Fundamental</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {quick.map((kpi) => {
                const n = parseValue(kpi.value);
                const color = Number.isFinite(n as number)
                  ? getIndicatorColor(kpi.label, n as number)
                  : "text-gray-400";
                const display =
                  !Number.isFinite(n as number)
                    ? "N/A"
                    : kpi.unit === "%"
                    ? fmtPercent(n, 1)
                    : kpi.unit === "x"
                    ? `${fmtRatio(n, 2)}x`
                    : kpi.unit === "$"
                    ? formatFCFCompact(n)
                    : fmtRatio(n, 2);

                return (
                  <div key={kpi.label} className="flex justify-between">
                    <span className="text-gray-400">{kpi.label}:</span>
                    <span className={`font-mono ${color}`}>{display}</span>
                  </div>
                );
              })}
              {/* Badge de calidad simple */}
              <div className="col-span-2 flex justify-end">
                <span className="text-xs px-2 py-1 rounded bg-emerald-900/30 border border-emerald-500/30 text-emerald-300">
                  Datos: {quality}
                </span>
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

          {/* Leyenda */}
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
                <IndicatorRow label="ROE" rawValue={data.roe} unit="%" />
                <IndicatorRow label="ROIC" rawValue={data.roic} unit="%" />
                <IndicatorRow label="Margen bruto" rawValue={data.grossMargin} unit="%" />
                <IndicatorRow label="Margen neto" rawValue={data.netMargin} unit="%" />
                <IndicatorRow label="Deuda/Capital" rawValue={data.debtToEquity} unit="x" />
                <IndicatorRow label="Current Ratio" rawValue={data.currentRatio} unit="x" />
                <IndicatorRow label="Cobertura de intereses" rawValue={data.interestCoverage} unit="x" />
                <IndicatorRow
                  label="Flujo de Caja Libre"
                  rawValue={data.freeCashFlow}
                  unit="$"
                />
                <IndicatorRow label="CAGR ingresos" rawValue={data.revenueCAGR_5Y} unit="%" />
                <IndicatorRow label="CAGR beneficios" rawValue={data.netIncomeCAGR_5Y} unit="%" />
                <IndicatorRow label="CAGR patrimonio" rawValue={data.equityCAGR_5Y} unit="%" />
                <IndicatorRow
                  label="Book Value por acción"
                  rawValue={data.bookValuePerShare}
                  render={(n) => `$${n.toFixed(2)}`}
                />
                <IndicatorRow
                  label="Acciones en circulación"
                  rawValue={data.sharesOutstanding}
                  render={(n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(2)}M`)}
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

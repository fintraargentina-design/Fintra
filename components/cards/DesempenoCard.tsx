import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMemo, useState } from "react";

interface DesempenoCardProps {
  stockPerformance?: any;
  stockBasicData?: any;
  stockAnalysis?: any;
  stockReport?: any;
}

/* =========================
   Helpers
   ========================= */
const num = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const pct = (v: number | null, d = 1) => (v == null ? "N/A" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`);
const money = (v: number | null) => (v == null ? "N/A" : `$${v.toFixed(2)}`);
const rangeText = (lo: number | null, hi: number | null) =>
  lo != null && hi != null ? `$${lo.toFixed(2)} / $${hi.toFixed(2)}` : "N/A";

const perfColor = (label: string, v: number | null) => {
  if (v == null) return "text-gray-400";
  switch (label) {
    case "1 mes":        return v >= 3 ? "text-green-400" : v >= -3 ? "text-yellow-400" : "text-red-400";
    case "3 meses":      return v >= 8 ? "text-green-400" : v >= -5 ? "text-yellow-400" : "text-red-400";
    case "YTD":          return v >= 15 ? "text-green-400" : v >= -5 ? "text-yellow-400" : "text-red-400";
    case "1 año":        return v >= 15 ? "text-green-400" : v >= -10 ? "text-yellow-400" : "text-red-400";
    case "3 años":       return v >= 30 ? "text-green-400" : v >= -15 ? "text-yellow-400" : "text-red-400";
    case "5 años":       return v >= 50 ? "text-green-400" : v >= -25 ? "text-yellow-400" : "text-red-400";
    case "Rel. S&P 1Y":  return v >= 0 ? "text-green-400" : "text-red-400";
    case "Rel. Nasdaq 1Y": return v >= 0 ? "text-green-400" : "text-red-400";
    default: return "text-gray-300";
  }
};
const perfComment = (label: string, v: number | null) => {
  if (v == null) return "Sin datos";
  switch (label) {
    case "1 mes":   return v >= 5 ? "Fuerte recuperación" : v >= 0 ? "Tendencia positiva" : v >= -5 ? "Corrección leve" : "Caída";
    case "3 meses": return v >= 10 ? "Crecimiento sostenido" : v >= 0 ? "Tendencia alcista" : v >= -10 ? "Volatilidad normal" : "Bajista";
    case "YTD":     return v >= 15 ? "Excelente año" : v >= 5 ? "Buen rendimiento" : v >= 0 ? "Estable" : v >= -10 ? "Año difícil" : "Muy negativo";
    case "1 año":   return v >= 20 ? "Excepcional" : v >= 10 ? "Buen desempeño" : v >= 0 ? "Positivo" : v >= -20 ? "Complicado" : "Pérdidas fuertes";
    case "3 años":  return v >= 40 ? "Gran crecimiento" : v >= 15 ? "Sostenido" : v >= 0 ? "Moderado" : v >= -30 ? "Desafiante" : "Declive";
    case "5 años":  return v >= 60 ? "Extraordinario" : v >= 25 ? "Sólido" : v >= 0 ? "Estable" : v >= -40 ? "Muy difícil" : "Declive severo";
    case "Rel. S&P 1Y":
    case "Rel. Nasdaq 1Y":
      return v >= 0 ? "Supera al índice" : "Bajo el índice";
    default: return "—";
  }
};

const riskColor = (label: string, v: number | null) => {
  if (v == null) return "text-gray-400";
  switch (label) {
    case "Beta":              return v < 0.8 ? "text-green-400" : v <= 1.2 ? "text-yellow-400" : "text-red-400";
    case "Volatilidad 1Y":    return v < 25 ? "text-green-400" : v <= 40 ? "text-yellow-400" : "text-red-400";
    case "Máxima caída 1Y":   // v es negativa (drawdown)
      return v > -15 ? "text-green-400" : v >= -30 ? "text-yellow-400" : "text-red-400";
    case "Distancia SMA 200": // positiva (por encima) suele ser bueno, muy negativa malo
      return v >= 0 ? "text-green-400" : v > -10 ? "text-yellow-400" : "text-red-400";
    default: return "text-gray-300";
  }
};
const riskComment = (label: string, v: number | null) => {
  if (v == null) return "Datos no disponibles";
  switch (label) {
    case "Beta":              return v < 0.8 ? "Más estable que el mercado" : v <= 1.2 ? "Similar al mercado" : "Más volátil que el mercado";
    case "Volatilidad 1Y":    return v < 25 ? "Volatilidad contenida" : v <= 40 ? "Volatilidad media" : "Alta volatilidad";
    case "Máxima caída 1Y":   return v > -15 ? "Drawdown controlado" : v >= -30 ? "Volátil" : "Riesgoso";
    case "Distancia SMA 200": return v >= 0 ? "Por encima de tendencia" : "Por debajo de tendencia";
    default: return "—";
  }
};

function PerfRow({label, value}:{label:string; value:number|null}) {
  return (
    <tr className="border-b border-gray-700/50">
      <td className="py-3 px-4 text-gray-300">{label}</td>
      <td className={`py-3 px-4 font-mono text-lg ${perfColor(label, value)}`}>{pct(value)}</td>
      <td className={`py-3 px-4 text-sm ${perfColor(label, value)}`}>{perfComment(label, value)}</td>
    </tr>
  );
}
function RiskRow({label, value, unit='%' }:{label:string; value:number|null; unit?:string}) {
  const show = value == null ? "N/A" : unit === "%" ? `${value.toFixed(1)}%` : value.toFixed(2);
  return (
    <tr className="border-b border-gray-700/50">
      <td className="py-3 px-4 text-gray-300">{label}</td>
      <td className={`py-3 px-4 font-mono text-lg ${riskColor(label, value)}`}>{show}</td>
      <td className={`py-3 px-4 text-sm ${riskColor(label, value)}`}>{riskComment(label, value)}</td>
    </tr>
  );
}

/* =========================
   Normalización (prefiere stockAnalysis.cards.*)
   ========================= */
function useNormalized(perf?: any, basic?: any, analysis?: any) {
  const A = analysis || {};
  const cards = A.cards || {};
  const P = cards.performance || {};
  const T = cards.technical || {};
  const B = cards.benchmarks || {};
  const D = (basic?.datos?.desempeno || {}) as Record<string, any>;
  const DP = (basic?.datos?.desempeno?.performance || {}) as Record<string, any>;

  // Precio actual (si no viene, usar de basic o de la prop stockPerformance)
  const price =
    num(A?.price) ??
    num(basic?.price) ??
    num(basic?.datos?.precio?.price) ??
    num(perf?.current_price) ??
    null;

  // Retornos
  const r1m = num(P?.returnsPct?.["1M"]) ?? num(DP["1M"]) ?? num(D?.["1M"]) ?? null;
  const r3m = num(P?.returnsPct?.["3M"]) ?? num(DP["3M"]) ?? num(D?.["3M"]) ?? null;
  const rYTD = num(P?.returnsPct?.["YTD"]) ?? num(DP["YTD"]) ?? num(D?.YTD) ?? null;
  const r1y = num(P?.returnsPct?.["1Y"]) ?? num(DP["1Y"]) ?? num(D?.["1Y"]) ?? null;
  const r3y = num(P?.returnsPct?.["3Y"]) ?? num(DP["3Y"]) ?? num(D?.["3Y"]) ?? null;
  const r5y = num(P?.returnsPct?.["5Y"]) ?? num(DP["5Y"]) ?? num(D?.["5Y"]) ?? null;

  // Riesgo
  const beta = num(P?.beta) ?? num(D?.beta) ?? null;
  const vol1y = num(P?.volatility1yPct) ?? num(D?.volatility1yPct) ?? null;

  // 52w range y drawdown
  const low52w = num(P?.low52w) ?? num(D?.low52w) ?? null;
  const high52w = num(P?.high52w) ?? num(D?.high52w) ?? null;

  // drawdown directo si lo provee el agregador; sino por 52w
  const dd1y =
    num(P?.drawdown1yPct) ??
    (low52w != null && high52w != null && high52w > 0 ? ((low52w - high52w) / high52w) * 100 : null);

  // Técnicos: SMA 20/50/200 y distancia (%)
  const sma20 = num(T?.sma20) ?? num(D?.sma20) ?? null;
  const sma50 = num(T?.sma50) ?? num(D?.sma50) ?? null;
  const sma200 = num(T?.sma200) ?? num(D?.sma200) ?? null;
  const distSMA20 = price && sma20 ? ((price - sma20) / sma20) * 100 : null;
  const distSMA50 = price && sma50 ? ((price - sma50) / sma50) * 100 : null;
  const distSMA200 = price && sma200 ? ((price - sma200) / sma200) * 100 : null;

  // Benchmarks relativos (si existen)
  const relSP1y = num(B?.relative1yVsSPX) ?? null;     // +% vs S&P 500
  const relNDX1y = num(B?.relative1yVsNDX) ?? null;    // +% vs Nasdaq

  return {
    price,
    returns: { r1m, r3m, rYTD, r1y, r3y, r5y },
    risk:   { beta, vol1y, dd1y },
    range:  { low52w, high52w },
    tech:   { sma20, sma50, sma200, distSMA20, distSMA50, distSMA200 },
    rel:    { relSP1y, relNDX1y },
  };
}

/* =========================
   Componente principal
   ========================= */
export default function DesempenoCard({ stockPerformance, stockBasicData, stockAnalysis, stockReport }: DesempenoCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const data = useMemo(
    () => useNormalized(stockPerformance, stockBasicData, stockAnalysis),
    [stockPerformance, stockBasicData, stockAnalysis]
  );

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
                  <span className="font-mono text-green-400">{money(data.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Beta:</span>
                  <span className={`font-mono ${riskColor("Beta", data.risk.beta)}`}>
                    {data.risk.beta == null ? "N/A" : data.risk.beta.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rend. 1 año:</span>
                  <span className={`font-mono ${perfColor("1 año", data.returns.r1y)}`}>{pct(data.returns.r1y)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Rend. YTD:</span>
                  <span className={`font-mono ${perfColor("YTD", data.returns.rYTD)}`}>{pct(data.returns.rYTD)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">52s mín/máx:</span>
                  <span className="font-mono text-yellow-400">
                    {rangeText(data.range.low52w, data.range.high52w)}
                  </span>
                </div>
                {data.tech.sma200 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Distancia SMA 200:</span>
                    <span className={`font-mono ${riskColor("Distancia SMA 200", data.tech.distSMA200)}`}>
                      {pct(data.tech.distSMA200)}
                    </span>
                  </div>
                )}
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
            {stockReport?.analisisDesempeno?.["Resumen Ejecutivo"] || "N/A"}
          </p>
        </div>

        {/* 2. RETORNOS POR PERÍODO */}
        <div className="mt-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4">Retornos por Período</h3>

          {/* Leyenda */}
          <div className="flex gap-6 mb-4 text-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-400 rounded" /><span className="text-gray-300">Positivo</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-400 rounded" /><span className="text-gray-300">Neutral</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-400 rounded" /><span className="text-gray-300">Negativo</span></div>
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
                <PerfRow label="1 mes" value={data.returns.r1m} />
                <PerfRow label="3 meses" value={data.returns.r3m} />
                <PerfRow label="YTD" value={data.returns.rYTD} />
                <PerfRow label="1 año" value={data.returns.r1y} />
                <PerfRow label="3 años" value={data.returns.r3y} />
                <PerfRow label="5 años" value={data.returns.r5y} />
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. VOLATILIDAD Y RIESGO */}
        <div className="mt-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4">Volatilidad y Riesgo</h3>
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
                <RiskRow label="Beta" value={data.risk.beta} unit="" />
                <RiskRow label="Volatilidad 1Y" value={data.risk.vol1y} />
                <RiskRow label="Máxima caída 1Y" value={data.risk.dd1y} />
                {data.tech.distSMA200 != null && (
                  <RiskRow label="Distancia SMA 200" value={data.tech.distSMA200} />
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. BENCHMARKS RELATIVOS (si existen) */}
        {(data.rel.relSP1y != null || data.rel.relNDX1y != null) && (
          <div className="mt-6">
            <h3 className="text-green-400 text-lg font-semibold mb-4">Desempeño Relativo vs. Índices</h3>
            <div className="bg-gray-800/30 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="py-3 px-4 text-left text-green-400 font-semibold">Comparativa</th>
                    <th className="py-3 px-4 text-left text-green-400 font-semibold">Diferencial</th>
                    <th className="py-3 px-4 text-left text-green-400 font-semibold">Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rel.relSP1y != null && (
                    <tr className="border-b border-gray-700/50">
                      <td className="py-3 px-4 text-gray-300">Rel. S&P 1Y</td>
                      <td className={`py-3 px-4 font-mono text-lg ${perfColor("Rel. S&P 1Y", data.rel.relSP1y)}`}>
                        {pct(data.rel.relSP1y)}
                      </td>
                      <td className={`py-3 px-4 text-sm ${perfColor("Rel. S&P 1Y", data.rel.relSP1y)}`}>
                        {perfComment("Rel. S&P 1Y", data.rel.relSP1y)}
                      </td>
                    </tr>
                  )}
                  {data.rel.relNDX1y != null && (
                    <tr className="border-b border-gray-700/50">
                      <td className="py-3 px-4 text-gray-300">Rel. Nasdaq 1Y</td>
                      <td className={`py-3 px-4 font-mono text-lg ${perfColor("Rel. Nasdaq 1Y", data.rel.relNDX1y)}`}>
                        {pct(data.rel.relNDX1y)}
                      </td>
                      <td className={`py-3 px-4 text-sm ${perfColor("Rel. Nasdaq 1Y", data.rel.relNDX1y)}`}>
                        {perfComment("Rel. Nasdaq 1Y", data.rel.relNDX1y)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. INTERPRETACIÓN IA */}
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-4 mt-6">
          <h3 className="text-blue-400 text-lg font-semibold mb-2">Interpretación Automática (IA)</h3>
          <p className="text-gray-200 text-sm leading-relaxed italic">
            {stockReport?.analisisDesempeno?.["Conclusión para inversores"] || "No hay datos suficientes"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

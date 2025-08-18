import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMemo, useState } from "react";

interface DividendosCardProps {
  stockAnalysis?: any;
  stockBasicData?: any;
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
const pct = (v: number | null, d = 2) => (v == null ? "N/A" : `${v.toFixed(d)}%`);
const money = (v: number | null, d = 2) => (v == null ? "N/A" : `$${v.toFixed(d)}`);

const colorScale = (metric: string, v: number | null) => {
  if (v == null) return "text-gray-400";
  switch (metric) {
    case "yield":
      return v >= 3 ? "text-green-400" : v >= 1.5 ? "text-yellow-400" : "text-red-400";
    case "payout":
      return v <= 50 ? "text-green-400" : v <= 70 ? "text-yellow-400" : "text-red-400";
    case "payoutFCF":
      return v <= 40 ? "text-green-400" : v <= 60 ? "text-yellow-400" : "text-red-400";
    case "growth":
      return v >= 5 ? "text-green-400" : v >= 0 ? "text-yellow-400" : "text-red-400";
    case "coverage": // veces (x)
      return v >= 2 ? "text-green-400" : v >= 1 ? "text-yellow-400" : "text-red-400";
    default:
      return "text-gray-300";
  }
};

const safetyBadge = (payoutE: number | null, payoutFCF: number | null, streak: number | null) => {
  const okPayout = (payoutE != null && payoutE <= 65) || (payoutFCF != null && payoutFCF <= 60);
  const medPayout =
    (payoutE != null && payoutE <= 75) || (payoutFCF != null && payoutFCF <= 70);
  const longStreak = (streak ?? 0) >= 10;
  const midStreak = (streak ?? 0) >= 5;

  if (okPayout && (longStreak || midStreak)) return { label: "Alta", cls: "bg-green-600 text-white" };
  if (medPayout && midStreak) return { label: "Media", cls: "bg-yellow-600 text-white" };
  return { label: "Baja", cls: "bg-red-600 text-white" };
};

/* =========================
   Normalización
   ========================= */
function useNormalizedDividends(analysis?: any, basic?: any) {
  const A = analysis || {};
  const C = A.cards || {};
  const DIV = C.dividends || {};
  const FUND = C.fundamentals || {};
  const VAL = C.valuation || {};
  const PRICE = num(A.price) ?? num(basic?.price) ?? num(basic?.datos?.precio?.price) ?? null;

  const D = (basic?.datos?.dividendos || {}) as Record<string, any>;

  // campos base
  const dpsTTM =
    num(DIV.dividendPerShareTTM) ??
    num(D.dividendPerShare) ??
    num(D.dpsTTM) ??
    null;

  // yield: preferimos % ya normalizado; si viene en decimal 0.x lo convertimos; si no, calculamos con DPS/Price
  const yieldPctRaw =
    num(DIV.dividendYieldPct) ??
    (num(basic?.dividend_yield) != null
      ? (num(basic?.dividend_yield)! > 1 ? num(basic?.dividend_yield)! : num(basic?.dividend_yield)! * 100)
      : null) ??
    (num(D.dividendYield) != null
      ? (num(D.dividendYield)! > 1 ? num(D.dividendYield)! : num(D.dividendYield)! * 100)
      : null);

  const yieldCalc = dpsTTM && PRICE ? (dpsTTM / PRICE) * 100 : null;
  const dividendYieldPct = yieldPctRaw ?? yieldCalc ?? null;

  // payout sobre utilidades (preferido) o calculado
  const payoutEarningsPct =
    num(DIV.payoutRatioPct) ??
    num(D.payoutRatio) ??
    (dpsTTM && num(VAL?.epsTTM)
      ? (dpsTTM / (num(VAL?.epsTTM) as number)) * 100
      : null);

  // payout sobre FCF
  const fcfTTM =
    num(FUND?.fcfTTM) ??
    num(basic?.datos?.fundamentales?.freeCashFlow) ??
    null;
  const dividendsPaidTTM =
    num(DIV.dividendsPaidTTM) ??
    num(D.dividendsPaidTTM) ??
    null;

  const payoutFcfPct =
    num(DIV.fcfPayoutRatioPct) ??
    num(D.fcfPayoutRatio) ??
    (fcfTTM && dividendsPaidTTM && fcfTTM !== 0
      ? Math.max(0, (dividendsPaidTTM / Math.abs(fcfTTM)) * 100)
      : null);

  // coberturas (veces)
  const coverageFCF = fcfTTM && dividendsPaidTTM ? (Math.abs(fcfTTM) / dividendsPaidTTM) : null;
  const epsTTM = num(VAL?.epsTTM) ?? num(D.epsTTM) ?? null;
  const coverageEarnings = dpsTTM && epsTTM && dpsTTM > 0 ? epsTTM / dpsTTM : null;

  // growth, streak y frecuencia
  const growth5yPct = num(DIV.growth5yCAGRpct) ?? num(D.growth5Y) ?? null;
  const growth10yPct = num(DIV.growth10yCAGRpct) ?? num(D.growth10Y) ?? null;
  const streakYears = num(DIV.streakYears) ?? num(D.streakYears) ?? null;
  const frequency = DIV.frequency ?? D.frequency ?? null;

  // próximas fechas
  const nextExDate = DIV.nextExDate ?? D.nextExDate ?? D.nextEx ?? null;
  const nextPayDate = DIV.nextPayDate ?? D.nextPayDate ?? null;

  // historial de pagos (últimos 8)
  const history: Array<{ date: string; amount: number }> =
    Array.isArray(DIV.lastPayments) && DIV.lastPayments.length
      ? DIV.lastPayments
      : Array.isArray(D.history)
      ? D.history
      : [];

  const last8 = history
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  // buyback yield si existe (informativo de política total de retorno)
  const buybackYieldPct =
    num(C.capitalAllocation?.buybackYieldPct) ??
    num(D.buybackYieldPct) ??
    null;

  return {
    price: PRICE,
    dpsTTM,
    dividendYieldPct,
    payoutEarningsPct,
    payoutFcfPct,
    coverageFCF,
    coverageEarnings,
    growth5yPct,
    growth10yPct,
    streakYears,
    frequency,
    nextExDate,
    nextPayDate,
    lastPayments: last8,
    buybackYieldPct,
  };
}

/* =========================
   UI rows
   ========================= */
function Row({
  label,
  value,
  hint,
  metric,
  unit = "",
}: {
  label: string;
  value: number | string | null;
  hint?: string;
  metric:
    | "yield"
    | "payout"
    | "payoutFCF"
    | "growth"
    | "coverage"
    | "neutral";
  unit?: string;
}) {
  const vnum = typeof value === "number" ? value : null;
  const cls =
    metric === "neutral" ? "text-gray-300" : colorScale(metric, vnum);
  const show =
    value == null
      ? "N/A"
      : typeof value === "number"
      ? `${unit === "%" ? value.toFixed(2) : value.toFixed(2)}${unit}`
      : value;

  return (
    <tr className="border-b border-gray-700/40">
      <td className="py-3 px-4 text-gray-300">{label}</td>
      <td className={`py-3 px-4 font-mono text-lg ${cls}`}>{show}</td>
      <td className="py-3 px-4 text-sm text-gray-400">{hint || ""}</td>
    </tr>
  );
}

/* =========================
   Component
   ========================= */
export default function DividendosCard({
  stockAnalysis,
  stockBasicData,
  stockReport,
}: DividendosCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const data = useMemo(
    () => useNormalizedDividends(stockAnalysis, stockBasicData),
    [stockAnalysis, stockBasicData]
  );

  const safety = useMemo(
    () => safetyBadge(data.payoutEarningsPct, data.payoutFcfPct, data.streakYears),
    [data.payoutEarningsPct, data.payoutFcfPct, data.streakYears]
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-tarjetas border-none cursor-pointer">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Dividendos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Dividend Yield (TTM):</span>
                  <span className={`font-mono ${colorScale("yield", data.dividendYieldPct)}`}>
                    {pct(data.dividendYieldPct)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Payout (utilidades):</span>
                  <span className={`font-mono ${colorScale("payout", data.payoutEarningsPct)}`}>
                    {pct(data.payoutEarningsPct)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Racha de aumentos:</span>
                  <span className="font-mono text-blue-400">
                    {data.streakYears != null ? `${data.streakYears} años` : "N/A"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Payout (FCF):</span>
                  <span className={`font-mono ${colorScale("payoutFCF", data.payoutFcfPct)}`}>
                    {pct(data.payoutFcfPct)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Próx. Ex-Date / Pago:</span>
                  <span className="font-mono text-purple-300 text-xs">
                    {data.nextExDate ? data.nextExDate : "—"}{data.nextPayDate ? ` · ${data.nextPayDate}` : ""}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Seguridad del dividendo:</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${safety.cls}`}>{safety.label}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gray-800/60 border-orange-500/30">

        <DialogHeader>
          <DialogTitle className="text-green-400 text-2xl">Análisis de Dividendos Detallado</DialogTitle>
        </DialogHeader>

        {/* 1) Resumen Ejecutivo */}
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-green-400 text-lg font-semibold mb-2">Resumen Ejecutivo</h3>
          <p className="text-gray-200 text-sm leading-relaxed">
            {stockReport?.analisisDividendos?.["Resumen Ejecutivo"] || "N/A"}
          </p>
        </div>

        {/* 2) Métricas clave */}
        <div className="bg-gray-800/30 rounded-lg overflow-hidden mb-6">
          {/* Leyenda */}
          <div className="px-4 pt-4 pb-2 text-sm flex gap-2">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full" /> <span className="text-gray-300">Favorable</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-500 rounded-full" /> <span className="text-gray-300">Neutral</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full" /> <span className="text-gray-300">Riesgoso</span>
            </span>
          </div>

          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="py-3 px-4 text-left text-green-400 font-semibold">Indicador</th>
                <th className="py-3 px-4 text-left text-green-400 font-semibold">Valor</th>
                <th className="py-3 px-4 text-left text-green-400 font-semibold">Comentario</th>
              </tr>
            </thead>
            <tbody>
              <Row
                label="Dividend Yield (TTM)"
                value={data.dividendYieldPct ?? null}
                unit="%"
                metric="yield"
                hint="Rendimiento anualizado sobre precio actual"
              />
              <Row
                label="Dividendo por acción (TTM)"
                value={data.dpsTTM ?? null}
                metric="neutral"
                hint="Suma de los últimos pagos de 12 meses"
              />
              <Row
                label="Payout utilidades"
                value={data.payoutEarningsPct ?? null}
                unit="%"
                metric="payout"
                hint="% de utilidades destinado a dividendos"
              />
              <Row
                label="Payout FCF"
                value={data.payoutFcfPct ?? null}
                unit="%"
                metric="payoutFCF"
                hint="% del flujo de caja libre destinado a dividendos"
              />
              <Row
                label="Cobertura por FCF"
                value={data.coverageFCF ?? null}
                metric="coverage"
                hint="Veces que el FCF cubre los dividendos"
              />
              <Row
                label="Cobertura por utilidades"
                value={data.coverageEarnings ?? null}
                metric="coverage"
                hint="EPS / DPS"
              />
              <Row
                label="Crecimiento 5 años (CAGR)"
                value={data.growth5yPct ?? null}
                unit="%"
                metric="growth"
                hint="Crecimiento anual compuesto del dividendo"
              />
              <Row
                label="Crecimiento 10 años (CAGR)"
                value={data.growth10yPct ?? null}
                unit="%"
                metric="growth"
                hint="Historial de más largo plazo"
              />
              <Row
                label="Años de racha (streak)"
                value={data.streakYears ?? null}
                metric="neutral"
                hint="Años consecutivos sin recortes"
              />
              <Row
                label="Frecuencia de pago"
                value={typeof (data.frequency ?? "") === "string" ? (data.frequency as string) : "N/A"}
                metric="neutral"
                hint="Mensual/Trimestral/Anual"
              />
              {data.buybackYieldPct != null && (
                <Row
                  label="Buyback Yield"
                  value={data.buybackYieldPct}
                  unit="%"
                  metric="neutral"
                  hint="Rendimiento por recompras (informativo)"
                />
              )}
              <Row
                label="Próx. Ex-Date"
                value={data.nextExDate ?? "N/A"}
                metric="neutral"
                hint="Fecha límite para recibir el próximo pago"
              />
              <Row
                label="Próx. Pago"
                value={data.nextPayDate ?? "N/A"}
                metric="neutral"
                hint="Fecha estimada de cobro"
              />
            </tbody>
          </table>
        </div>

        {/* 3) Historial reciente de pagos */}
        <div className="bg-gray-800/30 rounded-lg p-4 mb-6">
          <h3 className="text-green-400 text-lg font-semibold mb-3">Últimos pagos</h3>
          {data.lastPayments.length === 0 ? (
            <div className="text-gray-400 text-sm">Sin historial disponible</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {data.lastPayments.map((p) => (
                <div key={`${p.date}-${p.amount}`} className="bg-gray-900/40 rounded px-2 py-2 text-center">
                  <div className="text-xs text-gray-400">{p.date}</div>
                  <div className="text-sm font-mono text-cyan-300">${Number(p.amount).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4) Interpretación IA */}
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-blue-400 text-lg font-semibold mb-2">Interpretación Automática (IA)</h3>
          <p className="text-gray-200 text-sm leading-relaxed italic">
            {stockReport?.analisisDividendos?.["Conclusión para inversores"] || "No hay datos suficientes"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

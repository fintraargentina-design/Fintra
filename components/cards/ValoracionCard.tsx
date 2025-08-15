import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMemo, useState } from "react";

/**
 * ValoracionCard
 * - Prefiere datos de stockAnalysis.cards.valuation / peers / analysts si existen.
 * - Fallback a stockBasicData.{valoracion_*, datos.valoracion.*, market_cap, free_cash_flow, dividend_yield, ...}
 */
interface ValoracionCardProps {
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
const ratio = (v: number | null, d = 2) => (v == null ? "N/A" : v.toFixed(d));
const moneyComp = (v: number | null) => {
  if (v == null) return "N/A";
  const s = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  return `${s}$${a.toFixed(0)}`;
};

const colorFor = (label: string, v: number | null) => {
  if (v == null) return "text-gray-400";
  switch (label) {
    case "P/E (PER)":
    case "P/E forward":
      return v <= 15 ? "text-green-400" : v <= 25 ? "text-yellow-400" : "text-red-400";
    case "PEG":
      return v <= 1 ? "text-green-400" : v <= 1.5 ? "text-yellow-400" : "text-red-400";
    case "P/Book (P/B)":
      return v <= 1.5 ? "text-green-400" : v <= 3 ? "text-yellow-400" : "text-red-400";
    case "P/FCF":
      return v <= 15 ? "text-green-400" : v <= 25 ? "text-yellow-400" : "text-red-400";
    case "P/S (Ventas)":
      return v < 3 ? "text-green-400" : v <= 6 ? "text-yellow-400" : "text-red-400";
    case "EV/EBITDA":
      return v < 10 ? "text-green-400" : v <= 15 ? "text-yellow-400" : "text-red-400";
    case "EV/Ventas":
      return v < 2 ? "text-green-400" : v <= 4 ? "text-yellow-400" : "text-red-400";
    case "Dividend Yield":
      return v >= 2 ? "text-green-400" : v >= 1 ? "text-yellow-400" : "text-red-400";
    case "Crecimiento implícito":
      return v >= 7 ? "text-green-400" : v >= 4 ? "text-yellow-400" : "text-red-400";
    case "Descuento vs. PT":
      // positivo => descuento (verde); negativo => prima (rojo)
      return v >= 0 ? "text-green-400" : "text-red-400";
    case "P/E %ile 5Y":
      // percentil bajo (más barato vs historia) verde
      return v <= 35 ? "text-green-400" : v <= 65 ? "text-yellow-400" : "text-red-400";
    case "Z-score vs peers (P/E)":
      return Math.abs(v) <= 0.5 ? "text-green-400" : Math.abs(v) <= 1 ? "text-yellow-400" : "text-red-400";
    default:
      return "text-gray-300";
  }
};

const commentFor = (label: string, v: number | null) => {
  if (v == null) return "N/A";
  switch (label) {
    case "P/E (PER)":
    case "P/E forward":
      return v <= 15 ? "Atractivo" : v <= 25 ? "Aceptable" : "Caro";
    case "PEG":
      return v <= 1 ? "Subvalorado" : v <= 1.5 ? "Justo" : "Sobrevalorado";
    case "P/Book (P/B)":
      return v <= 1.5 ? "Atractivo" : v <= 3 ? "Aceptable" : "Caro";
    case "P/FCF":
      return v <= 15 ? "Atractivo" : v <= 25 ? "Aceptable" : "Caro";
    case "P/S (Ventas)":
      return v < 3 ? "Atractivo" : v <= 6 ? "Aceptable" : "Caro";
    case "EV/EBITDA":
      return v < 10 ? "Barato vs. flujo" : v <= 15 ? "Neutro" : "Exigente";
    case "EV/Ventas":
      return v < 2 ? "Barato" : v <= 4 ? "Neutro" : "Exigente";
    case "Dividend Yield":
      return v >= 2 ? "Atractivo" : v >= 1 ? "Aceptable" : "Bajo";
    case "Crecimiento implícito":
      return v >= 7 ? "Alto" : v >= 4 ? "Moderado" : "Bajo";
    case "Descuento vs. PT":
      return v >= 0 ? "Descuento vs consenso" : "Prima vs consenso";
    case "P/E %ile 5Y":
      return v <= 35 ? "Más barato que su historia" : v <= 65 ? "En línea histórica" : "Más caro que su historia";
    case "Z-score vs peers (P/E)":
      return Math.abs(v) <= 0.5 ? "En línea con sector" : Math.abs(v) <= 1 ? "Leve desvío" : "Desvío relevante";
    default:
      return "";
  }
};

/* =========================
   Fila de tabla
   ========================= */
function Row({
  label,
  value,
  unit = "",
  display,
}: {
  label: string;
  value: number | null;
  unit?: string;
  display?: (v: number | null) => string;
}) {
  const color = colorFor(label, value);
  const shown =
    display ? display(value) : value == null ? "N/A" : unit === "%" ? pct(value) : ratio(value);
  const comment = commentFor(label, value);
  return (
    <tr className="border-b border-gray-700/30">
      <td className="py-3 px-4 text-gray-200">{label}</td>
      <td className={`py-3 px-4 font-mono ${color}`}>{shown}</td>
      <td className={`py-3 px-4 text-sm ${color}`}>{comment}</td>
    </tr>
  );
}

/* =========================
   Normalización de entrada
   ========================= */
function useNormalized(sourceA?: any, sourceB?: any) {
  const a = sourceA || {};
  const b = sourceB || {};

  // Valuation (agregador preferido)
  const v = a?.cards?.valuation || {};
  const peers = a?.cards?.peers || {};
  const analysts = a?.cards?.analysts || {};

  const price =
    num(a?.price) ??
    num(b?.price) ??
    num(b?.datos?.precio?.price) ??
    null;

  const pe = num(v?.pe) ?? num(b?.valoracion_pe) ?? num(b?.datos?.valoracion?.pe) ?? null;
  const pb = num(v?.pbv) ?? num(b?.valoracion_pbv) ?? num(b?.datos?.valoracion?.pbv) ?? null;
  const ps = num(v?.ps) ?? num(b?.valoracion_ps) ?? num(b?.datos?.valoracion?.ps) ?? null;
  let peg = num(v?.peg) ?? num(b?.valoracion_peg) ?? num(b?.datos?.valoracion?.peg) ?? null;

  // Dividend yield (como %)
  const dyPct =
    (num(v?.dividendYieldPct) ??
      (num(b?.dividend_yield) != null ? (num(b?.dividend_yield)! * 100) : null) ??
      (num(b?.datos?.dividendos?.dividendYield) != null
        ? num(b?.datos?.dividendos?.dividendYield)! * 100
        : null)) ?? null;

  // P/FCF
  const mcap = num(v?.marketCap) ?? num(b?.market_cap) ?? null;
  const fcf = num(v?.freeCashFlowTTM) ?? num(b?.free_cash_flow) ?? num(b?.datos?.fundamentales?.freeCashFlow) ?? null;
  const pFcf = mcap && fcf ? mcap / fcf : null;

  // EV, EBITDA/Revenue
  const debt = num(v?.totalDebt) ?? num(b?.total_debt) ?? num(b?.datos?.fundamentales?.totalDebt) ?? null;
  const cash = num(v?.cash) ?? num(b?.cash) ?? num(b?.datos?.fundamentales?.cashAndEquivalents) ?? null;
  const ev = (mcap ?? null) != null ? (mcap! + (debt ?? 0) - (cash ?? 0)) : null;

  const ebitdaTTM = num(v?.ebitdaTTM) ?? num(b?.ebitda_ttm) ?? num(b?.datos?.fundamentales?.ebitdaTTM) ?? null;
  const revenueTTM = num(v?.revenueTTM) ?? num(b?.revenue_ttm) ?? num(b?.datos?.fundamentales?.revenueTTM) ?? null;

  const evEbitda = ev && ebitdaTTM ? ev / ebitdaTTM : null;
  const evSales = ev && revenueTTM ? ev / revenueTTM : null;

  // Forward P/E (si tenemos EPS próximo año)
  const epsNextFY =
    num(a?.cards?.estimates?.epsNextFY) ??
    num(b?.eps_next_fy) ??
    num(b?.datos?.estimaciones?.epsNextFY) ??
    null;
  const fwdPE = price && epsNextFY ? price / epsNextFY : null;

  // Implied Growth (si no viene: growth % ≈ PE / PEG)
  let impliedGrowthPct =
    num(v?.impliedGrowthPct) ??
    (pe && peg ? (pe / peg) : null);
  if (impliedGrowthPct != null && impliedGrowthPct > 0 && impliedGrowthPct < 1) {
    impliedGrowthPct = impliedGrowthPct * 100;
  }

  // Precio Objetivo (consenso)
  const ptAvg =
    num(analysts?.priceTargetAvg) ??
    num(b?.datos?.analistas?.priceTargetAvg) ??
    null;
  const discountVsPT = ptAvg && price ? ((ptAvg - price) / price) * 100 : null;

  // Percentil histórico 5Y de PE
  const peHist = (v?.history?.pe5y as number[]) || b?.datos?.valoracion?.peHistory5y || [];
  const pePctile = Array.isArray(peHist) && peHist.length > 8 && pe != null
    ? (() => {
        const sorted = [...peHist].filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
        const idx = sorted.findIndex((x) => pe <= x);
        const rank = idx === -1 ? sorted.length : idx;
        return (rank / sorted.length) * 100;
      })()
    : null;

  // Z-score vs. peers (P/E)
  const peerMedianPE = num(peers?.pe?.median) ?? null;
  const peerStdPE = num(peers?.pe?.stdev) ?? null;
  const zScorePE = pe != null && peerMedianPE != null && peerStdPE && peerStdPE > 0
    ? (pe - peerMedianPE) / peerStdPE
    : null;

  return {
    price,
    pe, peg, pb, ps,
    pFcf,
    dyPct,
    evEbitda, evSales,
    fwdPE,
    impliedGrowthPct,
    ptAvg, discountVsPT,
    pePctile,
    zScorePE
  };
}

/* =========================
   Componente principal
   ========================= */
export default function ValoracionCard({ stockAnalysis, stockBasicData, stockReport }: ValoracionCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const data = useMemo(
    () => useNormalized(stockAnalysis, stockBasicData),
    [stockAnalysis, stockBasicData]
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-green-500/30 cursor-pointer transition-all duration-300 hover:border-[#00FF00] hover:shadow-lg hover:shadow-[#00FF00]/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-400 text-lg">Valoración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">P/E (PER):</span>
                <span className={`font-mono ${colorFor("P/E (PER)", data.pe)}`}>{ratio(data.pe)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">EV/EBITDA:</span>
                <span className={`font-mono ${colorFor("EV/EBITDA", data.evEbitda)}`}>{ratio(data.evEbitda)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">P/Book (P/B):</span>
                <span className={`font-mono ${colorFor("P/Book (P/B)", data.pb)}`}>{ratio(data.pb)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">P/FCF:</span>
                <span className={`font-mono ${colorFor("P/FCF", data.pFcf)}`}>{ratio(data.pFcf)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dividend Yield:</span>
                <span className={`font-mono ${colorFor("Dividend Yield", data.dyPct)}`}>{pct(data.dyPct)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Descuento vs PT:</span>
                <span className={`font-mono ${colorFor("Descuento vs. PT", data.discountVsPT)}`}>
                  {pct(data.discountVsPT)}
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
            {stockReport?.analisisValoracion?.["Resumen Ejecutivo"] || "N/A"}
          </p>
        </div>

        {/* 2. MÚLTIPLOS CLAVE */}
        <div className="mt-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4">Múltiplos Clave</h3>

          {/* Leyenda */}
          <div className="flex gap-2 mb-4 text-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-400 rounded" /><span className="text-gray-300">Bueno</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-400 rounded" /><span className="text-gray-300">Neutral</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-400 rounded" /><span className="text-gray-300">Negativo</span></div>
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
                <Row label="P/E (PER)" value={data.pe} />
                <Row label="P/E forward" value={data.fwdPE} />
                <Row label="PEG" value={data.peg} />
                <Row label="P/Book (P/B)" value={data.pb} />
                <Row label="P/S (Ventas)" value={data.ps} />
                <Row label="P/FCF" value={data.pFcf} />
                <Row label="EV/EBITDA" value={data.evEbitda} />
                <Row label="EV/Ventas" value={data.evSales} />
                <Row label="Dividend Yield" value={data.dyPct} unit="%" />
                <Row label="Crecimiento implícito" value={data.impliedGrowthPct} unit="%" />
                <Row label="Descuento vs. PT" value={data.discountVsPT} unit="%" />
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. CONTEXTO (histórico y sector) */}
        <div className="mt-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4">Contexto</h3>
          <div className="bg-gray-800/30 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Métrica</th>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Valor</th>
                  <th className="py-3 px-4 text-left text-green-400 font-semibold">Evaluación</th>
                </tr>
              </thead>
              <tbody>
                <Row label="P/E %ile 5Y" value={data.pePctile} display={(v)=> v==null?"N/A":`${v.toFixed(0)}%`} />
                <Row label="Z-score vs peers (P/E)" value={data.zScorePE} />
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. INTERPRETACIÓN AUTOMÁTICA */}
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-blue-400 text-lg font-semibold mb-2">Interpretación Automática (IA)</h3>
          <p className="text-gray-200 text-sm leading-relaxed italic">
            {stockReport?.analisisValoracion?.["Conclusión para inversores"] || "No hay datos suficientes"}
          </p>
          {/* Muestras de datos base para transparencia (opcionales) */}
          <div className="text-xs text-gray-500 mt-3">
            <div>Precio: {moneyComp(num(stockAnalysis?.price) ?? num(stockBasicData?.price) ?? null)}</div>
            <div>PT promedio: {moneyComp(data.ptAvg)}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

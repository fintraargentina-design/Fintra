// components/cards/ValoracionCard.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { fmp } from "@/lib/fmp/client";
import { X } from "lucide-react";

type Row = {
  label: string;
  raw: number | null;
  unit?: "%" | "x";
  score: number | null;
  thresholds: { poor: number; avg: number };
  display: string;
  target?: number | null;
};

const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, x));
const ratioBetterLow = (x?: number | null, maxGood = 10, maxBad = 50) => {
  if (x == null) return null;
  const v = Math.min(Math.max(x, 0), maxBad);
  const score = ((maxBad - v) / (maxBad - maxGood)) * 100;
  return clamp(score);
};
const fmt = (v: number | null | undefined, unit?: "%" | "x") =>
  v == null ? "N/A" : unit === "%" ? `${v.toFixed(2)}%` : `${v.toFixed(2)}x`;

// Normalizaciones seguras (evita NaN/Infinity)
const numOrNull = (x: any): number | null => {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

// Función para obtener el texto del nivel de score
const getScoreLevel = (score: number | null): string => {
  if (score == null) return "Sin datos";
  if (score >= 70) return "Fuerte";
  if (score >= 40) return "A vigilar";
  return "Débil";
};

// Función para obtener el color del score
const getScoreColor = (score: number | null): string => {
  if (score == null) return "#94a3b8";
  if (score >= 70) return "#22c55e"; // Verde
  if (score >= 40) return "#eab308"; // Amarillo
  return "#ef4444"; // Rojo
};

const getHeatmapColor = (score: number | null) => {
  if (score == null) return "#1e293b"; // Gris neutro (Sin datos)

  // ESCALA VERDE (Positivo / Saludable / Subvaluado)
  // De menor a mayor intensidad
  if (score >= 90) return "#008000"; // Subida muy fuerte / Top
  if (score >= 80) return "#006600"; // Subida fuerte
  if (score >= 70) return "#004D00"; // Subida moderada
  if (score >= 60) return "#003300"; // Subida leve
  if (score >= 50) return "#001A00"; // Positivo marginal

  // ESCALA ROJA (Negativo / Riesgo / Sobrevaluado)
  // De menor a mayor intensidad de "gravedad" (mientras más bajo, más rojo intenso)
  if (score <= 10) return "#800000"; // Bajada muy fuerte / Crítico
  if (score <= 20) return "#660000"; // Bajada fuerte
  if (score <= 30) return "#4D0000"; // Bajada moderada
  if (score <= 40) return "#330000"; // Bajada leve
  return "#1A0000";                  // Negativo marginal (41-49)
};

// Agregar interfaces para el modal de explicaciones
interface ExplanationModalState {
  isOpen: boolean;
  selectedMetric: string | null;
}

const initialExplanationModalState: ExplanationModalState = {
  isOpen: false,
  selectedMetric: null
};


// Actualizar METRIC_EXPLANATIONS con ejemplos detallados
const METRIC_EXPLANATIONS: Record<string, { description: string; examples: string[] }> = {
  "P/E (PER)": {
    description: "Price-to-Earnings Ratio - Compara el precio de la acción con las ganancias por acción. Un P/E bajo puede indicar que la acción está infravalorada, pero también puede reflejar problemas en el negocio.",
    examples: [
      "P/E < 12: Potencialmente infravalorado (ej: Bancos tradicionales)",
      "P/E 12-20: Valoración razonable (ej: S&P 500 promedio ~18)",
      "P/E > 25: Posiblemente sobrevalorado o alto crecimiento esperado (ej: Tech stocks)"
    ]
  },
  "P/E forward": {
    description: "P/E basado en ganancias futuras estimadas por analistas. Es más relevante que el P/E histórico ya que los mercados descuentan expectativas futuras.",
    examples: [
      "Forward P/E < P/E histórico: Crecimiento esperado de ganancias",
      "Forward P/E > P/E histórico: Declive esperado de ganancias",
      "Forward P/E < 15: Atractivo para value investors"
    ]
  },
  "PEG": {
    description: "Price/Earnings to Growth - Relaciona el P/E con la tasa de crecimiento esperada. Un PEG menor a 1 sugiere que la acción puede estar infravalorada considerando su crecimiento.",
    examples: [
      "PEG < 1: Potencialmente infravalorado (ej: AAPL en 2016)",
      "PEG = 1: Valoración justa según crecimiento",
      "PEG > 2: Posiblemente sobrevalorado (ej: muchas tech en 2021)"
    ]
  },
  "P/Book (P/B)": {
    description: "Price-to-Book Ratio - Compara el precio con el valor contable por acción. Un P/B bajo puede indicar una oportunidad de valor, especialmente en sectores intensivos en activos.",
    examples: [
      "P/B < 1: Trading por debajo del valor contable (ej: Bancos en crisis)",
      "P/B 1-3: Valoración típica para empresas maduras",
      "P/B > 5: Común en empresas tech con pocos activos tangibles"
    ]
  },
  "P/S (Ventas)": {
    description: "Price-to-Sales Ratio - Relaciona la capitalización con los ingresos anuales. Útil para evaluar empresas con bajos beneficios, pérdidas temporales o modelos de negocio escalables.",
    examples: [
      "P/S < 2: Valoración conservadora (ej: Retail tradicional)",
      "P/S 2-10: Rango típico para muchas industrias",
      "P/S > 15: Común en SaaS y empresas de alto crecimiento"
    ]
  },
  "P/FCF": {
    description: "Price-to-Free Cash Flow - Compara el precio con el flujo de caja libre. Es una métrica crucial ya que el FCF representa el dinero real que la empresa puede distribuir o reinvertir.",
    examples: [
      "P/FCF < 15: Generación sólida de efectivo (ej: Microsoft ~20)",
      "P/FCF 15-25: Valoración razonable",
      "P/FCF > 30: Puede indicar baja generación de efectivo vs precio"
    ]
  },
  "EV/EBITDA": {
    description: "Enterprise Value to EBITDA - Múltiplo que considera la deuda total de la empresa. Es útil para comparar empresas con diferentes estructuras de capital y niveles de apalancamiento.",
    examples: [
      "EV/EBITDA < 8: Potencialmente atractivo (ej: Utilities maduras)",
      "EV/EBITDA 8-15: Valoración típica del mercado",
      "EV/EBITDA > 20: Alto, común en empresas de crecimiento"
    ]
  },
  "EV/Ventas": {
    description: "Enterprise Value to Sales - Similar al P/S pero considerando la deuda total. Proporciona una visión más completa del valor de la empresa respecto a sus ingresos.",
    examples: [
      "EV/Sales < 2: Conservador (ej: Grocery stores)",
      "EV/Sales 2-8: Rango amplio según industria",
      "EV/Sales > 10: Alto, típico en tech y biotech"
    ]
  },
  "Dividend Yield": {
    description: "Rendimiento por dividendo - Porcentaje de dividendos anuales respecto al precio actual. Importante para inversores que buscan ingresos regulares y empresas maduras.",
    examples: [
      "Yield > 4%: Alto rendimiento (ej: REITs, Utilities)",
      "Yield 2-4%: Rendimiento moderado (ej: Dividend Aristocrats)",
      "Yield < 2%: Bajo, común en empresas de crecimiento"
    ]
  },
  "Crecimiento implícito": {
    description: "Tasa de crecimiento anual que estaría implícita en el precio actual según modelos de valoración. Ayuda a entender qué expectativas de crecimiento están descontadas en el precio.",
    examples: [
      "< 5%: Expectativas conservadoras",
      "5-15%: Crecimiento moderado esperado",
      "> 20%: Altas expectativas de crecimiento (riesgo si no se cumple)"
    ]
  },
  "Descuento vs. PT": {
    description: "Descuento del precio actual respecto al precio objetivo promedio de los analistas. Un descuento alto puede indicar una oportunidad, pero también puede reflejar riesgos no considerados.",
    examples: [
      "Descuento > 20%: Potencial upside significativo",
      "Descuento 0-20%: Precio cerca del consenso",
      "Prima (descuento negativo): Precio por encima del consenso"
    ]
  }
};

type PeriodSel = "ttm" | "FY" | "Q1" | "Q2" | "Q3" | "Q4" | "annual" | "quarter";

export default function ValoracionCard({ symbol, period = "ttm", ratiosData }: { symbol: string; period?: PeriodSel; ratiosData?: any }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [explanationModal, setExplanationModal] = useState<ExplanationModalState>(initialExplanationModalState);

  // Función para abrir modal de explicaciones
  const openExplanationModal = (metricName: string) => {
    setExplanationModal({
      isOpen: true,
      selectedMetric: metricName
    });
  };

  // Función para cerrar modal de explicaciones
  const closeExplanationModal = () => {
    setExplanationModal(initialExplanationModalState);
  };


  useEffect(() => {
    console.log(`[ValoracionCard] Effect triggered for ${symbol} period=${period}`);
    // Lógica híbrida: si tenemos datos por props, usarlos directamente
    if (ratiosData) {
      try {
        const r = ratiosData;
        const build = (
          label: string,
          val: number | null,
          unit?: "%" | "x",
          score?: number | null,
          thresholds?: { poor: number; avg: number }
        ): Row => ({
          label,
          raw: val,
          unit,
          score: score ?? null,
          thresholds: thresholds ?? { poor: 40, avg: 70 },
          display: fmt(val, unit),
        });

        const pe = numOrNull(r.priceEarningsRatio ?? r.priceEarningsRatioTTM);
        const peg = numOrNull(r.pegRatio ?? r.pegRatioTTM);
        const pb = numOrNull(r.priceToBookRatio ?? r.priceToBookRatioTTM);
        const ps = numOrNull(r.priceToSalesRatio ?? r.priceToSalesRatioTTM);
        const pfcf = numOrNull(r.priceToFreeCashFlowRatio ?? r.priceToFreeCashFlowRatioTTM);
        const evEbitda = numOrNull(r.enterpriseValueMultiple ?? r.enterpriseValueMultipleTTM);
        const divYield = numOrNull(r.dividendYield ?? r.dividendYieldTTM); 

        const items: Row[] = [
          build("P/E (PER)", pe, "x", ratioBetterLow(pe, 12, 40)),
          build("P/E forward", null, "x", null),
          build("PEG", peg, "x", ratioBetterLow(peg, 1, 3)),
          build("P/Book (P/B)", pb, "x", ratioBetterLow(pb, 2, 6)),
          build("P/S (Ventas)", ps, "x", ratioBetterLow(ps, 2, 12)),
          build("P/FCF", pfcf, "x", ratioBetterLow(pfcf, 15, 40)),
          build("EV/EBITDA", evEbitda, "x", ratioBetterLow(evEbitda, 8, 25)),
          build("EV/Ventas", null, "x", null),
          build(
            "Dividend Yield",
            divYield ? divYield * 100 : null,
            "%",
            divYield == null ? null : clamp((divYield * 100 / 8) * 100),
            { poor: 10, avg: 30 }
          ),
           build("Crecimiento implícito", null, "%", null, { poor: 40, avg: 70 }),
           build("Descuento vs. PT", null, "%", null, { poor: 40, avg: 70 }),
        ];

        setRows(items);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error("Error processing props data:", err);
        setError("Error procesando datos");
      }
      return;
    }

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('🔍 Cargando valoración para:', symbol);
        
        // Cambiar de fmp.ratios a fmp.valuation
        const valuation = await fmp.valuation(symbol, { period, cache: "no-store" });
        console.log('📊 Datos de valoración recibidos:', valuation);
        
        // Verificar si hay error en la respuesta
        if (valuation.error) {
          throw new Error(valuation.error);
        }
        
        // Los datos ya vienen procesados y normalizados
        const {
          pe,
          forwardPe,
          peg,
          pb,
          ps,
          pfcf,
          evEbitda,
          evSales,
          dividendYield,
          impliedGrowth,
          discountVsPt
        } = valuation;
    
        // Precio actual del perfil
        const profileArr = await fmp.profile(symbol);
        const currentPrice = Array.isArray(profileArr) && profileArr.length ? numOrNull(profileArr[0]?.price) : null;
        console.log('💰 Precio actual:', currentPrice);
    
        const build = (
          label: string,
          val: number | null,
          unit?: "%" | "x",
          score?: number | null,
          thresholds?: { poor: number; avg: number }
        ): Row => ({
          label,
          raw: val,
          unit,
          score: score ?? null,
          thresholds: thresholds ?? { poor: 40, avg: 70 },
          display: fmt(val, unit),
        });
    
        const items: Row[] = [
          build("P/E (PER)", pe, "x", ratioBetterLow(pe, 12, 40)),
          build("P/E forward", forwardPe, "x", ratioBetterLow(forwardPe, 12, 40)),
          build("PEG", peg, "x", ratioBetterLow(peg, 1, 3)),
          build("P/Book (P/B)", pb, "x", ratioBetterLow(pb, 2, 6)),
          build("P/S (Ventas)", ps, "x", ratioBetterLow(ps, 2, 12)),
          build("P/FCF", pfcf, "x", ratioBetterLow(pfcf, 15, 40)),
          build("EV/EBITDA", evEbitda, "x", ratioBetterLow(evEbitda, 8, 25)),
          build("EV/Ventas", evSales, "x", ratioBetterLow(evSales, 2, 12)),
          build(
            "Dividend Yield",
            dividendYield, // Ya viene en % desde el endpoint
            "%",
            dividendYield == null ? null : clamp((dividendYield / 8) * 100),
            { poor: 10, avg: 30 }
          ),
          // Derivados (ya calculados en el endpoint)
          build("Crecimiento implícito", impliedGrowth, "%", null, { poor: 40, avg: 70 }),
          build("Descuento vs. PT", discountVsPt, "%", null, { poor: 40, avg: 70 }),
        ];
        
        console.log('📈 Items procesados:', items);
        console.log('🎯 Items con scores válidos:', items.filter(item => item.score !== null));
    
        if (alive) setRows(items);
      } catch (e: any) {
        console.error('❌ Error cargando valoración:', e);
        if (alive) setError(e?.message ?? "Error cargando valoración");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [symbol, period]);



  return (
    <>
      <div className="bg-tarjetas border-none">
        <div className="pb-0 px-6">
          {loading ? (
            <div className="h-32 grid place-items-center text-gray-500 text-sm">
              Cargando datos de Valoración…
            </div>
          ) : error ? (
            <div className="h-72 flex items-center justify-center text-red-400">{error}</div>
          ) : (
            <>
              {/* Métricas de valoración en formato Heatmap Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-0.5">
                {rows.map((row, index) => {
                  const scoreLevel = getScoreLevel(row.score);

                  return (
                    <div 
                        key={index} 
                        className="relative flex flex-col items-center justify-center px-3 py-3 gap-1 cursor-pointer hover:brightness-110 transition-all"
                        style={{ backgroundColor: getHeatmapColor(row.score) }}
                        onClick={() => openExplanationModal(row.label)}
                      >
                        {/* Top: Label */}
                        <div className="text-white/70 text-[10px] font-medium text-center leading-none line-clamp-1">
                          {row.label}
                        </div>

                        {/* Middle: Value */}
                        <div className="text-white text-sm tracking-tight leading-tight">
                          {row.display || "N/A"}
                        </div>

                        {/* Bottom: Level */}
                        <div className="text-[9px] text-white/90 font-medium uppercase tracking-wider bg-black/20 px-1 py-0 rounded leading-none">
                          {scoreLevel}
                        </div>                    
                      </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Explicaciones de Métricas */}
      {explanationModal.isOpen && explanationModal.selectedMetric && METRIC_EXPLANATIONS[explanationModal.selectedMetric] && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-100 border border-gray-300 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              {/* Header del modal */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  {explanationModal.selectedMetric}
                </h2>
                <button
                  onClick={closeExplanationModal}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido del modal */}
              <div className="space-y-4">
                {/* Descripción */}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Descripción</h3>
                  <p className="text-gray-800 leading-relaxed">
                    {METRIC_EXPLANATIONS[explanationModal.selectedMetric].description}
                  </p>
                </div>

                {/* Ejemplos */}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Ejemplos y Rangos</h3>
                  <ul className="space-y-2">
                    {METRIC_EXPLANATIONS[explanationModal.selectedMetric].examples.map((example, index) => (
                      <li key={index} className="text-gray-700 text-sm flex items-start">
                        <span className="w-2 h-2 bg-[#FFA028] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Botón cerrar */}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={closeExplanationModal}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

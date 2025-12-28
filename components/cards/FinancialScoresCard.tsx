// components/cards/FinancialScoresCard.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, X } from "lucide-react";
import { fmp } from "@/lib/fmp/client";

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

// Interfaces para el modal de explicaciones
interface ExplanationModalState {
  isOpen: boolean;
  selectedMetric: string | null;
}

const initialExplanationModalState: ExplanationModalState = {
  isOpen: false,
  selectedMetric: null
};

// Explicaciones detalladas para métricas financieras
const METRIC_EXPLANATIONS: Record<string, { description: string; examples: string[] }> = {
  "Altman Z-Score": {
    description: "El Altman Z-Score es un modelo predictivo que evalúa la probabilidad de quiebra de una empresa en los próximos dos años. Combina cinco ratios financieros clave para generar una puntuación única.",
    examples: [
      "Z > 3.0: Zona segura - Baja probabilidad de quiebra",
      "1.8 < Z < 3.0: Zona gris - Riesgo moderado, requiere análisis adicional",
      "Z < 1.8: Zona de riesgo - Alta probabilidad de dificultades financieras"
    ]
  },
  "Piotroski Score": {
    description: "El Piotroski Score evalúa la fortaleza financiera de una empresa mediante 9 criterios binarios (0 o 1) que analizan rentabilidad, apalancamiento y eficiencia operativa.",
    examples: [
      "Score 8-9: Empresa financieramente muy sólida",
      "Score 5-7: Fortaleza financiera moderada",
      "Score 0-4: Debilidades financieras significativas"
    ]
  },
  "Total Assets": {
    description: "Representa el valor total de todos los activos que posee la empresa, incluyendo activos corrientes (efectivo, inventarios) y no corrientes (propiedades, equipos, intangibles).",
    examples: [
      "Apple: ~$350B en activos totales (2023)",
      "Empresas medianas: $1B - $50B en activos",
      "Pequeñas empresas: < $1B en activos"
    ]
  },
  "Total Liabilities": {
    description: "Suma de todas las obligaciones financieras de la empresa, incluyendo deudas a corto y largo plazo, cuentas por pagar y otras obligaciones.",
    examples: [
      "Ratio Deuda/Activos < 30%: Apalancamiento conservador",
      "Ratio Deuda/Activos 30-60%: Apalancamiento moderado",
      "Ratio Deuda/Activos > 60%: Alto apalancamiento"
    ]
  },
  "Revenue": {
    description: "Ingresos totales generados por la empresa durante un período específico, antes de deducir cualquier costo o gasto. Es la línea superior del estado de resultados.",
    examples: [
      "Amazon: ~$500B en ingresos anuales (2023)",
      "Empresas Fortune 500: > $6B en ingresos",
      "Crecimiento de ingresos > 15% anual: Excelente"
    ]
  },
  "EBIT": {
    description: "Earnings Before Interest and Taxes - Ganancias antes de intereses e impuestos. Mide la rentabilidad operativa de la empresa sin considerar la estructura de capital ni los impuestos.",
    examples: [
      "Margen EBIT > 20%: Excelente rentabilidad operativa",
      "Margen EBIT 10-20%: Rentabilidad sólida",
      "Margen EBIT < 5%: Rentabilidad operativa débil"
    ]
  },
  "Market Cap": {
    description: "Capitalización de mercado - Valor total de todas las acciones en circulación de la empresa. Se calcula multiplicando el precio por acción por el número de acciones outstanding.",
    examples: [
      "Large Cap: > $10B (ej: Apple, Microsoft)",
      "Mid Cap: $2B - $10B (empresas en crecimiento)",
      "Small Cap: $300M - $2B (empresas pequeñas)"
    ]
  }
};

// Función mejorada para formatear números grandes
const fmtLargeNumber = (v?: number | null, d = 1) => {
  if (v == null) return "N/A";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(d)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(d)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(d)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(d)}K`;
  return `$${v.toFixed(0)}`;
};

// Función para formatear números completos con separadores de miles
const fmtFullNumber = (v?: number | null) => {
  if (v == null) return "N/A";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(v);
};

const numOrNull = (x: any): number | null => {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

// Nueva función helper para campos opcionales
const numOrUndefined = (x: any): number | undefined => {
  if (x === null || x === undefined) return undefined;
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
};

// Tipo local para los datos financieros (siguiendo el patrón de FundamentalCard)
type FinancialScoreData = {
  symbol: string;
  reportedCurrency?: string;
  altmanZScore: number | null;
  piotroskiScore: number | null;
  workingCapital?: number;
  totalAssets?: number;
  retainedEarnings?: number;
  ebit?: number;
  marketCap?: number;
  totalLiabilities?: number;
  revenue?: number;
  raw?: any; // Datos originales de FMP para acceso directo
};

export default function FinancialScoresCard({ symbol }: { symbol: string }) {
  const [scoresData, setScoresData] = useState<FinancialScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [explanationModal, setExplanationModal] = useState<ExplanationModalState>(initialExplanationModalState);

  const openExplanationModal = (metric: string) => {
    setExplanationModal({ isOpen: true, selectedMetric: metric });
  };

  const closeExplanationModal = () => {
    setExplanationModal(initialExplanationModalState);
  };

  // Funciones helper con useCallback para estabilidad
  const getSafeValue = useCallback((key: keyof FinancialScoreData): number | null => {
    if (!scoresData) return null;
    const value = scoresData[key];
    return numOrNull(value);
  }, [scoresData]);

  const getSafeRawValue = useCallback((key: string): number | null => {
    if (!scoresData || !scoresData.raw) return null;
    return numOrNull(scoresData.raw[key]);
  }, [scoresData]);

  useEffect(() => {
    const fetchScores = async () => {
      if (!symbol) {
        setError("Símbolo no válido");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const scores = await fmp.scores(symbol);
        
        console.log('API Response:', scores); // Para debug
        
        if (!scores) {
          throw new Error("No se pudieron obtener los datos de scores");
        }

        // Adaptar a la nueva estructura de la API
        const scoreData: FinancialScoreData = {
          symbol: symbol,
          reportedCurrency: scores.raw?.reportedCurrency || 'USD',
          // Usar los nuevos nombres de campos de la API
          altmanZScore: numOrNull(scores.altmanZ),        // ← Mantener null para campos requeridos
          piotroskiScore: numOrNull(scores.piotroski),    // ← Mantener null para campos requeridos
          // Usar numOrUndefined para campos opcionales
          workingCapital: numOrUndefined(scores.raw?.workingCapital),
          totalAssets: numOrUndefined(scores.raw?.totalAssets),
          retainedEarnings: numOrUndefined(scores.raw?.retainedEarnings),
          ebit: numOrUndefined(scores.raw?.ebit),
          marketCap: numOrUndefined(scores.raw?.marketCap),
          totalLiabilities: numOrUndefined(scores.raw?.totalLiabilities),
          revenue: numOrUndefined(scores.raw?.revenue),
          raw: scores.raw || scores // Mantener datos originales
        };
        
        console.log('Processed Score Data:', scoreData); // Para debug
        setScoresData(scoreData);
      } catch (err) {
        console.error("Error fetching financial scores:", err);
        const errorMessage = err instanceof Error ? err.message : "Error desconocido al cargar datos financieros";
        setError(errorMessage);
        setScoresData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, [symbol]);

  // Configuración del gráfico de barras horizontales combinado
  const combinedOption = useMemo(() => {
    if (!scoresData) return null;

    const chartData = [
      {
        name: "Altman Z-Score",
        value: Math.min(getSafeRawValue('altmanZScore') || 0, 10),
        original: getSafeRawValue('altmanZScore'),
        color: (getSafeRawValue('altmanZScore') || 0) > 3 ? "#10B981" : (getSafeRawValue('altmanZScore') || 0) > 1.8 ? "#F59E0B" : "#EF4444",
        unit: ""
      },
      {
        name: "Piotroski Score",
        value: getSafeRawValue('piotroskiScore') || 0,
        original: getSafeRawValue('piotroskiScore'),
        color: (getSafeRawValue('piotroskiScore') || 0) >= 7 ? "#10B981" : (getSafeRawValue('piotroskiScore') || 0) >= 5 ? "#3B82F6" : "#EF4444",
        unit: "/9"
      },
      {
        name: "Total Assets",
        value: Math.log10(Math.max(getSafeValue('totalAssets') || 1, 1)),
        original: getSafeValue('totalAssets'),
        color: "#8B5CF6",
        unit: ""
      },
      {
        name: "Total Liabilities",
        value: Math.log10(Math.max(getSafeValue('totalLiabilities') || 1, 1)),
        original: getSafeValue('totalLiabilities'),
        color: "#F59E0B",
        unit: ""
      },
      {
        name: "Revenue",
        value: Math.log10(Math.max(getSafeValue('revenue') || 1, 1)),
        original: getSafeValue('revenue'),
        color: "#06B6D4",
        unit: ""
      },
      {
        name: "EBIT",
        value: Math.log10(Math.max(getSafeValue('ebit') || 1, 1)),
        original: getSafeValue('ebit'),
        color: "#84CC16",
        unit: ""
      },
      {
        name: "Market Cap",
        value: Math.log10(Math.max(getSafeValue('marketCap') || 1, 1)),
        original: getSafeValue('marketCap'),
        color: "#EC4899",
        unit: ""
      }
    ].filter(item => item.original !== null && item.original !== undefined);

    if (chartData.length === 0) {
      return null;
    }
    
    const categories = chartData.map(item => item.name);

    const option = {
      backgroundColor: "transparent",
      grid: {
        left: "25%",
        right: "10%",
        top: "5%",
        bottom: "5%",
      },
      xAxis: {
        type: "value",
        max: 100,
        axisLabel: {
          color: "#9CA3AF",
          fontSize: 10,
        },
        axisLine: {
          lineStyle: {
            color: "#374151",
          },
        },
        splitLine: {
          lineStyle: {
            color: "#374151",
            type: "dashed",
          },
        },
      },
      yAxis: {
        type: "category",
        data: categories,
        axisLabel: {
          color: "#9CA3AF",
          fontSize: 11,
          formatter: (value: string) => value // Mantener el texto original
        },
        axisLine: {
          lineStyle: {
            color: "#374151",
          },
        },
        triggerEvent: true // ✅ Habilitar eventos en el eje Y
      },
      series: [
        {
          type: "bar",
          data: chartData.map((item, index) => ({
            value: item.value,
            itemStyle: {
              color: item.color,
            },
          })),
          barWidth: "60%",
        },
      ],
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1F2937",
        borderColor: "#374151",
        textStyle: {
          color: "#F3F4F6",
        },
        formatter: (params: any) => {
          const param = params[0];
          const dataItem = chartData[param.dataIndex];
          const category = categories[param.dataIndex];
          
          let displayValue = '';
          let fullValue = '';
          
          if (category.includes('Score')) {
            displayValue = `${dataItem.original?.toFixed(2) || 'N/A'}${dataItem.unit}`;
            fullValue = displayValue;
          } else {
            displayValue = fmtLargeNumber(dataItem.original);
            fullValue = fmtFullNumber(dataItem.original);
          }
          
          return `
            <div style="padding: 12px; min-width: 200px;">
              <div style="font-weight: bold; margin-bottom: 8px; color: #F59E0B;">${category}</div>
              <div style="margin-bottom: 4px; font-size: 16px;">${displayValue}</div>
              ${!category.includes('Score') && fullValue !== displayValue ? 
                `<div style="font-size: 12px; color: #9CA3AF; border-top: 1px solid #374151; padding-top: 4px; margin-top: 4px;">Valor completo: ${fullValue}</div>` : 
                ''}
            </div>
          `;
        },
      },
    };

    return option;
  }, [scoresData, getSafeValue, getSafeRawValue]);

  if (loading) {
    return (
      <Card className="bg-tarjetas border-gray-700/30">
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="h-32 grid place-items-center text-gray-500 text-sm">Cargando datos financieros...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !scoresData) {
    return (
      <Card className="bg-tarjetas border-gray-700/30">
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-red-400">
              {error || "No se pudieron cargar los datos financieros"}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-tarjetas border-none">
        {/* <CardHeader>
          <CardTitle className="text-[#FFA028] text-lg flex items-center">
            <div className="text-gray-400 mr-2">
              Financial Scores 
            </div>
            {symbol}
          </CardTitle>
        </CardHeader> */}
        <CardContent className="space-y-6 pt-6">
          {/* Métricas financieras en formato de tarjetas */}
          <div>
                  
            {/* Grid de métricas financieras */}
            <div className="grid grid-cols-4 gap-4 text-sm">
              {/* Altman Z-Score */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-gray-400">Altman Z-Score</div>
                <div className="text-green-400 font-mono text-lg">
                  {(() => {
                    const altmanScore = getSafeRawValue('altmanZScore');
                    return altmanScore !== null ? altmanScore.toFixed(2) : "N/A";
                  })()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const altmanScore = getSafeRawValue('altmanZScore');
                    if (altmanScore === null) return "Sin datos";
                    return altmanScore > 3 ? "Zona Segura" : 
                           altmanScore > 1.8 ? "Zona Gris" : "Zona de Riesgo";
                  })()}
                </div>
              </div>

              {/* Piotroski Score */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-gray-400">Piotroski Score</div>
                <div className="text-blue-400 font-mono text-lg">
                  {(() => {
                    const piotroskiScore = getSafeRawValue('piotroskiScore');
                    return piotroskiScore !== null ? `${piotroskiScore}/9` : "N/A";
                  })()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const piotroskiScore = getSafeRawValue('piotroskiScore');
                    if (piotroskiScore === null) return "Sin datos";
                    return piotroskiScore >= 7 ? "Excelente" : 
                           piotroskiScore >= 5 ? "Bueno" : "Débil";
                  })()}
                </div>
              </div>

              {/* Total Assets */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-gray-400">Total Assets</div>
                <div className="text-purple-400 font-mono text-lg">
                  {(() => {
                    const totalAssets = getSafeValue('totalAssets');
                    return totalAssets !== null ? fmtLargeNumber(totalAssets) : "N/A";
                  })()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Activos totales
                </div>
              </div>

              {/* Total Liabilities */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-gray-400">Total Liabilities</div>
                <div className="text-yellow-400 font-mono text-lg">
                  {(() => {
                    const totalLiabilities = getSafeValue('totalLiabilities');
                    return totalLiabilities !== null ? fmtLargeNumber(totalLiabilities) : "N/A";
                  })()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Pasivos totales
                </div>
              </div>

              {/* Revenue */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-gray-400">Revenue</div>
                <div className="text-cyan-400 font-mono text-lg">
                  {(() => {
                    const revenue = getSafeValue('revenue');
                    return revenue !== null ? fmtLargeNumber(revenue) : "N/A";
                  })()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Ingresos totales
                </div>
              </div>

              {/* EBIT */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-gray-400">EBIT</div>
                <div className="text-lime-400 font-mono text-lg">
                  {(() => {
                    const ebit = getSafeValue('ebit');
                    return ebit !== null ? fmtLargeNumber(ebit) : "N/A";
                  })()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Ganancias antes de intereses e impuestos
                </div>
              </div>

              {/* Market Cap */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-gray-400">Market Cap</div>
                <div className="text-pink-400 font-mono text-lg">
                  {(() => {
                    const marketCap = getSafeValue('marketCap');
                    return marketCap !== null ? fmtLargeNumber(marketCap) : "N/A";
                  })()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Capitalización de mercado
                </div>
              </div>

              {/* Working Capital */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-gray-400">Working Capital</div>
                <div className="text-indigo-400 font-mono text-lg">
                  {(() => {
                    const workingCapital = getSafeValue('workingCapital');
                    return workingCapital !== null ? fmtLargeNumber(workingCapital) : "N/A";
                  })()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Capital de trabajo
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
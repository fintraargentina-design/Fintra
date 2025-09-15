// components/cards/FinancialScoresCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  if (x === null || x === undefined || x === '') {
    return null;
  }
  
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
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
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const scores = await fmp.scores(symbol);
        const rawScoreData = Array.isArray(scores) && scores.length ? scores[0] : scores;
        
        // Convert to FinancialScoreData format
        const scoreData: FinancialScoreData = {
          symbol: rawScoreData.symbol,
          reportedCurrency: rawScoreData.reportedCurrency,
          altmanZScore: numOrNull(rawScoreData.altmanZScore),
          piotroskiScore: numOrNull(rawScoreData.piotroskiScore),
          workingCapital: rawScoreData.workingCapital,
          totalAssets: rawScoreData.totalAssets,
          retainedEarnings: rawScoreData.retainedEarnings,
          ebit: rawScoreData.ebit,
          marketCap: rawScoreData.marketCap,
          totalLiabilities: rawScoreData.totalLiabilities,
          revenue: rawScoreData.revenue,
          raw: rawScoreData // Store original data
        };
        
        setScoresData(scoreData);
      } catch (err: any) {
        setError(err?.message || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol]);

  // Configuración del gráfico de barras horizontales combinado
  const combinedOption = useMemo(() => {
    if (!scoresData) {
      return null;
    }

    // Los datos están en scoresData.raw, no directamente en scoresData
    const rawData = scoresData.raw || scoresData;

    // Preparar datos de scores (normalizados a escala 0-100)
    const altmanZ = numOrNull(rawData.altmanZScore);
    const piotroski = numOrNull(rawData.piotroskiScore);
    
    const normalizedAltman = altmanZ ? Math.min(Math.max((altmanZ / 10) * 100, 0), 100) : 0;
    const normalizedPiotroski = piotroski ? (piotroski / 9) * 100 : 0;

    // Preparar datos financieros (en billones para normalizar)
    const totalAssets = numOrNull(rawData.totalAssets);
    const totalLiabilities = numOrNull(rawData.totalLiabilities);
    const revenue = numOrNull(rawData.revenue);
    const ebit = numOrNull(rawData.ebit);
    const marketCap = numOrNull(rawData.marketCap);

    const categories = [
      'Altman Z-Score',
      'Piotroski Score',
      'Total Assets',
      'Total Liabilities', 
      'Revenue',
      'EBIT',
      'Market Cap'
    ];

    const chartData = [
      { value: normalizedAltman, original: altmanZ, unit: '', color: '#10B981' },
      { value: normalizedPiotroski, original: piotroski, unit: '/9', color: '#3B82F6' },
      { value: totalAssets ? (totalAssets / 1e12) * 10 : 0, original: totalAssets, unit: '', color: '#8B5CF6' },
      { value: totalLiabilities ? (totalLiabilities / 1e12) * 10 : 0, original: totalLiabilities, unit: '', color: '#EF4444' },
      { value: revenue ? (revenue / 1e12) * 10 : 0, original: revenue, unit: '', color: '#F59E0B' },
      { value: ebit ? Math.max((ebit / 1e11) * 10, 0) : 0, original: ebit, unit: '', color: '#06B6D4' },
      { value: marketCap ? (marketCap / 1e12) * 10 : 0, original: marketCap, unit: '', color: '#F97316' }
    ];

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
  }, [scoresData]);

  if (loading) {
    return (
      <Card className="bg-tarjetas border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-orange-400 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Financial Scores — {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Cargando datos financieros...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !scoresData) {
    return (
      <Card className="bg-tarjetas border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-orange-400 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Financial Scores — {symbol}
          </CardTitle>
        </CardHeader>
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
      <Card className="h-[492px] bg-tarjetas border-none">
        <CardHeader>
          <CardTitle className="text-orange-400 text-lg flex items-center">
            <div className="text-gray-400 mr-2">
              Financial Scores 
            </div>
            {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Gráfico combinado */}
          <div>
            <h3 className="text-gray-300 text-sm font-medium mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Análisis Financiero Completo
            </h3>
            <div className="h-60">
              {combinedOption ? (
                <ReactECharts
                  echarts={echarts}
                  option={combinedOption}
                  style={{ height: "80%", width: "100%" }}
                  opts={{ renderer: "canvas" }}
                  onEvents={{
                    'click': (params: any) => {
                      if (params.componentType === 'yAxis') {
                        const metricName = params.value;
                        openExplanationModal(metricName);
                      }
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No hay datos suficientes para mostrar el gráfico
                </div>
              )}
            </div>
            
            {/* Resumen de scores */}
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-gray-400">Altman Z-Score</div>
                <div className="text-green-400 font-mono text-lg">
                  {numOrNull((scoresData.raw || scoresData).altmanZScore)?.toFixed(2) || "N/A"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(numOrNull((scoresData.raw || scoresData).altmanZScore) || 0) > 3 ? "Zona Segura" : 
                   (numOrNull((scoresData.raw || scoresData).altmanZScore) || 0) > 1.8 ? "Zona Gris" : "Zona de Riesgo"}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-gray-400">Piotroski Score</div>
                <div className="text-blue-400 font-mono text-lg">
                  {numOrNull((scoresData.raw || scoresData).piotroskiScore) || "N/A"}/9
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(numOrNull((scoresData.raw || scoresData).piotroskiScore) || 0) >= 7 ? "Excelente" : 
                   (numOrNull((scoresData.raw || scoresData).piotroskiScore) || 0) >= 5 ? "Bueno" : "Débil"}
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
                        <span className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
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
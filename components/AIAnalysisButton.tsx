'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, X } from 'lucide-react';

// Interfaces para el análisis global
interface GlobalAnalysisResponse {
  impacto: string;
  analisis: string;
}

interface GlobalAnalysisState {
  isOpen: boolean;
  isLoading: boolean;
  data: GlobalAnalysisResponse | null;
  error: string | null;
}

interface AIAnalysisButtonProps {
  symbol: string;
  // Props para recibir datos de todas las tarjetas
  fundamentalData?: any;
  valoracionData?: any;
  financialScoresData?: any;
  overviewData?: any;
  estimacionData?: any;
  dividendosData?: any;
  desempenoData?: any;
}

const initialGlobalAnalysisState: GlobalAnalysisState = {
  isOpen: false,
  isLoading: false,
  data: null,
  error: null
};

export default function AIAnalysisButton({
  symbol,
  fundamentalData,
  valoracionData,
  financialScoresData,
  overviewData,
  estimacionData,
  dividendosData,
  desempenoData
}: AIAnalysisButtonProps) {
  const [globalAnalysis, setGlobalAnalysis] = useState<GlobalAnalysisState>(initialGlobalAnalysisState);

  const handleGlobalAnalyzeWithAI = async () => {
    if (!symbol) {
      console.error('No symbol provided for global analysis');
      return;
    }

    setGlobalAnalysis({
      isOpen: true,
      isLoading: true,
      data: null,
      error: null
    });

    try {
      // Acceder correctamente a los datos de FMP
      const fmpData = overviewData?.datos || {};
      const fundamentales = fundamentalData || fmpData.fundamentales || {};
      const valoracion = valoracionData || fmpData.valoracion || {};
      const financialScores = financialScoresData || fmpData.financialScores || {};
      
      // NUEVO: Acceder a los scores desde las APIs correctas
      const scoresData = await fetch(`/api/fmp/financial-scores?symbol=${symbol}`).then(r => r.json()).catch(() => ({}));
      const keyMetricsData = await fetch(`/api/fmp/key-metrics?symbol=${symbol}`).then(r => r.json()).catch(() => []);
      const ratiosData = await fetch(`/api/fmp/ratios?symbol=${symbol}`).then(r => r.json()).catch(() => []);
      
      // Extraer datos de las respuestas de FMP
      const latestKeyMetrics = Array.isArray(keyMetricsData) ? keyMetricsData[0] : {};
      const latestRatios = Array.isArray(ratiosData) ? ratiosData[0] : {};
      
      // Debug: mostrar estructura de datos disponibles
      // console.log('Debug - overviewData:', overviewData); // Eliminar en producción
      // console.log('Debug - fundamentalData:', fundamentalData);
      // console.log('Debug - valoracionData:', valoracionData);
      console.log('Debug - financialScoresData:', financialScoresData);
      console.log('Debug - scoresData:', scoresData);
      console.log('Debug - keyMetricsData:', latestKeyMetrics);
      console.log('Debug - ratiosData:', latestRatios);
      
      // Construir el objeto con datos financieros completos
      const globalData = {
        symbol,
        timestamp: new Date().toISOString(),
        chartType: null,
        
        scores: {
          altmanZScore: scoresData?.altmanZ || financialScores?.altmanZScore || fundamentales?.altmanZScore || null,
          altmanInterpretation: scoresData?.altmanInterpretation || financialScores?.altmanInterpretation || null,
          piotroskiScore: scoresData?.piotroski || financialScores?.piotroskiScore || fundamentales?.piotroskiScore || null,
          piotroskiInterpretation: scoresData?.piotroskiInterpretation || financialScores?.piotroskiInterpretation || null
        },
        
        financialData: {
          // Datos de Key Metrics (donde están totalAssets, revenue, etc.)
          totalAssets: latestKeyMetrics?.totalAssets || fundamentales?.totalAssets || null,
          totalLiabilities: latestKeyMetrics?.totalLiabilities || fundamentales?.totalLiabilities || null,
          revenue: latestKeyMetrics?.revenue || latestRatios?.revenue || fundamentales?.revenue || valoracion?.revenue || null,
          ebit: latestKeyMetrics?.ebit || latestRatios?.ebit || fundamentales?.ebit || null,
          marketCap: latestKeyMetrics?.marketCap || valoracion?.marketCap || overviewData?.market_cap || null,
          workingCapital: latestKeyMetrics?.workingCapital || fundamentales?.workingCapital || null,
          retainedEarnings: latestKeyMetrics?.retainedEarnings || fundamentales?.retainedEarnings || null,
          
          // Datos adicionales de ratios y key metrics
          totalRevenue: latestKeyMetrics?.totalRevenue || latestKeyMetrics?.revenue || fundamentales?.totalRevenue || null,
          operatingIncome: latestKeyMetrics?.operatingIncome || fundamentales?.operatingIncome || null,
          netIncome: latestKeyMetrics?.netIncome || fundamentales?.netIncome || null,
          totalDebt: latestKeyMetrics?.totalDebt || fundamentales?.totalDebt || null,
          totalStockholderEquity: latestKeyMetrics?.totalStockholderEquity || fundamentales?.totalStockholderEquity || null,
          freeCashFlow: latestKeyMetrics?.freeCashFlow || latestRatios?.freeCashFlow || fundamentales?.freeCashFlow || null,
          currentRatio: latestRatios?.currentRatio || fundamentales?.currentRatio || null,
          quickRatio: latestRatios?.quickRatio || fundamentales?.quickRatio || null,
          debtToEquity: latestRatios?.debtToEquity || fundamentales?.debtToEquity || null,
          roe: latestRatios?.returnOnEquity || fundamentales?.roe || null,
          roic: latestRatios?.returnOnCapitalEmployed || fundamentales?.roic || null,
          netMargin: latestRatios?.netProfitMargin || fundamentales?.netMargin || null,
          grossMargin: latestRatios?.grossProfitMargin || fundamentales?.grossMargin || null,
          
          // Datos del dashboard que se ven en la imagen
          bookValuePerShare: latestKeyMetrics?.bookValuePerShare || latestRatios?.bookValuePerShare || null,
          priceToBookRatio: latestRatios?.priceToBookRatio || valoracion?.pb || null,
          priceEarningsRatio: latestRatios?.priceEarningsRatio || valoracion?.pe || null,
          enterpriseValue: latestKeyMetrics?.enterpriseValue || null,
          evToEbitda: latestRatios?.enterpriseValueMultiple || valoracion?.evEbitda || null
        },
        
        summary: {
          financialStrength: financialScores?.financialStrength || null,
          hasAltmanScore: Boolean(scoresData?.altmanZ || financialScores?.altmanZScore || fundamentales?.altmanZScore),
          hasPiotroskiScore: Boolean(scoresData?.piotroski || financialScores?.piotroskiScore || fundamentales?.piotroskiScore)
        },
        
        // Agregar datos adicionales para el análisis
        rawData: {
          fundamentales,
          valoracion,
          financialScores,
          estimacion: estimacionData,
          dividendos: dividendosData,
          desempeno: desempenoData,
          // Nuevos datos de FMP APIs
          scoresFromAPI: scoresData,
          keyMetricsFromAPI: latestKeyMetrics,
          ratiosFromAPI: latestRatios
        }
      };

      console.log('Sending complete FMP data to n8n:', globalData);
      console.log('Available data sources:', {
        fundamentalData: !!fundamentalData,
        valoracionData: !!valoracionData,
        financialScoresData: !!financialScoresData,
        overviewData: !!overviewData
      });
  
      const response = await fetch('https://n8n.srv904355.hstgr.cloud/webhook/7fc6b803-531d-45fe-88fa-35df9f21f54d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(globalData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Global analysis response:', result);

      // Procesar la respuesta (asumiendo que viene en español como las otras)
      let processedData: GlobalAnalysisResponse;
      
      if (Array.isArray(result) && result.length > 0) {
        processedData = result[0];
      } else if (result && typeof result === 'object') {
        processedData = result;
      } else {
        throw new Error('Formato de respuesta inesperado');
      }

      // Validar que tenga las claves esperadas
      if (!processedData.impacto || !processedData.analisis) {
        console.warn('Respuesta incompleta:', processedData);
        processedData = {
          impacto: processedData.impacto || 'neutral',
          analisis: processedData.analisis || 'Análisis no disponible'
        };
      }

      setGlobalAnalysis({
        isOpen: true,
        isLoading: false,
        data: processedData,
        error: null
      });

    } catch (error) {
      console.error('Error in global AI analysis:', error);
      setGlobalAnalysis({
        isOpen: true,
        isLoading: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error desconocido en el análisis global'
      });
    }
  };

  const closeGlobalModal = () => {
    setGlobalAnalysis(initialGlobalAnalysisState);
  };

  const getImpactColor = (impact: string) => {
    const lowerImpact = impact?.toLowerCase() || '';
    if (lowerImpact.includes('positivo')) return '#22c55e';
    if (lowerImpact.includes('negativo')) return '#ef4444';
    return '#64748b';
  };

  return (
    <>
      <Button
        onClick={handleGlobalAnalyzeWithAI}
        disabled={globalAnalysis.isLoading || !symbol}
        size="sm"
        variant="outline"
        className="text-xs bg-transparent text-purple-300 hover:bg-purple-600/30 hover:border-purple-500/50 disabled:opacity-50 flex items-center gap-2"
      >
        {globalAnalysis.isLoading ? (
          <>
            <div className="w-3 h-3 border border-purple-300 border-t-transparent rounded-full animate-spin" />
            Analizando...
          </>
        ) : (
          <>
            <Brain className="w-3 h-3" />
            {/* Análisis IA */}
          </>
        )}
      </Button>

      {/* Modal de Análisis Global */}
      {globalAnalysis.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              {/* Header del modal */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  {globalAnalysis.error ? 'Error' : `Análisis Global de ${symbol} con IA`}
                </h2>
                <button
                  onClick={closeGlobalModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido del modal */}
              {globalAnalysis.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
                  <span className="ml-4 text-gray-400 text-lg">Realizando análisis integral de todas las métricas...</span>
                </div>
              ) : globalAnalysis.error ? (
                <div className="text-center py-12">
                  <p className="text-red-400 mb-6 text-lg">{globalAnalysis.error}</p>
                  <button
                    onClick={closeGlobalModal}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              ) : globalAnalysis.data ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ 
                        backgroundColor: getImpactColor(globalAnalysis.data.impacto)
                      }}
                    />
                    <span className="text-lg font-medium text-gray-200">
                      Impacto General: {globalAnalysis.data.impacto}
                    </span>
                  </div>
                  
                  <div className="bg-gray-800/30 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-200 mb-4">Análisis Integral</h3>
                    <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
                      {globalAnalysis.data.analisis}
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={closeGlobalModal}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
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
      // Recopilar todos los datos de las tarjetas
      const globalData = {
        symbol,
        timestamp: new Date().toISOString(),
        analysisType: 'global_comprehensive',
        
        // Datos fundamentales
        fundamental: fundamentalData ? {
          metrics: fundamentalData.metrics || {},
          summary: fundamentalData.summary || '',
          ratios: fundamentalData.ratios || {}
        } : null,
        
        // Datos de valoración
        valoracion: valoracionData ? {
          currentPrice: valoracionData.currentPrice || 0,
          targetPrice: valoracionData.targetPrice || 0,
          metrics: valoracionData.metrics || {},
          valuation: valoracionData.valuation || {}
        } : null,
        
        // Scores financieros
        financialScores: financialScoresData ? {
          altmanZScore: financialScoresData.altmanZScore || 0,
          piotroskiScore: financialScoresData.piotroskiScore || 0,
          metrics: financialScoresData.metrics || {}
        } : null,
        
        // Datos de overview
        overview: overviewData ? {
          profile: overviewData.profile || {},
          marketData: overviewData.marketData || {},
          keyMetrics: overviewData.keyMetrics || {}
        } : null,
        
        // Datos de estimación
        estimacion: estimacionData ? {
          estimates: estimacionData.estimates || [],
          consensus: estimacionData.consensus || {},
          revisions: estimacionData.revisions || []
        } : null,
        
        // Datos de dividendos
        dividendos: dividendosData ? {
          history: dividendosData.history || [],
          yield: dividendosData.yield || 0,
          growth: dividendosData.growth || 0
        } : null,
        
        // Datos de desempeño
        desempeno: desempenoData ? {
          performance: desempenoData.performance || {},
          returns: desempenoData.returns || {},
          volatility: desempenoData.volatility || 0
        } : null
      };

      console.log('Sending global analysis data to n8n:', globalData);

      const response = await fetch('https://n8n.srv904355.hstgr.cloud/webhook-test/19d4e091-5368-4b5e-b4b3-71257abbd92d', {
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
        className="text-xs bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30 hover:border-purple-500/50 disabled:opacity-50 flex items-center gap-2"
      >
        {globalAnalysis.isLoading ? (
          <>
            <div className="w-3 h-3 border border-purple-300 border-t-transparent rounded-full animate-spin" />
            Analizando...
          </>
        ) : (
          <>
            <Brain className="w-3 h-3" />
            Análisis Global IA
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
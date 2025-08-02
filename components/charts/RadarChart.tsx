import React, { useEffect, useRef, useState } from 'react';
import { calculateRadarDimensions, formatRadarData, RadarDimensions } from './StockRadarData';

interface RadarChartProps {
  stockBasicData: any;
  stockAnalysis: any;
}

const RadarChart: React.FC<RadarChartProps> = ({ stockBasicData, stockAnalysis }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [radarData, setRadarData] = useState<RadarDimensions | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Obtener el símbolo de la acción
  const getStockSymbol = (): string | null => {
    return stockBasicData?.symbol || stockBasicData?.datos?.symbol || null;
  };

  // Cargar datos del radar
  const loadRadarData = async () => {
    const symbol = getStockSymbol();
    if (!symbol) {
      console.log('No hay símbolo disponible para el radar');
      // Usar datos por defecto si no hay símbolo
      setRadarData({
        rentabilidad: 50,
        crecimiento: 50,
        solidezFinanciera: 50,
        generacionCaja: 50,
        margen: 50,
        valoracion: 50,
        riesgoVolatilidad: 50
      });
      return;
    }

    setIsLoading(true);
    try {
      const dimensions = await calculateRadarDimensions(symbol);
      if (dimensions) {
        setRadarData(dimensions);
      } else {
        // Usar datos por defecto si no se pueden calcular
        setRadarData({
          rentabilidad: 50,
          crecimiento: 50,
          solidezFinanciera: 50,
          generacionCaja: 50,
          margen: 50,
          valoracion: 50,
          riesgoVolatilidad: 50
        });
      }
    } catch (error) {
      console.error('Error calculando dimensiones del radar:', error);
      // Usar datos por defecto en caso de error
      setRadarData({
        rentabilidad: 50,
        crecimiento: 50,
        solidezFinanciera: 50,
        generacionCaja: 50,
        margen: 50,
        valoracion: 50,
        riesgoVolatilidad: 50
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Cargar Chart.js dinámicamente
    const loadChartJS = async () => {
      if (typeof window !== 'undefined' && !window.Chart) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.async = true;
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
          script.onload = resolve;
        });
      }
    };

    const initChart = async () => {
      await loadChartJS();
      
      if (canvasRef.current && window.Chart && radarData) {
        // Destruir chart anterior si existe
        if (chartRef.current) {
          chartRef.current.destroy();
        }

        const ctx = canvasRef.current.getContext('2d');
        const chartData = formatRadarData(radarData, stockBasicData?.name, getStockSymbol());
        
        chartRef.current = new window.Chart(ctx, {
          type: 'radar',
          data: chartData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              r: {
                beginAtZero: true,
                min: 0,
                max: 100,
                ticks: {
                  display: false, // Esto oculta los números
                  stepSize: 20
                },
                pointLabels: {
                  color: 'rgba(255, 255, 255, 0.9)',
                  font: {
                    size: 12,
                    weight: 'bold'
                  }
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.2)'
                },
                angleLines: {
                  color: 'rgba(255, 255, 255, 0.2)'
                }
              }
            }
          }
        });
      }
    };

    if (radarData) {
      initChart();
    }

    // Cleanup
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [radarData, stockBasicData]);

  // Cargar datos cuando cambie la acción
  useEffect(() => {
    loadRadarData();
  }, [stockBasicData, stockAnalysis]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Calculando métricas...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="w-full h-full" width="400" height="300" style={{ marginRight: '40px' }}></canvas>
      </div>
    </div>
  );
};

export default RadarChart;
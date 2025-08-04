import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Star, Target } from "lucide-react";
import { useEffect, useRef } from "react";

interface EstimacionTabProps {
  selectedStock?: any;
}

export default function EstimacionTab({ selectedStock }: EstimacionTabProps) {
  const chartRef1 = useRef<HTMLCanvasElement>(null);
  const chartRef2 = useRef<HTMLCanvasElement>(null);
  const chartRef3 = useRef<HTMLCanvasElement>(null);
  const chartInstance1 = useRef<any>(null);
  const chartInstance2 = useRef<any>(null);
  const chartInstance3 = useRef<any>(null);

  // Datos de estimación (simulados basados en el JSON)
  const estimacionData = {
    symbol: "AAPL",
    empresa: "Apple Inc.",
    proyecciones: {
      ingresos: {
        "1Y": { base: 460000000000, conservador: 440000000000, optimista: 480000000000 },
        "3Y": { base: 530000000000, conservador: 500000000000, optimista: 570000000000 },
        "5Y": { base: 600000000000, conservador: 550000000000, optimista: 650000000000 }
      },
      netIncome: {
        "1Y": { base: 110000000000, conservador: 100000000000, optimista: 120000000000 },
        "3Y": { base: 130000000000, conservador: 115000000000, optimista: 145000000000 },
        "5Y": { base: 150000000000, conservador: 130000000000, optimista: 170000000000 }
      },
      eps: {
        "1Y": { base: 6.5, conservador: 6.0, optimista: 7.0 },
        "3Y": { base: 7.5, conservador: 6.8, optimista: 8.2 },
        "5Y": { base: 8.8, conservador: 7.5, optimista: 10.0 }
      }
    },
    valoracion_futura: {
      precio_objetivo_12m: {
        base: 220,
        conservador: 205,
        optimista: 240
      },
      metodo: "Múltiplos históricos y estimación de EPS",
      estado_actual: "subvaluada"
    },
    inferencia_historica: {
      fair_value_actual: 215,
      precio_actual: 195,
      upside_potencial: "10.25%"
    },
    drivers_crecimiento: {
      principales: [
        "Expansión de servicios (iCloud, Apple Music, Apple TV+)",
        "Desarrollo en inteligencia artificial y chips propios",
        "Ecosistema cerrado con alta fidelidad del cliente"
      ],
      riesgos: [
        "Altos costos de producción",
        "Dependencia del iPhone",
        "Regulaciones antimonopolio en EE.UU. y Europa"
      ]
    },
    resumen_llm: "Según las proyecciones actuales, Apple podría aumentar sus ingresos de forma sostenida gracias a su ecosistema de servicios y capacidad de innovación en hardware. El precio objetivo a 12 meses ronda los $220, lo que representa un upside del 10% desde el valor actual. La IA considera que la acción está razonablemente valuada con riesgo moderado.",
    comparacion_analistas: {
      consenso_precio_objetivo: 225,
      opinion_promedio: "Buy",
      cantidad_analistas: 38
    },
    rating_futuro_ia: 4,
    riesgo: "amarillo"
  };

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    return `$${num.toFixed(2)}`;
  };

  const getRiskColor = (riesgo: string) => {
    switch (riesgo) {
      case 'verde': return 'bg-green-500';
      case 'amarillo': return 'bg-yellow-500';
      case 'rojo': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-600'}`} 
      />
    ));
  };

  useEffect(() => {
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

    const initCharts = async () => {
      await loadChartJS();
      
      if (window.Chart) {
        // Gráfico de Ingresos
        if (chartRef1.current) {
          if (chartInstance1.current) chartInstance1.current.destroy();
          
          const ctx1 = chartRef1.current.getContext('2d');
          chartInstance1.current = new window.Chart(ctx1, {
            type: 'line',
            data: {
              labels: ['1 Año', '3 Años', '5 Años'],
              datasets: [
                {
                  label: 'Conservador',
                  data: [440, 500, 550],
                  borderColor: 'rgb(239, 68, 68)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  tension: 0.4
                },
                {
                  label: 'Base',
                  data: [460, 530, 600],
                  borderColor: 'rgb(34, 197, 94)',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  tension: 0.4
                },
                {
                  label: 'Optimista',
                  data: [480, 570, 650],
                  borderColor: 'rgb(59, 130, 246)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  tension: 0.4
                }
              ]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Proyección de Ingresos (Miles de Millones)',
                  color: '#10b981'
                },
                legend: {
                  labels: {
                    color: '#10b981'
                  }
                }
              },
              scales: {
                y: {
                  ticks: { color: '#10b981' },
                  grid: { color: 'rgba(16, 185, 129, 0.1)' }
                },
                x: {
                  ticks: { color: '#10b981' },
                  grid: { color: 'rgba(16, 185, 129, 0.1)' }
                }
              }
            }
          });
        }

        // Gráfico de EPS
        if (chartRef2.current) {
          if (chartInstance2.current) chartInstance2.current.destroy();
          
          const ctx2 = chartRef2.current.getContext('2d');
          chartInstance2.current = new window.Chart(ctx2, {
            type: 'bar',
            data: {
              labels: ['1 Año', '3 Años', '5 Años'],
              datasets: [
                {
                  label: 'Conservador',
                  data: [6.0, 6.8, 7.5],
                  backgroundColor: 'rgba(239, 68, 68, 0.7)'
                },
                {
                  label: 'Base',
                  data: [6.5, 7.5, 8.8],
                  backgroundColor: 'rgba(34, 197, 94, 0.7)'
                },
                {
                  label: 'Optimista',
                  data: [7.0, 8.2, 10.0],
                  backgroundColor: 'rgba(59, 130, 246, 0.7)'
                }
              ]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Proyección de EPS ($)',
                  color: '#10b981'
                },
                legend: {
                  labels: {
                    color: '#10b981'
                  }
                }
              },
              scales: {
                y: {
                  ticks: { color: '#10b981' },
                  grid: { color: 'rgba(16, 185, 129, 0.1)' }
                },
                x: {
                  ticks: { color: '#10b981' },
                  grid: { color: 'rgba(16, 185, 129, 0.1)' }
                }
              }
            }
          });
        }

        // Gráfico de Precio Objetivo
        if (chartRef3.current) {
          if (chartInstance3.current) chartInstance3.current.destroy();
          
          const ctx3 = chartRef3.current.getContext('2d');
          chartInstance3.current = new window.Chart(ctx3, {
            type: 'doughnut',
            data: {
              labels: ['Conservador', 'Base', 'Optimista'],
              datasets: [{
                data: [205, 220, 240],
                backgroundColor: [
                  'rgba(239, 68, 68, 0.7)',
                  'rgba(34, 197, 94, 0.7)',
                  'rgba(59, 130, 246, 0.7)'
                ],
                borderColor: [
                  'rgb(239, 68, 68)',
                  'rgb(34, 197, 94)',
                  'rgb(59, 130, 246)'
                ],
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Precio Objetivo 12M ($)',
                  color: '#10b981'
                },
                legend: {
                  labels: {
                    color: '#10b981'
                  }
                }
              }
            }
          });
        }
      }
    };

    initCharts();

    return () => {
      if (chartInstance1.current) chartInstance1.current.destroy();
      if (chartInstance2.current) chartInstance2.current.destroy();
      if (chartInstance3.current) chartInstance3.current.destroy();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header con información básica */}
      <Card className="bg-gray-900/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 text-xl flex items-center gap-2">
            📊 Estimación y Proyecciones - {estimacionData.empresa}
            <Badge variant="outline" className="text-green-400 border-green-400">
              {estimacionData.symbol}
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* 1. Proyección de Crecimiento */}
      <Card className="bg-gray-900/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 text-lg">📊 1. Proyección de Crecimiento</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Tabla Comparativa */}
          <div className="mb-6">
            <h4 className="text-green-300 font-semibold mb-4">Tabla Comparativa por Escenario</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-green-500/30">
                <thead>
                  <tr className="bg-green-500/10">
                    <th className="border border-green-500/30 p-3 text-left text-green-400">Métrica</th>
                    <th className="border border-green-500/30 p-3 text-center text-green-400">Escenario</th>
                    <th className="border border-green-500/30 p-3 text-center text-green-400">1 Año</th>
                    <th className="border border-green-500/30 p-3 text-center text-green-400">3 Años</th>
                    <th className="border border-green-500/30 p-3 text-center text-green-400">5 Años</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Ingresos */}
                  <tr>
                    <td rowSpan={3} className="border border-green-500/30 p-3 text-gray-300 font-medium">Ingresos</td>
                    <td className="border border-green-500/30 p-3 text-red-400">Conservador</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">{formatNumber(estimacionData.proyecciones.ingresos["1Y"].conservador)}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">{formatNumber(estimacionData.proyecciones.ingresos["3Y"].conservador)}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">{formatNumber(estimacionData.proyecciones.ingresos["5Y"].conservador)}</td>
                  </tr>
                  <tr>
                    <td className="border border-green-500/30 p-3 text-green-400">Base</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">{formatNumber(estimacionData.proyecciones.ingresos["1Y"].base)}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">{formatNumber(estimacionData.proyecciones.ingresos["3Y"].base)}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">{formatNumber(estimacionData.proyecciones.ingresos["5Y"].base)}</td>
                  </tr>
                  <tr>
                    <td className="border border-green-500/30 p-3 text-blue-400">Optimista</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">{formatNumber(estimacionData.proyecciones.ingresos["1Y"].optimista)}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">{formatNumber(estimacionData.proyecciones.ingresos["3Y"].optimista)}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">{formatNumber(estimacionData.proyecciones.ingresos["5Y"].optimista)}</td>
                  </tr>
                  {/* EPS */}
                  <tr>
                    <td rowSpan={3} className="border border-green-500/30 p-3 text-gray-300 font-medium">EPS</td>
                    <td className="border border-green-500/30 p-3 text-red-400">Conservador</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">${estimacionData.proyecciones.eps["1Y"].conservador}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">${estimacionData.proyecciones.eps["3Y"].conservador}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">${estimacionData.proyecciones.eps["5Y"].conservador}</td>
                  </tr>
                  <tr>
                    <td className="border border-green-500/30 p-3 text-green-400">Base</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">${estimacionData.proyecciones.eps["1Y"].base}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">${estimacionData.proyecciones.eps["3Y"].base}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">${estimacionData.proyecciones.eps["5Y"].base}</td>
                  </tr>
                  <tr>
                    <td className="border border-green-500/30 p-3 text-blue-400">Optimista</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">${estimacionData.proyecciones.eps["1Y"].optimista}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">${estimacionData.proyecciones.eps["3Y"].optimista}</td>
                    <td className="border border-green-500/30 p-3 text-center text-gray-300">${estimacionData.proyecciones.eps["5Y"].optimista}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <canvas ref={chartRef1} width="400" height="300"></canvas>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <canvas ref={chartRef2} width="400" height="300"></canvas>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Valoración Estimada a Futuro */}
      <Card className="bg-gray-900/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 text-lg">📈 2. Valoración Estimada a Futuro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-green-300 font-semibold mb-4">Precio Objetivo 12 Meses</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-red-500/10 rounded">
                  <span className="text-red-400">Conservador:</span>
                  <span className="text-white font-bold">${estimacionData.valoracion_futura.precio_objetivo_12m.conservador}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-500/10 rounded">
                  <span className="text-green-400">Base:</span>
                  <span className="text-white font-bold">${estimacionData.valoracion_futura.precio_objetivo_12m.base}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded">
                  <span className="text-blue-400">Optimista:</span>
                  <span className="text-white font-bold">${estimacionData.valoracion_futura.precio_objetivo_12m.optimista}</span>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-gray-800/50 rounded">
                <p className="text-gray-300 text-sm mb-2"><strong>Método:</strong> {estimacionData.valoracion_futura.metodo}</p>
                <p className="text-gray-300 text-sm"><strong>Estado actual:</strong> 
                  <Badge className={`ml-2 ${estimacionData.valoracion_futura.estado_actual === 'subvaluada' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {estimacionData.valoracion_futura.estado_actual}
                  </Badge>
                </p>
              </div>
            </div>
            
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <canvas ref={chartRef3} width="300" height="300"></canvas>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Inferencia IA con Histórico */}
      <Card className="bg-gray-900/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 text-lg">🧠 3. Inferencia IA con Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-green-400">${estimacionData.inferencia_historica.fair_value_actual}</div>
              <div className="text-gray-400 text-sm">Fair Value Actual</div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-white">${estimacionData.inferencia_historica.precio_actual}</div>
              <div className="text-gray-400 text-sm">Precio Actual</div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-green-400 flex items-center justify-center gap-1">
                <TrendingUp className="w-5 h-5" />
                {estimacionData.inferencia_historica.upside_potencial}
              </div>
              <div className="text-gray-400 text-sm">Upside Potencial</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Drivers de Crecimiento */}
      <Card className="bg-gray-900/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 text-lg">🏗 4. Drivers de Crecimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-green-300 font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Catalizadores Principales
              </h4>
              <ul className="space-y-2">
                {estimacionData.drivers_crecimiento.principales.map((driver, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-300">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-sm">{driver}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="text-red-300 font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Riesgos Principales
              </h4>
              <ul className="space-y-2">
                {estimacionData.drivers_crecimiento.riesgos.map((riesgo, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-300">
                    <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-sm">{riesgo}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Resumen Explicativo */}
      <Card className="bg-gray-900/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 text-lg">💬 5. Resumen Explicativo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <p className="text-gray-300 leading-relaxed">{estimacionData.resumen_llm}</p>
          </div>
        </CardContent>
      </Card>

      {/* 6. Comparación con Analistas */}
      <Card className="bg-gray-900/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 text-lg">🧩 6. Comparación con Analistas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-green-400">${estimacionData.comparacion_analistas.consenso_precio_objetivo}</div>
              <div className="text-gray-400 text-sm">Consenso Precio Objetivo</div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded text-center">
              <Badge className="bg-green-500 text-white text-lg px-4 py-2">
                {estimacionData.comparacion_analistas.opinion_promedio}
              </Badge>
              <div className="text-gray-400 text-sm mt-2">Opinión Promedio</div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-white">{estimacionData.comparacion_analistas.cantidad_analistas}</div>
              <div className="text-gray-400 text-sm">Analistas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7. Bonus - Gamificación */}
      <Card className="bg-gray-900/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 text-lg">🎯 Bonus - Rating IA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center">
              <h4 className="text-green-300 font-semibold mb-3">⭐ IA Rating Futuro</h4>
              <div className="flex justify-center gap-1 mb-2">
                {getStars(estimacionData.rating_futuro_ia)}
              </div>
              <p className="text-gray-400 text-sm">{estimacionData.rating_futuro_ia}/5 estrellas</p>
            </div>
            
            <div className="text-center">
              <h4 className="text-green-300 font-semibold mb-3">📉 Semáforo de Riesgo</h4>
              <div className="flex justify-center">
                <div className={`w-16 h-16 rounded-full ${getRiskColor(estimacionData.riesgo)} flex items-center justify-center`}>
                  <Target className="w-8 h-8 text-white" />
                </div>
              </div>
              <p className="text-gray-400 text-sm mt-2 capitalize">{estimacionData.riesgo}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
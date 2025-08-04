import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Star, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface EstimacionCardProps {
  selectedStock?: any;
}

export default function EstimacionCard({ selectedStock }: EstimacionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
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
      upside_estimado: 10.26,
      tendencia: "alcista"
    },
    drivers_crecimiento: [
      "Expansión en servicios (App Store, iCloud, Apple Music)",
      "Innovación en productos (iPhone, Mac, iPad)",
      "Crecimiento en mercados emergentes",
      "Ecosistema integrado y fidelidad del cliente"
    ],
    riesgos_limitantes: [
      "Dependencia del iPhone (60% de ingresos)",
      "Competencia intensa en smartphones",
      "Regulaciones antimonopolio",
      "Saturación en mercados desarrollados"
    ],
    resumen_llm: "Apple mantiene una posición sólida con un ecosistema integrado único y alta fidelidad del cliente. Las proyecciones muestran crecimiento sostenido impulsado por servicios e innovación, aunque enfrenta riesgos de dependencia del iPhone y competencia intensa.",
    comparacion_analistas: {
      precio_objetivo_promedio: 225,
      opinion_promedio: "Comprar",
      numero_analistas: 42
    },
    rating_ai_futuro: 4,
    nivel_riesgo: "amarillo"
  };

  // Formatear números grandes
  const formatLargeNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    return `$${num.toLocaleString()}`;
  };

  // Función para renderizar estrellas
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
        }`}
      />
    ));
  };

  // Función para obtener color del semáforo de riesgo
  const getRiskColor = (nivel: string) => {
    switch (nivel) {
      case 'verde': return 'bg-green-500';
      case 'amarillo': return 'bg-yellow-500';
      case 'rojo': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Inicializar gráficos cuando se abre el modal
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      import('chart.js/auto').then((Chart) => {
        // Gráfico de Ingresos
        if (chartRef1.current) {
          if (chartInstance1.current) {
            chartInstance1.current.destroy();
          }
          
          const ctx1 = chartRef1.current.getContext('2d');
          chartInstance1.current = new Chart.default(ctx1, {
            type: 'line',
            data: {
              labels: ['1Y', '3Y', '5Y'],
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
                  color: 'white'
                },
                legend: {
                  labels: {
                    color: 'white'
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  ticks: {
                    color: 'white',
                    callback: function(value: any) {
                      return '$' + value + 'B';
                    }
                  },
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                  }
                },
                x: {
                  ticks: {
                    color: 'white'
                  },
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                  }
                }
              }
            }
          });
        }

        // Gráfico de EPS
        if (chartRef2.current) {
          if (chartInstance2.current) {
            chartInstance2.current.destroy();
          }
          
          const ctx2 = chartRef2.current.getContext('2d');
          chartInstance2.current = new Chart.default(ctx2, {
            type: 'bar',
            data: {
              labels: ['1Y', '3Y', '5Y'],
              datasets: [
                {
                  label: 'Conservador',
                  data: [6.0, 6.8, 7.5],
                  backgroundColor: 'rgba(239, 68, 68, 0.8)'
                },
                {
                  label: 'Base',
                  data: [6.5, 7.5, 8.8],
                  backgroundColor: 'rgba(34, 197, 94, 0.8)'
                },
                {
                  label: 'Optimista',
                  data: [7.0, 8.2, 10.0],
                  backgroundColor: 'rgba(59, 130, 246, 0.8)'
                }
              ]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Proyección de EPS',
                  color: 'white'
                },
                legend: {
                  labels: {
                    color: 'white'
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    color: 'white',
                    callback: function(value: any) {
                      return '$' + value;
                    }
                  },
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                  }
                },
                x: {
                  ticks: {
                    color: 'white'
                  },
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                  }
                }
              }
            }
          });
        }

        // Gráfico de Valoración (Donut)
        if (chartRef3.current) {
          if (chartInstance3.current) {
            chartInstance3.current.destroy();
          }
          
          const ctx3 = chartRef3.current.getContext('2d');
          chartInstance3.current = new Chart.default(ctx3, {
            type: 'doughnut',
            data: {
              labels: ['Conservador', 'Base', 'Optimista'],
              datasets: [{
                data: [205, 220, 240],
                backgroundColor: [
                  'rgba(239, 68, 68, 0.8)',
                  'rgba(34, 197, 94, 0.8)',
                  'rgba(59, 130, 246, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#1f2937'
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Precio Objetivo 12M',
                  color: 'white'
                },
                legend: {
                  labels: {
                    color: 'white'
                  }
                }
              }
            }
          });
        }
      });
    }

    return () => {
      if (chartInstance1.current) chartInstance1.current.destroy();
      if (chartInstance2.current) chartInstance2.current.destroy();
      if (chartInstance3.current) chartInstance3.current.destroy();
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-blue-500/30 cursor-pointer transition-all duration-300 hover:border-[#00BFFF] hover:shadow-lg hover:shadow-[#00BFFF]/20">
          <CardHeader>
            <CardTitle className="text-blue-400 text-lg flex items-center gap-2">
              📊 Estimación
              <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                AI Analysis
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Precio Objetivo:</span>
                  <span className="text-blue-400 font-mono">
                    ${estimacionData.valoracion_futura.precio_objetivo_12m.base}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fair Value:</span>
                  <span className="text-blue-400 font-mono">
                    ${estimacionData.inferencia_historica.fair_value_actual}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Upside:</span>
                  <span className="text-green-400 font-mono">
                    +{estimacionData.inferencia_historica.upside_estimado}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rating AI:</span>
                  <div className="flex">
                    {renderStars(estimacionData.rating_ai_futuro)}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center text-xs text-gray-500">
              Click para ver análisis completo
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-900 border-blue-500/30">
        <DialogHeader>
          <DialogTitle className="text-blue-400 text-xl flex items-center gap-2">
            📊 Análisis de Estimación - {estimacionData.empresa}
            <Badge variant="outline" className="border-blue-500/50 text-blue-400">
              {estimacionData.symbol}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 1. PROYECCIONES DE CRECIMIENTO */}
          <Card className="bg-gray-800/50 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-blue-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                1. Proyecciones de Crecimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabla Comparativa */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">Métrica</th>
                      <th className="text-center py-2 px-3 text-red-400">Conservador</th>
                      <th className="text-center py-2 px-3 text-green-400">Base</th>
                      <th className="text-center py-2 px-3 text-blue-400">Optimista</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3 font-medium text-gray-300">Ingresos 1Y</td>
                      <td className="text-center py-2 px-3 text-red-400">{formatLargeNumber(estimacionData.proyecciones.ingresos["1Y"].conservador)}</td>
                      <td className="text-center py-2 px-3 text-green-400">{formatLargeNumber(estimacionData.proyecciones.ingresos["1Y"].base)}</td>
                      <td className="text-center py-2 px-3 text-blue-400">{formatLargeNumber(estimacionData.proyecciones.ingresos["1Y"].optimista)}</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3 font-medium text-gray-300">Ingresos 5Y</td>
                      <td className="text-center py-2 px-3 text-red-400">{formatLargeNumber(estimacionData.proyecciones.ingresos["5Y"].conservador)}</td>
                      <td className="text-center py-2 px-3 text-green-400">{formatLargeNumber(estimacionData.proyecciones.ingresos["5Y"].base)}</td>
                      <td className="text-center py-2 px-3 text-blue-400">{formatLargeNumber(estimacionData.proyecciones.ingresos["5Y"].optimista)}</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3 font-medium text-gray-300">EPS 1Y</td>
                      <td className="text-center py-2 px-3 text-red-400">${estimacionData.proyecciones.eps["1Y"].conservador}</td>
                      <td className="text-center py-2 px-3 text-green-400">${estimacionData.proyecciones.eps["1Y"].base}</td>
                      <td className="text-center py-2 px-3 text-blue-400">${estimacionData.proyecciones.eps["1Y"].optimista}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-medium text-gray-300">EPS 5Y</td>
                      <td className="text-center py-2 px-3 text-red-400">${estimacionData.proyecciones.eps["5Y"].conservador}</td>
                      <td className="text-center py-2 px-3 text-green-400">${estimacionData.proyecciones.eps["5Y"].base}</td>
                      <td className="text-center py-2 px-3 text-blue-400">${estimacionData.proyecciones.eps["5Y"].optimista}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <canvas ref={chartRef1} width="400" height="300"></canvas>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <canvas ref={chartRef2} width="400" height="300"></canvas>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. VALORACIÓN FUTURA ESTIMADA */}
          <Card className="bg-gray-800/50 border-green-500/30">
            <CardHeader>
              <CardTitle className="text-green-400 flex items-center gap-2">
                <Target className="w-5 h-5" />
                2. Valoración Futura Estimada (12 meses)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-red-900/30 p-3 rounded-lg">
                      <div className="text-red-400 font-bold text-lg">${estimacionData.valoracion_futura.precio_objetivo_12m.conservador}</div>
                      <div className="text-xs text-gray-400">Conservador</div>
                    </div>
                    <div className="bg-green-900/30 p-3 rounded-lg border border-green-500/50">
                      <div className="text-green-400 font-bold text-lg">${estimacionData.valoracion_futura.precio_objetivo_12m.base}</div>
                      <div className="text-xs text-gray-400">Base</div>
                    </div>
                    <div className="bg-blue-900/30 p-3 rounded-lg">
                      <div className="text-blue-400 font-bold text-lg">${estimacionData.valoracion_futura.precio_objetivo_12m.optimista}</div>
                      <div className="text-xs text-gray-400">Optimista</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Método:</span>
                      <span className="text-green-400 text-sm">{estimacionData.valoracion_futura.metodo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Estado actual:</span>
                      <Badge variant="outline" className="border-green-500/50 text-green-400">
                        {estimacionData.valoracion_futura.estado_actual}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <canvas ref={chartRef3} width="300" height="300"></canvas>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. INFERENCIA IA CON HISTORIAL */}
          <Card className="bg-gray-800/50 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-purple-400 flex items-center gap-2">
                🤖 3. Inferencia IA con Historial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-purple-900/20 p-4 rounded-lg text-center">
                  <div className="text-purple-400 font-bold text-2xl">${estimacionData.inferencia_historica.fair_value_actual}</div>
                  <div className="text-gray-400 text-sm">Fair Value Hoy</div>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg text-center">
                  <div className="text-gray-300 font-bold text-2xl">${estimacionData.inferencia_historica.precio_actual}</div>
                  <div className="text-gray-400 text-sm">Precio Actual</div>
                </div>
                <div className="bg-green-900/20 p-4 rounded-lg text-center">
                  <div className="text-green-400 font-bold text-2xl flex items-center justify-center gap-1">
                    <TrendingUp className="w-5 h-5" />
                    +{estimacionData.inferencia_historica.upside_estimado}%
                  </div>
                  <div className="text-gray-400 text-sm">Upside Estimado</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. DRIVERS DE CRECIMIENTO Y RIESGOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-800/50 border-green-500/30">
              <CardHeader>
                <CardTitle className="text-green-400 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  4. Drivers de Crecimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {estimacionData.drivers_crecimiento.map((driver, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-gray-300">{driver}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Riesgos Limitantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {estimacionData.riesgos_limitantes.map((riesgo, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-gray-300">{riesgo}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* 5. RESUMEN EXPLICATIVO */}
          <Card className="bg-gray-800/50 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-blue-400">5. Resumen Explicativo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 leading-relaxed">
                {estimacionData.resumen_llm}
              </p>
            </CardContent>
          </Card>

          {/* 6. COMPARACIÓN CON ANALISTAS */}
          <Card className="bg-gray-800/50 border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-yellow-400">6. Comparación con Analistas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-yellow-400 font-bold text-xl">${estimacionData.comparacion_analistas.precio_objetivo_promedio}</div>
                  <div className="text-gray-400 text-sm">Precio Objetivo Promedio</div>
                </div>
                <div className="text-center">
                  <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                    {estimacionData.comparacion_analistas.opinion_promedio}
                  </Badge>
                  <div className="text-gray-400 text-sm mt-1">Opinión Promedio</div>
                </div>
                <div className="text-center">
                  <div className="text-yellow-400 font-bold text-xl">{estimacionData.comparacion_analistas.numero_analistas}</div>
                  <div className="text-gray-400 text-sm">Analistas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 7. BONUS - GAMIFICACIÓN */}
          <Card className="bg-gray-800/50 border-orange-500/30">
            <CardHeader>
              <CardTitle className="text-orange-400">🎯 Bonus - Evaluación AI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-orange-400 text-sm mb-2">Rating AI Futuro</div>
                  <div className="flex justify-center gap-1">
                    {renderStars(estimacionData.rating_ai_futuro)}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">{estimacionData.rating_ai_futuro}/5 estrellas</div>
                </div>
                <div className="text-center">
                  <div className="text-orange-400 text-sm mb-2">Semáforo de Riesgo</div>
                  <div className="flex justify-center">
                    <div className={`w-8 h-8 rounded-full ${getRiskColor(estimacionData.nivel_riesgo)}`}></div>
                  </div>
                  <div className="text-gray-400 text-xs mt-1 capitalize">{estimacionData.nivel_riesgo}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
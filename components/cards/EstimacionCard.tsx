'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Star, Target, BarChart3, DollarSign, Brain, Zap, Shield, FileText, Users, Award } from "lucide-react";

interface EstimacionCardProps {
  selectedStock?: { symbol?: string; name?: string; price?: number } | null;
}

interface AnalystEstimate {
  symbol: string;
  date: string;
  revenueLow: number;
  revenueHigh: number;
  revenueAvg: number;
  ebitdaLow: number;
  ebitdaHigh: number;
  ebitdaAvg: number;
  ebitLow: number;
  ebitHigh: number;
  ebitAvg: number;
  netIncomeLow: number;
  netIncomeHigh: number;
  netIncomeAvg: number;
  sgaExpenseLow: number;
  sgaExpenseHigh: number;
  sgaExpenseAvg: number;
  epsAvg: number;
  epsHigh: number;
  epsLow: number;
  numAnalystsRevenue: number;
  numAnalystsEps: number;
}

const formatMoney = (value: number, isLarge = false): string => {
  if (isLarge) {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';
  
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-5 w-5 text-blue-400" />
        {trend && (
          <TrendingUp className={`h-4 w-4 ${trendColor} ${trend === 'down' ? 'rotate-180' : ''}`} />
        )}
      </div>
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-sm text-gray-400">{title}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

// Nuevo componente para la sección de Inferencia IA
function AIInferenceSection({ selectedStock }: { selectedStock?: { symbol?: string; name?: string; price?: number } | null }) {
  // Datos simulados para demostración - en producción vendrían de la API
  const fairValue = selectedStock?.symbol === 'AAPL' ? 215 : selectedStock?.symbol === 'TSLA' ? 280 : 195;
  const currentPrice = selectedStock?.price || 195;
  const upside = ((fairValue - currentPrice) / currentPrice * 100);
  
  return (
    <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-6 border border-purple-500/30">
      <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
        <Brain className="h-6 w-6" />
        🤖 3. Inferencia IA con Historial
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">${fairValue}</div>
          <div className="text-sm text-gray-400">Fair Value Hoy</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">${currentPrice}</div>
          <div className="text-sm text-gray-400">Precio Actual</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold flex items-center justify-center gap-1 ">
            <TrendingUp className={`h-5 w-5 ${upside < 0 ? 'rotate-180' : ''}`} />
            {upside > 0 ? '+' : ''}{upside.toFixed(2)}%
          </div>
          <div className="text-sm text-gray-400">Upside Estimado</div>
        </div>
      </div>
    </div>
  );
}

// Nuevo componente para Drivers de Crecimiento
function GrowthDriversSection({ selectedStock }: { selectedStock?: { symbol?: string; name?: string; price?: number } | null }) {
  // Datos simulados basados en el símbolo
  const getDrivers = () => {
    if (selectedStock?.symbol === 'AAPL') {
      return [
        "Expansión en servicios (App Store, iCloud, Apple Music)",
        "Innovación en productos (iPhone, Mac, iPad)",
        "Crecimiento en mercados emergentes",
        "Ecosistema integrado y fidelidad del cliente"
      ];
    }
    return ["Próximamente"];
  };
  
  return (
    <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-lg p-6 border border-green-500/30">
      <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
        <TrendingUp className="h-6 w-6" />
        📈 4. Drivers de Crecimiento
      </h3>
      
      <div className="space-y-3">
        {getDrivers().map((driver, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
            <span className="text-gray-300">{driver}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Nuevo componente para Riesgos Limitantes
function LimitingRisksSection({ selectedStock }: { selectedStock?: { symbol?: string; name?: string; price?: number } | null }) {
  // Datos simulados basados en el símbolo
  const getRisks = () => {
    if (selectedStock?.symbol === 'AAPL') {
      return [
        "Dependencia del iPhone (60% de ingresos)",
        "Competencia intensa en smartphones",
        "Regulaciones antimonopolio",
        "Saturación en mercados desarrollados"
      ];
    }
    return ["Próximamente"];
  };
  
  return (
    <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 rounded-lg p-6 border border-red-500/30">
      <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
        <AlertTriangle className="h-6 w-6" />
        ⚠️ Riesgos Limitantes
      </h3>
      
      <div className="space-y-3">
        {getRisks().map((risk, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
            <span className="text-gray-300">{risk}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Nuevo componente para Resumen Explicativo
function ExplanatorySummarySection() {
  return (
    <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-lg p-6 border border-blue-500/30">
      <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
        <FileText className="h-6 w-6" />
        📋 5. Resumen Explicativo
      </h3>
      
      <div className="text-center py-8">
        <div className="text-gray-400">Análisis próximamente disponible</div>
      </div>
    </div>
  );
}

// Nuevo componente para Comparación con Analistas
function AnalystComparisonSection() {
  return (
    <div className="bg-gradient-to-r from-yellow-900/30 to-amber-900/30 rounded-lg p-6 border border-yellow-500/30">
      <h3 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
        <Users className="h-6 w-6" />
        👥 6. Comparación con Analistas
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-yellow-400">$0</div>
          <div className="text-sm text-gray-400 mt-1">Precio Objetivo Promedio</div>
        </div>
        <div className="text-center">
          <Badge className="bg-yellow-600 text-white px-3 py-1">
            Próximamente
          </Badge>
          <div className="text-sm text-gray-400 mt-2">Opinión Promedio</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-yellow-400">0</div>
          <div className="text-sm text-gray-400 mt-1">Analistas</div>
        </div>
      </div>
    </div>
  );
}

// Nuevo componente para Evaluación AI
function AIEvaluationSection() {
  return (
    <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-lg p-6 border border-orange-500/30">
      <h3 className="text-xl font-bold text-orange-400 mb-4 flex items-center gap-2">
        <Award className="h-6 w-6" />
        🎯 Bonus - Evaluación AI
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-300 mb-2">Rating AI Futuro</div>
          <div className="flex justify-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="h-6 w-6 text-gray-600 fill-gray-600" />
            ))}
          </div>
          <div className="text-sm text-gray-400">0/5 estrellas</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-300 mb-2">Semáforo de Riesgo</div>
          <div className="w-16 h-16 bg-yellow-500 rounded-full mx-auto mb-2 flex items-center justify-center">
            <div className="w-8 h-8 bg-yellow-400 rounded-full"></div>
          </div>
          <div className="text-sm text-yellow-400 font-medium">Amarillo</div>
        </div>
      </div>
    </div>
  );
}

function EstimateTable({ estimates }: { estimates: AnalystEstimate[] }) {
  if (estimates.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No hay estimaciones disponibles</p>
      </div>
    );
  }

  // Filtrar solo años futuros
  const currentYear = new Date().getFullYear();
  const futureEstimates = estimates.filter(est => {
    const year = new Date(est.date).getFullYear();
    return year >= currentYear;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      {/* Revenue Table */}
      <div>
        <h4 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Proyecciones de Ingresos
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 text-gray-300">Año</th>
                <th className="text-right py-2 text-gray-300">Conservador</th>
                <th className="text-right py-2 text-gray-300">Promedio</th>
                <th className="text-right py-2 text-gray-300">Optimista</th>
                <th className="text-right py-2 text-gray-300">Analistas</th>
              </tr>
            </thead>
            <tbody>
              {futureEstimates.map((estimate) => {
                const year = new Date(estimate.date).getFullYear();
                return (
                  <tr key={estimate.date} className="border-b border-gray-800">
                    <td className="py-2 text-white font-medium">{year}</td>
                    <td className="py-2 text-right text-red-400">{formatMoney(estimate.revenueLow, true)}</td>
                    <td className="py-2 text-right text-blue-400 font-semibold">{formatMoney(estimate.revenueAvg, true)}</td>
                    <td className="py-2 text-right text-green-400">{formatMoney(estimate.revenueHigh, true)}</td>
                    <td className="py-2 text-right text-gray-400">{estimate.numAnalystsRevenue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* EPS Table */}
      <div>
        <h4 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
          <Target className="h-5 w-5" />
          Proyecciones de EPS
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 text-gray-300">Año</th>
                <th className="text-right py-2 text-gray-300">Conservador</th>
                <th className="text-right py-2 text-gray-300">Promedio</th>
                <th className="text-right py-2 text-gray-300">Optimista</th>
                <th className="text-right py-2 text-gray-300">Analistas</th>
              </tr>
            </thead>
            <tbody>
              {futureEstimates.map((estimate) => {
                const year = new Date(estimate.date).getFullYear();
                return (
                  <tr key={estimate.date} className="border-b border-gray-800">
                    <td className="py-2 text-white font-medium">{year}</td>
                    <td className="py-2 text-right text-red-400">{formatMoney(estimate.epsLow)}</td>
                    <td className="py-2 text-right text-blue-400 font-semibold">{formatMoney(estimate.epsAvg)}</td>
                    <td className="py-2 text-right text-green-400">{formatMoney(estimate.epsHigh)}</td>
                    <td className="py-2 text-right text-gray-400">{estimate.numAnalystsEps}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* EBITDA Table */}
      <div>
        <h4 className="text-lg font-semibold text-blue-400 mb-3">Proyecciones de EBITDA</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 text-gray-300">Año</th>
                <th className="text-right py-2 text-gray-300">Conservador</th>
                <th className="text-right py-2 text-gray-300">Promedio</th>
                <th className="text-right py-2 text-gray-300">Optimista</th>
              </tr>
            </thead>
            <tbody>
              {futureEstimates.map((estimate) => {
                const year = new Date(estimate.date).getFullYear();
                return (
                  <tr key={estimate.date} className="border-b border-gray-800">
                    <td className="py-2 text-white font-medium">{year}</td>
                    <td className="py-2 text-right text-red-400">{formatMoney(estimate.ebitdaLow, true)}</td>
                    <td className="py-2 text-right text-blue-400 font-semibold">{formatMoney(estimate.ebitdaAvg, true)}</td>
                    <td className="py-2 text-right text-green-400">{formatMoney(estimate.ebitdaHigh, true)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Net Income Table */}
      <div>
        <h4 className="text-lg font-semibold text-blue-400 mb-3">Proyecciones de Ingreso Neto</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 text-gray-300">Año</th>
                <th className="text-right py-2 text-gray-300">Conservador</th>
                <th className="text-right py-2 text-gray-300">Promedio</th>
                <th className="text-right py-2 text-gray-300">Optimista</th>
              </tr>
            </thead>
            <tbody>
              {futureEstimates.map((estimate) => {
                const year = new Date(estimate.date).getFullYear();
                return (
                  <tr key={estimate.date} className="border-b border-gray-800">
                    <td className="py-2 text-white font-medium">{year}</td>
                    <td className="py-2 text-right text-red-400">{formatMoney(estimate.netIncomeLow, true)}</td>
                    <td className="py-2 text-right text-blue-400 font-semibold">{formatMoney(estimate.netIncomeAvg, true)}</td>
                    <td className="py-2 text-right text-green-400">{formatMoney(estimate.netIncomeHigh, true)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function EstimacionCard({ selectedStock }: EstimacionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [estimates, setEstimates] = useState<AnalystEstimate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const chartRef1 = useRef<HTMLCanvasElement>(null);
  const chartRef2 = useRef<HTMLCanvasElement>(null);
  const chartInstance1 = useRef<any>(null);
  const chartInstance2 = useRef<any>(null);

  // Fetch estimates data usando la URL exacta que funciona
  useEffect(() => {
    if (!selectedStock?.symbol) {
      setEstimates([]);
      setError(null);
      return;
    }

    const fetchEstimates = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiKey = 'CoxPU7bKfCKHpDpSE1pxpVVQ2jGKjZzK';
        const url = `https://financialmodelingprep.com/stable/analyst-estimates?symbol=${selectedStock.symbol}&period=annual&page=0&limit=10&apikey=${apiKey}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setEstimates(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching estimates:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setEstimates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEstimates();
  }, [selectedStock?.symbol]);

  const futureEstimates = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return estimates.filter(est => {
      const year = new Date(est.date).getFullYear();
      return year >= currentYear;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [estimates]);

  const totalAnalysts = useMemo(() => {
    if (futureEstimates.length === 0) return 0;
    return Math.max(...futureEstimates.map(est => Math.max(est.numAnalystsRevenue || 0, est.numAnalystsEps || 0)));
  }, [futureEstimates]);

  // Charts
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || futureEstimates.length === 0) return;

    import("chart.js/auto").then((mod) => {
      const Chart = mod.default;

      const ctx1 = chartRef1.current?.getContext("2d");
      const ctx2 = chartRef2.current?.getContext("2d");
      if (!ctx1 || !ctx2) return;

      // Revenue Chart
      chartInstance1.current?.destroy();
      chartInstance1.current = new Chart(ctx1, {
        type: "line",
        data: {
          labels: futureEstimates.map(est => new Date(est.date).getFullYear().toString()),
          datasets: [
            {
              label: "Conservador",
              data: futureEstimates.map(est => est.revenueLow / 1e9),
              borderColor: "rgba(239,68,68,0.8)",
              backgroundColor: "rgba(239,68,68,0.1)",
              tension: 0.4
            },
            {
              label: "Promedio",
              data: futureEstimates.map(est => est.revenueAvg / 1e9),
              borderColor: "rgba(59,130,246,0.8)",
              backgroundColor: "rgba(59,130,246,0.1)",
              tension: 0.4
            },
            {
              label: "Optimista",
              data: futureEstimates.map(est => est.revenueHigh / 1e9),
              borderColor: "rgba(34,197,94,0.8)",
              backgroundColor: "rgba(34,197,94,0.1)",
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: "Proyecciones de Ingresos (Billions)", color: "white" },
            legend: { labels: { color: "white" } }
          },
          scales: {
            x: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } },
            y: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } }
          }
        }
      });

      // EPS Chart
      chartInstance2.current?.destroy();
      chartInstance2.current = new Chart(ctx2, {
        type: "bar",
        data: {
          labels: futureEstimates.map(est => new Date(est.date).getFullYear().toString()),
          datasets: [
            {
              label: "Conservador",
              data: futureEstimates.map(est => est.epsLow),
              backgroundColor: "rgba(239,68,68,0.8)"
            },
            {
              label: "Promedio",
              data: futureEstimates.map(est => est.epsAvg),
              backgroundColor: "rgba(59,130,246,0.8)"
            },
            {
              label: "Optimista",
              data: futureEstimates.map(est => est.epsHigh),
              backgroundColor: "rgba(34,197,94,0.8)"
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: "Proyecciones de EPS", color: "white" },
            legend: { labels: { color: "white" } }
          },
          scales: {
            x: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } },
            y: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } }
          }
        }
      });
    });

    return () => {
      chartInstance1.current?.destroy();
      chartInstance2.current?.destroy();
    };
  }, [isOpen, futureEstimates]);

  const getQualityBadge = () => {
    const years = futureEstimates.length;
    const analysts = totalAnalysts;
    
    if (years >= 4 && analysts >= 20) return { text: "Excelente", color: "bg-green-500" };
    if (years >= 3 && analysts >= 10) return { text: "Buena", color: "bg-blue-500" };
    if (years >= 2 && analysts >= 5) return { text: "Regular", color: "bg-yellow-500" };
    return { text: "Limitada", color: "bg-red-500" };
  };

  const qualityBadge = getQualityBadge();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-blue-500/30 cursor-pointer transition-all duration-300 hover:border-[#00BFFF] hover:shadow-lg hover:shadow-[#00BFFF]/20">
          <CardHeader>
            <CardTitle className="text-blue-400 text-lg flex items-center gap-2">
              📊 Estimaciones de Analistas
              <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                {loading ? "Cargando..." : "Análisis"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4"></div>
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Error al cargar datos</span>
              </div>
            ) : futureEstimates.length === 0 ? (
              <div className="text-gray-400 text-sm">No hay estimaciones disponibles</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  title="Años Proyectados"
                  value={futureEstimates.length.toString()}
                  icon={BarChart3}
                  trend="neutral"
                />
                <StatCard
                  title="Total Analistas"
                  value={totalAnalysts.toString()}
                  icon={Star}
                  trend="neutral"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-400 flex items-center gap-3">
            📊 Estimaciones de Analistas - {selectedStock?.symbol}
            <Badge className={`${qualityBadge.color} text-white`}>
              Calidad: {qualityBadge.text}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-800 rounded animate-pulse"></div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-400 text-lg">Error al cargar las estimaciones</p>
              <p className="text-gray-400 text-sm mt-2">{error}</p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                  title="Años Disponibles"
                  value={futureEstimates.length.toString()}
                  subtitle={futureEstimates.length > 0 ? `${new Date(futureEstimates[0].date).getFullYear()} - ${new Date(futureEstimates[futureEstimates.length - 1].date).getFullYear()}` : ""}
                  icon={BarChart3}
                  trend="neutral"
                />
                <StatCard
                  title="Total Analistas"
                  value={totalAnalysts.toString()}
                  subtitle="Siguiendo la acción"
                  icon={Star}
                  trend="neutral"
                />
                <StatCard
                  title="Métricas"
                  value="4"
                  subtitle="Revenue, EPS, EBITDA, Net Income"
                  icon={Target}
                  trend="neutral"
                />
                <StatCard
                  title="Última Actualización"
                  value="Reciente"
                  subtitle="Datos de FMP"
                  icon={TrendingUp}
                  trend="up"
                />
              </div>

              {/* Charts */}
              {futureEstimates.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <canvas ref={chartRef1} className="w-full h-64"></canvas>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <canvas ref={chartRef2} className="w-full h-64"></canvas>
                  </div>
                </div>
              )}

              {/* Detailed Tables */}
              <EstimateTable estimates={futureEstimates} />
              
              {/* NUEVAS SECCIONES AGREGADAS */}
              
              {/* AI Inference Section */}
              <AIInferenceSection selectedStock={selectedStock} />
              
              {/* Growth Drivers and Limiting Risks - Side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GrowthDriversSection selectedStock={selectedStock} />
                <LimitingRisksSection selectedStock={selectedStock} />
              </div>
              
              {/* Explanatory Summary */}
              <ExplanatorySummarySection />
              
              {/* Analyst Comparison */}
              <AnalystComparisonSection />
              
              {/* AI Evaluation */}
              <AIEvaluationSection />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
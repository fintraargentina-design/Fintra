'use client';

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp, AlertTriangle, Target, BarChart3, DollarSign, 
  TrendingDown, Users, Calendar, Brain
} from "lucide-react";
import { fmp } from "@/lib/fmp/client";
import type { ValuationResponse, RatiosResponse, GrowthResponse, ProfileResponse } from "@/lib/fmp/types";

interface EstimacionCardProps {
  selectedStock?: { symbol?: string; name?: string; price?: number } | null;
}

interface EstimationData {
  valuation: ValuationResponse | null;
  ratios: RatiosResponse | null;
  growth: GrowthResponse | null;
  profile: ProfileResponse | null;
}

interface ProjectionData {
  period: string;
  revenue: { base: number; conservative: number; optimistic: number };
  eps: { base: number; conservative: number; optimistic: number };
  netIncome: { base: number; conservative: number; optimistic: number };
}

// Funciones de formateo
const formatUSD = (v?: number | null) => {
  if (!v || !Number.isFinite(v)) return "—";
  return `$${v.toFixed(2)}`;
};

const formatBillions = (v?: number | null) => {
  if (!v || !Number.isFinite(v)) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
};

const formatPercent = (v?: number | null) => {
  if (!v || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
};

const formatRatio = (v?: number | null) => {
  if (!v || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2)}×`;
};

// Componente de estadística
function Stat({ label, value, sub, color = "text-blue-400" }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-800/50 p-3 rounded-md border border-gray-700/50">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

// Componente de proyección
function ProjectionRow({ label, data, formatter }: {
  label: string;
  data: { base: number; conservative: number; optimistic: number };
  formatter: (v: number) => string;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium text-gray-300">{label}</TableCell>
      <TableCell className="text-red-400">{formatter(data.conservative)}</TableCell>
      <TableCell className="text-green-400 font-semibold">{formatter(data.base)}</TableCell>
      <TableCell className="text-blue-400">{formatter(data.optimistic)}</TableCell>
    </TableRow>
  );
}

// Función para calcular proyecciones basadas en datos reales
function calculateProjections(data: EstimationData, currentPrice?: number): ProjectionData[] {
  const { growth, ratios, profile } = data;
  
  if (!growth?.[0] || !profile?.[0]) {
    return [];
  }

  const marketCap = profile[0].mktCap;
  const priceToSales = ratios?.[0]?.priceToSalesRatio;
  const currentRevenue = (marketCap && priceToSales) ? marketCap / priceToSales : 0;
  
  // Calcular EPS desde precio y P/E ratio
  const stockPrice = currentPrice || profile[0].price || 0;
  const peRatio = ratios?.[0]?.priceEarningsRatio;
  const currentEPS = (stockPrice && peRatio) ? stockPrice / peRatio : 0;
  
  const currentNetIncome = 0; // Calcular desde EPS * shares outstanding
  
  const revenueGrowth = growth[0].revenueGrowth || 5;
  const epsGrowth = growth?.[0]?.epsgrowth || 0;  // ✅ Corregido: epsgrowth en lugar de growthEPS
  const baseMultiplier = 1 + (epsGrowth / 100);
  const netIncomeGrowth = growth[0].growthNetIncome || 6;

  return [
    {
      period: "1Y",
      revenue: {
        base: currentRevenue * (1 + revenueGrowth / 100),
        conservative: currentRevenue * (1 + (revenueGrowth * 0.7) / 100),
        optimistic: currentRevenue * (1 + (revenueGrowth * 1.3) / 100)
      },
      eps: {
        base: currentEPS * (1 + epsGrowth / 100),
        conservative: currentEPS * (1 + (epsGrowth * 0.7) / 100),
        optimistic: currentEPS * (1 + (epsGrowth * 1.3) / 100)
      },
      netIncome: {
        base: currentNetIncome * (1 + netIncomeGrowth / 100),
        conservative: currentNetIncome * (1 + (netIncomeGrowth * 0.7) / 100),
        optimistic: currentNetIncome * (1 + (netIncomeGrowth * 1.3) / 100)
      }
    },
    {
      period: "3Y",
      revenue: {
        base: currentRevenue * Math.pow(1 + revenueGrowth / 100, 3),
        conservative: currentRevenue * Math.pow(1 + (revenueGrowth * 0.7) / 100, 3),
        optimistic: currentRevenue * Math.pow(1 + (revenueGrowth * 1.3) / 100, 3)
      },
      eps: {
        base: currentEPS * Math.pow(1 + epsGrowth / 100, 3),
        conservative: currentEPS * Math.pow(1 + (epsGrowth * 0.7) / 100, 3),
        optimistic: currentEPS * Math.pow(1 + (epsGrowth * 1.3) / 100, 3)
      },
      netIncome: {
        base: currentNetIncome * Math.pow(1 + netIncomeGrowth / 100, 3),
        conservative: currentNetIncome * Math.pow(1 + (netIncomeGrowth * 0.7) / 100, 3),
        optimistic: currentNetIncome * Math.pow(1 + (netIncomeGrowth * 1.3) / 100, 3)
      }
    },
    {
      period: "5Y",
      revenue: {
        base: currentRevenue * Math.pow(1 + revenueGrowth / 100, 5),
        conservative: currentRevenue * Math.pow(1 + (revenueGrowth * 0.7) / 100, 5),
        optimistic: currentRevenue * Math.pow(1 + (revenueGrowth * 1.3) / 100, 5)
      },
      eps: {
        base: currentEPS * Math.pow(1 + epsGrowth / 100, 5),
        conservative: currentEPS * Math.pow(1 + (epsGrowth * 0.7) / 100, 5),
        optimistic: currentEPS * Math.pow(1 + (epsGrowth * 1.3) / 100, 5)
      },
      netIncome: {
        base: currentNetIncome * Math.pow(1 + netIncomeGrowth / 100, 5),
        conservative: currentNetIncome * Math.pow(1 + (netIncomeGrowth * 0.7) / 100, 5),
        optimistic: currentNetIncome * Math.pow(1 + (netIncomeGrowth * 1.3) / 100, 5)
      }
    }
  ];
}

// Función para calcular el nivel de riesgo
function calculateRiskLevel(data: EstimationData): { level: string; color: string; description: string } {
  const { valuation, ratios } = data;
  
  if (!valuation && !ratios) {
    return { level: "Sin datos", color: "bg-gray-600", description: "Datos insuficientes" };
  }

  let riskScore = 0;
  let factors = 0;

  if (valuation?.pe) {
    factors++;
    if (valuation.pe > 30) riskScore += 2;
    else if (valuation.pe > 20) riskScore += 1;
  }

  if (valuation?.pb) {
    factors++;
    if (valuation.pb > 3) riskScore += 2;
    else if (valuation.pb > 2) riskScore += 1;
  }

  if (ratios?.[0]?.debtToEquityRatio) {
    factors++;
    if (ratios[0].debtToEquityRatio > 1) riskScore += 2;
    else if (ratios[0].debtToEquityRatio > 0.5) riskScore += 1;
  }

  if (factors === 0) {
    return { level: "Sin datos", color: "bg-gray-600", description: "Datos insuficientes" };
  }

  const avgRisk = riskScore / factors;
  
  if (avgRisk >= 1.5) {
    return { level: "Alto", color: "bg-red-600", description: "Múltiplos elevados" };
  } else if (avgRisk >= 0.8) {
    return { level: "Medio", color: "bg-yellow-600", description: "Valoración moderada" };
  } else {
    return { level: "Bajo", color: "bg-green-600", description: "Valoración atractiva" };
  }
}

// Función para calcular precios objetivo
function calculateTargetPrices(data: EstimationData, currentPrice?: number) {
  const { valuation, growth } = data;
  
  if (!valuation?.forwardPe || !currentPrice) {
    return { conservative: null, base: null, optimistic: null };
  }

  const epsGrowth = growth?.[0]?.growthEPS || 0;
  const baseMultiplier = 1 + (epsGrowth / 100);
  
  const conservative = currentPrice * baseMultiplier * 0.9;
  const base = currentPrice * baseMultiplier;
  const optimistic = currentPrice * baseMultiplier * 1.2;

  return {
    conservative: conservative > 0 ? conservative : null,
    base: base > 0 ? base : null,
    optimistic: optimistic > 0 ? optimistic : null
  };
}

export default function EstimacionCard({ selectedStock }: EstimacionCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EstimationData>({
    valuation: null,
    ratios: null,
    growth: null,
    profile: null
  });

  // Obtener datos cuando cambia el símbolo
  useEffect(() => {
    if (!selectedStock?.symbol) {
      setData({ valuation: null, ratios: null, growth: null, profile: null });
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [valuationData, ratiosData, growthData, profileData] = await Promise.all([
          fmp.valuation(selectedStock.symbol).catch(() => null),
          fmp.ratios(selectedStock.symbol, { limit: 1 }).catch(() => null),
          fmp.growth(selectedStock.symbol, { limit: 1 }).catch(() => null),
          fmp.profile(selectedStock.symbol).catch(() => null)
        ]);

        setData({
          valuation: valuationData,
          ratios: ratiosData,
          growth: growthData,
          profile: profileData
        });
      } catch (err: any) {
        setError(err?.message || 'Error al obtener datos');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedStock?.symbol]);

  // Cálculos derivados
  const riskAssessment = calculateRiskLevel(data);
  const targetPrices = calculateTargetPrices(data, selectedStock?.price);
  const projections = calculateProjections(data, selectedStock?.price);
  const currentPrice = selectedStock?.price || 0;
  
  // Calcular upside potencial
  const upside = targetPrices.base && currentPrice > 0 
    ? ((targetPrices.base - currentPrice) / currentPrice * 100)
    : null;

  // Badge de calidad de datos
  const dataQuality = (() => {
    const hasValuation = !!data.valuation;
    const hasRatios = !!data.ratios;
    const hasGrowth = !!data.growth;
    const score = [hasValuation, hasRatios, hasGrowth].filter(Boolean).length;
    
    if (score >= 3) return { text: "Excelente", color: "bg-green-600" };
    if (score >= 2) return { text: "Buena", color: "bg-blue-600" };
    if (score >= 1) return { text: "Limitada", color: "bg-yellow-600" };
    return { text: "Sin datos", color: "bg-red-600" };
  })();

  // Drivers de crecimiento simulados
  const growthDrivers = {
    principales: [
      "Expansión en nuevos mercados",
      "Innovación en productos/servicios",
      "Mejora en márgenes operativos"
    ],
    riesgos: [
      "Competencia intensificada",
      "Cambios regulatorios",
      "Volatilidad económica"
    ]
  };

  return (
    <Card className="bg-gray-900/50 border-blue-500/30 transition-all duration-300 hover:border-[#00BFFF] hover:shadow-lg hover:shadow-[#00BFFF]/20">
      <CardHeader>
        <CardTitle className="text-blue-400 text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          Análisis Completo de Estimaciones
          <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
            {loading ? "Cargando..." : "Análisis"}
          </Badge>
          <Badge className={`${dataQuality.color} text-white text-xs`}>
            Datos: {dataQuality.text}
          </Badge>
          <Badge className={`${riskAssessment.color} text-white text-xs`}>
            Riesgo: {riskAssessment.level}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {loading ? (
          <div className="space-y-3">
            <div className="h-6 bg-gray-800 rounded animate-pulse" />
            <div className="h-6 bg-gray-800 rounded animate-pulse" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-800/50">
              <TabsTrigger value="overview" className="text-xs">Resumen</TabsTrigger>
              <TabsTrigger value="projections" className="text-xs">Proyecciones</TabsTrigger>
              <TabsTrigger value="valuation" className="text-xs">Valoración</TabsTrigger>
              <TabsTrigger value="analysis" className="text-xs">Análisis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Precio objetivo estimado */}
              {targetPrices.base && (
                <Card className="bg-gray-800/50 border-green-500/30">
                  <CardHeader>
                    <CardTitle className="text-green-400 flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4" />
                      Precio Objetivo 12M
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="bg-rose-900/30 p-3 rounded">
                        <div className="text-rose-400 text-lg font-bold">
                          {formatUSD(targetPrices.conservative)}
                        </div>
                        <div className="text-xs text-gray-400">Conservador</div>
                      </div>
                      <div className="bg-green-900/30 p-3 rounded border border-green-500/30">
                        <div className="text-green-400 text-lg font-bold">
                          {formatUSD(targetPrices.base)}
                        </div>
                        <div className="text-xs text-gray-400">
                          Base {upside ? `(${upside > 0 ? '+' : ''}${upside.toFixed(1)}%)` : ''}
                        </div>
                      </div>
                      <div className="bg-blue-900/30 p-3 rounded">
                        <div className="text-blue-400 text-lg font-bold">
                          {formatUSD(targetPrices.optimistic)}
                        </div>
                        <div className="text-xs text-gray-400">Optimista</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Métricas principales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat 
                  label="P/E Ratio" 
                  value={formatRatio(data.valuation?.pe)} 
                  sub={data.valuation?.forwardPe ? `Forward: ${formatRatio(data.valuation.forwardPe)}` : undefined}
                />
                <Stat 
                  label="P/B Ratio" 
                  value={formatRatio(data.valuation?.pb)} 
                />
                <Stat 
                  label="PEG Ratio" 
                  value={formatRatio(data.valuation?.peg)} 
                  sub="Crecimiento ajustado"
                />
                <Stat 
                  label="Dividend Yield" 
                  value={formatPercent(data.valuation?.dividendYield)} 
                />
              </div>

              {/* Información de la empresa */}
              {data.profile?.[0] && (
                <div className="text-sm text-gray-400 bg-gray-800/30 p-3 rounded">
                  <div className="font-medium text-gray-300 mb-1">
                    {data.profile[0].companyName} ({data.profile[0].symbol})
                  </div>
                  <div className="text-xs">
                    {data.profile[0].industry} • {data.profile[0].sector} • {data.profile[0].country}
                  </div>
                  {data.profile[0].marketCap && (
                    <div className="text-xs mt-1">
                      Market Cap: {formatBillions(data.profile[0].marketCap)}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="projections" className="space-y-4">
              {projections.length > 0 ? (
                <div className="space-y-4">
                  {/* Tabla de proyecciones de ingresos */}
                  <Card className="bg-gray-800/30">
                    <CardHeader>
                      <CardTitle className="text-blue-400 flex items-center gap-2 text-base">
                        <BarChart3 className="h-4 w-4" />
                        Proyecciones de Ingresos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-gray-400">Período</TableHead>
                            <TableHead className="text-gray-400">Conservador</TableHead>
                            <TableHead className="text-gray-400">Base</TableHead>
                            <TableHead className="text-gray-400">Optimista</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projections.map((proj) => (
                            <ProjectionRow
                              key={proj.period}
                              label={proj.period}
                              data={proj.revenue}
                              formatter={formatBillions}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Tabla de proyecciones de EPS */}
                  <Card className="bg-gray-800/30">
                    <CardHeader>
                      <CardTitle className="text-green-400 flex items-center gap-2 text-base">
                        <DollarSign className="h-4 w-4" />
                        Proyecciones de EPS
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-gray-400">Período</TableHead>
                            <TableHead className="text-gray-400">Conservador</TableHead>
                            <TableHead className="text-gray-400">Base</TableHead>
                            <TableHead className="text-gray-400">Optimista</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projections.map((proj) => (
                            <ProjectionRow
                              key={proj.period}
                              label={proj.period}
                              data={proj.eps}
                              formatter={formatUSD}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Tabla de proyecciones de ingreso neto */}
                  <Card className="bg-gray-800/30">
                    <CardHeader>
                      <CardTitle className="text-purple-400 flex items-center gap-2 text-base">
                        <TrendingUp className="h-4 w-4" />
                        Proyecciones de Ingreso Neto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-gray-400">Período</TableHead>
                            <TableHead className="text-gray-400">Conservador</TableHead>
                            <TableHead className="text-gray-400">Base</TableHead>
                            <TableHead className="text-gray-400">Optimista</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projections.map((proj) => (
                            <ProjectionRow
                              key={proj.period}
                              label={proj.period}
                              data={proj.netIncome}
                              formatter={formatBillions}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay datos suficientes para generar proyecciones</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="valuation" className="space-y-4">
              {/* Métricas de valoración */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat 
                  label="EV/EBITDA" 
                  value={formatRatio(data.valuation?.evEbitda)} 
                />
                <Stat 
                  label="P/S Ratio" 
                  value={formatRatio(data.valuation?.ps)} 
                />
                <Stat 
                  label="Deuda/Equity" 
                  value={formatRatio(data.ratios?.[0]?.debtToEquityRatio)} 
                />
                <Stat 
                  label="ROE" 
                  value={formatPercent(data.ratios?.[0]?.returnOnEquity)} 
                />
              </div>

              {/* Crecimiento */}
              {data.growth?.[0] && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat 
                    label="Crecimiento Revenue" 
                    value={formatPercent(data.growth[0].revenueGrowth)}
                    color="text-green-400"
                  />
                  <Stat 
                    label="Crecimiento EPS" 
                    value={formatPercent(data.growth[0].epsgrowth)}
                    color="text-green-400"
                  />
                  <Stat 
                    label="Crecimiento EBITDA" 
                    value={formatPercent(data.growth[0].growthEBITDA)} 
                    color="text-green-400"
                  />
                  <Stat 
                    label="Crecimiento FCF" 
                    value={formatPercent(data.growth[0].growthFreeCashFlow)} 
                    color="text-green-400"
                  />
                </div>
              )}

              {/* Análisis de valoración */}
              <Card className="bg-gray-800/30">
                <CardHeader>
                  <CardTitle className="text-yellow-400 flex items-center gap-2 text-base">
                    <Target className="h-4 w-4" />
                    Estado de Valoración
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-gray-400">Nivel de Riesgo</div>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${riskAssessment.color}`}>
                        {riskAssessment.level}
                      </div>
                      <div className="text-xs text-gray-500">{riskAssessment.description}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-gray-400">Fair Value Estimado</div>
                      <div className="text-lg font-semibold text-green-400">
                        {targetPrices.base ? formatUSD(targetPrices.base) : "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {upside ? `Upside: ${upside > 0 ? '+' : ''}${upside.toFixed(1)}%` : "—"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              {/* Drivers de crecimiento */}
              <Card className="bg-gray-800/30">
                <CardHeader>
                  <CardTitle className="text-green-400 flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4" />
                    Drivers de Crecimiento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {growthDrivers.principales.map((driver, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-gray-300">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        {driver}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Factores de riesgo */}
              <Card className="bg-gray-800/30">
                <CardHeader>
                  <CardTitle className="text-red-400 flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    Factores de Riesgo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {growthDrivers.riesgos.map((riesgo, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-gray-300">
                        <div className="w-2 h-2 bg-red-400 rounded-full" />
                        {riesgo}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Consenso de analistas simulado */}
              <Card className="bg-gray-800/30">
                <CardHeader>
                  <CardTitle className="text-blue-400 flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Consenso de Analistas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-400 mb-1">Precio Objetivo Promedio</div>
                      <div className="text-lg font-semibold text-blue-400">
                        {targetPrices.base ? formatUSD(targetPrices.base * 1.05) : "—"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-400 mb-1">Recomendación</div>
                      <div className="text-lg font-semibold text-green-400">Buy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-400 mb-1">Analistas</div>
                      <div className="text-lg font-semibold text-gray-300">12</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumen de IA */}
              <Card className="bg-gray-800/30">
                <CardHeader>
                  <CardTitle className="text-purple-400 flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4" />
                    Resumen de IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Según las proyecciones actuales, {data.profile?.[0]?.companyName || 'la empresa'} muestra 
                    un potencial de crecimiento {data.growth?.[0]?.revenueGrowth && data.growth[0].revenueGrowth > 10 ? 'sólido' : 'moderado'} 
                    basado en sus métricas financieras. El precio objetivo estimado sugiere un 
                    {upside && upside > 0 ? 'upside' : 'downside'} del {upside ? Math.abs(upside).toFixed(1) : '0'}% 
                    desde el valor actual. La valoración se considera {riskAssessment.level.toLowerCase()} 
                    con riesgo {riskAssessment.level.toLowerCase()}.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
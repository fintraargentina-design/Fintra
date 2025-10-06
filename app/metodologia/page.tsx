"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MetodologiaPage() {
  const ratios: Array<{
    key: string;
    title: string;
    formula: string;
    definition: string;
    period: string;
    source: string;
    example?: string;
    strength?: "fuerte" | "medio" | "débil";
  }> = [
    {
      key: "roe",
      title: "ROE (Return on Equity)",
      formula: "ROE = Utilidad neta / Patrimonio promedio",
      definition: "Mide la rentabilidad obtenida sobre el capital de los accionistas.",
      period: "TTM o anual, según selección",
      source: "FMP: ratios, ratiosTTM",
      example: "Si utilidad neta = 2B y patrimonio promedio = 10B, ROE = 20%",
      strength: "fuerte",
    },
    {
      key: "roic",
      title: "ROIC (Return on Invested Capital)",
      formula: "ROIC = (Utilidad neta – Dividendos) / (Deuda total + Patrimonio – Efectivo)",
      definition: "Evalúa la eficiencia del capital total invertido en el negocio.",
      period: "TTM o anual",
      source: "FMP: ratios, valuation, keyMetrics",
      example: "Con utilidad neta 1.5B, dividendos 0.2B, deuda 5B, patrimonio 8B y efectivo 1B → ROIC ≈ 1.3B / 12B = 10.8%",
      strength: "medio",
    },
    {
      key: "gross_margin",
      title: "Margen bruto",
      formula: "Margen bruto = Utilidad bruta / Ventas",
      definition: "Porcentaje de ventas que permanece tras el costo de bienes vendidos.",
      period: "TTM, trimestral o anual",
      source: "FMP: income, ratios",
      example: "Si utilidad bruta = 40 y ventas = 100 → 40%",
      strength: "fuerte",
    },
    {
      key: "net_margin",
      title: "Margen neto",
      formula: "Margen neto = Utilidad neta / Ventas",
      definition: "Porcentaje de ventas que se convierte en beneficio neto.",
      period: "TTM o anual",
      source: "FMP: income, ratios",
      example: "Utilidad neta 15 y ventas 100 → 15%",
      strength: "medio",
    },
    {
      key: "debt_to_capital",
      title: "Deuda/Capital",
      formula: "Deuda/Capital = Deuda total / (Deuda + Patrimonio)",
      definition: "Mide el apalancamiento financiero respecto al capital total.",
      period: "TTM o anual",
      source: "FMP: ratios, balance",
      example: "Deuda 30, Patrimonio 70 → 30/(30+70) = 30%",
      strength: "medio",
    },
    {
      key: "current_ratio",
      title: "Current Ratio",
      formula: "Current Ratio = Activos corrientes / Pasivos corrientes",
      definition: "Capacidad para cubrir obligaciones de corto plazo.",
      period: "Trimestral o anual",
      source: "FMP: balance, ratios",
      example: "Activos corrientes 3, Pasivos corrientes 2 → 1.5x",
      strength: "fuerte",
    },
    {
      key: "fcf_margin",
      title: "Flujo de Caja Libre (%)",
      formula: "FCF % = FCF / Ventas",
      definition: "Efectivo libre generado respecto a las ventas.",
      period: "TTM o anual",
      source: "FMP: cashflow, ratios",
      example: "FCF 5 y ventas 100 → 5%",
      strength: "medio",
    },
    {
      key: "cagr",
      title: "CAGR (Ingresos, Beneficios, Patrimonio)",
      formula: "CAGR = ((Valor final / Valor inicial)^(1/n)) – 1",
      definition: "Tasa de crecimiento anual compuesta en n períodos.",
      period: "Anual",
      source: "FMP: income, balance, keyMetrics",
      example: "Ingresos pasan de 50 a 80 en 5 años → CAGR ≈ 9.8%",
      strength: "fuerte",
    },
    {
      key: "pe",
      title: "P/E, P/E Forward, PEG",
      formula: "P/E = Precio / Beneficio; P/E fwd = Precio / Beneficio esperado; PEG = P/E / Crecimiento esperado",
      definition: "Relación precio-beneficio actual y estimado; ajuste por crecimiento.",
      period: "TTM para P/E; estimaciones para forward y PEG",
      source: "FMP: valuation, ratios",
      example: "Precio 100, EPS TTM 5 → P/E = 20; crecimiento esperado 15% → PEG ≈ 1.33",
      strength: "medio",
    },
    {
      key: "multiples",
      title: "P/B, P/S, P/FCF, EV/EBITDA, EV/Ventas",
      formula: "P/B = Precio / Valor libro; P/S = Precio / Ventas; P/FCF = Precio / FCF; EV/EBITDA = Valor empresa / EBITDA; EV/Ventas = Valor empresa / Ventas",
      definition: "Múltiplos de valoración basados en libro, ventas, efectivo y empresa.",
      period: "TTM o anual (según métrica)",
      source: "FMP: valuation, keyMetrics, ratios",
      example: "EV 500 y EBITDA 50 → EV/EBITDA = 10",
      strength: "medio",
    },
    {
      key: "div_yield",
      title: "Dividend Yield",
      formula: "Yield = Dividendos por acción / Precio",
      definition: "Rendimiento por dividendos respecto al precio actual.",
      period: "TTM o anual",
      source: "FMP: dividends, valuation",
      example: "DPS 2 y precio 50 → 4%",
      strength: "medio",
    },
  ];

  const strengthBadge = (s?: "fuerte" | "medio" | "débil") => (
    <Badge
      variant="outline"
      className={
        s === "fuerte"
          ? "text-green-400 border-green-500/40"
          : s === "medio"
          ? "text-yellow-300 border-yellow-500/40"
          : "text-red-400 border-red-500/40"
      }
    >
      {s || "a vigilar"}
    </Badge>
  );

  return (
    <div className="w-full px-3 py-3">
      <Card className="bg-tarjetas border-none">
        <CardHeader>
          <CardTitle className="text-orange-400 text-lg">
            ¿Cómo calculamos tus métricas?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {ratios.map((r) => (
            <div key={r.key} className="bg-fondoDeTarjetas/60 rounded-md p-3 border border-gray-700/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white text-sm font-medium">{r.title}</h3>
                {strengthBadge(r.strength)}
              </div>
              <div className="text-xs text-gray-300 space-y-1">
                <p><span className="text-gray-400">Definición:</span> {r.definition}</p>
                <p><span className="text-gray-400">Fórmula:</span> {r.formula}</p>
                <p><span className="text-gray-400">Periodo:</span> {r.period}</p>
                <p><span className="text-gray-400">Fuente:</span> {r.source}</p>
                {r.example && <p><span className="text-gray-400">Ejemplo:</span> {r.example}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
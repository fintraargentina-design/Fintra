// components/EstimacionCard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Star, Target } from "lucide-react";
import { getStockProyecciones, StockProyeccionData } from "@/lib/stockQueries";

// NUEVO: analyst estimates (FMP)
import {
  getAnalystEstimates,
  formatAnalystEstimatesForDisplay,
} from "@/api/financialModelingPrep";

interface EstimacionCardProps {
  selectedStock?: { symbol?: string; name?: string; price?: number } | null;
}

type NivelRiesgo = "verde" | "amarillo" | "rojo";

/* =========================
   Helpers y subcomponentes
   ========================= */

const formatMoney = (n: number) => {
  if (n === null || n === undefined) return "N/A";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  return `${sign}$${a.toLocaleString()}`;
};

function StatTile({
  label,
  value,
  accent = "indigo",
}: {
  label: string;
  value: React.ReactNode;
  accent?: "indigo" | "emerald" | "rose" | "amber";
}) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-900/30 to-purple-900/20 border-indigo-500/30",
    emerald: "from-emerald-900/30 to-teal-900/20 border-emerald-500/30",
    rose: "from-rose-900/30 to-pink-900/20 border-rose-500/30",
    amber: "from-amber-900/30 to-yellow-900/20 border-amber-500/30",
  };
  return (
    <div className={`rounded-lg p-4 border bg-gradient-to-r ${colors[accent]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-gray-400 text-xs mt-1">{label}</div>
    </div>
  );
}

function BulletListCard({
  title,
  items,
  tone = "green",
}: {
  title: string;
  items: string[];
  tone?: "green" | "red";
}) {
  const border = tone === "green" ? "border-green-500/30" : "border-red-500/30";
  const titleClr = tone === "green" ? "text-green-400" : "text-red-400";
  const dot = tone === "green" ? "bg-green-400" : "bg-red-400";

  return (
    <Card className={`bg-gray-800/50 ${border}`}>
      <CardHeader>
        <CardTitle className={`${titleClr} flex items-center gap-2`}>
          {tone === "green" ? <TrendingUp className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items?.length ? (
            items.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <div className={`w-2 h-2 ${dot} rounded-full mt-2 flex-shrink-0`} />
                <span className="text-gray-300">{t}</span>
              </li>
            ))
          ) : (
            <span className="text-gray-500 text-sm">Sin información</span>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex justify-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`} />
      ))}
    </div>
  );
}

function RiskSemaphore({ level }: { level: NivelRiesgo }) {
  const map: Record<NivelRiesgo, string> = {
    verde: "bg-green-500",
    amarillo: "bg-yellow-500",
    rojo: "bg-red-500",
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-8 h-8 rounded-full ${map[level]}`} />
      <div className="text-xs text-gray-400 capitalize">{level}</div>
    </div>
  );
}

/* =========================
   Componente principal
   ========================= */

export default function EstimacionCard({ selectedStock }: EstimacionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [proyeccionData, setProyeccionData] = useState<StockProyeccionData | null>(null);
  const [loading, setLoading] = useState(false);

  // NUEVO: estado para Analyst Estimates
  const [analystRows, setAnalystRows] = useState<any[]>([]);
  const [analystErr, setAnalystErr] = useState<string | null>(null);

  const chartRef1 = useRef<HTMLCanvasElement>(null);
  const chartRef2 = useRef<HTMLCanvasElement>(null);
  const chartRef3 = useRef<HTMLCanvasElement>(null);
  const chartInstance1 = useRef<any>(null);
  const chartInstance2 = useRef<any>(null);
  const chartInstance3 = useRef<any>(null);

  useEffect(() => {
    const fetchAll = async () => {
      if (!selectedStock?.symbol) {
        setProyeccionData(null);
        setAnalystRows([]);
        return;
      }
      setLoading(true);
      try {
        const [proj, estimates] = await Promise.all([
          getStockProyecciones(selectedStock.symbol),
          getAnalystEstimates(selectedStock.symbol, { period: "annual", limit: 10 }),
        ]);
        setProyeccionData(proj);
        setAnalystRows(formatAnalystEstimatesForDisplay(estimates));
        setAnalystErr(null);
      } catch (error: any) {
        console.error("Error fetching proyecciones/estimates:", error);
        setProyeccionData(null);
        setAnalystRows([]);
        setAnalystErr(error?.message || "Error estimates");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [selectedStock?.symbol]);

  // Agregados simples desde Analyst Estimates (conteo y EPS/Ingresos como fallback)
  const analystAgg = useMemo(() => {
    if (!analystRows?.length) return { numAnalysts: 0, y1: null as any, y3: null as any, y5: null as any };

    // máximo de analistas reportado
    const numAnalysts = analystRows.reduce((m, r: any) => {
      const n = Number(r.numberAnalysts ?? 0);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);

    const sorted = [...analystRows].sort((a: any, b: any) => {
      const ax = Number(a.date ?? a.period ?? a.calendarYear ?? 0);
      const bx = Number(b.date ?? b.period ?? b.calendarYear ?? 0);
      return ax - bx;
    });

    const last = sorted[sorted.length - 1] || null;      // aprox 1Y
    const mid3 = sorted[sorted.length - 3] || null;      // aprox 3Y
    const mid5 = sorted[sorted.length - 5] || null;      // aprox 5Y
    const pick = (r: any) => r ? ({
      revenue: r.revenueAvg ?? r.revenueAverage ?? null,
      eps: r.epsAvg ?? r.epsAverage ?? null,
    }) : null;

    return { numAnalysts, y1: pick(last), y3: pick(mid3), y5: pick(mid5) };
  }, [analystRows]);

  const estimacionData = useMemo(() => {
    if (proyeccionData) {
      const drivers = proyeccionData.drivers_crecimiento?.principales || ["Próximamente"];
      const riesgos = proyeccionData.drivers_crecimiento?.riesgos || ["Próximamente"];

      const precioObjetivo = proyeccionData.valoracion_futura?.precio_objetivo_12m;
      const precio12m =
        typeof precioObjetivo === "object" && precioObjetivo !== null
          ? precioObjetivo
          : typeof precioObjetivo === "number" && precioObjetivo > 0
          ? { base: precioObjetivo, conservador: precioObjetivo * 0.9, optimista: precioObjetivo * 1.1 }
          : { base: 0, conservador: 0, optimista: 0 };

      const result = {
        symbol: proyeccionData.symbol || selectedStock?.symbol || "N/A",
        empresa: proyeccionData.empresa || selectedStock?.name || "Próximamente",
        proyecciones: {
          ingresos: proyeccionData.proyecciones?.ingresos || {
            "1Y": { base: 0, conservador: 0, optimista: 0 },
            "3Y": { base: 0, conservador: 0, optimista: 0 },
            "5Y": { base: 0, conservador: 0, optimista: 0 },
          },
          netIncome: proyeccionData.proyecciones?.netIncome || {
            "1Y": { base: 0, conservador: 0, optimista: 0 },
            "3Y": { base: 0, conservador: 0, optimista: 0 },
            "5Y": { base: 0, conservador: 0, optimista: 0 },
          },
          eps: proyeccionData.proyecciones?.eps || {
            "1Y": { base: 0, conservador: 0, optimista: 0 },
            "3Y": { base: 0, conservador: 0, optimista: 0 },
            "5Y": { base: 0, conservador: 0, optimista: 0 },
          },
        },
        valoracion_futura: {
          precio_objetivo_12m: precio12m,
          metodo: proyeccionData.valoracion_futura?.metodo || "Próximamente",
          estado_actual: proyeccionData.valoracion_futura?.estado_actual || "Próximamente",
        },
        inferencia_historica: {
          fair_value_actual: proyeccionData.inferencia_historica?.fair_value_actual || 0,
          precio_actual: selectedStock?.price || 0,
          upside_estimado: 0, // se calcula abajo
          tendencia: "Próximamente",
        },
        drivers_crecimiento: drivers,
        riesgos_limitantes: riesgos,
        resumen_llm: proyeccionData.resumen_llm || "Análisis próximamente disponible",
        comparacion_analistas: {
          precio_objetivo_promedio: proyeccionData.comparacion_analistas?.consenso_precio_objetivo || 0,
          opinion_promedio: proyeccionData.comparacion_analistas?.opinion_promedio || "Próximamente",
          numero_analistas: proyeccionData.comparacion_analistas?.cantidad_analistas || 0,
        },
        rating_ai_futuro: proyeccionData.rating_futuro_ia || 0,
        nivel_riesgo: (proyeccionData.riesgo as NivelRiesgo) || "amarillo",
      };

      // Upside
      const { fair_value_actual, precio_actual } = result.inferencia_historica;
      if (fair_value_actual > 0 && precio_actual > 0) {
        result.inferencia_historica.upside_estimado = Math.round(((fair_value_actual - precio_actual) / precio_actual) * 100);
      }

      // ---- Fallback con Analyst Estimates (sin pisar lo que ya traés) ----
      if (!result.comparacion_analistas.numero_analistas && analystAgg.numAnalysts) {
        result.comparacion_analistas.numero_analistas = analystAgg.numAnalysts;
      }
      // EPS fallback 1Y / 5Y
      if (analystAgg.y1?.eps != null && !result.proyecciones.eps["1Y"]?.base) {
        result.proyecciones.eps["1Y"].base = Number(analystAgg.y1.eps);
      }
      if (analystAgg.y5?.eps != null && !result.proyecciones.eps["5Y"]?.base) {
        result.proyecciones.eps["5Y"].base = Number(analystAgg.y5.eps);
      }
      // Ingresos fallback 1Y / 5Y
      if (analystAgg.y1?.revenue != null && !result.proyecciones.ingresos["1Y"]?.base) {
        result.proyecciones.ingresos["1Y"].base = Number(analystAgg.y1.revenue);
      }
      if (analystAgg.y5?.revenue != null && !result.proyecciones.ingresos["5Y"]?.base) {
        result.proyecciones.ingresos["5Y"].base = Number(analystAgg.y5.revenue);
      }

      return result;
    }

    // Branch sin datos (conserva tu layout e “Próximamente”)
    return {
      symbol: selectedStock?.symbol || "N/A",
      empresa: selectedStock?.name || "Próximamente",
      proyecciones: {
        ingresos: {
          "1Y": { base: 0, conservador: 0, optimista: 0 },
          "3Y": { base: 0, conservador: 0, optimista: 0 },
          "5Y": { base: 0, conservador: 0, optimista: 0 },
        },
        netIncome: {
          "1Y": { base: 0, conservador: 0, optimista: 0 },
          "3Y": { base: 0, conservador: 0, optimista: 0 },
          "5Y": { base: 0, conservador: 0, optimista: 0 },
        },
        eps: {
          "1Y": { base: 0, conservador: 0, optimista: 0 },
          "3Y": { base: 0, conservador: 0, optimista: 0 },
          "5Y": { base: 0, conservador: 0, optimista: 0 },
        },
      },
      valoracion_futura: {
        precio_objetivo_12m: { base: 0, conservador: 0, optimista: 0 },
        metodo: "Próximamente",
        estado_actual: "Próximamente",
      },
      inferencia_historica: {
        fair_value_actual: 0,
        precio_actual: selectedStock?.price || 0,
        upside_estimado: 0,
        tendencia: "Próximamente",
      },
      drivers_crecimiento: ["Próximamente"],
      riesgos_limitantes: ["Próximamente"],
      resumen_llm: "Análisis próximamente disponible",
      comparacion_analistas: { precio_objetivo_promedio: 0, opinion_promedio: "Próximamente", numero_analistas: 0 },
      rating_ai_futuro: 0,
      nivel_riesgo: "amarillo" as NivelRiesgo,
    };
  }, [proyeccionData, selectedStock?.name, selectedStock?.price, selectedStock?.symbol, analystAgg]);

  // Charts (sin cambios visuales)
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    import("chart.js/auto").then((mod) => {
      const Chart = mod.default;

      const ctx1 = chartRef1.current?.getContext("2d");
      const ctx2 = chartRef2.current?.getContext("2d");
      const ctx3 = chartRef3.current?.getContext("2d");
      if (!ctx1 || !ctx2 || !ctx3) return;

      // Línea: Ingresos
      chartInstance1.current?.destroy();
      chartInstance1.current = new Chart(ctx1, {
        type: "line",
        data: {
          labels: ["1Y", "3Y", "5Y"],
          datasets: [
            {
              label: "Conservador",
              data: [
                (estimacionData.proyecciones.ingresos["1Y"]?.conservador ?? 0) / 1e9,
                (estimacionData.proyecciones.ingresos["3Y"]?.conservador ?? 0) / 1e9,
                (estimacionData.proyecciones.ingresos["5Y"]?.conservador ?? 0) / 1e9,
              ],
              borderColor: "rgb(239, 68, 68)",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              tension: 0.4,
            },
            {
              label: "Base",
              data: [
                (estimacionData.proyecciones.ingresos["1Y"]?.base ?? 0) / 1e9,
                (estimacionData.proyecciones.ingresos["3Y"]?.base ?? 0) / 1e9,
                (estimacionData.proyecciones.ingresos["5Y"]?.base ?? 0) / 1e9,
              ],
              borderColor: "rgb(34, 197, 94)",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              tension: 0.4,
            },
            {
              label: "Optimista",
              data: [
                (estimacionData.proyecciones.ingresos["1Y"]?.optimista ?? 0) / 1e9,
                (estimacionData.proyecciones.ingresos["3Y"]?.optimista ?? 0) / 1e9,
                (estimacionData.proyecciones.ingresos["5Y"]?.optimista ?? 0) / 1e9,
              ],
              borderColor: "rgb(59, 130, 246)",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: "Proyección de Ingresos (Billions)", color: "white" },
            legend: { labels: { color: "white" } },
          },
          scales: {
            y: {
              ticks: { color: "white", callback: (v: any) => `$${v}B` },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
            x: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } },
          },
        },
      });

      // Barras: EPS
      chartInstance2.current?.destroy();
      const y1 = estimacionData.proyecciones.eps["1Y"];
      const y5 = estimacionData.proyecciones.eps["5Y"];
      chartInstance2.current = new Chart(ctx2, {
        type: "bar",
        data: {
          labels: ["1Y (Cons.)", "1Y (Base)", "1Y (Opt.)", "5Y (Cons.)", "5Y (Base)", "5Y (Opt.)"],
          datasets: [
            {
              label: "EPS",
              data: [y1?.conservador ?? 0, y1?.base ?? 0, y1?.optimista ?? 0, y5?.conservador ?? 0, y5?.base ?? 0, y5?.optimista ?? 0],
              backgroundColor: "rgba(34, 197, 94, 0.8)",
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { title: { display: true, text: "Proyección de EPS", color: "white" }, legend: { labels: { color: "white" } } },
          scales: {
            y: { beginAtZero: true, ticks: { color: "white", callback: (v: any) => `$${v}` }, grid: { color: "rgba(255,255,255,0.1)" } },
            x: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } },
          },
        },
      });

      // Donut: Precio objetivo 12M
      chartInstance3.current?.destroy();
      const po = estimacionData.valoracion_futura.precio_objetivo_12m || { conservador: 0, base: 0, optimista: 0 };
      chartInstance3.current = new Chart(ctx3, {
        type: "doughnut",
        data: {
          labels: ["Conservador", "Base", "Optimista"],
          datasets: [
            {
              data: [po.conservador ?? 0, po.base ?? 0, po.optimista ?? 0],
              backgroundColor: ["rgba(239,68,68,0.8)", "rgba(34,197,94,0.8)", "rgba(59,130,246,0.8)"],
              borderWidth: 2,
              borderColor: "#1f2937",
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: "Precio Objetivo 12M", color: "white" },
            legend: { labels: { color: "white" } },
          },
        },
      });
    });

    return () => {
      chartInstance1.current?.destroy();
      chartInstance2.current?.destroy();
      chartInstance3.current?.destroy();
    };
  }, [isOpen, estimacionData.proyecciones, estimacionData.valoracion_futura, estimacionData.inferencia_historica]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-blue-500/30 cursor-pointer transition-all duration-300 hover:border-[#00BFFF] hover:shadow-lg hover:shadow-[#00BFFF]/20">
          <CardHeader>
            <CardTitle className="text-blue-400 text-lg flex items-center gap-2">
              📊 Proyecciones y Perspectivas (3–5 años)
              <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                {loading ? "Cargando..." : "AI Analysis"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-center text-gray-500">Cargando proyecciones...</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Precio Objetivo (12m):</span>
                    <span className="text-blue-400 font-mono">
                      {Number(estimacionData.valoracion_futura.precio_objetivo_12m?.base) > 0
                        ? `$${estimacionData.valoracion_futura.precio_objetivo_12m?.base}`
                        : "Próximamente"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fair Value:</span>
                    <span className="text-blue-400 font-mono">
                      {estimacionData.inferencia_historica.fair_value_actual > 0
                        ? formatMoney(estimacionData.inferencia_historica.fair_value_actual)
                        : "Próximamente"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Upside:</span>
                    <span className="text-green-400 font-mono">
                      {estimacionData.inferencia_historica.upside_estimado > 0
                        ? `+${estimacionData.inferencia_historica.upside_estimado}%`
                        : "Próximamente"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Rating AI:</span>
                    <div className="flex">
                      {estimacionData.rating_ai_futuro > 0 ? (
                        <Stars rating={estimacionData.rating_ai_futuro} />
                      ) : (
                        <span className="text-gray-500 text-xs">Próximamente</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="text-center text-xs text-gray-500">Click para ver análisis completo</div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-900 border-blue-500/30">
        <DialogHeader>
          <DialogTitle className="text-blue-400 text-xl flex items-center gap-2">
            📊 Proyecciones y Perspectivas — {estimacionData.empresa}
            <Badge variant="outline" className="border-blue-500/50 text-blue-400">{estimacionData.symbol}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* KPI Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatTile label="Fair Value Hoy" value={formatMoney(estimacionData.inferencia_historica.fair_value_actual)} accent="indigo" />
            <StatTile label="Precio Actual" value={formatMoney(estimacionData.inferencia_historica.precio_actual)} accent="indigo" />
            <StatTile label="Upside Estimado" value={<span className="text-emerald-400">+{estimacionData.inferencia_historica.upside_estimado}%</span>} accent="emerald" />
          </div>

          {/* Proyecciones */}
          <Card className="bg-gray-800/50 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-blue-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                1. Proyecciones de Crecimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      <td className="text-center py-2 px-3 text-red-400">{formatMoney(estimacionData.proyecciones.ingresos["1Y"]?.conservador ?? 0)}</td>
                      <td className="text-center py-2 px-3 text-green-400">{formatMoney(estimacionData.proyecciones.ingresos["1Y"]?.base ?? 0)}</td>
                      <td className="text-center py-2 px-3 text-blue-400">{formatMoney(estimacionData.proyecciones.ingresos["1Y"]?.optimista ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3 font-medium text-gray-300">Ingresos 5Y</td>
                      <td className="text-center py-2 px-3 text-red-400">{formatMoney(estimacionData.proyecciones.ingresos["5Y"]?.conservador ?? 0)}</td>
                      <td className="text-center py-2 px-3 text-green-400">{formatMoney(estimacionData.proyecciones.ingresos["5Y"]?.base ?? 0)}</td>
                      <td className="text-center py-2 px-3 text-blue-400">{formatMoney(estimacionData.proyecciones.ingresos["5Y"]?.optimista ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3 font-medium text-gray-300">EPS 1Y</td>
                      <td className="text-center py-2 px-3 text-red-400">${estimacionData.proyecciones.eps["1Y"]?.conservador ?? 0}</td>
                      <td className="text-center py-2 px-3 text-green-400">${estimacionData.proyecciones.eps["1Y"]?.base ?? 0}</td>
                      <td className="text-center py-2 px-3 text-blue-400">${estimacionData.proyecciones.eps["1Y"]?.optimista ?? 0}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-medium text-gray-300">EPS 5Y</td>
                      <td className="text-center py-2 px-3 text-red-400">${estimacionData.proyecciones.eps["5Y"]?.conservador ?? 0}</td>
                      <td className="text-center py-2 px-3 text-green-400">${estimacionData.proyecciones.eps["5Y"]?.base ?? 0}</td>
                      <td className="text-center py-2 px-3 text-blue-400">${estimacionData.proyecciones.eps["5Y"]?.optimista ?? 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <canvas ref={chartRef1} width="400" height="300" />
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <canvas ref={chartRef2} width="400" height="300" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Valoración futura */}
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
                    <div className="bg-rose-900/30 p-3 rounded-lg">
                      <div className="text-rose-400 font-bold text-lg">
                        ${estimacionData.valoracion_futura.precio_objetivo_12m?.conservador ?? 0}
                      </div>
                      <div className="text-xs text-gray-400">Conservador</div>
                    </div>
                    <div className="bg-green-900/30 p-3 rounded-lg border border-green-500/50">
                      <div className="text-green-400 font-bold text-lg">
                        ${estimacionData.valoracion_futura.precio_objetivo_12m?.base ?? 0}
                      </div>
                      <div className="text-xs text-gray-400">Base</div>
                    </div>
                    <div className="bg-blue-900/30 p-3 rounded-lg">
                      <div className="text-blue-400 font-bold text-lg">
                        ${estimacionData.valoracion_futura.precio_objetivo_12m?.optimista ?? 0}
                      </div>
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
                  <canvas ref={chartRef3} width="300" height="300" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Drivers vs Riesgos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BulletListCard title="4. Drivers de Crecimiento" items={estimacionData.drivers_crecimiento} tone="green" />
            <BulletListCard title="Riesgos Limitantes" items={estimacionData.riesgos_limitantes} tone="red" />
          </div>

          {/* Resumen LLM */}
          <Card className="bg-gray-800/50 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-blue-400">5. Resumen Explicativo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 leading-relaxed">{estimacionData.resumen_llm}</p>
            </CardContent>
          </Card>

          {/* Analistas + Bonus */}
          <div className="grid grid-cols-1 gap-6">
            <Card className="bg-gray-800/50 border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-yellow-400">6. Comparación con Analistas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-yellow-400 font-bold text-2xl">
                      {formatMoney(estimacionData.comparacion_analistas.precio_objetivo_promedio)}
                    </div>
                    <div className="text-gray-400 text-sm">Precio Objetivo Promedio</div>
                  </div>
                  <div>
                    <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                      {estimacionData.comparacion_analistas.opinion_promedio}
                    </Badge>
                    <div className="text-gray-400 text-sm mt-1">Opinión Promedio</div>
                  </div>
                  <div>
                    <div className="text-yellow-400 font-bold text-2xl">
                      {estimacionData.comparacion_analistas.numero_analistas}
                    </div>
                    <div className="text-gray-400 text-sm">Analistas</div>
                  </div>
                </div>
                {analystErr && <div className="text-xs text-yellow-500 mt-3">Estimates: {analystErr}</div>}
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-orange-500/30">
              <CardHeader>
                <CardTitle className="text-orange-400">🎯 Bonus - Evaluación AI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-orange-400 text-sm mb-2">Rating AI Futuro</div>
                    <Stars rating={estimacionData.rating_ai_futuro} />
                    <div className="text-gray-400 text-xs mt-1">{estimacionData.rating_ai_futuro}/5 estrellas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-orange-400 text-sm mb-2">Semáforo de Riesgo</div>
                    <RiskSemaphore level={estimacionData.nivel_riesgo} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

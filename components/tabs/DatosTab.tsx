'use client';

import { useMemo, useEffect, useState } from "react";
import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosCard from "@/components/cards/DividendosCard";
import { Card } from "../ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { savePeriodSelection, supabase } from "@/lib/supabase";

type PeriodSel = "ttm" | "FY" | "Q1" | "Q2" | "Q3" | "Q4" | "annual" | "quarter";

interface DatosTabProps {
  stockAnalysis: any;
  stockPerformance?: any;
  stockBasicData?: any;
  stockReport?: any;
  symbol: string;             // ← NUEVO
  period?: PeriodSel;         // periodo seleccionado (por defecto annual)
}

export default function DatosTab({
  stockAnalysis,
  stockPerformance,
  stockBasicData,
  stockReport,
  symbol,
  period = "annual",
}: DatosTabProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSel>(period);
  const [activeTab, setActiveTab] = useState("financials");

  // Sincronizar si el padre cambia el periodo
  useEffect(() => {
    setSelectedPeriod(period);
  }, [period]);

  // Cargar periodo persistido al cambiar el símbolo
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('periodos_accion')
          .select('period')
          .eq('symbol', symbol.toUpperCase())
          .maybeSingle();
        if (!error && data?.period && alive) {
          setSelectedPeriod(data.period as PeriodSel);
        }
      } catch (_) {
        // noop
      }
    })();
    return () => { alive = false; };
  }, [symbol]);

  const handlePeriodChange = async (value: string) => {
    const v = value as PeriodSel;
    setSelectedPeriod(v);
    try {
      await savePeriodSelection(symbol, v, new Date().toISOString());
    } catch (_) {
      // noop
    }
  };

  const tabs = [
    { id: "financials", label: "Datos Financieros" },
    { id: "performance", label: "Desempeño" },
    { id: "dividends", label: "Dividendos" },
  ];

  return (
    <div className="flex flex-col w-full h-full">
      {/* Top Tabs (Fixed) */}
      <div className="w-full border-b border-white/10 bg-tarjetas shrink-0">
        <div className="flex flex-row w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 text-center justify-center px-2 py-1 text-xs font-medium transition-colors border-b-2
                ${
                  activeTab === tab.id
                    ? "border-orange-400 text-orange-400"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex min-h-0 bg-tarjetas">
        {/* Sidebar (Only for financials) */}
        {activeTab === "financials" && (
          <div className="w-20 shrink-0 border-r border-white/10 pr-2 pt-4 pl-2 overflow-y-auto">
             <span className="text-[10px] text-gray-500 mb-2 font-medium uppercase tracking-wider pl-1 block">Periodo</span>
             <div className="flex flex-col gap-1">
                {[
                  { label: "TTM", value: "ttm" },
                  { label: "FY", value: "FY" },
                  { label: "Q1", value: "Q1" },
                  { label: "Q2", value: "Q2" },
                  { label: "Q3", value: "Q3" },
                  { label: "Q4", value: "Q4" },
                  { label: "Anual", value: "annual" },
                  { label: "Trimestral", value: "quarter" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePeriodChange(opt.value)}
                    className={[
                      "px-2 py-1 text-[10px] text-left rounded transition-colors w-full",
                      selectedPeriod === (opt.value as PeriodSel)
                        ? "bg-orange-500/10 text-orange-400 font-medium"
                        : "text-gray-400 hover:text-gray-200 hover:bg-white/5",
                    ].join(" ")}
                    title={opt.label}
                  >
                    {opt.label}
                  </button>
                ))}
             </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {activeTab === "financials" && (
            <div className="flex flex-col pt-4">
              <div className="bg-tarjetas border-none">
                <FundamentalCard 
                  symbol={symbol} 
                  period={selectedPeriod} 
                />
              </div>
              <div className="bg-tarjetas border-none">
                <ValoracionCard symbol={symbol} period={selectedPeriod} />
              </div>
            </div>
          )}

          {activeTab === "performance" && (
            <div className="bg-tarjetas border-none p-4">
              <DesempenoCard symbol={symbol} />
            </div>
          )}

          {activeTab === "dividends" && (
            <div className="bg-tarjetas border-none p-4">
              <DividendosCard symbol={symbol} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

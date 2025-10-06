// components/tabs/DatosTab.tsx
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

  // … si querés seguir normalizando otras tarjetas, mantené tus useMemo …

  return (
    <div className="flex flex-col gap-2">
      <Card className="bg-tarjetas border-none">
      <FundamentalCard symbol={symbol} period={selectedPeriod} onPeriodChange={handlePeriodChange} />
      <ValoracionCard  symbol={symbol} period={selectedPeriod} />
        <DesempenoCard symbol={symbol} />
        <DividendosCard symbol={symbol} />
      </Card>
      {/* tus otras tarjetas con sus props actuales */}
      {/* <DesempenoCard stockPerformance={stockPerformance} stockBasicData={stockPerformance} stockReport={stockReport}/>
      <DividendosCard stockAnalysis={stockAnalysis} stockBasicData={stockBasicData?.datos?.dividendos ?? null} stockReport={stockReport}/> */}
    </div>
  );
}

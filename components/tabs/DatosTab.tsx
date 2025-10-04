// components/tabs/DatosTab.tsx
'use client';

import { useMemo } from "react";
import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosCard from "@/components/cards/DividendosCard";

interface DatosTabProps {
  stockAnalysis: any;
  stockPerformance?: any;
  stockBasicData?: any;
  stockReport?: any;
  symbol: string;             // ← NUEVO
}

export default function DatosTab({
  stockAnalysis,
  stockPerformance,
  stockBasicData,
  stockReport,
  symbol,
}: DatosTabProps) {

  // … si querés seguir normalizando otras tarjetas, mantené tus useMemo …

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <FundamentalCard symbol={symbol} />
        <ValoracionCard  symbol={symbol} />
        <DesempenoCard symbol={symbol} />
        <DividendosCard symbol={symbol} />

        {/* tus otras tarjetas con sus props actuales */}
        {/* <DesempenoCard stockPerformance={stockPerformance} stockBasicData={stockPerformance} stockReport={stockReport}/>
        <DividendosCard stockAnalysis={stockAnalysis} stockBasicData={stockBasicData?.datos?.dividendos ?? null} stockReport={stockReport}/> */}
      </div>
    </div>
  );
}

'use client';

import { useMemo } from "react";
import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosCard from "@/components/cards/DividendosCard";

import {
  normalizeForFundamentalCard,
  normalizeForValoracionCard,
  normalizeForDesempenoCard,
  normalizeForDividendosCard,
  // opcional si querés calcular badges/medianas acá:
  // badgeRoicSpread, badgeNetDebtEbitda, badgeFCFMargin, badgeFCFYield, badgeSharpe,
  // buildValuationPeerView,
} from '@/components/cards/funcionesTarjetas';

interface DatosTabProps {
  // Ideal: `stockAnalysis` = objeto agregado con todo (TTM, ratios, EV, peers, histórico, etc.)
  stockAnalysis: any;
  // Si aún pasás estas props “raw”, las mantenemos por compatibilidad:
  stockPerformance?: any;
  stockBasicData?: any;
  stockReport?: any;
}

export default function DatosTab({
  stockAnalysis,
  stockPerformance,
  stockBasicData,
  stockReport,
}: DatosTabProps) {
  // Normalizaciones — se ejecutan una sola vez por cambio de `stockAnalysis`
  const fundamentalNorm = useMemo(
    () => (stockAnalysis ? normalizeForFundamentalCard(stockAnalysis) : stockBasicData ?? null),
    [stockAnalysis, stockBasicData]
  );

  const valuationNorm = useMemo(
    () => (stockAnalysis ? normalizeForValoracionCard(stockAnalysis) : stockBasicData ?? null),
    [stockAnalysis, stockBasicData]
  );

  const performanceNorm = useMemo(
    () => (stockAnalysis ? normalizeForDesempenoCard(stockAnalysis) : stockPerformance ?? null),
    [stockAnalysis, stockPerformance]
  );

  const dividendsNorm = useMemo(
    () => (stockAnalysis ? normalizeForDividendosCard(stockAnalysis) : stockBasicData?.datos?.dividendos ?? null),
    [stockAnalysis, stockBasicData]
  );

  // Molde que espera DividendosCard:
  const dividendBasicShape = useMemo(() => {
    const dividendYield =
      dividendsNorm?.dividendYield ??
      stockBasicData?.dividend_yield ??
      null;

    return {
      dividend_yield: dividendYield,               // usado para el % en la card
      datos: { dividendos: dividendsNorm || {} },  // objeto con métricas de dividendos normalizado
    };
  }, [dividendsNorm, stockBasicData]);

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FundamentalCard
          stockBasicData={fundamentalNorm}
          stockAnalysis={stockAnalysis}
          stockReport={stockReport}
        />

        <ValoracionCard
          stockAnalysis={stockAnalysis}
          stockBasicData={valuationNorm}
          stockReport={stockReport}
        />

        <DesempenoCard
          stockPerformance={performanceNorm /* sigue aceptando esta prop */}
          stockBasicData={performanceNorm    /* y se la pasamos igual para 52w/beta, etc. */}
          stockReport={stockReport}
        />

        <DividendosCard
          stockAnalysis={stockAnalysis}
          stockBasicData={dividendBasicShape}  // ← importante: forma que espera DividendosCard
          stockReport={stockReport}
        />
      </div>
    </div>
  );
}

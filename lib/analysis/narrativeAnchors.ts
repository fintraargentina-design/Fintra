
export type AnchorTone = "positive" | "warning" | "neutral" | "negative";
export type TemporalHint = "recent" | "persistent" | "fading";

export interface NarrativeAnchor {
  id: string;
  label: string;
  tone: AnchorTone;
  highlight: string[];
  temporal_hint?: TemporalHint;
  dominance?: 'primary' | 'secondary';
  // Returns true if this anchor applies to the current context
  when: (ctx: AnchorContext) => boolean;
}

export interface AnchorContext {
  ticker: string;
  hasPeer: boolean;
  // Basic data (often contains 5y CAGRs, sector, etc.)
  basicData?: {
    revenue_cagr_5y?: number | null;
    net_income_cagr_5y?: number | null;
    roe?: number | null;
    roic?: number | null;
    net_margin?: number | null;
    debt_equity?: number | null;
    current_ratio?: number | null;
    sector?: string;
    [key: string]: any;
  };
  // TTM Ratios (PE, PB, etc.)
  ratios?: {
    priceEarningsRatioTTM?: number | null;
    priceToBookRatioTTM?: number | null;
    debtEquityRatioTTM?: number | null;
    currentRatioTTM?: number | null;
    returnOnEquityTTM?: number | null;
    [key: string]: any;
  };
  // TTM Metrics (ROIC, etc.)
  metrics?: {
    roicTTM?: number | null;
    netIncomePerShareTTM?: number | null;
    [key: string]: any;
  };
  // Analysis data (FGOS scores, etc.)
  analysis?: {
    fgos_score?: number | null;
    valuation_score?: number | null;
    [key: string]: any;
  };
}

export const narrativeAnchors: NarrativeAnchor[] = [
  {
    id: "solid-profitability",
    label: "Rentabilidad sólida y consistente",
    tone: "positive",
    highlight: ["ROE", "ROIC", "Margen neto", "Margen Operativo"],
    when: (ctx) => {
      // Logic: High ROE/ROIC and positive growth history
      const roe = ctx.ratios?.returnOnEquityTTM ?? ctx.basicData?.roe;
      const roic = ctx.metrics?.roicTTM ?? ctx.basicData?.roic;
      const netMargin = ctx.basicData?.net_margin; // TTM often in ratios too?
      
      // Thresholds (simplified for generic narrative)
      const robustROE = (roe ?? 0) > 0.15; // > 15%
      const robustROIC = (roic ?? 0) > 0.10; // > 10%
      const positiveMargin = (netMargin ?? 0) > 0.05; // > 5%

      return robustROE && robustROIC && positiveMargin;
    }
  },
  {
    id: "increasing-leverage",
    label: "Apalancamiento elevado",
    tone: "warning",
    highlight: ["Deuda/Patrimonio", "Deuda Neta/EBITDA", "Current Ratio", "Quick Ratio"],
    when: (ctx) => {
      // Logic: High Debt/Equity
      const de = ctx.ratios?.debtEquityRatioTTM ?? ctx.basicData?.debt_equity;
      // Note: "Increasing" requires history. If we lack history in this context, 
      // we fallback to "Elevado" or check if we can infer something. 
      // User asked for "Apalancamiento en aumento". 
      // Without history props in context, we might check if D/E > Sector Avg? 
      // Or simply D/E > 2.0 as a "Warning" anchor.
      // Let's stick to "Elevado" if we can't check increase, or maybe "Riesgo financiero latente" covers it.
      // Let's try to interpret "Apalancamiento en aumento" as "High Leverage" for now if we lack trend data.
      // But wait, user said "Usar SOLO datos ya presentes". 
      // If we don't have historical D/E, we can't say "en aumento".
      // Let's rename to "Apalancamiento considerable" or similar if we can't prove increase,
      // OR assuming we might have some growth metrics for debt? (unlikely in basicData).
      // Let's use "Apalancamiento elevado" for the label if > 2.0.
      
      return (de ?? 0) > 2.0; 
    }
  },
  {
    id: "sector-aligned-valuation",
    label: "Valoración alineada al sector",
    tone: "neutral",
    highlight: ["P/E Ratio", "EV/EBITDA", "P/B Ratio", "P/S Ratio"],
    when: (ctx) => {
      // Logic: PE between 15 and 25 (Generic) OR comparable to standard
      // Without explicit sector averages in context, we use absolute heuristics or 
      // check if `analysis` has a valuation score that implies "Fair".
      
      const pe = ctx.ratios?.priceEarningsRatioTTM;
      if (!pe) return false;
      return pe > 15 && pe < 25;
    }
  },
  {
    id: "demanding-valuation",
    label: "Valoración exigente",
    tone: "warning", // or neutral depending on growth
    highlight: ["P/E Ratio", "EV/EBITDA", "P/B Ratio", "PEG Ratio"],
    when: (ctx) => {
      const pe = ctx.ratios?.priceEarningsRatioTTM;
      return (pe ?? 0) > 35; // Generic threshold
    }
  },
  {
    id: "financial-risk",
    label: "Riesgo financiero latente",
    tone: "negative",
    highlight: ["Altman Z-Score", "Interest Coverage", "Current Ratio", "Deuda/Patrimonio"],
    when: (ctx) => {
       const interestCoverage = ctx.basicData?.interest_coverage;
       const currentRatio = ctx.ratios?.currentRatioTTM ?? ctx.basicData?.current_ratio;
       
       // Low interest coverage or low liquidity
       const badCoverage = interestCoverage !== undefined && interestCoverage !== null && interestCoverage < 1.5;
       const badLiquidity = (currentRatio ?? 0) < 0.8;
       
       return badCoverage || badLiquidity;
    }
  },
  // Extra: Growth
  {
      id: "strong-growth",
      label: "Crecimiento acelerado",
      tone: "positive",
      highlight: ["Crecimiento Ventas", "Crecimiento Beneficio", "Revenue CAGR (5y)", "Net Income CAGR (5y)"],
      when: (ctx) => {
          const revCagr = ctx.basicData?.revenue_cagr_5y;
          const incCagr = ctx.basicData?.net_income_cagr_5y;
          return (revCagr ?? 0) > 0.15 && (incCagr ?? 0) > 0.15;
      }
  }
];

export function evaluateNarrativeAnchors(ctx: AnchorContext): NarrativeAnchor[] {
  return narrativeAnchors.filter(anchor => anchor.when(ctx));
}

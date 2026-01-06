// Fintra/app/api/cron/fmp-bulk/buildSnapshots.ts

import { normalizeFinancials } from './normalizeFinancials';
import { normalizeValuation } from './normalizeValuation';
import { normalizePerformance } from './normalizePerformance';
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain';
import { normalizeProfileStructural } from './normalizeProfileStructural';
import { resolveInvestmentVerdict } from '@/lib/engine/resolveInvestmentVerdict';

// Helper estándar FINTRA para bloques pendientes (JSONB válido)
function pending(reason: string, extra: any = {}) {
  return {
    status: 'pending',
    computed: false,
    reason,
    ...extra
  };
}

export function buildSnapshot(
  sym: string,
  profile: any,
  ratios: any,
  metrics: any,
  quote: any,
  priceChange: any,
  scores: any
) {
  console.log('🧪 SNAPSHOT START', sym);

  const today = new Date().toISOString().slice(0, 10);

  // 1️⃣ PROFILE STRUCTURAL (identidad + clasificación + scores financieros)
  const profileStructural = normalizeProfileStructural(profile, ratios, scores);
  if (!profileStructural) {
    console.log('❌ PROFILE STRUCTURAL NULL', sym);
    return null;
  }

  // 2️⃣ PERFORMANCE (precio, retornos, dividendos)
  const performance = normalizePerformance(
    profile,
    quote,
    priceChange,
    metrics,
    ratios
  );

  // 3️⃣ FINANCIAL NORMALIZATION (raw, sin inteligencia)
  const financials = normalizeFinancials(sym, profile, ratios, metrics, quote);

  // 4️⃣ FGOS (INTELIGENCIA — puede fallar)
  const fgos = calculateFGOSFromData(
    sym,
    profile,
    ratios,
    metrics,
    {},      // growth bulk aún no incorporado
    quote
  );

  // 5️⃣ VALUATION (CRUDA, NO depende de FGOS)
  const valuation = normalizeValuation(ratios, profile);

  const valuationBlock = valuation
    ? {
        score: valuation.valuation_score,
        status: valuation.valuation_status
      }
    : pending('Valuation not available');

  // 6️⃣ INVESTMENT VERDICT (CRÍTICO, pero tolerante a faltantes)
  const investmentVerdict =
    fgos && typeof fgos.fgos_score === 'number' && valuation
      ? resolveInvestmentVerdict(
          fgos.fgos_score,
          valuation.valuation_status as any
        )
      : pending('Verdict requires FGOS and Valuation');

  // 7️⃣ MARKET POSITION (placeholder válido — modelo pendiente)
  const marketPosition = pending(
    'Market position model not implemented yet'
  );

  console.log('✅ SNAPSHOT OK', sym);

  // 8️⃣ SNAPSHOT FINAL — NUNCA NULL EN CAMPOS NOT NULL
  return {
    ticker: sym,
    snapshot_date: today,
    engine_version: 'v2.0',

    // JSONB estructural (usado también para display)
    profile_structural: profileStructural,

    // JSONB mercado (si no hay datos, queda pendiente)
    market_snapshot: performance ?? pending('No price/performance data'),

    // FGOS
    fgos_score: fgos ? fgos.fgos_score : 0,
    fgos_components: fgos
      ? fgos.fgos_breakdown
      : pending('FGOS components missing'),

    // Valuation
    valuation: valuationBlock,

    // Market position (no null)
    market_position: marketPosition,

    // Verdict (no null)
    investment_verdict: investmentVerdict,

    // Calidad de datos
    data_confidence: {
      has_profile: !!profile,
      has_fgos: !!fgos,
      has_valuation: !!valuation,
      has_performance: !!performance
    }
  };
}

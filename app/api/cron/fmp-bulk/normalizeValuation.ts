// Fintra/app/api/cron/fmp-bulk/normalizeValuation.ts

import type { FmpRatios, FmpProfile, ValuationResult } from '@/lib/engine/types';

export function normalizeValuation(
  ratios: FmpRatios | null,
  _profile: FmpProfile | null
): ValuationResult | null {
  if (!ratios) return null;

  const pe = Number(
    ratios?.priceToEarningsRatioTTM ?? ratios?.peRatioTTM ?? ratios?.peRatio ?? null
  );

  const evEbitda = Number(ratios?.evToEbitdaTTM ?? null);
  const pfcf = Number(ratios?.priceToFreeCashFlowRatioTTM ?? null);

  return {
    pe_ratio: Number.isFinite(pe) ? pe : null,
    ev_ebitda: Number.isFinite(evEbitda) ? evEbitda : null,
    price_to_fcf: Number.isFinite(pfcf) ? pfcf : null,
    valuation_status: 'Pending'
  };
}

// Fintra/app/api/cron/fmp-bulk/normalizeValuation.ts

export function normalizeValuation(
  ratios: any,
  profile: any
) {
  if (!ratios) return null;

  const pe =
    Number(
      ratios?.priceToEarningsRatioTTM ??
      ratios?.peRatioTTM ??
      ratios?.peRatio ??
      null
    );

  const evEbitda = Number(ratios?.evToEbitdaTTM ?? null);
  const ps = Number(ratios?.priceToSalesRatioTTM ?? null);
  const pfcf = Number(ratios?.priceToFreeCashFlowRatioTTM ?? null);
  const dividendYield = Number(ratios?.dividendYieldTTM ?? null);

  return {
    // 🔹 métricas crudas (CLAVE para benchmarks)
    pe_ratio: pe,
    ev_ebitda: evEbitda,
    price_to_sales: ps,
    price_to_fcf: pfcf,
    dividend_yield: dividendYield,

    // 🔹 metadata
    sector: profile?.sector ?? profile?.Sector ?? null,
    source: 'FMP',

    // 🔹 placeholders (se completan luego)
    valuation_score: null,
    valuation_status: 'pending'
  };
}

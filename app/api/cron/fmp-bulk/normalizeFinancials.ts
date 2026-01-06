export function normalizeFinancials(
  sym: string,
  profile: any,
  ratios: any,
  metrics: any,
  quote: any
) {
  if (!profile || !ratios || !metrics) return null;

  return {
    ticker: sym,

    sector: profile.sector || profile.Sector || null,
    industry: profile.industry || profile.Industry || null,

    pe_ttm: ratios.peRatioTTM ?? null,
    debt_to_equity: ratios.debtEquityRatioTTM ?? null,
    roe: ratios.returnOnEquityTTM ?? null,

    roic: metrics.roicTTM ?? null,
    gross_margin: metrics.grossProfitMarginTTM ?? null,
    operating_margin: metrics.operatingProfitMarginTTM ?? null,

    source: 'FMP',
    normalized_at: new Date().toISOString(),
  };
}

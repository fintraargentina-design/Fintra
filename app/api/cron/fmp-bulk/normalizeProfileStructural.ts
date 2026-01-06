// Fintra/app/api/cron/fmp-bulk/normalizeProfileStructural.ts

export function normalizeProfileStructural(
  profile: any,
  ratios: any,
  scores: any
) {
  return {
    identity: {
      name: profile.companyName ?? null,
      ticker: profile.symbol ?? null,
      description: profile.description ?? null,
      exchange: profile.exchange ?? null,
      exchangeFullName: profile.exchangeFullName ?? null,
      country: profile.country ?? null,
      currency: profile.currency ?? null,
      website: profile.website ?? null,
      ceo: profile.ceo ?? null,
      fullTimeEmployees: profile.fullTimeEmployees ?? null,
      founded: profile.ipoDate ?? null,
      cik: profile.cik ?? null,
      isin: profile.isin ?? null,
      logo: profile.image ?? null,
      cusip: profile.cusip ?? null,
      phone: profile.phone ?? null,
      isEtf: profile.isEtf ?? null,
      isActivelyTrading: profile.isActivelyTrading ?? null,
      isAdr: profile.isAdr ?? null
    },

    metrics: {
        marketCap: profile.marketCap ?? null,
        price: profile.price ?? null,
        change: profile.change ?? null,
        changePercentage: profile.changePercentage ?? null,
        beta: profile.beta ?? null,
        lastDividend: profile.lastDividend ?? null,
        volume: profile.volume ?? null,
        averageVolume: profile.averageVolume ?? null,
        range: profile.range ?? null
    },

    classification: {
      sector: profile.sector ?? null,
      industry: profile.industry ?? null
    },

    financial_scores: {

      altman_z: scores?.altmanZScore
        ? Number(scores.altmanZScore)
        : null,
      piotroski_score: scores?.piotroskiScore
        ? Number(scores.piotroskiScore)
        : null,
      marketCap: scores?.marketCap
        ? Number(scores.marketCap)
        : null,
      revenue: scores?.revenue
        ? Number(scores.revenue)
        : null,
      total_assets: scores?.totalAssets
        ? Number(scores.totalAssets)
        : null,
      total_liabilities: scores?.totalLiabilities
        ? Number(scores.totalLiabilities)
        : null,
      working_capital: scores?.workingCapital
        ? Number(scores.workingCapital)
        : null,
      ebit: scores?.ebit
        ? Number(scores.ebit)
        : null,
      retainedEarnings: scores?.retainedEarnings
        ? Number(scores.retainedEarnings)
        : null
    }
  };
}

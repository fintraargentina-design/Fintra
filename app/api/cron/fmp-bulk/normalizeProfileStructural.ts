// Fintra/app/api/cron/fmp-bulk/normalizeProfileStructural.ts

import type { FmpProfile, FmpRatios } from '@/lib/engine/types';

export function normalizeProfileStructural(
  profile: FmpProfile,
  ratios: FmpRatios | null,
  scores: any
) {
  return {
    identity: {
      name: profile.companyName ?? null,
      ticker: profile.symbol ?? null,
      description: (profile as any).description ?? null,
      exchange: (profile as any).exchange ?? null,
      exchangeFullName: (profile as any).exchangeFullName ?? null,
      country: (profile as any).country ?? null,
      currency: (profile as any).currency ?? null,
      website: (profile as any).website ?? null,
      ceo: (profile as any).ceo ?? null,
      fullTimeEmployees: (profile as any).fullTimeEmployees ?? null,
      founded: (profile as any).ipoDate ?? null,
      cik: (profile as any).cik ?? null,
      isin: (profile as any).isin ?? null,
      logo: (profile as any).image ?? null,
      cusip: (profile as any).cusip ?? null,
      phone: (profile as any).phone ?? null,
      isEtf: (profile as any).isEtf ?? null,
      isActivelyTrading: (profile as any).isActivelyTrading ?? null,
      isAdr: (profile as any).isAdr ?? null
    },

    metrics: {
        marketCap: profile.marketCap ?? null,
        price: (profile as any).price ?? null,
        change: (profile as any).change ?? null,
        changePercentage: (profile as any).changePercentage ?? null,
        beta: (profile as any).beta ?? null,
        lastDividend: (profile as any).lastDividend ?? null,
        volume: (profile as any).volume ?? null,
        averageVolume: (profile as any).averageVolume ?? null,
        range: (profile as any).range ?? null
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

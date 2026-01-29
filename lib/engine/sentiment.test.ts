import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {}
}));

import { calculateSentiment, type SentimentValuationTimeline } from './sentiment';
import { computeFGOS } from './fgos-recompute';
import type { FinancialSnapshot, FmpRatios, FmpMetrics, SectorBenchmark } from './types';

describe('sentiment valuation engine', () => {
  it('returns pending when no timeline is provided', () => {
    const result = calculateSentiment(null);
    expect(result.status).toBe('pending');
    expect(result.value).toBeNull();
  });

  it('returns partial sentiment with only 1Y history', () => {
    const timeline: SentimentValuationTimeline = {
      TTM: {
        pe_ratio: 20,
        ev_ebitda: 12,
        price_to_fcf: 18,
        price_to_sales: 4
      },
      TTM_1A: {
        pe_ratio: 15,
        ev_ebitda: 10,
        price_to_fcf: 15,
        price_to_sales: 3
      },
      TTM_3A: null,
      TTM_5A: null
    };

    const result = calculateSentiment(timeline);
    expect(result.status).toBe('partial');
    expect(result.value).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects optimistic regime when multiples expand across horizons', () => {
    const timeline: SentimentValuationTimeline = {
      TTM: {
        pe_ratio: 30,
        ev_ebitda: 18,
        price_to_fcf: 25,
        price_to_sales: 6
      },
      TTM_1A: {
        pe_ratio: 20,
        ev_ebitda: 12,
        price_to_fcf: 18,
        price_to_sales: 4
      },
      TTM_3A: {
        pe_ratio: 15,
        ev_ebitda: 10,
        price_to_fcf: 15,
        price_to_sales: 3
      },
      TTM_5A: null
    };

    const result = calculateSentiment(timeline);
    expect(result.status).toBe('computed');
    expect(result.value).toBeGreaterThan(60);
  });

  it('detects pessimistic regime when multiples compress across horizons', () => {
    const timeline: SentimentValuationTimeline = {
      TTM: {
        pe_ratio: 10,
        ev_ebitda: 6,
        price_to_fcf: 8,
        price_to_sales: 2
      },
      TTM_1A: {
        pe_ratio: 15,
        ev_ebitda: 10,
        price_to_fcf: 15,
        price_to_sales: 3
      },
      TTM_3A: {
        pe_ratio: 20,
        ev_ebitda: 12,
        price_to_fcf: 18,
        price_to_sales: 4
      },
      TTM_5A: null
    };

    const result = calculateSentiment(timeline);
    expect(result.status).toBe('computed');
    expect(result.value).toBeLessThan(40);
  });

  it('penalizes extreme rerating intensity', () => {
    const moderateTimeline: SentimentValuationTimeline = {
      TTM: {
        pe_ratio: 22,
        ev_ebitda: 13,
        price_to_fcf: 20,
        price_to_sales: 4.5
      },
      TTM_1A: {
        pe_ratio: 18,
        ev_ebitda: 11,
        price_to_fcf: 17,
        price_to_sales: 3.8
      },
      TTM_3A: null,
      TTM_5A: null
    };

    const extremeTimeline: SentimentValuationTimeline = {
      TTM: {
        pe_ratio: 80,
        ev_ebitda: 50,
        price_to_fcf: 70,
        price_to_sales: 12
      },
      TTM_1A: {
        pe_ratio: 20,
        ev_ebitda: 12,
        price_to_fcf: 18,
        price_to_sales: 4
      },
      TTM_3A: null,
      TTM_5A: null
    };

    const moderate = calculateSentiment(moderateTimeline);
    const extreme = calculateSentiment(extremeTimeline);

    expect((extreme.signals.rerating_intensity_penalty || 0)).toBeLessThanOrEqual(
      moderate.signals.rerating_intensity_penalty || 0
    );
    expect(extreme.value || 0).toBeLessThan(95);
  });

  it('keeps FGOS score computed even when sentiment is pending', () => {
    const snapshot: FinancialSnapshot = {
      ticker: 'TEST',
      snapshot_date: '2025-01-01',
      engine_version: 'test',
      sector: 'Technology',
      profile_structural: {
        identity: {
          name: null,
          ticker: null,
          description: null,
          exchange: null,
          exchangeFullName: null,
          country: null,
          currency: null,
          website: null,
          ceo: null,
          fullTimeEmployees: null,
          founded: null,
          cik: null,
          isin: null,
          logo: null,
          cusip: null,
          phone: null,
          isEtf: null,
          isActivelyTrading: null,
          isAdr: null
        },
        metrics: {
          marketCap: null,
          price: null,
          change: null,
          changePercentage: null,
          beta: null,
          lastDividend: null,
          volume: null,
          averageVolume: null,
          range: null
        },
        classification: {
          sector: 'Technology',
          industry: null
        },
        financial_scores: {
          altman_z: null,
          piotroski_score: null,
          marketCap: null,
          revenue: null,
          total_assets: null,
          total_liabilities: null,
          working_capital: null,
          ebit: null,
          retainedEarnings: null
        }
      },
      market_snapshot: {
        price: null,
        ytd_percent: null,
        div_yield: null
      },
      fundamentals_growth: {
        revenue_cagr: 0.1,
        earnings_cagr: 0.12,
        fcf_cagr: 0.08
      },
      fgos_score: null,
      fgos_components: null,
      fgos_status: null,
      fgos_category: null,
      fgos_confidence_percent: null,
      fgos_confidence_label: null,
      fgos_maturity: null,
      peers: null,
      valuation: null,
      market_position: null,
      investment_verdict: null,
      data_confidence: {
        has_profile: true,
        has_financials: true,
        has_valuation: false,
        has_performance: false,
        has_fgos: false,
        confidence_level: 'medium',
        coverage: { valid_windows: 0, required_windows: 0, valid_metrics: 0, required_metrics: 0 },
        maturity: 'unknown',
        industry_cadence: 'unknown',
        limiting_factor: 'none'
      }
    };

    const ratios: FmpRatios = {
      operatingProfitMarginTTM: 0.2,
      netProfitMarginTTM: 0.15,
      debtEquityRatioTTM: 30,
      interestCoverageTTM: 8
    };

    const metrics: FmpMetrics = {
      roicTTM: 0.15,
      freeCashFlowMarginTTM: 0.12,
      altmanZScore: 3.5,
      piotroskiScore: 7
    };

    const baseBenchmark: SectorBenchmark = {
      sample_size: 50,
      confidence: 'high',
      p10: 0,
      p25: 0.05,
      p50: 0.1,
      p75: 0.15,
      p90: 0.2,
      median: 0.1,
      trimmed_mean: 0.1,
      uncertainty_range: null
    };

    const benchmarks: Record<string, SectorBenchmark> = {
      revenue_cagr: baseBenchmark,
      earnings_cagr: baseBenchmark,
      fcf_cagr: baseBenchmark,
      roic: baseBenchmark,
      operating_margin: baseBenchmark,
      net_margin: baseBenchmark,
      fcf_margin: baseBenchmark,
      debt_to_equity: baseBenchmark,
      interest_coverage: baseBenchmark
    };

    const confidenceInputs = {
      financial_history_years: 5,
      years_since_ipo: 10,
      earnings_volatility_class: 'MEDIUM' as const
    };

    const result = computeFGOS(
      'TEST',
      snapshot,
      ratios,
      metrics,
      snapshot.fundamentals_growth || {},
      benchmarks,
      confidenceInputs,
      undefined,
      null
    );

    expect(result.fgos_score).not.toBeNull();
    expect(result.fgos_components.sentiment).toBeNull();
    expect(result.fgos_components.sentiment_details?.status).toBe('pending');
    expect(result.fgos_components.sentiment_details?.value).toBeNull();
  });

  it('propagates valuation-based sentiment into FGOS breakdown', () => {
    const timeline: SentimentValuationTimeline = {
      TTM: {
        pe_ratio: 30,
        ev_ebitda: 18,
        price_to_fcf: 25,
        price_to_sales: 6
      },
      TTM_1A: {
        pe_ratio: 20,
        ev_ebitda: 12,
        price_to_fcf: 18,
        price_to_sales: 4
      },
      TTM_3A: {
        pe_ratio: 15,
        ev_ebitda: 10,
        price_to_fcf: 15,
        price_to_sales: 3
      },
      TTM_5A: null
    };

    const directSentiment = calculateSentiment(timeline);

    const snapshot: FinancialSnapshot = {
      ticker: 'TEST',
      snapshot_date: '2025-01-01',
      engine_version: 'test',
      sector: 'Technology',
      profile_structural: {
        identity: {
          name: null,
          ticker: null,
          description: null,
          exchange: null,
          exchangeFullName: null,
          country: null,
          currency: null,
          website: null,
          ceo: null,
          fullTimeEmployees: null,
          founded: null,
          cik: null,
          isin: null,
          logo: null,
          cusip: null,
          phone: null,
          isEtf: null,
          isActivelyTrading: null,
          isAdr: null
        },
        metrics: {
          marketCap: null,
          price: null,
          change: null,
          changePercentage: null,
          beta: null,
          lastDividend: null,
          volume: null,
          averageVolume: null,
          range: null
        },
        classification: {
          sector: 'Technology',
          industry: null
        },
        financial_scores: {
          altman_z: null,
          piotroski_score: null,
          marketCap: null,
          revenue: null,
          total_assets: null,
          total_liabilities: null,
          working_capital: null,
          ebit: null,
          retainedEarnings: null
        }
      },
      market_snapshot: {
        price: null,
        ytd_percent: null,
        div_yield: null
      },
      fundamentals_growth: {
        revenue_cagr: 0.1,
        earnings_cagr: 0.12,
        fcf_cagr: 0.08
      },
      fgos_score: null,
      fgos_components: null,
      fgos_status: null,
      fgos_category: null,
      fgos_confidence_percent: null,
      fgos_confidence_label: null,
      fgos_maturity: null,
      peers: null,
      valuation: null,
      market_position: null,
      investment_verdict: null,
      data_confidence: {
        has_profile: true,
        has_financials: true,
        has_valuation: true,
        has_performance: false,
        has_fgos: false,
        confidence_level: 'medium',
        coverage: { valid_windows: 0, required_windows: 0, valid_metrics: 0, required_metrics: 0 },
        maturity: 'unknown',
        industry_cadence: 'unknown',
        limiting_factor: 'none'
      }
    };

    const ratios: FmpRatios = {
      operatingProfitMarginTTM: 0.2,
      netProfitMarginTTM: 0.15,
      debtEquityRatioTTM: 30,
      interestCoverageTTM: 8
    };

    const metrics: FmpMetrics = {
      roicTTM: 0.15,
      freeCashFlowMarginTTM: 0.12,
      altmanZScore: 3.5,
      piotroskiScore: 7
    };

    const baseBenchmark: SectorBenchmark = {
      sample_size: 50,
      confidence: 'high',
      p10: 0,
      p25: 0.05,
      p50: 0.1,
      p75: 0.15,
      p90: 0.2,
      median: 0.1,
      trimmed_mean: 0.1,
      uncertainty_range: null
    };

    const benchmarks: Record<string, SectorBenchmark> = {
      revenue_cagr: baseBenchmark,
      earnings_cagr: baseBenchmark,
      fcf_cagr: baseBenchmark,
      roic: baseBenchmark,
      operating_margin: baseBenchmark,
      net_margin: baseBenchmark,
      fcf_margin: baseBenchmark,
      debt_to_equity: baseBenchmark,
      interest_coverage: baseBenchmark
    };

    const confidenceInputs = {
      financial_history_years: 5,
      years_since_ipo: 10,
      earnings_volatility_class: 'MEDIUM' as const
    };

    const result = computeFGOS(
      'TEST',
      snapshot,
      ratios,
      metrics,
      snapshot.fundamentals_growth || {},
      benchmarks,
      confidenceInputs,
      undefined,
      timeline
    );

    const sentimentScore = result.fgos_components.sentiment;
    const sentimentDetails = result.fgos_components.sentiment_details;

    expect(sentimentScore).toBe(directSentiment.value);
    expect(sentimentDetails?.status).toBe(directSentiment.status);
    expect(sentimentDetails?.value).toBe(directSentiment.value);
    expect(sentimentDetails?.band).toBe(directSentiment.band);
    expect(sentimentDetails?.signals?.relative_deviation).toBeCloseTo(
      directSentiment.signals.relative_deviation || 0,
      6
    );
  });
});

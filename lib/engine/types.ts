export type FgosCategory =
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Pending';

export interface LowConfidenceImpact {
  raw_percentile: number;
  effective_percentile: number;
  sample_size: number;
  weight: number;
  benchmark_low_confidence: true;
}

export interface FgosBreakdown {
  growth: number | null;
  profitability: number | null;
  efficiency: number | null;
  solvency: number | null;
  benchmark_low_confidence?: boolean;
  growth_impact?: LowConfidenceImpact;
  profitability_impact?: LowConfidenceImpact;
  efficiency_impact?: LowConfidenceImpact;
  solvency_impact?: LowConfidenceImpact;
}

export interface FgosResult {
  ticker: string;
  fgos_score: number | null;
  fgos_category: FgosCategory;
  fgos_breakdown: FgosBreakdown;
  confidence: number;
  quality_warnings?: string[];
  calculated_at: string;
}

export interface ValuationResult {
  pe_ratio: number | null;
  ev_ebitda: number | null;
  price_to_fcf: number | null;
  valuation_status: 'undervalued' | 'overvalued' | 'fair' | 'pending';
  intrinsic_value?: number | null;
  upside_potential?: number | null;
}

export interface ProfileStructural {
  identity: {
    name: string | null;
    ticker: string | null;
    description: string | null;
    exchange: string | null;
    exchangeFullName: string | null;
    country: string | null;
    currency: string | null;
    website: string | null;
    ceo: string | null;
    fullTimeEmployees: string | null;
    founded: string | null;
    cik: string | null;
    isin: string | null;
    logo: string | null;
    cusip: string | null;
    phone: string | null;
    isEtf: boolean | null;
    isActivelyTrading: boolean | null;
    isAdr: boolean | null;
  };
  metrics: {
    marketCap: number | null;
    price: number | null;
    change: number | null;
    changePercentage: number | null;
    beta: number | null;
    lastDividend: number | null;
    volume: number | null;
    averageVolume: number | null;
    range: string | null;
  };
  classification: {
    sector: string | null;
    industry: string | null;
  };
  financial_scores: {
    altman_z: number | null;
    piotroski_score: number | null;
    marketCap: number | null;
    revenue: number | null;
    total_assets: number | null;
    total_liabilities: number | null;
    working_capital: number | null;
    ebit: number | null;
    retainedEarnings: number | null;
  };
}

export interface MarketPosition {
  /**
   * Status of the market position calculation.
   * - 'computed': Successfully calculated.
   * - 'pending': Missing data (sector, benchmarks, sample size).
   */
  status: 'computed' | 'pending';

  /**
   * The sector used for benchmarking.
   */
  sector: string;

  /**
   * Relative position components based on sector benchmarks.
   * Values are percentiles (0-100).
   */
  components: {
    size?: {
      market_cap_percentile: number;
    };
    profitability?: {
      roic_percentile?: number;
      margin_percentile?: number;
    };
    growth?: {
      revenue_growth_percentile?: number;
    };
  };

  /**
   * Conceptual summary of the position.
   * - 'leader': Strong across most components.
   * - 'strong': Above average in key components.
   * - 'average': Mixed or neutral.
   * - 'weak': Consistently below average.
   */
  summary: 'leader' | 'strong' | 'average' | 'weak';

  /**
   * Confidence in the position assessment.
   * - 'high': Robust benchmarks, high coverage.
   * - 'medium': Adequate benchmarks.
   * - 'low': Low-confidence benchmarks or poor coverage.
   */
  confidence: 'low' | 'medium' | 'high';

  /**
   * Explanations for status or confidence issues.
   */
  reasons?: string[];
}

export interface FinancialSnapshot {
  ticker: string;
  snapshot_date: string;
  engine_version: string;
  sector: string | null;
  profile_structural: ProfileStructural | { status: 'pending'; reason: string; [key: string]: any };
  market_snapshot: {
    price: number | null;
    ytd_percent: number | null;
    div_yield: number | null;
    return_1y?: number | null;
    [key: string]: any;
  } | null;
  fundamentals_growth?: {
    revenue_cagr: number | null;
    earnings_cagr: number | null;
    fcf_cagr: number | null;
  } | null;
  fgos_score: number | null;
  fgos_components: FgosBreakdown | null;
  fgos_status?: string | null;
  fgos_category?: string | null;
  fgos_confidence?: number | null;
  peers?: any | null;
  valuation: ValuationResult | null;
  market_position: MarketPosition | null;
  investment_verdict: any | null;
  data_confidence: {
    has_profile: boolean;
    has_financials: boolean;
    has_valuation: boolean;
    has_performance: boolean;
    has_fgos: boolean;
  };
}

// FMP Partial Types for inputs
export interface FmpProfile {
  sector: string | null;
  industry?: string | null;
  companyName?: string;
  symbol?: string;
  marketCap?: number | null;
  [key: string]: any;
}

export interface FmpRatios {
  operatingProfitMarginTTM?: number | null;
  netProfitMarginTTM?: number | null;
  debtEquityRatioTTM?: number | null;
  interestCoverageTTM?: number | null;
  [key: string]: any;
}

export interface FmpMetrics {
  roicTTM?: number | null;
  freeCashFlowMarginTTM?: number | null;
  altmanZScore?: number | null;
  piotroskiScore?: number | null;
  [key: string]: any;
}

export interface FmpQuote {
  price?: number | null;
  changesPercentage?: number | null;
  [key: string]: any;
}

export interface SectorBenchmark {
  sample_size: number;
  confidence: 'low' | 'medium' | 'high';
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  median?: number | null;
  trimmed_mean?: number | null;
  uncertainty_range?: { p5: number; p95: number } | null;
}

export interface SectorBenchmarkRow extends SectorBenchmark {
  sector?: string;
  industry?: string;
  metric: string;
  stats_date: string;
}

export interface EcoNodeJSON {
  id: string;
  n: string; // name
  ehs: number; // Ecosystem Health Score
  [key: string]: any;
}

export interface EcosystemDataJSON {
  suppliers: EcoNodeJSON[];
  clients: EcoNodeJSON[];
}

export interface FintraSnapshotDB {
  ticker: string;
  snapshot_date?: string;
  date?: string; // Used in some client views
  engine_version?: string;
  sector?: string | null;
  fgos_score: number | null;
  fgos_components?: any;
  fgos_breakdown?: any;
  valuation?: any;
  valuation_score?: number;
  valuation_status?: string;
  verdict_text?: string;
  ecosystem_score?: number | null;
  ecosystem_data?: any;
  ecosystem_report?: string | null;
  calculated_at?: string;
  profile_structural?: ProfileStructural | null;
  investment_verdict?: any;
  [key: string]: any;
}

export interface EcosystemRelationDB {
  id: number;
  ticker: string;
  related_ticker: string;
  relation_type: 'supplier' | 'client' | 'peer';
  confidence: number;
  source: string;
  created_at: string;
}

export interface EcosystemReportDB {
  ticker: string;
  date: string;
  data: EcosystemDataJSON;
  ecosystem_score: number;
  report_md: string;
  created_at?: string;
}

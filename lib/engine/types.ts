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
  moat?: number | null;
  sentiment?: number | null;
  sentiment_details?: {
    value: number | null;
    band?: 'pessimistic' | 'neutral' | 'optimistic' | null;
    confidence: number | null;
    status: 'computed' | 'partial' | 'pending';
    signals?: {
      relative_deviation: number | null;
      directional_consistency: number | null;
      rerating_intensity_penalty: number | null;
    };
    components?: any;
  };
  competitive_advantage?: {
    score: number | null;
    band: 'weak' | 'defendable' | 'strong' | null;
    confidence: number | null;
    axes?: {
      return_persistence?: number | null;
      operating_stability?: number | null;
      capital_discipline?: number | null;
    };
    years_analyzed?: number;
  };
}

export type FgosStatus = 'Mature' | 'Developing' | 'Early-stage' | 'Incomplete' | 'partial';

export interface FgosResult {
  ticker: string;
  fgos_score: number | null;
  fgos_category: FgosCategory;
  fgos_breakdown: FgosBreakdown;
  confidence: number;
  confidence_label?: 'High' | 'Medium' | 'Low';
  fgos_status?: FgosStatus;
  quality_warnings?: string[];
  calculated_at: string;
}

export type CanonicalValuationStatus =
  | 'very_cheap_sector'
  | 'cheap_sector'
  | 'fair_sector'
  | 'expensive_sector'
  | 'very_expensive_sector'
  | 'potentially_cheap'
  | 'potentially_expensive'
  | 'descriptive_only'
  | 'pending';

export type LegacyValuationStatus = 'undervalued' | 'overvalued' | 'fair' | 'pending';

export interface ValuationResult {
  pe_ratio: number | null;
  ev_ebitda: number | null;
  price_to_fcf: number | null;

  // Legacy field kept for backward-compat
  valuation_status: LegacyValuationStatus;

  intrinsic_value?: number | null;
  upside_potential?: number | null;

  // Canonical State
  stage: 'pending' | 'partial' | 'computed';
  confidence: {
    label: 'Low' | 'Medium' | 'High';
    percent: number;
    valid_metrics_count: number;
  };
  explanation: string;

  // Canonical valuation verdict (sector-relative)
  canonical_status?: CanonicalValuationStatus;
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

export interface ValuationMetrics {
  pe_ratio: number | null;
  ev_ebitda: number | null;
  price_to_fcf: number | null;
}

export interface ValuationState {
  stage: 'pending' | 'partial' | 'computed';
  valuation_status: CanonicalValuationStatus;
  confidence: {
    label: 'Low' | 'Medium' | 'High';
    percent: number; // 0-100
    valid_metrics_count: number;
  };
  metrics: ValuationMetrics;
  explanation: string;
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
}

export interface IFSMemory {
  window_years: number;
  observed_years: number;
  distribution: {
    leader: number;
    follower: number;
    laggard: number;
  };
  timeline?: ("leader" | "follower" | "laggard")[];
  current_streak: {
    position: "leader" | "follower" | "laggard";
    years: number;
  };
}

export interface IFSData {
  position: "leader" | "follower" | "laggard";
  pressure?: number;
  /**
   * Conceptual summary of the position.
   * - 'leader': Strong across most components.
   * - 'strong': Above average in key components.
   * - 'average': Mixed or neutral.
   * - 'weak': Consistently below average.
   */
  summary?: 'leader' | 'strong' | 'average' | 'weak';

  /**
   * Confidence in the position assessment.
   * - 'high': Robust benchmarks, high coverage.
   * - 'medium': Adequate benchmarks.
   * - 'low': Low-confidence benchmarks or poor coverage.
   */
  confidence?: 'low' | 'medium' | 'high';

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
  classification?: {
    status: 'full' | 'partial' | 'missing';
    sector: string | null;
    industry: string | null;
    source?: 'canonical' | 'profile_fallback';
  };
  sector_performance?: {
    status: 'full' | 'partial' | 'missing';
    data: {
      '1D'?: number | null;
      '1W'?: number | null;
      '1M'?: number | null;
      '3M'?: number | null;
      '6M'?: number | null;
      'YTD'?: number | null;
      '1Y'?: number | null;
      '3Y'?: number | null;
      '5Y'?: number | null;
    };
  };
  industry_performance?: {
    status: 'full' | 'partial' | 'missing';
    data: {
      '1D'?: number | null;
      '1W'?: number | null;
      '1M'?: number | null;
      'YTD'?: number | null;
      '1Y'?: number | null;
      '3Y'?: number | null;
      '5Y'?: number | null;
    };
  };
  sector_pe?: {
    status: 'full' | 'partial' | 'missing';
    value: number | null;
  };
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
}

export interface EnrichedStockData {
  ticker: string;
  sectorRank: number | null;
  sectorRankTotal: number | null;
  sectorValuationStatus: string | null;
  fgosBand: string | null;
  fgosScore?: number | null;
  fgosStatus?: string | null; // e.g. Mature, Developing
  sentimentBand?: string | null; // e.g. optimistic, neutral
  ifs?: IFSData | null;
  ifsMemory?: IFSMemory | null;
  strategyState: string | null;
  priceEod: number | null;
  ytdReturn: number | null;
  marketCap: number | null;
}

// Database & Ecosystem Types
export interface FintraSnapshotDB {
  ticker: string;
  snapshot_date: string;
  profile_structural?: any;
  market_snapshot?: any;
  fgos_score?: number | null;
  fgos_components?: any;
  valuation?: any;
  ifs?: any;
  ifs_memory?: any;
  sector_rank?: number | null;
  sector_rank_total?: number | null;
  created_at?: string;
  [key: string]: any; // Allow other columns
}

export interface EcosystemRelationDB {
  id?: string;
  ticker_source: string;
  ticker_target: string;
  relation_type: string;
  strength: number;
  metadata?: any;
  created_at?: string;
}

export interface EcosystemReportDB {
  id: string;
  ticker: string;
  date: string;
  data: any;
  ecosystem_score: number | null;
  report_md: string | null;
  created_at: string;
}

export interface EcoNodeJSON {
  id: string;
  group: number;
  radius?: number;
  color?: string;
  label?: string;
}

export interface EcosystemDataJSON {
  nodes: EcoNodeJSON[];
  links: any[];
}

// Timeline Types
export interface TimelineMetricValue {
  value: number;
  [key: string]: any;
}

export interface TimelineMetric {
  key?: string;
  label: string;
  values: Record<string, TimelineMetricValue>;
}

export interface FundamentalsTimelineResponse {
  metrics: TimelineMetric[];
}

export interface PerformanceYear {
  year: string | number;
}

export interface PerformanceTimelineResponse {
  years: PerformanceYear[];
  metrics: TimelineMetric[];
}

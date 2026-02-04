import type { FMPCompanyProfile, FMPFinancialRatio } from "@/lib/fmp/types";

export type FgosCategory = "High" | "Medium" | "Low" | "Pending";

export type PeriodType = "FY" | "Q1" | "Q2" | "Q3" | "Q4";

export interface ValueItem {
  value: number | null;
  display?: string | null;
  color?: string;
  normalized?: number | null;
  periodType?: PeriodType | null;
  endDate?: string;
  period_type?: PeriodType | null;
  period_end_date?: string;
}

export interface Metric {
  key: string;
  label: string;
  unit?: string;
  category?: string;
  values: Record<string, ValueItem>;
  priority?: string;
  heatmap?: any;
}

export interface YearGroup {
  year: string | number;
  periods?: string[];
  tone?: "light" | "dark";
  columns?: string[];
}

export interface LowConfidenceImpact {
  raw_percentile: number;
  effective_percentile: number;
  sample_size: number;
  weight: number;
  benchmark_low_confidence: true;
}

export interface QualityBrakes {
  applied: boolean;
  reasons: string[];
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
  quality_brakes?: QualityBrakes;
  sentiment_details?: {
    value: number | null;
    band?: "pessimistic" | "neutral" | "optimistic" | null;
    confidence: number | null;
    status: "computed" | "partial" | "pending";
    signals?: {
      relative_deviation: number | null;
      directional_consistency: number | null;
      rerating_intensity_penalty: number | null;
    };
    components?: any;
  };
  competitive_advantage?: {
    score: number | null;
    band: "weak" | "defendable" | "strong" | null;
    confidence: number | null;
    axes?: {
      return_persistence?: number | null;
      operating_stability?: number | null;
      capital_discipline?: number | null;
    };
    years_analyzed?: number;
  };
}

export type FgosStatus =
  | "Mature"
  | "Developing"
  | "Early-stage"
  | "Incomplete"
  | "partial";

export interface FgosResult {
  ticker: string;
  fgos_score: number | null;
  fgos_category: FgosCategory;
  fgos_breakdown: FgosBreakdown;
  confidence: number;
  confidence_label?: "High" | "Medium" | "Low";
  fgos_status?: FgosStatus;
  quality_warnings?: string[];
  quality_brakes?: QualityBrakes; // Quality penalties structure
  calculated_at: string;
}

export type CanonicalValuationStatus =
  | "very_cheap_sector"
  | "cheap_sector"
  | "fair_sector"
  | "expensive_sector"
  | "very_expensive_sector"
  | "potentially_cheap"
  | "potentially_expensive"
  | "descriptive_only"
  | "pending";

export type LegacyValuationStatus =
  | "undervalued"
  | "overvalued"
  | "fair"
  | "pending";

export interface ValuationResult {
  pe_ratio: number | null;
  ev_ebitda: number | null;
  price_to_fcf: number | null;

  // Legacy field kept for backward-compat
  valuation_status: LegacyValuationStatus;

  intrinsic_value?: number | null;
  upside_potential?: number | null;

  // Canonical State
  stage: "pending" | "partial" | "computed";
  confidence: {
    label: "Low" | "Medium" | "High";
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
  stage: "pending" | "partial" | "computed";
  valuation_status: CanonicalValuationStatus;
  confidence: {
    label: "Low" | "Medium" | "High";
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
  status: "computed" | "pending";

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
  summary?: "leader" | "strong" | "average" | "weak";

  /**
   * Confidence in the position assessment.
   * - 'high': Robust benchmarks, high coverage.
   * - 'medium': Adequate benchmarks.
   * - 'low': Low-confidence benchmarks or poor coverage.
   */
  confidence?: "low" | "medium" | "high";

  /**
   * Explanations for status or confidence issues.
   */
  reasons?: string[];
}

/**
 * IQS - Industry Quality Score
 *
 * STRUCTURAL position vs industry peers based on REAL fiscal year fundamentals.
 * This is NOT IFS Live. They coexist but never merge.
 *
 * PUBLIC NAME: "IQS (Industry Quality Score)"
 * INTERNAL FIELD: ifs_fy (DB column name)
 *
 * RULES:
 * - One entry per REAL fiscal year (no inferred duration)
 * - Industry comparison ONLY (never sector)
 * - Percentile-based ranking (relative, not absolute)
 * - No temporal ambiguity (explicit fiscal_year strings)
 * - No inferred trends or narratives
 */
export type IQSPosition = "leader" | "follower" | "laggard";

export interface IQSFiscalYearPosition {
  /**
   * Explicit fiscal year (e.g. "2023")
   */
  fiscal_year: string;

  /**
   * Position within industry for this FY
   */
  position: IQSPosition;

  /**
   * Percentile rank (0-100) within industry
   */
  percentile: number;
}

export interface IQSResult {
  /**
   * Mode identifier (constant)
   */
  mode: "fy_industry_structural";

  /**
   * Explicit list of fiscal years (oldest → newest)
   * e.g. ["2021", "2022", "2023"]
   */
  fiscal_years: string[];

  /**
   * Position for each fiscal year (ordered oldest → newest)
   */
  fiscal_positions: IQSFiscalYearPosition[];

  /**
   * Most recent fiscal year position
   */
  current_fy: {
    fiscal_year: string;
    position: IQSPosition;
  };

  /**
   * Confidence based ONLY on FY data completeness (0-100)
   * NOT on trend, consistency, or improvement
   */
  confidence: number;
}

/**
 * Fiscal year fundamental data structure
 */
export interface FiscalYearData {
  fiscal_year: string;
  fiscal_date_ending: string;

  // Quality metrics
  roic: number | null;
  operating_margin: number | null;
  net_margin: number | null;
  revenue_cagr: number | null;
  fcf_margin: number | null;

  // Balance sheet health
  debt_to_equity: number | null;
  current_ratio: number | null;

  // Efficiency
  // asset_turnover: number | null; // Removed: Not in DB
  // roa: number | null; // Removed: Not in DB
}

/**
 * Precomputed industry benchmark for a fiscal year
 * (To avoid O(N²) peer loops)
 */
export interface IndustryFYBenchmark {
  industry: string;
  fiscal_year: string;

  // Percentile distributions for each metric
  roic_distribution: number[];
  margin_distribution: number[];
  growth_distribution: number[];
  leverage_distribution: number[];
  fcf_distribution: number[];

  // Metadata
  sample_size: number;
  computed_at: string;
}

export interface FinancialSnapshot {
  ticker: string;
  snapshot_date: string;
  engine_version: string;
  sector: string | null;
  classification?: {
    status: "full" | "partial" | "missing";
    sector: string | null;
    industry: string | null;
    source?: "canonical" | "profile_fallback";
  };
  sector_performance?: {
    status: "full" | "partial" | "missing";
    data: {
      "1D"?: number | null;
      "1W"?: number | null;
      "1M"?: number | null;
      "3M"?: number | null;
      "6M"?: number | null;
      YTD?: number | null;
      "1Y"?: number | null;
      "3Y"?: number | null;
      "5Y"?: number | null;
    };
  };
  industry_performance?: {
    status: "full" | "partial" | "missing";
    data: {
      "1D"?: number | null;
      "1W"?: number | null;
      "1M"?: number | null;
      "3M"?: number | null;
      "6M"?: number | null;
      YTD?: number | null;
      "1Y"?: number | null;
      "3Y"?: number | null;
      "5Y"?: number | null;
    };
  };
  relative_return?: Record<string, any>;
  [key: string]: any;
}

export interface EnrichedStockData {
  ticker: string;
  sectorRank: number | null;
  sectorRankTotal: number | null;
  sectorValuationStatus: string | null;
  fgosBand: string | null;
  fgosScore: number | null;
  fgosStatus: string | null;
  sentimentBand: string | null;
  qualityBrakes?: QualityBrakes; // Quality penalties structure
  ifs: IFSData | null;
  ifs_fy: IQSResult | null;
  strategyState: string | null;
  priceEod: number | null;
  ytdReturn: number | null;
  relativeReturn1Y?: number | null;
  alphaVsIndustry1Y?: number | null;
  alphaVsSector1Y?: number | null;
  marketCap: number | null;
  companyName?: string | null;
}

export interface SectorBenchmark {
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  sample_size: number;
  confidence: "low" | "medium" | "high";
  median: number | null;
  trimmed_mean: number | null;
  uncertainty_range: { p5: number; p95: number } | any | null;
}

export interface FundamentalsTimelineResponse {
  ticker: string;
  groups: YearGroup[];
  metrics: Metric[];
}

export interface FintraSnapshotDB {
  ticker: string;
  snapshot_date: string;
  price: number | null;
  change_percentage: number | null;
  fgos_score: number | null;
  valuation_status: string | null;
  verdict_text: string | null;
  ecosystem_score: number | null;
  relative_return: any | null;
  market_cap?: number | null;
  volume?: number | null;
}

export interface EcosystemRelationDB {
  relation_id: string;
  source_ticker: string;
  target_ticker: string;
  relation_type: string;
  strength: number;
  confidence: number;
  reasons: string[] | null;
  last_updated: string;
}

export interface EcoNodeJSON {
  id: string;
  label: string;
  type?: string;
  weight?: number;
}

export interface EcosystemDataJSON {
  nodes: EcoNodeJSON[];
  edges: any[];
  metrics?: any;
}

export interface EcosystemReportDB {
  report_id: string;
  ticker: string;
  ecosystem_score: number;
  relations_count: number;
  summary: string;
  analysis_date: string;
  ecosystem_data?: EcosystemDataJSON;
}

export type FmpProfile = FMPCompanyProfile;
export type FmpRatios = FMPFinancialRatio;

export interface FmpMetrics {
  roicTTM?: number | null;
  returnOnInvestedCapitalTTM?: number | null;
  freeCashFlowMarginTTM?: number | null;
  altmanZScore?: number | null;
  piotroskiScore?: number | null;
  wacc?: number | null;
  [key: string]: any;
}

export interface FmpQuote {
  price?: number | null;
  change?: number | null;
  changesPercentage?: number | null;
  yearHigh?: number | null;
  yearLow?: number | null;
  [key: string]: any;
}

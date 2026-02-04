-- =============================================
-- FINTRA DATABASE SCHEMA BACKUP
-- Generated: 2026-02-03T07:18:51.207Z
-- Method: Simple table list + column export
-- =============================================


-- =============================================
-- Table: public.fintra_universe
-- =============================================

CREATE TABLE IF NOT EXISTS public.fintra_universe (
    ticker TEXT,
    name TEXT,
    exchange TEXT,
    exchange_short TEXT,
    type TEXT,
    currency TEXT,
    is_active BOOLEAN,
    first_seen DATE,
    last_seen DATE,
    source TEXT,
    sector TEXT,
    industry TEXT,
    sub_industry TEXT,
    instrument_type TEXT,
    is_etf BOOLEAN,
    is_adr BOOLEAN,
    is_fund BOOLEAN,
    country TEXT,
    region TEXT,
    profile_confidence BIGINT,
    last_profile_update DATE
);

-- Row count: 88647


-- =============================================
-- Table: public.fintra_market_state
-- =============================================

CREATE TABLE IF NOT EXISTS public.fintra_market_state (
    ticker TEXT,
    price DOUBLE PRECISION,
    change TEXT,
    change_percentage TEXT,
    market_cap BIGINT,
    ytd_return TEXT,
    last_price_date DATE,
    source TEXT,
    updated_at TIMESTAMPTZ,
    sector TEXT,
    industry TEXT,
    volume TEXT,
    fgos_score BIGINT,
    valuation_status TEXT,
    verdict_text TEXT,
    ecosystem_score TEXT,
    fgos_confidence_label TEXT,
    fgos_confidence_percent BIGINT,
    market_position TEXT,
    strategic_state TEXT,
    relative_return TEXT,
    country TEXT,
    company_name TEXT
);

-- Row count: 88626


-- =============================================
-- Table: public.fintra_snapshots
-- =============================================

CREATE TABLE IF NOT EXISTS public.fintra_snapshots (
    ticker TEXT,
    snapshot_date DATE,
    profile_structural JSONB,
    market_snapshot JSONB,
    fgos_score BIGINT,
    fgos_components JSONB,
    valuation JSONB,
    market_position JSONB,
    investment_verdict JSONB,
    data_confidence JSONB,
    engine_version TEXT,
    created_at TIMESTAMPTZ,
    sector TEXT,
    fundamentals_growth JSONB,
    fgos_status TEXT,
    fgos_category TEXT,
    fgos_confidence_label TEXT,
    fgos_maturity TEXT,
    fgos_confidence_percent BIGINT,
    strategic_state JSONB,
    relative_return JSONB,
    industry_performance JSONB,
    sector_performance JSONB,
    sector_pe JSONB,
    classification JSONB,
    ifs JSONB,
    relative_vs_sector_1w TEXT,
    relative_vs_sector_1m DOUBLE PRECISION,
    relative_vs_sector_ytd TEXT,
    relative_vs_sector_1y DOUBLE PRECISION,
    relative_vs_sector_3y DOUBLE PRECISION,
    relative_vs_sector_5y DOUBLE PRECISION,
    relative_vs_market_1w TEXT,
    relative_vs_market_1m DOUBLE PRECISION,
    relative_vs_market_ytd TEXT,
    relative_vs_market_1y DOUBLE PRECISION,
    relative_vs_market_3y DOUBLE PRECISION,
    relative_vs_market_5y DOUBLE PRECISION,
    sector_rank TEXT,
    sector_rank_total TEXT,
    ifs_memory JSONB,
    relative_vs_sector_3m TEXT,
    relative_vs_sector_6m TEXT,
    relative_vs_sector_2y TEXT,
    relative_vs_market_3m TEXT,
    relative_vs_market_6m TEXT,
    relative_vs_market_2y TEXT,
    ifs_fy TEXT
);

-- Row count: 106738


-- =============================================
-- Table: public.company_profile
-- =============================================

CREATE TABLE IF NOT EXISTS public.company_profile (
    ticker TEXT,
    company_name TEXT,
    description TEXT,
    sector TEXT,
    industry TEXT,
    country TEXT,
    website TEXT,
    ceo TEXT,
    employees BIGINT,
    source TEXT,
    updated_at TIMESTAMPTZ
);

-- Row count: 53406


-- =============================================
-- Table: public.financial_statements
-- =============================================

-- Error retrieving schema: Table not found or inaccessible: Could not find the table 'public.financial_statements' in the schema cache


-- =============================================
-- Table: public.prices_daily
-- =============================================

CREATE TABLE IF NOT EXISTS public.prices_daily (
    ticker TEXT,
    price_date DATE,
    open BIGINT,
    high BIGINT,
    low BIGINT,
    close BIGINT,
    adj_close DOUBLE PRECISION,
    volume BIGINT,
    source TEXT,
    data_freshness TEXT
);

-- Row count: 0


-- =============================================
-- Table: public.performance
-- =============================================

-- Error retrieving schema: Table not found or inaccessible: Could not find the table 'public.performance' in the schema cache


-- =============================================
-- Table: public.performance_windows
-- =============================================

CREATE TABLE IF NOT EXISTS public.performance_windows (
    ticker TEXT,
    benchmark_ticker TEXT,
    window_code TEXT,
    asset_return DOUBLE PRECISION,
    benchmark_return DOUBLE PRECISION,
    alpha DOUBLE PRECISION,
    volatility TEXT,
    max_drawdown TEXT,
    as_of_date DATE,
    source TEXT,
    created_at TIMESTAMPTZ
);

-- Row count: 132424


-- =============================================
-- Table: public.sector_performance
-- =============================================

CREATE TABLE IF NOT EXISTS public.sector_performance (
    sector TEXT,
    window_code TEXT,
    performance_date DATE,
    return_percent DOUBLE PRECISION,
    source TEXT,
    created_at TIMESTAMPTZ
);

-- Row count: 77


-- =============================================
-- Table: public.sector_performance_windows
-- =============================================

-- Error retrieving schema: Table not found or inaccessible: Could not find the table 'public.sector_performance_windows' in the schema cache


-- =============================================
-- Table: public.industry_performance
-- =============================================

CREATE TABLE IF NOT EXISTS public.industry_performance (
    industry TEXT,
    window_code TEXT,
    performance_date DATE,
    return_percent DOUBLE PRECISION,
    source TEXT
);

-- Row count: 215429


-- =============================================
-- Table: public.industry_performance_windows
-- =============================================

-- Error retrieving schema: Table not found or inaccessible: Could not find the table 'public.industry_performance_windows' in the schema cache


-- =============================================
-- Table: public.sector_benchmarks
-- =============================================

CREATE TABLE IF NOT EXISTS public.sector_benchmarks (
    sector TEXT,
    snapshot_date DATE,
    metric TEXT,
    p10 DOUBLE PRECISION,
    p25 DOUBLE PRECISION,
    p50 DOUBLE PRECISION,
    p75 DOUBLE PRECISION,
    p90 DOUBLE PRECISION,
    sample_size BIGINT,
    confidence TEXT,
    median DOUBLE PRECISION,
    trimmed_mean DOUBLE PRECISION,
    uncertainty_range JSONB
);

-- Row count: 8023


-- =============================================
-- Table: public.industry_benchmarks
-- =============================================

CREATE TABLE IF NOT EXISTS public.industry_benchmarks (
    industry TEXT,
    window_code TEXT,
    benchmark_type TEXT,
    benchmark_key TEXT,
    performance_date DATE,
    alpha_percent DOUBLE PRECISION,
    source TEXT,
    created_at TIMESTAMPTZ
);

-- Row count: 252


-- =============================================
-- Table: public.sector_pe_aggregates
-- =============================================

-- Error retrieving schema: Table not found or inaccessible: Could not find the table 'public.sector_pe_aggregates' in the schema cache


-- =============================================
-- Table: public.industry_pe_aggregates
-- =============================================

-- Error retrieving schema: Table not found or inaccessible: Could not find the table 'public.industry_pe_aggregates' in the schema cache


-- =============================================
-- Table: public.ttm_valuation
-- =============================================

-- Error retrieving schema: Table not found or inaccessible: Could not find the table 'public.ttm_valuation' in the schema cache


-- =============================================
-- Table: public.dividends
-- =============================================

-- Error retrieving schema: Table not found or inaccessible: Could not find the table 'public.dividends' in the schema cache


-- =============================================
-- Table: public.company_peers
-- =============================================

-- Error retrieving schema: Table not found or inaccessible: Could not find the table 'public.company_peers' in the schema cache


-- =============================================
-- Table: public.industry_classification
-- =============================================

CREATE TABLE IF NOT EXISTS public.industry_classification (
    industry_code TEXT,
    industry_name TEXT,
    sector TEXT,
    description TEXT,
    source TEXT,
    active BOOLEAN,
    created_at TIMESTAMPTZ
);

-- Row count: 159


-- =============================================
-- Table: public.industry_metadata
-- =============================================

CREATE TABLE IF NOT EXISTS public.industry_metadata (
    industry_code TEXT,
    cadence TEXT,
    dominant_horizons JSONB,
    structural_horizon_min_years BIGINT,
    version TEXT,
    effective_from DATE,
    effective_to TEXT
);

-- Row count: 10


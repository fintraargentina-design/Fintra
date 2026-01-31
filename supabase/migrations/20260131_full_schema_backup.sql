-- Schema Backup - Generated on 2026-01-31

-- Table: asset_industry_map
CREATE TABLE IF NOT EXISTS asset_industry_map (
    source text NOT NULL,
    industry_code text NOT NULL,
    ticker text NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now()
);

-- Table: busquedas_acciones
CREATE TABLE IF NOT EXISTS busquedas_acciones (
    ultima_busqueda timestamp with time zone NOT NULL DEFAULT now(),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    busquedas integer NOT NULL DEFAULT 1,
    symbol text NOT NULL
);

-- Table: company_profile
CREATE TABLE IF NOT EXISTS company_profile (
    employees integer,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    description text,
    company_name text,
    sector text,
    industry text,
    country text,
    website text,
    ticker text NOT NULL,
    ceo text,
    source text NOT NULL DEFAULT 'fmp'::text
);

-- Table: cron_state
CREATE TABLE IF NOT EXISTS cron_state (
    name text NOT NULL,
    last_run_date date
);

-- Table: datos_dividendos
CREATE TABLE IF NOT EXISTS datos_dividendos (
    dividend_per_share numeric,
    year integer NOT NULL,
    data_freshness numeric,
    payout_fcf numeric,
    created_at timestamp with time zone DEFAULT now(),
    has_dividend boolean NOT NULL DEFAULT false,
    dividend_cash_paid numeric,
    payout_eps numeric,
    fiscal_year_end_date date,
    is_growing boolean,
    payments_count integer,
    dividend_yield numeric,
    source text NOT NULL,
    ticker text NOT NULL,
    is_stable boolean
);

-- Table: datos_financieros
CREATE TABLE IF NOT EXISTS datos_financieros (
    period_type text NOT NULL,
    period_label text NOT NULL,
    source text NOT NULL,
    period_status text NOT NULL DEFAULT 'preliminary'::text,
    weighted_shares_out numeric,
    current_ratio numeric,
    invested_capital numeric,
    book_value_per_share numeric,
    revenue_cagr numeric,
    capex numeric,
    finalized_at timestamp with time zone,
    earnings_cagr numeric,
    equity_cagr numeric,
    revenue numeric,
    wacc numeric,
    ebitda_margin numeric,
    ebitda numeric,
    interest_coverage numeric,
    created_at timestamp with time zone DEFAULT now(),
    total_equity numeric,
    period_end_date date NOT NULL,
    net_income numeric,
    data_freshness numeric,
    roic numeric,
    free_cash_flow numeric,
    gross_margin numeric,
    net_margin numeric,
    roe numeric,
    operating_margin numeric,
    fcf_margin numeric,
    data_completeness numeric,
    ticker text NOT NULL,
    total_debt numeric,
    debt_to_equity numeric
);

-- Table: datos_performance
CREATE TABLE IF NOT EXISTS datos_performance (
    data_freshness numeric,
    source text NOT NULL,
    benchmark_ticker text,
    window_code text NOT NULL,
    ticker text NOT NULL,
    performance_date date NOT NULL DEFAULT CURRENT_DATE,
    return_percent numeric NOT NULL,
    absolute_return numeric,
    volatility numeric,
    max_drawdown numeric,
    relative_return numeric,
    created_at timestamp with time zone DEFAULT now()
);

-- Table: datos_valuacion
CREATE TABLE IF NOT EXISTS datos_valuacion (
    dividend_yield numeric,
    price_to_fcf numeric,
    price_to_sales numeric,
    pe_forward numeric,
    pe_ratio numeric,
    enterprise_value numeric,
    source text NOT NULL,
    valuation_status text,
    market_cap numeric,
    price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    valuation_date date NOT NULL DEFAULT CURRENT_DATE,
    p_fcf_percentile numeric,
    sector text NOT NULL,
    denominator_period text NOT NULL,
    denominator_type text NOT NULL,
    ticker text NOT NULL,
    composite_percentile numeric,
    peg_ratio numeric,
    ev_ebitda numeric,
    ev_sales numeric,
    price_to_book numeric,
    ev_ebitda_percentile numeric,
    pe_percentile numeric,
    data_freshness numeric
);

-- Table: fintra_active_stocks
CREATE TABLE IF NOT EXISTS fintra_active_stocks (
    exchange text,
    name text,
    ticker text,
    first_seen date,
    is_active boolean,
    last_seen date,
    source text,
    currency text,
    type text,
    exchange_short text
);

-- Table: fintra_ecosystem_reports
CREATE TABLE IF NOT EXISTS fintra_ecosystem_reports (
    ticker text NOT NULL,
    report_md text,
    id bigint NOT NULL,
    date date DEFAULT CURRENT_DATE,
    data jsonb,
    ecosystem_score integer,
    updated_at timestamp with time zone DEFAULT now()
);

-- Table: fintra_market_state
CREATE TABLE IF NOT EXISTS fintra_market_state (
    price numeric,
    valuation_status text,
    verdict_text text,
    fgos_confidence_label text,
    country text,
    company_name text,
    strategic_state jsonb,
    last_price_date date,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    volume numeric,
    fgos_score numeric,
    ecosystem_score numeric,
    fgos_confidence_percent numeric,
    market_position jsonb,
    sector text,
    source text NOT NULL DEFAULT 'consolidated'::text,
    relative_return jsonb,
    ticker text NOT NULL,
    ytd_return numeric,
    market_cap numeric,
    change_percentage numeric,
    change numeric,
    industry text
);

-- Table: fintra_sec_event_signals
CREATE TABLE IF NOT EXISTS fintra_sec_event_signals (
    accepted_date timestamp with time zone,
    filing_date timestamp with time zone NOT NULL,
    ticker text NOT NULL,
    event_type text NOT NULL,
    event_category text NOT NULL,
    sec_item text NOT NULL,
    link text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL DEFAULT gen_random_uuid()
);

-- Table: fintra_sec_structural_signals
CREATE TABLE IF NOT EXISTS fintra_sec_structural_signals (
    ticker text NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    supplier_concentration text,
    single_source_dependency boolean,
    purchase_obligations_currency text,
    purchase_obligations_amount numeric,
    created_at timestamp with time zone DEFAULT now(),
    geographic_exposure ARRAY,
    environmental_exposure text,
    fiscal_year integer NOT NULL,
    source text NOT NULL DEFAULT 'SEC_10K'::text
);

-- Table: fintra_snapshots
CREATE TABLE IF NOT EXISTS fintra_snapshots (
    profile_structural jsonb NOT NULL,
    market_snapshot jsonb NOT NULL,
    fgos_score numeric,
    fgos_components jsonb,
    valuation jsonb NOT NULL,
    market_position jsonb NOT NULL,
    investment_verdict jsonb NOT NULL,
    data_confidence jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    peers jsonb,
    fundamentals_growth jsonb,
    fgos_confidence numeric,
    fgos_confidence_percent numeric,
    strategic_state jsonb,
    relative_return jsonb,
    industry_performance jsonb,
    sector_performance jsonb,
    sector_pe jsonb,
    classification jsonb,
    ifs jsonb,
    relative_vs_sector_1w numeric,
    relative_vs_sector_1m numeric,
    relative_vs_sector_ytd numeric,
    relative_vs_sector_1y numeric,
    relative_vs_sector_3y numeric,
    relative_vs_sector_5y numeric,
    relative_vs_market_1w numeric,
    relative_vs_market_1m numeric,
    relative_vs_market_ytd numeric,
    relative_vs_market_1y numeric,
    relative_vs_market_3y numeric,
    relative_vs_market_5y numeric,
    sector_rank integer,
    sector_rank_total integer,
    snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
    ticker text NOT NULL,
    engine_version text NOT NULL,
    sector text,
    fgos_status text DEFAULT 'computed'::text,
    fgos_category text,
    fgos_confidence_label text,
    fgos_maturity text
);

-- Table: fintra_universe
CREATE TABLE IF NOT EXISTS fintra_universe (
    last_seen date DEFAULT CURRENT_DATE,
    last_profile_update date,
    instrument_type text,
    sub_industry text,
    industry text,
    sector text,
    is_etf boolean,
    source text NOT NULL DEFAULT 'FMP'::text,
    currency text,
    type text,
    exchange_short text,
    exchange text,
    name text,
    ticker text NOT NULL,
    profile_confidence numeric,
    is_active boolean DEFAULT true,
    first_seen date DEFAULT CURRENT_DATE,
    is_fund boolean,
    is_adr boolean,
    region text,
    country text
);

-- Table: industry_benchmarks
CREATE TABLE IF NOT EXISTS industry_benchmarks (
    industry text NOT NULL,
    window_code text NOT NULL,
    benchmark_type text NOT NULL,
    benchmark_key text NOT NULL,
    source text NOT NULL DEFAULT 'derived_from_performance'::text,
    performance_date date NOT NULL,
    alpha_percent numeric,
    created_at timestamp with time zone DEFAULT now()
);

-- Table: industry_classification
CREATE TABLE IF NOT EXISTS industry_classification (
    industry_name text NOT NULL,
    sector text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    source text NOT NULL,
    industry_code text NOT NULL,
    active boolean NOT NULL DEFAULT true
);

-- Table: industry_metadata
CREATE TABLE IF NOT EXISTS industry_metadata (
    effective_to date,
    industry_code text NOT NULL,
    cadence text NOT NULL,
    dominant_horizons ARRAY NOT NULL,
    version text NOT NULL,
    effective_from date NOT NULL,
    structural_horizon_min_years integer NOT NULL
);

-- Table: industry_pe
CREATE TABLE IF NOT EXISTS industry_pe (
    pe_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    pe numeric,
    industry text NOT NULL,
    source text NOT NULL
);

-- Table: industry_performance
CREATE TABLE IF NOT EXISTS industry_performance (
    return_percent numeric,
    source text NOT NULL,
    window_code text NOT NULL,
    industry text NOT NULL,
    performance_date date NOT NULL
);

-- Table: news_insight_snapshots
CREATE TABLE IF NOT EXISTS news_insight_snapshots (
    evidence_level text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    analysis_version integer NOT NULL DEFAULT 1,
    published_date date NOT NULL,
    confidence text NOT NULL,
    narrative_vector ARRAY NOT NULL,
    direction text NOT NULL,
    url text NOT NULL,
    source text NOT NULL,
    symbol text NOT NULL,
    canonical_id text NOT NULL,
    news_type text NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    is_eligible_for_history boolean NOT NULL DEFAULT false,
    explanation text
);

-- Table: performance_windows
CREATE TABLE IF NOT EXISTS performance_windows (
    alpha numeric,
    asset_return numeric,
    as_of_date date NOT NULL,
    max_drawdown numeric,
    benchmark_return numeric,
    source text,
    volatility numeric,
    ticker text NOT NULL,
    window_code text NOT NULL,
    benchmark_ticker text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Table: periodos_accion
CREATE TABLE IF NOT EXISTS periodos_accion (
    symbol text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    period text NOT NULL
);

-- Table: prices_daily
CREATE TABLE IF NOT EXISTS prices_daily (
    high numeric,
    low numeric,
    close numeric NOT NULL,
    adj_close numeric,
    volume bigint,
    data_freshness integer,
    ticker text NOT NULL,
    price_date date NOT NULL,
    open numeric,
    source text NOT NULL DEFAULT 'fmp_csv'::text
);

-- Table: sector_benchmarks
CREATE TABLE IF NOT EXISTS sector_benchmarks (
    snapshot_date date NOT NULL,
    uncertainty_range jsonb,
    trimmed_mean double precision,
    median double precision,
    sample_size integer NOT NULL DEFAULT 0,
    p90 numeric,
    p75 numeric,
    sector text NOT NULL,
    metric text NOT NULL,
    p50 numeric,
    p25 numeric,
    p10 numeric,
    confidence text NOT NULL DEFAULT 'pending'::text
);

-- Table: sector_pe
CREATE TABLE IF NOT EXISTS sector_pe (
    sector text NOT NULL,
    source text DEFAULT 'fmp_sector_pe'::text,
    created_at timestamp with time zone DEFAULT now(),
    pe_date date NOT NULL,
    pe numeric
);

-- Table: sector_performance
CREATE TABLE IF NOT EXISTS sector_performance (
    window_code text NOT NULL,
    source text DEFAULT 'fmp_sector'::text,
    performance_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    sector text NOT NULL,
    return_percent numeric
);

-- Table: sector_stats
CREATE TABLE IF NOT EXISTS sector_stats (
    stats_date date NOT NULL,
    p25 numeric,
    p50 numeric,
    std_dev numeric,
    metric text NOT NULL,
    mean numeric,
    uncertainty_range jsonb,
    confidence_level text,
    p75 numeric,
    p90 numeric,
    sector text NOT NULL,
    p10 numeric,
    sample_size integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    median double precision,
    trimmed_mean double precision
);

-- Table: sic_industry_map
CREATE TABLE IF NOT EXISTS sic_industry_map (
    sic_description text NOT NULL,
    industry_code text NOT NULL,
    sic_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    source text NOT NULL,
    confidence text NOT NULL
);

-- Table: stock_peers
CREATE TABLE IF NOT EXISTS stock_peers (
    source text NOT NULL DEFAULT 'FMP'::text,
    ticker text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    confidence text DEFAULT 'market'::text,
    peer_ticker text NOT NULL
);

-- Primary Keys
ALTER TABLE public.asset_industry_map ADD PRIMARY KEY (ticker, effective_from);
ALTER TABLE public.busquedas_acciones ADD PRIMARY KEY (id);
ALTER TABLE public.company_profile ADD PRIMARY KEY (ticker);
ALTER TABLE public.cron_state ADD PRIMARY KEY (name);
ALTER TABLE public.datos_dividendos ADD PRIMARY KEY (ticker, year);
ALTER TABLE public.datos_financieros ADD PRIMARY KEY (period_label, ticker, period_type);
ALTER TABLE public.datos_performance ADD PRIMARY KEY (window_code, performance_date, ticker);
ALTER TABLE public.datos_valuacion ADD PRIMARY KEY (denominator_type, denominator_period, ticker, valuation_date);
ALTER TABLE public.fintra_ecosystem_reports ADD PRIMARY KEY (id);
ALTER TABLE public.fintra_market_state ADD PRIMARY KEY (ticker);
ALTER TABLE public.fintra_sec_event_signals ADD PRIMARY KEY (id);
ALTER TABLE public.fintra_sec_structural_signals ADD PRIMARY KEY (id);
ALTER TABLE public.fintra_snapshots ADD PRIMARY KEY (ticker, engine_version, snapshot_date);
ALTER TABLE public.fintra_universe ADD PRIMARY KEY (ticker);
ALTER TABLE public.industry_benchmarks ADD PRIMARY KEY (industry, window_code, benchmark_type, performance_date);
ALTER TABLE public.industry_classification ADD PRIMARY KEY (industry_code);
ALTER TABLE public.industry_metadata ADD PRIMARY KEY (industry_code);
ALTER TABLE public.industry_pe ADD PRIMARY KEY (industry, pe_date);
ALTER TABLE public.industry_performance ADD PRIMARY KEY (industry, window_code, performance_date);
ALTER TABLE public.news_insight_snapshots ADD PRIMARY KEY (id);
ALTER TABLE public.performance_windows ADD PRIMARY KEY (as_of_date, window_code, benchmark_ticker, ticker);
ALTER TABLE public.periodos_accion ADD PRIMARY KEY (symbol);
ALTER TABLE public.prices_daily ADD PRIMARY KEY (ticker, price_date);
ALTER TABLE public.sector_benchmarks ADD PRIMARY KEY (sector, metric, snapshot_date);
ALTER TABLE public.sector_pe ADD PRIMARY KEY (pe_date, sector);
ALTER TABLE public.sector_performance ADD PRIMARY KEY (performance_date, window_code, sector);
ALTER TABLE public.sector_stats ADD PRIMARY KEY (metric, sector, stats_date);
ALTER TABLE public.sic_industry_map ADD PRIMARY KEY (sic_code);
ALTER TABLE public.stock_peers ADD PRIMARY KEY (ticker, peer_ticker);

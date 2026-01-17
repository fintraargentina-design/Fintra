CREATE TABLE IF NOT EXISTS performance_windows (
    ticker TEXT NOT NULL,
    benchmark_ticker TEXT NOT NULL,
    window_code TEXT NOT NULL,
    asset_return NUMERIC,
    benchmark_return NUMERIC,
    alpha NUMERIC,
    volatility NUMERIC,
    max_drawdown NUMERIC,
    as_of_date DATE NOT NULL,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT performance_windows_pkey PRIMARY KEY (ticker, benchmark_ticker, window_code, as_of_date)
);

CREATE INDEX IF NOT EXISTS performance_windows_as_of_date_idx
    ON performance_windows (as_of_date);


-- Migration: Add relative performance columns and sector aggregation function

-- 1. Add Relative Performance Columns to fintra_snapshots
-- We use explicit columns for query efficiency and strict typing, as requested.

ALTER TABLE fintra_snapshots
ADD COLUMN IF NOT EXISTS relative_vs_sector_1w NUMERIC,
ADD COLUMN IF NOT EXISTS relative_vs_sector_1m NUMERIC,
ADD COLUMN IF NOT EXISTS relative_vs_sector_ytd NUMERIC,
ADD COLUMN IF NOT EXISTS relative_vs_sector_1y NUMERIC,
ADD COLUMN IF NOT EXISTS relative_vs_sector_3y NUMERIC,
ADD COLUMN IF NOT EXISTS relative_vs_sector_5y NUMERIC,

ADD COLUMN IF NOT EXISTS relative_vs_market_1w NUMERIC,
ADD COLUMN IF NOT EXISTS relative_vs_market_1m NUMERIC,
ADD COLUMN IF NOT EXISTS relative_vs_market_ytd NUMERIC,
ADD COLUMN IF NOT EXISTS relative_vs_market_1y NUMERIC,
ADD COLUMN IF NOT EXISTS relative_vs_market_3y NUMERIC,
ADD COLUMN IF NOT EXISTS relative_vs_market_5y NUMERIC;

-- 2. Create Sector Aggregation Function
-- Calculates compounded returns from daily sector returns using log-aggregation.
-- Formula: (exp(sum(ln(1 + r))) - 1) * 100

CREATE OR REPLACE FUNCTION calculate_sector_windows_from_returns(p_as_of_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    -- Window Start Dates
    d_1w date := p_as_of_date - interval '7 days';
    d_1m date := p_as_of_date - interval '1 month';
    d_ytd date := date_trunc('year', p_as_of_date);
    d_1y date := p_as_of_date - interval '1 year';
    d_3y date := p_as_of_date - interval '3 years';
    d_5y date := p_as_of_date - interval '5 years';
BEGIN
    -- We aggregate from 'sector_performance' where window_code = '1D'
    -- We assume '1D' rows contain the daily percentage return.
    
    WITH daily_data AS (
        SELECT
            sector,
            performance_date,
            return_percent
        FROM sector_performance
        WHERE window_code = '1D'
          AND performance_date <= p_as_of_date
          AND performance_date >= d_5y -- Optimization: don't scan older than 5Y
          AND return_percent IS NOT NULL
          AND return_percent > -100 -- Prevent ln(<=0) error
    ),
    aggregated AS (
        SELECT
            sector,
            -- 1W
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_1w)) - 1) * 100 as ret_1w,
            -- 1M
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_1m)) - 1) * 100 as ret_1m,
            -- YTD
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date >= d_ytd)) - 1) * 100 as ret_ytd,
            -- 1Y
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_1y)) - 1) * 100 as ret_1y,
            -- 3Y
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_3y)) - 1) * 100 as ret_3y,
            -- 5Y
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_5y)) - 1) * 100 as ret_5y
        FROM daily_data
        GROUP BY sector
    ),
    unpivoted AS (
        SELECT sector, '1W' as window_code, ret_1w as return_percent FROM aggregated WHERE ret_1w IS NOT NULL
        UNION ALL
        SELECT sector, '1M' as window_code, ret_1m as return_percent FROM aggregated WHERE ret_1m IS NOT NULL
        UNION ALL
        SELECT sector, 'YTD' as window_code, ret_ytd as return_percent FROM aggregated WHERE ret_ytd IS NOT NULL
        UNION ALL
        SELECT sector, '1Y' as window_code, ret_1y as return_percent FROM aggregated WHERE ret_1y IS NOT NULL
        UNION ALL
        SELECT sector, '3Y' as window_code, ret_3y as return_percent FROM aggregated WHERE ret_3y IS NOT NULL
        UNION ALL
        SELECT sector, '5Y' as window_code, ret_5y as return_percent FROM aggregated WHERE ret_5y IS NOT NULL
    )
    INSERT INTO sector_performance (sector, window_code, performance_date, return_percent, source)
    SELECT
        sector,
        window_code,
        p_as_of_date,
        return_percent,
        'sql_aggregation'
    FROM unpivoted
    ON CONFLICT (sector, window_code, performance_date)
    DO UPDATE SET
        return_percent = EXCLUDED.return_percent,
        source = EXCLUDED.source;

END;
$$;

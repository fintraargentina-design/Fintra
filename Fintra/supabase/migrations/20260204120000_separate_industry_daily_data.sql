-- Migration: Separate Daily vs Windowed Industry Data
-- Date: 2026-02-04
-- Author: FINTRA Data Engineering

-- 1. Create table for raw daily industry returns (Option A)
-- This table replaces the use of industry_performance for window_code = '1D'
CREATE TABLE IF NOT EXISTS industry_performance_daily (
    industry TEXT NOT NULL,
    performance_date DATE NOT NULL,
    return_percent NUMERIC, -- Raw daily return percentage
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (industry, performance_date)
);

-- 2. Migrate existing 1D data to the new table
INSERT INTO industry_performance_daily (industry, performance_date, return_percent, source)
SELECT 
    industry, 
    performance_date, 
    return_percent, 
    source
FROM industry_performance
WHERE window_code = '1D'
ON CONFLICT (industry, performance_date) DO NOTHING;

-- 3. Remove 1D data from the windowed table (Strict Separation)
DELETE FROM industry_performance
WHERE window_code = '1D';

-- 4. Update the aggregation function to read from the new daily table
-- Includes EXPLICIT Gap Policy (Declarative) and Source Marking
CREATE OR REPLACE FUNCTION calculate_industry_windows_from_returns(p_as_of_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    -- Window Start Dates (Canonical Set: 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y)
    d_1m date := p_as_of_date - interval '1 month';
    d_3m date := p_as_of_date - interval '3 months';
    d_6m date := p_as_of_date - interval '6 months';
    d_1y date := p_as_of_date - interval '1 year';
    d_2y date := p_as_of_date - interval '2 years';
    d_3y date := p_as_of_date - interval '3 years';
    d_5y date := p_as_of_date - interval '5 years';
BEGIN
    -- GAP POLICY: DECLARATIVE (ACCEPTABLE)
    -- We aggregate from 'industry_performance_daily' which contains raw 1D returns.
    -- Returns are compounded ONLY over available trading days found in the table.
    -- If a day is missing (gap), it is implicitly treated as 0% return for that day 
    -- (i.e., it does not contribute to the compounding drift).
    -- NO gap filling or interpolation is performed.
    
    WITH daily_data AS (
        SELECT
            industry,
            performance_date,
            return_percent
        FROM industry_performance_daily -- CHANGED: Read from separate daily table
        WHERE performance_date <= p_as_of_date
          AND performance_date >= d_5y -- Optimization: don't scan older than 5Y
          AND return_percent IS NOT NULL
          AND return_percent > -100 -- Prevent ln(<=0) error
    ),
    aggregated AS (
        SELECT
            industry,
            -- 1M
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_1m)) - 1) * 100 as ret_1m,
            -- 3M
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_3m)) - 1) * 100 as ret_3m,
            -- 6M
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_6m)) - 1) * 100 as ret_6m,
            -- 1Y
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_1y)) - 1) * 100 as ret_1y,
            -- 2Y
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_2y)) - 1) * 100 as ret_2y,
            -- 3Y
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_3y)) - 1) * 100 as ret_3y,
            -- 5Y
            (exp(sum(ln(1 + return_percent/100.0)) FILTER (WHERE performance_date > d_5y)) - 1) * 100 as ret_5y
        FROM daily_data
        GROUP BY industry
    ),
    unpivoted AS (
        SELECT industry, '1M' as window_code, ret_1m as return_percent FROM aggregated WHERE ret_1m IS NOT NULL
        UNION ALL
        SELECT industry, '3M' as window_code, ret_3m as return_percent FROM aggregated WHERE ret_3m IS NOT NULL
        UNION ALL
        SELECT industry, '6M' as window_code, ret_6m as return_percent FROM aggregated WHERE ret_6m IS NOT NULL
        UNION ALL
        SELECT industry, '1Y' as window_code, ret_1y as return_percent FROM aggregated WHERE ret_1y IS NOT NULL
        UNION ALL
        SELECT industry, '2Y' as window_code, ret_2y as return_percent FROM aggregated WHERE ret_2y IS NOT NULL
        UNION ALL
        SELECT industry, '3Y' as window_code, ret_3y as return_percent FROM aggregated WHERE ret_3y IS NOT NULL
        UNION ALL
        SELECT industry, '5Y' as window_code, ret_5y as return_percent FROM aggregated WHERE ret_5y IS NOT NULL
    )
    INSERT INTO industry_performance (industry, window_code, performance_date, return_percent, source)
    SELECT
        industry,
        window_code,
        p_as_of_date,
        return_percent,
        'derived_from_industry_daily_returns' -- CHANGED: Explicit source marking
    FROM unpivoted
    ON CONFLICT (industry, window_code, performance_date)
    DO UPDATE SET
        return_percent = EXCLUDED.return_percent,
        source = EXCLUDED.source;

END;
$$;

-- Migration: Refactor calculate_ticker_performance for CPU efficiency
-- Problem: Previous version used window functions and scanned ~1250 rows per ticker.
-- Solution: Use exact point-to-point lookups (2 reads per window).
-- Goal: Reduce CPU usage by order of magnitude.

CREATE OR REPLACE FUNCTION calculate_ticker_performance(p_ticker text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_latest_date date;
    v_latest_close numeric;
    
    -- Target Dates
    d_1w date;
    d_1m date;
    d_3m date;
    d_6m date;
    d_ytd date;
    d_1y date;
    d_3y date;
    d_5y date;

    -- Start Prices
    p_1d numeric;
    p_1w numeric;
    p_1m numeric;
    p_3m numeric;
    p_6m numeric;
    p_ytd numeric;
    p_1y numeric;
    p_3y numeric;
    p_5y numeric;

BEGIN
    -- 1. Get Latest Price (Anchor)
    SELECT price_date, adj_close INTO v_latest_date, v_latest_close
    FROM prices_daily
    WHERE ticker = p_ticker
    ORDER BY price_date DESC
    LIMIT 1;

    IF v_latest_date IS NULL THEN
        RETURN;
    END IF;

    -- 2. Define Window Start Dates (Anchor is v_latest_date)
    d_1w := v_latest_date - interval '7 days';
    d_1m := v_latest_date - interval '1 month';
    d_3m := v_latest_date - interval '3 months';
    d_6m := v_latest_date - interval '6 months';
    d_ytd := date_trunc('year', v_latest_date);
    d_1y := v_latest_date - interval '1 year';
    d_3y := v_latest_date - interval '3 years';
    d_5y := v_latest_date - interval '5 years';

    -- 3. Fetch Start Prices (Efficient Index Lookups)
    -- We use subqueries to allow the optimizer to plan efficient point-lookups
    -- Index usage: (ticker, price_date DESC) supports both DESC (for 1D) and ASC (for others via backward scan)

    SELECT
        -- 1D: Last trading day - 1 (Strictly less than latest date)
        (SELECT adj_close FROM prices_daily WHERE ticker = p_ticker AND price_date < v_latest_date ORDER BY price_date DESC LIMIT 1),
        -- 1W: Earliest date >= target
        (SELECT adj_close FROM prices_daily WHERE ticker = p_ticker AND price_date >= d_1w ORDER BY price_date ASC LIMIT 1),
        -- 1M
        (SELECT adj_close FROM prices_daily WHERE ticker = p_ticker AND price_date >= d_1m ORDER BY price_date ASC LIMIT 1),
        -- 3M
        (SELECT adj_close FROM prices_daily WHERE ticker = p_ticker AND price_date >= d_3m ORDER BY price_date ASC LIMIT 1),
        -- 6M
        (SELECT adj_close FROM prices_daily WHERE ticker = p_ticker AND price_date >= d_6m ORDER BY price_date ASC LIMIT 1),
        -- YTD
        (SELECT adj_close FROM prices_daily WHERE ticker = p_ticker AND price_date >= d_ytd ORDER BY price_date ASC LIMIT 1),
        -- 1Y
        (SELECT adj_close FROM prices_daily WHERE ticker = p_ticker AND price_date >= d_1y ORDER BY price_date ASC LIMIT 1),
        -- 3Y
        (SELECT adj_close FROM prices_daily WHERE ticker = p_ticker AND price_date >= d_3y ORDER BY price_date ASC LIMIT 1),
        -- 5Y
        (SELECT adj_close FROM prices_daily WHERE ticker = p_ticker AND price_date >= d_5y ORDER BY price_date ASC LIMIT 1)
    INTO
        p_1d, p_1w, p_1m, p_3m, p_6m, p_ytd, p_1y, p_3y, p_5y;

    -- 4. Upsert Results
    -- Calculate simple returns: (End / Start) - 1
    -- Insert NULL for volatility/drawdown as they are no longer computed
    
    WITH new_rows (ticker, performance_date, window_code, return_percent, absolute_return, volatility, max_drawdown, source, data_freshness) AS (
        VALUES
            (p_ticker, v_latest_date, '1D', CASE WHEN p_1d IS NOT NULL AND p_1d <> 0 THEN ((v_latest_close / p_1d) - 1) * 100 ELSE NULL END, CASE WHEN p_1d IS NOT NULL THEN v_latest_close - p_1d ELSE NULL END, NULL::numeric, NULL::numeric, 'prices_daily_lite', 0),
            (p_ticker, v_latest_date, '1W', CASE WHEN p_1w IS NOT NULL AND p_1w <> 0 THEN ((v_latest_close / p_1w) - 1) * 100 ELSE NULL END, CASE WHEN p_1w IS NOT NULL THEN v_latest_close - p_1w ELSE NULL END, NULL::numeric, NULL::numeric, 'prices_daily_lite', 0),
            (p_ticker, v_latest_date, '1M', CASE WHEN p_1m IS NOT NULL AND p_1m <> 0 THEN ((v_latest_close / p_1m) - 1) * 100 ELSE NULL END, CASE WHEN p_1m IS NOT NULL THEN v_latest_close - p_1m ELSE NULL END, NULL::numeric, NULL::numeric, 'prices_daily_lite', 0),
            (p_ticker, v_latest_date, '3M', CASE WHEN p_3m IS NOT NULL AND p_3m <> 0 THEN ((v_latest_close / p_3m) - 1) * 100 ELSE NULL END, CASE WHEN p_3m IS NOT NULL THEN v_latest_close - p_3m ELSE NULL END, NULL::numeric, NULL::numeric, 'prices_daily_lite', 0),
            (p_ticker, v_latest_date, '6M', CASE WHEN p_6m IS NOT NULL AND p_6m <> 0 THEN ((v_latest_close / p_6m) - 1) * 100 ELSE NULL END, CASE WHEN p_6m IS NOT NULL THEN v_latest_close - p_6m ELSE NULL END, NULL::numeric, NULL::numeric, 'prices_daily_lite', 0),
            (p_ticker, v_latest_date, 'YTD', CASE WHEN p_ytd IS NOT NULL AND p_ytd <> 0 THEN ((v_latest_close / p_ytd) - 1) * 100 ELSE NULL END, CASE WHEN p_ytd IS NOT NULL THEN v_latest_close - p_ytd ELSE NULL END, NULL::numeric, NULL::numeric, 'prices_daily_lite', 0),
            (p_ticker, v_latest_date, '1Y', CASE WHEN p_1y IS NOT NULL AND p_1y <> 0 THEN ((v_latest_close / p_1y) - 1) * 100 ELSE NULL END, CASE WHEN p_1y IS NOT NULL THEN v_latest_close - p_1y ELSE NULL END, NULL::numeric, NULL::numeric, 'prices_daily_lite', 0),
            (p_ticker, v_latest_date, '3Y', CASE WHEN p_3y IS NOT NULL AND p_3y <> 0 THEN ((v_latest_close / p_3y) - 1) * 100 ELSE NULL END, CASE WHEN p_3y IS NOT NULL THEN v_latest_close - p_3y ELSE NULL END, NULL::numeric, NULL::numeric, 'prices_daily_lite', 0),
            (p_ticker, v_latest_date, '5Y', CASE WHEN p_5y IS NOT NULL AND p_5y <> 0 THEN ((v_latest_close / p_5y) - 1) * 100 ELSE NULL END, CASE WHEN p_5y IS NOT NULL THEN v_latest_close - p_5y ELSE NULL END, NULL::numeric, NULL::numeric, 'prices_daily_lite', 0)
    )
    INSERT INTO datos_performance (ticker, performance_date, window_code, return_percent, absolute_return, volatility, max_drawdown, source, data_freshness)
    SELECT * FROM new_rows
    WHERE return_percent IS NOT NULL
    ON CONFLICT (ticker, performance_date, window_code)
    DO UPDATE SET
        return_percent = EXCLUDED.return_percent,
        absolute_return = EXCLUDED.absolute_return,
        volatility = NULL, -- Clear old volatility as we don't compute it
        max_drawdown = NULL, -- Clear old drawdown
        source = EXCLUDED.source,
        data_freshness = EXCLUDED.data_freshness;

END;
$$;

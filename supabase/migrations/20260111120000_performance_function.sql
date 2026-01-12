CREATE OR REPLACE FUNCTION calculate_ticker_performance(p_ticker text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_latest_date date;
    v_latest_close numeric;
    
    -- Window Lookbacks (Trading Days)
    w_1d int := 1;
    w_1w int := 5;
    w_1m int := 21;
    w_3m int := 63;
    w_6m int := 126;
    w_1y int := 252;
    w_3y int := 756;
    w_5y int := 1260;

    -- Return Values
    r_1d numeric; abs_1d numeric;
    r_1w numeric; abs_1w numeric;
    r_1m numeric; abs_1m numeric;
    r_3m numeric; abs_3m numeric;
    r_6m numeric; abs_6m numeric;
    r_ytd numeric; abs_ytd numeric;
    r_1y numeric; abs_1y numeric;
    r_3y numeric; abs_3y numeric;
    r_5y numeric; abs_5y numeric;

    -- Volatility Values
    vol_1m numeric;
    vol_3m numeric;
    vol_6m numeric;
    vol_1y numeric;
    vol_3y numeric;
    vol_5y numeric;

    -- Drawdown Values
    dd_1m numeric;
    dd_3m numeric;
    dd_6m numeric;
    dd_ytd numeric;
    dd_1y numeric;
    dd_3y numeric;
    dd_5y numeric;

BEGIN
    -- 1. Get Latest Price
    SELECT price_date, adj_close INTO v_latest_date, v_latest_close
    FROM prices_daily
    WHERE ticker = p_ticker
    ORDER BY price_date DESC
    LIMIT 1;

    IF v_latest_date IS NULL THEN
        RETURN;
    END IF;

    -- 2. Calculate Returns & Absolute Returns
    -- Using CTE to fetch past price points by row number
    WITH price_history AS (
        SELECT 
            adj_close,
            ROW_NUMBER() OVER (ORDER BY price_date DESC) as rn
        FROM prices_daily
        WHERE ticker = p_ticker
    ),
    ytd_base AS (
        SELECT adj_close
        FROM prices_daily
        WHERE ticker = p_ticker AND price_date < date_trunc('year', v_latest_date)
        ORDER BY price_date DESC
        LIMIT 1
    )
    SELECT
        (SELECT adj_close FROM price_history WHERE rn = 1 + w_1d),
        (SELECT adj_close FROM price_history WHERE rn = 1 + w_1w),
        (SELECT adj_close FROM price_history WHERE rn = 1 + w_1m),
        (SELECT adj_close FROM price_history WHERE rn = 1 + w_3m),
        (SELECT adj_close FROM price_history WHERE rn = 1 + w_6m),
        (SELECT adj_close FROM price_history WHERE rn = 1 + w_1y),
        (SELECT adj_close FROM price_history WHERE rn = 1 + w_3y),
        (SELECT adj_close FROM price_history WHERE rn = 1 + w_5y),
        (SELECT adj_close FROM ytd_base)
    INTO 
        r_1d, r_1w, r_1m, r_3m, r_6m, r_1y, r_3y, r_5y, r_ytd;

    -- Compute Derived Values (Percent & Abs)
    IF r_1d IS NOT NULL THEN abs_1d := v_latest_close - r_1d; r_1d := ((v_latest_close / r_1d) - 1) * 100; END IF;
    IF r_1w IS NOT NULL THEN abs_1w := v_latest_close - r_1w; r_1w := ((v_latest_close / r_1w) - 1) * 100; END IF;
    IF r_1m IS NOT NULL THEN abs_1m := v_latest_close - r_1m; r_1m := ((v_latest_close / r_1m) - 1) * 100; END IF;
    IF r_3m IS NOT NULL THEN abs_3m := v_latest_close - r_3m; r_3m := ((v_latest_close / r_3m) - 1) * 100; END IF;
    IF r_6m IS NOT NULL THEN abs_6m := v_latest_close - r_6m; r_6m := ((v_latest_close / r_6m) - 1) * 100; END IF;
    IF r_1y IS NOT NULL THEN abs_1y := v_latest_close - r_1y; r_1y := ((v_latest_close / r_1y) - 1) * 100; END IF;
    IF r_3y IS NOT NULL THEN abs_3y := v_latest_close - r_3y; r_3y := ((v_latest_close / r_3y) - 1) * 100; END IF;
    IF r_5y IS NOT NULL THEN abs_5y := v_latest_close - r_5y; r_5y := ((v_latest_close / r_5y) - 1) * 100; END IF;
    IF r_ytd IS NOT NULL THEN abs_ytd := v_latest_close - r_ytd; r_ytd := ((v_latest_close / r_ytd) - 1) * 100; END IF;

    -- 3. Calculate Volatility & Drawdown
    -- Fetch recent history once for all windows
    WITH relevant_history AS (
        SELECT 
            price_date,
            adj_close,
            LAG(adj_close) OVER (ORDER BY price_date) as prev_close,
            ROW_NUMBER() OVER (ORDER BY price_date DESC) as rn
        FROM prices_daily
        WHERE ticker = p_ticker
        ORDER BY price_date DESC
        LIMIT 1261 -- Max window (5Y) + 1
    ),
    daily_returns AS (
        SELECT 
            rn,
            CASE WHEN prev_close > 0 THEN LN(adj_close / prev_close) ELSE 0 END as log_return
        FROM relevant_history
        WHERE prev_close IS NOT NULL
    ),
    -- Volatility Calculation (Annualized StdDev)
    vol_calc AS (
        SELECT
            (SELECT STDDEV(log_return) * SQRT(252) * 100 FROM daily_returns WHERE rn <= w_1m HAVING COUNT(*) >= w_1m) as v_1m,
            (SELECT STDDEV(log_return) * SQRT(252) * 100 FROM daily_returns WHERE rn <= w_3m HAVING COUNT(*) >= w_3m) as v_3m,
            (SELECT STDDEV(log_return) * SQRT(252) * 100 FROM daily_returns WHERE rn <= w_6m HAVING COUNT(*) >= w_6m) as v_6m,
            (SELECT STDDEV(log_return) * SQRT(252) * 100 FROM daily_returns WHERE rn <= w_1y HAVING COUNT(*) >= w_1y) as v_1y,
            (SELECT STDDEV(log_return) * SQRT(252) * 100 FROM daily_returns WHERE rn <= w_3y HAVING COUNT(*) >= w_3y) as v_3y,
            (SELECT STDDEV(log_return) * SQRT(252) * 100 FROM daily_returns WHERE rn <= w_5y HAVING COUNT(*) >= w_5y) as v_5y
    ),
    -- Drawdown Calculation
    dd_stats AS (
        SELECT
            (
                WITH subset AS (SELECT adj_close, rn FROM relevant_history WHERE rn <= w_1m),
                dd_series AS (
                    SELECT (adj_close / MAX(adj_close) OVER (ORDER BY rn DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) - 1 as dd
                    FROM subset
                )
                SELECT MIN(dd) * 100 FROM dd_series HAVING COUNT(*) >= w_1m
            ) as d_1m,
            (
                WITH subset AS (SELECT adj_close, rn FROM relevant_history WHERE rn <= w_3m),
                dd_series AS (
                    SELECT (adj_close / MAX(adj_close) OVER (ORDER BY rn DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) - 1 as dd
                    FROM subset
                )
                SELECT MIN(dd) * 100 FROM dd_series HAVING COUNT(*) >= w_3m
            ) as d_3m,
            (
                WITH subset AS (SELECT adj_close, rn FROM relevant_history WHERE rn <= w_6m),
                dd_series AS (
                    SELECT (adj_close / MAX(adj_close) OVER (ORDER BY rn DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) - 1 as dd
                    FROM subset
                )
                SELECT MIN(dd) * 100 FROM dd_series HAVING COUNT(*) >= w_6m
            ) as d_6m,
            (
                WITH subset AS (SELECT adj_close, rn FROM relevant_history WHERE rn <= w_1y),
                dd_series AS (
                    SELECT (adj_close / MAX(adj_close) OVER (ORDER BY rn DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) - 1 as dd
                    FROM subset
                )
                SELECT MIN(dd) * 100 FROM dd_series HAVING COUNT(*) >= w_1y
            ) as d_1y,
            (
                WITH subset AS (SELECT adj_close, rn FROM relevant_history WHERE rn <= w_3y),
                dd_series AS (
                    SELECT (adj_close / MAX(adj_close) OVER (ORDER BY rn DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) - 1 as dd
                    FROM subset
                )
                SELECT MIN(dd) * 100 FROM dd_series HAVING COUNT(*) >= w_3y
            ) as d_3y,
            (
                WITH subset AS (SELECT adj_close, rn FROM relevant_history WHERE rn <= w_5y),
                dd_series AS (
                    SELECT (adj_close / MAX(adj_close) OVER (ORDER BY rn DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) - 1 as dd
                    FROM subset
                )
                SELECT MIN(dd) * 100 FROM dd_series HAVING COUNT(*) >= w_5y
            ) as d_5y,
            (
                WITH subset AS (
                    SELECT d.adj_close, d.price_date 
                    FROM prices_daily d
                    WHERE d.ticker = p_ticker AND d.price_date >= date_trunc('year', v_latest_date)
                ),
                dd_series AS (
                    SELECT (adj_close / MAX(adj_close) OVER (ORDER BY price_date ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) - 1 as dd
                    FROM subset
                )
                SELECT MIN(dd) * 100 FROM dd_series
            ) as d_ytd
    )
    SELECT 
        v_1m, v_3m, v_6m, v_1y, v_3y, v_5y,
        d_1m, d_3m, d_6m, d_1y, d_3y, d_5y, d_ytd
    INTO 
        vol_1m, vol_3m, vol_6m, vol_1y, vol_3y, vol_5y,
        dd_1m, dd_3m, dd_6m, dd_1y, dd_3y, dd_5y, dd_ytd
    FROM vol_calc, dd_stats;

    -- 4. Upsert Results
    -- Filter out NULL returns using CTE
    WITH new_rows (ticker, performance_date, window_code, return_percent, absolute_return, volatility, max_drawdown, source, data_freshness) AS (
        VALUES
            (p_ticker, v_latest_date, '1D', r_1d, abs_1d, NULL::numeric, NULL::numeric, 'prices_daily_sql', 0),
            (p_ticker, v_latest_date, '1W', r_1w, abs_1w, NULL::numeric, NULL::numeric, 'prices_daily_sql', 0),
            (p_ticker, v_latest_date, '1M', r_1m, abs_1m, vol_1m, dd_1m, 'prices_daily_sql', 0),
            (p_ticker, v_latest_date, '3M', r_3m, abs_3m, vol_3m, dd_3m, 'prices_daily_sql', 0),
            (p_ticker, v_latest_date, '6M', r_6m, abs_6m, vol_6m, dd_6m, 'prices_daily_sql', 0),
            (p_ticker, v_latest_date, 'YTD', r_ytd, abs_ytd, NULL::numeric, dd_ytd, 'prices_daily_sql', 0),
            (p_ticker, v_latest_date, '1Y', r_1y, abs_1y, vol_1y, dd_1y, 'prices_daily_sql', 0),
            (p_ticker, v_latest_date, '3Y', r_3y, abs_3y, vol_3y, dd_3y, 'prices_daily_sql', 0),
            (p_ticker, v_latest_date, '5Y', r_5y, abs_5y, vol_5y, dd_5y, 'prices_daily_sql', 0)
    )
    INSERT INTO datos_performance (ticker, performance_date, window_code, return_percent, absolute_return, volatility, max_drawdown, source, data_freshness)
    SELECT * FROM new_rows
    WHERE return_percent IS NOT NULL
    ON CONFLICT (ticker, performance_date, window_code)
    DO UPDATE SET
        return_percent = EXCLUDED.return_percent,
        absolute_return = EXCLUDED.absolute_return,
        volatility = COALESCE(EXCLUDED.volatility, datos_performance.volatility),
        max_drawdown = COALESCE(EXCLUDED.max_drawdown, datos_performance.max_drawdown),
        source = EXCLUDED.source,
        data_freshness = EXCLUDED.data_freshness;

END;
$$;

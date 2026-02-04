DO $$
DECLARE
    -- Cursor to iterate over asset returns for supported windows
    cur_assets CURSOR FOR 
        SELECT 
            ticker, 
            window_code, 
            performance_date, 
            return_percent
        FROM datos_performance
        WHERE window_code IN ('1Y', '3Y', '5Y');

    -- Record to hold current row
    r RECORD;

    -- Variables for resolution
    v_industry_code TEXT;
    v_industry_name TEXT;
    v_sector TEXT;
    
    -- Variables for returns
    v_sector_return NUMERIC;
    v_industry_return NUMERIC;
    
    -- Variables for calculated alpha
    v_alpha_sector NUMERIC;
    v_alpha_industry NUMERIC;

    -- Stats for logging
    v_count_total INT := 0;
    v_count_skipped INT := 0;
    v_count_sector_written INT := 0;
    v_count_industry_written INT := 0;

BEGIN
    RAISE NOTICE 'START batch: Materializing Alpha vs Sector/Industry';

    OPEN cur_assets;

    LOOP
        FETCH cur_assets INTO r;
        EXIT WHEN NOT FOUND;

        v_count_total := v_count_total + 1;

        -- ---------------------------------------------------------
        -- 1. Resolve Industry via asset_industry_map (Temporal)
        -- ---------------------------------------------------------
        v_industry_code := NULL;
        
        SELECT industry_code INTO v_industry_code
        FROM asset_industry_map
        WHERE ticker = r.ticker
          AND effective_from <= r.performance_date
          AND (effective_to IS NULL OR effective_to >= r.performance_date)
        LIMIT 1;

        -- If no valid mapping exists for this date, SKIP
        IF v_industry_code IS NULL THEN
            v_count_skipped := v_count_skipped + 1;
            -- RAISE NOTICE 'SKIP: No industry map for % on %', r.ticker, r.performance_date;
            CONTINUE;
        END IF;

        -- ---------------------------------------------------------
        -- 2. Resolve industry_name and sector
        -- ---------------------------------------------------------
        v_industry_name := NULL;
        v_sector := NULL;

        SELECT industry_name, sector INTO v_industry_name, v_sector
        FROM industry_classification
        WHERE industry_code = v_industry_code;

        -- If classification metadata is missing, SKIP
        IF v_industry_name IS NULL OR v_sector IS NULL THEN
            v_count_skipped := v_count_skipped + 1;
            CONTINUE;
        END IF;

        -- ---------------------------------------------------------
        -- 3. Fetch Sector Performance
        -- ---------------------------------------------------------
        v_sector_return := NULL;

        SELECT return_percent INTO v_sector_return
        FROM sector_performance
        WHERE sector = v_sector
          AND window_code = r.window_code
          AND performance_date = r.performance_date;

        -- ---------------------------------------------------------
        -- 4. Fetch Industry Performance
        -- ---------------------------------------------------------
        v_industry_return := NULL;

        SELECT return_percent INTO v_industry_return
        FROM industry_performance
        WHERE industry = v_industry_name
          AND window_code = r.window_code
          AND performance_date = r.performance_date;

        -- ---------------------------------------------------------
        -- 5. Insert / Upsert Alpha vs Sector
        -- ---------------------------------------------------------
        IF v_sector_return IS NOT NULL THEN
            v_alpha_sector := r.return_percent - v_sector_return;

            INSERT INTO performance_windows (
                ticker, 
                benchmark_ticker, 
                window_code, 
                as_of_date,
                asset_return, 
                benchmark_return, 
                alpha, 
                source
            ) VALUES (
                r.ticker, 
                v_sector, 
                r.window_code, 
                r.performance_date,
                r.return_percent, 
                v_sector_return, 
                v_alpha_sector, 
                'alpha_sector'
            )
            ON CONFLICT (ticker, benchmark_ticker, window_code, as_of_date)
            DO UPDATE SET
                asset_return = EXCLUDED.asset_return,
                benchmark_return = EXCLUDED.benchmark_return,
                alpha = EXCLUDED.alpha,
                source = EXCLUDED.source;

            v_count_sector_written := v_count_sector_written + 1;
            RAISE NOTICE 'WRITE sector alpha: % vs % (%)', r.ticker, v_sector, r.window_code;
        END IF;

        -- ---------------------------------------------------------
        -- 6. Insert / Upsert Alpha vs Industry
        -- ---------------------------------------------------------
        IF v_industry_return IS NOT NULL THEN
            v_alpha_industry := r.return_percent - v_industry_return;

            INSERT INTO performance_windows (
                ticker, 
                benchmark_ticker, 
                window_code, 
                as_of_date,
                asset_return, 
                benchmark_return, 
                alpha, 
                source
            ) VALUES (
                r.ticker, 
                v_industry_name, 
                r.window_code, 
                r.performance_date,
                r.return_percent, 
                v_industry_return, 
                v_alpha_industry, 
                'alpha_industry'
            )
            ON CONFLICT (ticker, benchmark_ticker, window_code, as_of_date)
            DO UPDATE SET
                asset_return = EXCLUDED.asset_return,
                benchmark_return = EXCLUDED.benchmark_return,
                alpha = EXCLUDED.alpha,
                source = EXCLUDED.source;

            v_count_industry_written := v_count_industry_written + 1;
            RAISE NOTICE 'WRITE industry alpha: % vs % (%)', r.ticker, v_industry_name, r.window_code;
        END IF;

    END LOOP;

    CLOSE cur_assets;

    RAISE NOTICE 'END batch: Processed %, Skipped %, Inserted Sector %, Inserted Industry %', 
        v_count_total, v_count_skipped, v_count_sector_written, v_count_industry_written;

END $$;

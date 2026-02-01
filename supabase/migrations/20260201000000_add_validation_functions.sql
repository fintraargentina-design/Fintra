-- Migration: Add validation functions for Solvency/Efficiency fix
-- Description: Functions to quickly check data quality and coverage

-- Function 1: Get interest_coverage stats
CREATE OR REPLACE FUNCTION public.get_financials_coverage_stats()
RETURNS TABLE (
    total_records BIGINT,
    with_interest_coverage BIGINT,
    with_operating_income BIGINT,
    with_interest_expense BIGINT,
    with_ebitda BIGINT,
    pct_interest_coverage NUMERIC,
    avg_interest_coverage NUMERIC,
    median_interest_coverage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT
            COUNT(*) as total,
            COUNT(interest_coverage) as coverage_count,
            COUNT(operating_income) as op_income_count,
            COUNT(interest_expense) as int_expense_count,
            COUNT(ebitda) as ebitda_count,
            AVG(interest_coverage) as avg_coverage,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY interest_coverage) as median_coverage
        FROM datos_financieros
        WHERE period_type = 'TTM'
    )
    SELECT
        total,
        coverage_count,
        op_income_count,
        int_expense_count,
        ebitda_count,
        ROUND((coverage_count::NUMERIC / NULLIF(total, 0) * 100), 2),
        ROUND(avg_coverage::NUMERIC, 2),
        ROUND(median_coverage::NUMERIC, 2)
    FROM stats;
END;
$$;

COMMENT ON FUNCTION public.get_financials_coverage_stats() IS
'Returns statistics about interest_coverage and related fields in datos_financieros';

-- Function 2: Get solvency/efficiency stats
CREATE OR REPLACE FUNCTION public.get_solvency_stats(min_date DATE DEFAULT '2024-01-01')
RETURNS TABLE (
    total_snapshots BIGINT,
    with_solvency BIGINT,
    with_efficiency BIGINT,
    with_category BIGINT,
    pct_solvency NUMERIC,
    pct_efficiency NUMERIC,
    avg_solvency NUMERIC,
    avg_efficiency NUMERIC,
    high_count BIGINT,
    medium_count BIGINT,
    low_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::FLOAT IS NOT NULL) as solvency_count,
            COUNT(*) FILTER (WHERE (fgos_components->>'efficiency')::FLOAT IS NOT NULL) as efficiency_count,
            COUNT(*) FILTER (WHERE fgos_category IS NOT NULL) as category_count,
            AVG((fgos_components->>'solvency')::FLOAT) as avg_solv,
            AVG((fgos_components->>'efficiency')::FLOAT) as avg_eff,
            COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::FLOAT >= 70) as high,
            COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::FLOAT >= 40 AND (fgos_components->>'solvency')::FLOAT < 70) as medium,
            COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::FLOAT < 40) as low
        FROM fintra_snapshots
        WHERE snapshot_date >= min_date
    )
    SELECT
        total,
        solvency_count,
        efficiency_count,
        category_count,
        ROUND((solvency_count::NUMERIC / NULLIF(total, 0) * 100), 2),
        ROUND((efficiency_count::NUMERIC / NULLIF(total, 0) * 100), 2),
        ROUND(avg_solv::NUMERIC, 2),
        ROUND(avg_eff::NUMERIC, 2),
        high,
        medium,
        low
    FROM stats;
END;
$$;

COMMENT ON FUNCTION public.get_solvency_stats(DATE) IS
'Returns statistics about Solvency and Efficiency in fintra_snapshots';

-- Function 3: Check for solvency inversion bug
CREATE OR REPLACE FUNCTION public.check_solvency_inversion_bug(min_date DATE DEFAULT '2024-01-01')
RETURNS TABLE (
    count BIGINT,
    example_tickers TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH suspicious AS (
        SELECT
            fs.ticker,
            (fs.fgos_components->>'solvency')::FLOAT as solvency,
            df.debt_to_equity
        FROM fintra_snapshots fs
        JOIN datos_financieros df
            ON df.ticker = fs.ticker
            AND df.period_type = 'TTM'
        WHERE fs.snapshot_date >= min_date
          AND (fs.fgos_components->>'solvency')::FLOAT > 90
          AND df.debt_to_equity > 2.0
        LIMIT 20
    )
    SELECT
        (SELECT COUNT(*) FROM suspicious)::BIGINT,
        ARRAY(SELECT ticker FROM suspicious LIMIT 10)
    ;
END;
$$;

COMMENT ON FUNCTION public.check_solvency_inversion_bug(DATE) IS
'Checks for companies with high debt but high solvency (indicates bug)';

-- Function 4: Quick health check
CREATE OR REPLACE FUNCTION public.quick_health_check()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    value TEXT,
    passed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    financials_pct NUMERIC;
    solvency_pct NUMERIC;
    bug_count BIGINT;
    today_snapshots BIGINT;
BEGIN
    -- Check 1: Interest coverage populated
    SELECT
        ROUND((COUNT(interest_coverage)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2)
    INTO financials_pct
    FROM datos_financieros
    WHERE period_type = 'TTM';

    RETURN QUERY SELECT
        'Interest Coverage'::TEXT,
        CASE WHEN financials_pct >= 80 THEN 'PASS' WHEN financials_pct >= 50 THEN 'WARNING' ELSE 'FAIL' END,
        financials_pct::TEXT || '%',
        financials_pct >= 50;

    -- Check 2: Solvency populated
    SELECT
        ROUND((COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::FLOAT IS NOT NULL)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2)
    INTO solvency_pct
    FROM fintra_snapshots
    WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days';

    RETURN QUERY SELECT
        'Solvency Populated'::TEXT,
        CASE WHEN solvency_pct >= 80 THEN 'PASS' WHEN solvency_pct >= 50 THEN 'WARNING' ELSE 'FAIL' END,
        solvency_pct::TEXT || '%',
        solvency_pct >= 50;

    -- Check 3: Bug check
    SELECT COUNT(*) INTO bug_count
    FROM fintra_snapshots fs
    JOIN datos_financieros df ON df.ticker = fs.ticker AND df.period_type = 'TTM'
    WHERE fs.snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
      AND (fs.fgos_components->>'solvency')::FLOAT > 90
      AND df.debt_to_equity > 2.0;

    RETURN QUERY SELECT
        'Solvency Bug Check'::TEXT,
        CASE WHEN bug_count = 0 THEN 'PASS' WHEN bug_count < 10 THEN 'WARNING' ELSE 'FAIL' END,
        bug_count::TEXT || ' cases',
        bug_count < 10;

    -- Check 4: Today's snapshots
    SELECT COUNT(*) INTO today_snapshots
    FROM fintra_snapshots
    WHERE snapshot_date = CURRENT_DATE;

    RETURN QUERY SELECT
        'Today Snapshots'::TEXT,
        CASE WHEN today_snapshots >= 1000 THEN 'PASS' WHEN today_snapshots > 0 THEN 'WARNING' ELSE 'FAIL' END,
        today_snapshots::TEXT,
        today_snapshots > 0;
END;
$$;

COMMENT ON FUNCTION public.quick_health_check() IS
'Quick health check of critical metrics - run anytime to verify system health';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_financials_coverage_stats() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_solvency_stats(DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_solvency_inversion_bug(DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.quick_health_check() TO authenticated, anon;

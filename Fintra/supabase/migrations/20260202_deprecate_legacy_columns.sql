-- Migration: Deprecate legacy flat columns
-- Date: 2026-02-02
-- Phase: 1 of 3 (Deprecation → Migration → Removal)

-- Document deprecation in table comment
COMMENT ON TABLE fintra_snapshots IS 
  'Core snapshot table for Fintra financial data.
   
   DEPRECATED COLUMNS (as of Feb 2026):
   - sector_rank, sector_rank_total → Use performance_windows->1M
   - relative_vs_sector_* → Use performance_windows->*->vs_sector
   - relative_vs_market_* → Use performance_windows->*->vs_market
   
   Removal planned: Q2 2026 (after UI/query migration)';

-- Deprecate sector_rank columns
COMMENT ON COLUMN fintra_snapshots.sector_rank IS 
  'DEPRECATED (Feb 2026): Use performance_windows->''1M''->''sector_rank'' instead.
   This column is no longer written by cron jobs.
   Reads will be supported until Q2 2026.
   Migration guide: See docs/migrations/performance_windows.md';

COMMENT ON COLUMN fintra_snapshots.sector_rank_total IS 
  'DEPRECATED (Feb 2026): Use performance_windows->''1M''->''sector_total'' instead.
   This column is no longer written by cron jobs.
   Reads will be supported until Q2 2026.
   Migration guide: See docs/migrations/performance_windows.md';

-- Deprecate relative_vs_sector columns
DO $$ 
DECLARE 
    col_name text;
    windows text[] := ARRAY['1m', '3m', '6m', '1y', '2y', '3y', '5y'];
    window_key text;
BEGIN
    FOREACH window_key IN ARRAY windows
    LOOP
        col_name := 'relative_vs_sector_' || window_key;
        
        -- Check if column exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'fintra_snapshots' 
            AND column_name = col_name
        ) THEN
            EXECUTE format(
                'COMMENT ON COLUMN fintra_snapshots.%I IS %L',
                col_name,
                format(
                    'DEPRECATED (Feb 2026): Use performance_windows->''%s''->''vs_sector'' instead. ' ||
                    'This column is no longer written by cron jobs. ' ||
                    'Reads will be supported until Q2 2026. ' ||
                    'Migration guide: See docs/migrations/performance_windows.md',
                    UPPER(window_key)
                )
            );
            
            RAISE NOTICE 'Deprecated column: %', col_name;
        END IF;
    END LOOP;
END $$;

-- Deprecate relative_vs_market columns
DO $$ 
DECLARE 
    col_name text;
    windows text[] := ARRAY['1m', '3m', '6m', '1y', '2y', '3y', '5y'];
    window_key text;
BEGIN
    FOREACH window_key IN ARRAY windows
    LOOP
        col_name := 'relative_vs_market_' || window_key;
        
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'fintra_snapshots' 
            AND column_name = col_name
        ) THEN
            EXECUTE format(
                'COMMENT ON COLUMN fintra_snapshots.%I IS %L',
                col_name,
                format(
                    'DEPRECATED (Feb 2026): Use performance_windows->''%s''->''vs_market'' instead. ' ||
                    'This column is no longer written by cron jobs. ' ||
                    'Reads will be supported until Q2 2026. ' ||
                    'Migration guide: See docs/migrations/performance_windows.md',
                    UPPER(window_key)
                )
            );
            
            RAISE NOTICE 'Deprecated column: %', col_name;
        END IF;
    END LOOP;
END $$;

-- Create view to track deprecated column usage
CREATE OR REPLACE VIEW deprecated_columns_usage AS
SELECT 
    'sector_rank' as column_name,
    COUNT(*) FILTER (WHERE sector_rank IS NOT NULL) as rows_with_data,
    COUNT(*) as total_rows,
    ROUND(100.0 * COUNT(*) FILTER (WHERE sector_rank IS NOT NULL) / NULLIF(COUNT(*), 0), 2) as usage_percent,
    MAX(snapshot_date) FILTER (WHERE sector_rank IS NOT NULL) as last_written_date
FROM fintra_snapshots

UNION ALL

SELECT 
    'sector_rank_total',
    COUNT(*) FILTER (WHERE sector_rank_total IS NOT NULL),
    COUNT(*),
    ROUND(100.0 * COUNT(*) FILTER (WHERE sector_rank_total IS NOT NULL) / NULLIF(COUNT(*), 0), 2),
    MAX(snapshot_date) FILTER (WHERE sector_rank_total IS NOT NULL)
FROM fintra_snapshots

UNION ALL

SELECT 
    'relative_vs_sector_1m',
    COUNT(*) FILTER (WHERE relative_vs_sector_1m IS NOT NULL),
    COUNT(*),
    ROUND(100.0 * COUNT(*) FILTER (WHERE relative_vs_sector_1m IS NOT NULL) / NULLIF(COUNT(*), 0), 2),
    MAX(snapshot_date) FILTER (WHERE relative_vs_sector_1m IS NOT NULL)
FROM fintra_snapshots

UNION ALL

SELECT 
    'relative_vs_market_1m',
    COUNT(*) FILTER (WHERE relative_vs_market_1m IS NOT NULL),
    COUNT(*),
    ROUND(100.0 * COUNT(*) FILTER (WHERE relative_vs_market_1m IS NOT NULL) / NULLIF(COUNT(*), 0), 2),
    MAX(snapshot_date) FILTER (WHERE relative_vs_market_1m IS NOT NULL)
FROM fintra_snapshots;

COMMENT ON VIEW deprecated_columns_usage IS 
  'Tracks usage of deprecated columns to monitor when safe to delete.
   Query this view periodically to check if columns can be removed.
   Removal criteria: usage_percent = 0 AND last_written_date > 90 days ago';

-- Migration: Add statistics columns to sector_benchmarks and related tables
-- Description: Adds sample_size, confidence, and advanced statistical metrics (median, trimmed_mean, uncertainty_range)
--              to sector_benchmarks. Also updates sector_stats and industry_stats to support the new statistical engine.

-- UP
BEGIN;

-- 1. Update sector_benchmarks (Primary Request)
ALTER TABLE sector_benchmarks 
ADD COLUMN IF NOT EXISTS sample_size INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS confidence TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS median FLOAT,
ADD COLUMN IF NOT EXISTS trimmed_mean FLOAT,
ADD COLUMN IF NOT EXISTS uncertainty_range JSONB;

CREATE INDEX IF NOT EXISTS idx_sector_benchmarks_sector_metric ON sector_benchmarks(sector, metric);

-- 2. Update sector_stats (Required for cron compatibility)
ALTER TABLE sector_stats
ADD COLUMN IF NOT EXISTS median FLOAT,
ADD COLUMN IF NOT EXISTS trimmed_mean FLOAT,
ADD COLUMN IF NOT EXISTS uncertainty_range JSONB;

-- 3. Update industry_stats (Required for cron compatibility)
-- Using DO block to avoid error if table doesn't exist yet
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'industry_stats') THEN
        ALTER TABLE industry_stats
        ADD COLUMN IF NOT EXISTS median FLOAT,
        ADD COLUMN IF NOT EXISTS trimmed_mean FLOAT,
        ADD COLUMN IF NOT EXISTS uncertainty_range JSONB;
    END IF;
END $$;

COMMIT;

-- DOWN
/*
BEGIN;

-- Revert sector_benchmarks
ALTER TABLE sector_benchmarks 
DROP COLUMN IF EXISTS sample_size,
DROP COLUMN IF EXISTS confidence,
DROP COLUMN IF EXISTS median,
DROP COLUMN IF EXISTS trimmed_mean,
DROP COLUMN IF EXISTS uncertainty_range;

DROP INDEX IF EXISTS idx_sector_benchmarks_sector_metric;

-- Revert sector_stats
ALTER TABLE sector_stats
DROP COLUMN IF EXISTS median,
DROP COLUMN IF EXISTS trimmed_mean,
DROP COLUMN IF EXISTS uncertainty_range;

-- Revert industry_stats
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'industry_stats') THEN
        ALTER TABLE industry_stats
        DROP COLUMN IF EXISTS median,
        DROP COLUMN IF EXISTS trimmed_mean,
        DROP COLUMN IF EXISTS uncertainty_range;
    END IF;
END $$;

COMMIT;
*/

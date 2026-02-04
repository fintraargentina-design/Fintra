-- Migration: Add sector_rank and sector_rank_total columns to fintra_snapshots
-- Description: Adds columns for deterministic sector ranking and a function to compute them.

-- UP
BEGIN;

-- 1. Add columns
ALTER TABLE fintra_snapshots
ADD COLUMN IF NOT EXISTS sector_rank INTEGER,
ADD COLUMN IF NOT EXISTS sector_rank_total INTEGER;

-- 2. Create ranking function
CREATE OR REPLACE FUNCTION compute_sector_ranks(p_snapshot_date DATE DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_target_date DATE;
BEGIN
    -- Determine target date
    IF p_snapshot_date IS NOT NULL THEN
        v_target_date := p_snapshot_date;
    ELSE
        SELECT MAX(snapshot_date) INTO v_target_date FROM fintra_snapshots;
    END IF;

    IF v_target_date IS NULL THEN
        RETURN;
    END IF;

    -- CTE to calculate ranks
    WITH RankedSnapshots AS (
        SELECT
            ticker,
            snapshot_date,
            sector,
            -- Ranking logic
            ROW_NUMBER() OVER (
                PARTITION BY snapshot_date, sector
                ORDER BY
                    -- a) IFS Position Priority
                    CASE (ifs->>'position')
                        WHEN 'leader' THEN 1
                        WHEN 'follower' THEN 2
                        WHEN 'laggard' THEN 3
                        ELSE 4
                    END ASC,
                    -- b) IFS Pressure (DESC - Higher ranks higher)
                    COALESCE((ifs->>'pressure')::numeric, 0) DESC,
                    -- c) FGOS Score (DESC)
                    fgos_score DESC,
                    -- d) Ticker Tiebreaker (ASC)
                    ticker ASC
            ) as calculated_rank,
            COUNT(*) OVER (
                PARTITION BY snapshot_date, sector
            ) as calculated_total
        FROM
            fintra_snapshots
        WHERE
            snapshot_date = v_target_date
            AND sector IS NOT NULL
            AND ifs IS NOT NULL
            AND fgos_score IS NOT NULL
    )
    UPDATE fintra_snapshots
    SET
        sector_rank = rs.calculated_rank,
        sector_rank_total = rs.calculated_total
    FROM
        RankedSnapshots rs
    WHERE
        fintra_snapshots.ticker = rs.ticker
        AND fintra_snapshots.snapshot_date = rs.snapshot_date;

END;
$$;

COMMIT;

-- DOWN
/*
BEGIN;

DROP FUNCTION IF EXISTS compute_sector_ranks(DATE);

ALTER TABLE fintra_snapshots
DROP COLUMN IF EXISTS sector_rank,
DROP COLUMN IF EXISTS sector_rank_total;

COMMIT;
*/

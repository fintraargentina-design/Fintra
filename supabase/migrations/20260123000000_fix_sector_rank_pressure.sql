-- Fix sector ranking pressure logic for laggards
-- Description: Updates compute_sector_ranks to sort Laggards by pressure ASC (lower pressure is better) 
--              while keeping Leaders/Followers by pressure DESC (higher pressure is better).

CREATE OR REPLACE FUNCTION public.compute_sector_ranks(p_snapshot_date date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
                    -- leader (1) > follower (2) > laggard (3)
                    CASE (ifs->>'position')
                        WHEN 'leader' THEN 1
                        WHEN 'follower' THEN 2
                        WHEN 'laggard' THEN 3
                        ELSE 4
                    END ASC,
                    
                    -- b) IFS Pressure
                    -- Leader: Higher pressure is better (Strong Leader > Weak Leader) -> DESC
                    -- Follower: Tie (usually max intensity) -> DESC
                    -- Laggard: Lower pressure is better (Weak Laggard > Strong Laggard) -> ASC
                    -- IMPLEMENTATION: Flip sign for laggard so DESC works for all
                    CASE 
                        WHEN (ifs->>'position') = 'laggard' THEN ((ifs->>'pressure')::numeric * -1)
                        ELSE COALESCE((ifs->>'pressure')::numeric, 0)
                    END DESC,

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
$function$;

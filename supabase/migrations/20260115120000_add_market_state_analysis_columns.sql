-- Migration: Add analysis columns to fintra_market_state and fintra_snapshots
-- Description: Adds market_position, strategic_state, and relative_return columns
--              to support the Main Sector Table requirements (Quality, Structure, Performance).

-- UP
BEGIN;

-- 1. Update fintra_market_state
ALTER TABLE fintra_market_state
ADD COLUMN IF NOT EXISTS market_position JSONB,
ADD COLUMN IF NOT EXISTS strategic_state JSONB,
ADD COLUMN IF NOT EXISTS relative_return JSONB;

-- 2. Update fintra_snapshots
ALTER TABLE fintra_snapshots
ADD COLUMN IF NOT EXISTS market_position JSONB,
ADD COLUMN IF NOT EXISTS strategic_state JSONB,
ADD COLUMN IF NOT EXISTS relative_return JSONB;

COMMIT;

-- DOWN
/*
BEGIN;

ALTER TABLE fintra_market_state
DROP COLUMN IF EXISTS market_position,
DROP COLUMN IF EXISTS strategic_state,
DROP COLUMN IF EXISTS relative_return;

ALTER TABLE fintra_snapshots
DROP COLUMN IF EXISTS market_position,
DROP COLUMN IF EXISTS strategic_state,
DROP COLUMN IF EXISTS relative_return;

COMMIT;
*/

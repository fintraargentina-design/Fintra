-- Migration: Add IFS FY (Industry Quality Score) to fintra_snapshots
-- Date: 2026-02-03
-- Purpose: Add structural competitive position metric based on fiscal year fundamentals

-- Add ifs_fy column to fintra_snapshots
ALTER TABLE fintra_snapshots
ADD COLUMN IF NOT EXISTS ifs_fy JSONB;

-- Add comment explaining the field
COMMENT ON COLUMN fintra_snapshots.ifs_fy IS 
'IFS FY - Industry Quality Score: Structural position vs industry peers based on fiscal year fundamentals. Complements IFS Live (momentum) with long-term quality assessment.

Structure:
{
  "timeline": ["leader", "follower", "laggard"],
  "observed_years": 3,
  "current_position": "leader",
  "trend": "improving" | "stable" | "deteriorating",
  "confidence": 76
}

Rules:
- timeline: Max 5 fiscal years, ordered oldest → newest
- observed_years: 1-5 (no minimum requirement)
- current_position: Most recent FY position
- trend: Based on score trajectory
- confidence: 0-100 (based on FY count + consistency)
';

-- Add GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_fintra_snapshots_ifs_fy 
ON fintra_snapshots USING GIN (ifs_fy);

-- Add index for current_position queries (commonly filtered field)
CREATE INDEX IF NOT EXISTS idx_fintra_snapshots_ifs_fy_position 
ON fintra_snapshots ((ifs_fy->>'current_position'));

-- Add index for trend queries
CREATE INDEX IF NOT EXISTS idx_fintra_snapshots_ifs_fy_trend 
ON fintra_snapshots ((ifs_fy->>'trend'));

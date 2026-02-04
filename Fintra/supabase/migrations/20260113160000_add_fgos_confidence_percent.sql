-- Add fgos_confidence_percent to fintra_snapshots
ALTER TABLE fintra_snapshots
ADD COLUMN IF NOT EXISTS fgos_confidence_percent numeric;

-- Add fgos_confidence_percent to fintra_market_state
ALTER TABLE fintra_market_state
ADD COLUMN IF NOT EXISTS fgos_confidence_percent numeric;

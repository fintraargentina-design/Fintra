-- Add fgos_confidence_label to fintra_market_state
ALTER TABLE fintra_market_state
ADD COLUMN IF NOT EXISTS fgos_confidence_label TEXT;

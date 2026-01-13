-- Add confidence label and maturity status to fintra_snapshots
ALTER TABLE fintra_snapshots 
ADD COLUMN IF NOT EXISTS fgos_confidence_label text,
ADD COLUMN IF NOT EXISTS fgos_maturity text;

-- Add comment to explain values
COMMENT ON COLUMN fintra_snapshots.fgos_confidence_label IS 'High, Medium, Low';
COMMENT ON COLUMN fintra_snapshots.fgos_maturity IS 'Mature, Developing, Early-stage, Incomplete';

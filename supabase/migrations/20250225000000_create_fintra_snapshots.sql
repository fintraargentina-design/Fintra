-- Add JSONB support for Ecosystem Analysis
ALTER TABLE fintra_snapshots 
ADD COLUMN IF NOT EXISTS ecosystem_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ai_report_markdown TEXT;

-- Create an index on the JSONB column for better performance if we query inside it later
CREATE INDEX IF NOT EXISTS idx_fintra_snapshots_ecosystem_data ON fintra_snapshots USING gin (ecosystem_data);

-- Add missing columns to fintra_market_state
ALTER TABLE fintra_market_state
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS employees text, -- or integer, checking source. Source says text or integer? FMP usually integer but maybe text in DB.
ADD COLUMN IF NOT EXISTS ceo text,
ADD COLUMN IF NOT EXISTS return_1y numeric,
ADD COLUMN IF NOT EXISTS return_3y numeric,
ADD COLUMN IF NOT EXISTS return_5y numeric,
ADD COLUMN IF NOT EXISTS sector_percentiles jsonb;

-- Ensure employees is consistent with source (profile_structural.identity.fullTimeEmployees is usually string or number)
-- Let's use text to be safe if we don't know, or numeric if we are sure.
-- FMP fullTimeEmployees is often a string in JSON "12345".

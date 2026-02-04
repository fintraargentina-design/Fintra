-- Migration: Add fields for Competitive Advantage (FGOS)
-- Description: Adds capex, invested_capital, and weighted_shares_out to datos_financieros table.
--              These fields are required for calculating Capital Discipline axis in Competitive Advantage module.

-- UP
BEGIN;

ALTER TABLE datos_financieros
ADD COLUMN IF NOT EXISTS capex NUMERIC,
ADD COLUMN IF NOT EXISTS invested_capital NUMERIC,
ADD COLUMN IF NOT EXISTS weighted_shares_out NUMERIC;

COMMIT;

-- DOWN
/*
BEGIN;

ALTER TABLE datos_financieros
DROP COLUMN IF EXISTS capex,
DROP COLUMN IF EXISTS invested_capital,
DROP COLUMN IF EXISTS weighted_shares_out;

COMMIT;
*/

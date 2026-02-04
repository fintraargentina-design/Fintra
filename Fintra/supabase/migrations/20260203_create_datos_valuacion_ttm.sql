-- Migration: Create datos_valuacion_ttm table for historical TTM valuation
-- 
-- STRICT CONSTRAINTS:
-- - TTM is INTERNAL, derived ONLY from 4 closed fiscal quarters
-- - Historical data is materialized here (NOT recalculated)
-- - One row per ticker per quarter-end date
-- - No approximations, no interpolations

CREATE TABLE IF NOT EXISTS public.datos_valuacion_ttm (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  valuation_date DATE NOT NULL,
  
  -- Price context
  price NUMERIC(12, 4) NOT NULL,
  price_date DATE NOT NULL, -- Actual date of price used (nearest <= valuation_date)
  
  -- TTM Fundamentals (sum of 4 quarters, NULL if any quarter missing)
  revenue_ttm NUMERIC(20, 2),
  ebitda_ttm NUMERIC(20, 2),
  net_income_ttm NUMERIC(20, 2),
  eps_ttm NUMERIC(10, 4),  -- Computed as net_income_ttm / shares_outstanding (NOT sum of quarterly EPS)
  free_cash_flow_ttm NUMERIC(20, 2),
  
  -- Context for valuation (derived from TTM and price)
  market_cap NUMERIC(20, 2),
  enterprise_value NUMERIC(20, 2),
  net_debt NUMERIC(20, 2),
  
  -- Valuation Ratios
  pe_ratio NUMERIC(10, 2),
  ev_ebitda NUMERIC(10, 2),
  price_to_sales NUMERIC(10, 2),
  price_to_fcf NUMERIC(10, 2),
  
  -- Audit trail
  quarters_used TEXT, -- e.g., "2023Q1,2023Q2,2023Q3,2023Q4"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(ticker, valuation_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_datos_valuacion_ttm_ticker ON public.datos_valuacion_ttm(ticker);
CREATE INDEX IF NOT EXISTS idx_datos_valuacion_ttm_date ON public.datos_valuacion_ttm(valuation_date DESC);
CREATE INDEX IF NOT EXISTS idx_datos_valuacion_ttm_ticker_date ON public.datos_valuacion_ttm(ticker, valuation_date DESC);

-- RLS Policies (read-only for anon users)
ALTER TABLE public.datos_valuacion_ttm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.datos_valuacion_ttm
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access"
  ON public.datos_valuacion_ttm
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.datos_valuacion_ttm IS 'Historical TTM valuation data - materialized from 4 closed fiscal quarters';
COMMENT ON COLUMN public.datos_valuacion_ttm.valuation_date IS 'Date of most recent quarter in the TTM window (quarter-end date)';
COMMENT ON COLUMN public.datos_valuacion_ttm.price_date IS 'Actual trading date of price used (nearest closing price <= valuation_date)';
COMMENT ON COLUMN public.datos_valuacion_ttm.quarters_used IS 'Comma-separated list of quarter labels used in TTM calculation';

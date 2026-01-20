-- Migration: Add optimized index for prices_daily to reduce CPU usage
-- Description: Creates a composite index on (ticker, price_date DESC) to optimize
--              the calculate_ticker_performance function queries which filter by ticker
--              and sort/filter by date. This replaces full table scans or inefficient sorts.

CREATE INDEX IF NOT EXISTS idx_prices_daily_ticker_date_desc 
ON public.prices_daily (ticker, price_date DESC);

ANALYZE public.prices_daily;

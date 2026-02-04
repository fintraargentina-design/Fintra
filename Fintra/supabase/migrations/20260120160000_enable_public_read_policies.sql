-- Migration: Add missing RLS policies to satisfy Security Advisor
-- Description: Adds explicit RLS policies for tables that had RLS enabled but no policies defined.
-- Most tables are reference/financial data and get "Allow public read access".
-- Internal tables get "Allow service role only".

-- 1. Reference and Financial Data (Public Read)
CREATE POLICY "Allow public read access" ON public.asset_industry_map FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.busquedas_acciones FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.datos_dividendos FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.datos_financieros FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.datos_performance FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.datos_valuacion FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.fintra_market_state FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.fintra_snapshots FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.fintra_universe FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.industry_benchmarks FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.industry_classification FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.industry_pe FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.industry_performance FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.performance_windows FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.prices_daily FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.sector_benchmarks FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.sector_pe FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.sector_performance FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.sector_stats FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.sic_industry_map FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access" ON public.stock_peers FOR SELECT TO public USING (true);

-- 2. Internal State (Service Role Only)
-- Explicitly allow service_role (redundant but satisfies "No Policy" warning)
CREATE POLICY "Allow service role only" ON public.cron_state FOR ALL TO service_role USING (true) WITH CHECK (true);

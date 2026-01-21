-- Migration: Fix Supabase Security Advisor warnings
-- Description: Sets explicit search_path for public functions and secures periodos_accion table.

-- 1. Fix "Function Search Path Mutable" warnings
-- We set search_path to 'public' to prevent search_path hijacking attacks.

ALTER FUNCTION public.build_sector_fgos_benchmarks(date) SET search_path = public;
ALTER FUNCTION public.build_sector_stats(date) SET search_path = public;
ALTER FUNCTION public.calculate_ticker_performance(text) SET search_path = public;
ALTER FUNCTION public.execute_sql(text) SET search_path = public;
ALTER FUNCTION public.fintra_fgos_sanity_issues(date) SET search_path = public;
ALTER FUNCTION public.fintra_snapshot_coverage(date) SET search_path = public;
ALTER FUNCTION public.get_sectors_by_market_cap() SET search_path = public;

-- 2. Fix "RLS Policy Always True" warnings for periodos_accion
-- The table is currently empty and unreferenced in the codebase, but has permissive policies.
-- We restrict access to authenticated users only.

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow public insert/update" ON public.periodos_accion;
DROP POLICY IF EXISTS "Allow public select" ON public.periodos_accion;
DROP POLICY IF EXISTS "Allow public update" ON public.periodos_accion;

-- Create restrictive policies (Authenticated users only)
CREATE POLICY "Enable read access for authenticated users only" ON public.periodos_accion
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.periodos_accion
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON public.periodos_accion
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

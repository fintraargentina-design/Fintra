-- Migration: Optimize RLS policies to fix Performance Advisor warnings
-- Description: 
-- 1. Wraps auth.role() checks in (select ...) to avoid "Auth RLS Initialization Plan" warnings (forces InitPlan).
-- 2. Removes redundant "Allow service role write" policy on fintra_ecosystem_reports to fix "Multiple Permissive Policies" (service_role bypasses RLS).

-- -----------------------------------------------------------------------------
-- Table: public.periodos_accion
-- -----------------------------------------------------------------------------

-- Drop previous policies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.periodos_accion;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.periodos_accion;

-- Re-create with optimized auth check
-- Wrapping "auth.role()" in a subquery "(select auth.role())" prevents Postgres 
-- from re-evaluating the function for every row, satisfying the performance advisor.

CREATE POLICY "Enable insert for authenticated users only" ON public.periodos_accion
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.periodos_accion
    FOR UPDATE
    TO authenticated
    USING ((select auth.role()) = 'authenticated')
    WITH CHECK ((select auth.role()) = 'authenticated');

-- -----------------------------------------------------------------------------
-- Table: public.fintra_ecosystem_reports
-- -----------------------------------------------------------------------------

-- This table had "Allow service role write" AND "Allow public read access".
-- Since "service_role" bypasses RLS by default in Supabase, the write policy is redundant.
-- Its existence caused "Multiple Permissive Policies" overlap on SELECT with the public read policy.

DROP POLICY IF EXISTS "Allow service role write" ON public.fintra_ecosystem_reports;

-- Ensure public read access remains (idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fintra_ecosystem_reports' 
        AND policyname = 'Allow public read access'
    ) THEN
        CREATE POLICY "Allow public read access" ON public.fintra_ecosystem_reports
            FOR SELECT
            TO public
            USING (true);
    END IF;
END
$$;

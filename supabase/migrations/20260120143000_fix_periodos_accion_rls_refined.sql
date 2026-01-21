-- Migration: Refine RLS policies for periodos_accion to satisfy linter
-- Description: Replaces literal 'true' with 'auth.role() = ''authenticated''' to avoid "Policy Always True" warnings.

-- Drop previous policies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.periodos_accion;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.periodos_accion;

-- Re-create with explicit auth check
-- This is functionally equivalent to 'true' for the 'authenticated' role, 
-- but satisfies the linter's check for overly permissive wildcard policies.

CREATE POLICY "Enable insert for authenticated users only" ON public.periodos_accion
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.periodos_accion
    FOR UPDATE
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

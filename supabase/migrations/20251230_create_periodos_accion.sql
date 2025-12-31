-- Create periodos_accion table for storing user selected periods per stock
CREATE TABLE IF NOT EXISTS public.periodos_accion (
    symbol TEXT NOT NULL PRIMARY KEY,
    period TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.periodos_accion ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (since auth is not fully enforced or it's per-device preference)
-- Adjust based on actual auth requirements. Assuming public access for now as per other tables or service role.
CREATE POLICY "Allow public select" ON public.periodos_accion FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update" ON public.periodos_accion FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.periodos_accion FOR UPDATE USING (true);

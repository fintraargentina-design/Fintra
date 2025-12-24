CREATE TABLE IF NOT EXISTS public.fintra_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker TEXT NOT NULL,
    fgos_score INTEGER NOT NULL,
    fgos_breakdown JSONB NOT NULL,
    valuation_status TEXT,
    ecosystem_score INTEGER,
    price_at_calculation NUMERIC,
    fair_value_estimate NUMERIC,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint para asegurar un solo snapshot reciente por día/ticker si se quisiera, 
    -- pero por ahora permitimos historial.
    -- Un índice único compuesto ayudaría a "upsert" por ticker si solo queremos el último estado actual.
    -- Pero el requerimiento dice "snapshots", sugiriendo historial. 
    -- Sin embargo, el cron hará upsert. Vamos a poner constraint unique en ticker para el MVP simple
    -- o manejamos el historial en otra tabla. Para upsert fácil, unique ticker.
    CONSTRAINT fintra_snapshots_ticker_key UNIQUE (ticker)
);

-- Habilitar RLS
ALTER TABLE public.fintra_snapshots ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública
CREATE POLICY "Allow public read access" ON public.fintra_snapshots
    FOR SELECT USING (true);

-- Política de escritura solo servicio (si se usara service role key, esto es implícito, 
-- pero para clientes autenticados restringimos)
CREATE POLICY "Allow service role write" ON public.fintra_snapshots
    FOR ALL USING (auth.role() = 'service_role');


-- Create stock_analysis table
CREATE TABLE IF NOT EXISTS public.stock_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    recommendation TEXT,
    target_price NUMERIC,
    analyst_rating TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for stock_analysis
ALTER TABLE public.stock_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on stock_analysis" ON public.stock_analysis
    FOR SELECT USING (true);

CREATE POLICY "Allow service role write on stock_analysis" ON public.stock_analysis
    FOR ALL USING (auth.role() = 'service_role');


-- Create stock_performance table
CREATE TABLE IF NOT EXISTS public.stock_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    day_1 NUMERIC,
    week_1 NUMERIC,
    month_1 NUMERIC,
    month_3 NUMERIC,
    month_6 NUMERIC,
    year_1 NUMERIC,
    ytd NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for stock_performance
ALTER TABLE public.stock_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on stock_performance" ON public.stock_performance
    FOR SELECT USING (true);

CREATE POLICY "Allow service role write on stock_performance" ON public.stock_performance
    FOR ALL USING (auth.role() = 'service_role');

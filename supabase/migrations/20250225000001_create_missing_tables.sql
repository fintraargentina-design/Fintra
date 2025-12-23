-- Create stock_analysis table
CREATE TABLE IF NOT EXISTS public.stock_analysis (
    symbol TEXT PRIMARY KEY,
    recommendation TEXT,
    target_price NUMERIC,
    analyst_rating TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for stock_analysis
ALTER TABLE public.stock_analysis ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to stock_analysis
CREATE POLICY "Allow public read access" ON public.stock_analysis
    FOR SELECT
    USING (true);

-- Create policy for service role write access to stock_analysis
CREATE POLICY "Allow service role write access" ON public.stock_analysis
    FOR ALL
    USING (auth.role() = 'service_role');


-- Create stock_performance table
CREATE TABLE IF NOT EXISTS public.stock_performance (
    symbol TEXT PRIMARY KEY,
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

-- Create policy for public read access to stock_performance
CREATE POLICY "Allow public read access" ON public.stock_performance
    FOR SELECT
    USING (true);

-- Create policy for service role write access to stock_performance
CREATE POLICY "Allow service role write access" ON public.stock_performance
    FOR ALL
    USING (auth.role() = 'service_role');

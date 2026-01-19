-- Create industry_benchmarks table
CREATE TABLE IF NOT EXISTS public.industry_benchmarks (
    industry TEXT NOT NULL,
    window_code TEXT NOT NULL,
    benchmark_type TEXT NOT NULL CHECK (benchmark_type IN ('sector', 'market')),
    benchmark_key TEXT NOT NULL,
    performance_date DATE NOT NULL,
    alpha_percent NUMERIC NULL,
    source TEXT NOT NULL DEFAULT 'derived_from_performance',
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (industry, window_code, benchmark_type, performance_date)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_industry ON public.industry_benchmarks(industry);
CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_window_code ON public.industry_benchmarks(window_code);
CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_performance_date ON public.industry_benchmarks(performance_date);

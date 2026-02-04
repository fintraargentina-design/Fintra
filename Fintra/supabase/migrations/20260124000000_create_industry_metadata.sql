CREATE TABLE IF NOT EXISTS industry_metadata (
    industry_code TEXT PRIMARY KEY,
    cadence TEXT NOT NULL CHECK (cadence IN ('fast', 'medium', 'slow')),
    dominant_horizons TEXT[] NOT NULL,
    structural_horizon_min_years INTEGER NOT NULL,
    version TEXT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE
);

-- Seed Data
INSERT INTO industry_metadata (industry_code, cadence, dominant_horizons, structural_horizon_min_years, version, effective_from)
VALUES 
-- Software (Fast)
('Software - Infrastructure', 'fast', ARRAY['3M','6M','1Y','2Y'], 2, 'v1', '2020-01-01'),
('Software - Application', 'fast', ARRAY['3M','6M','1Y','2Y'], 2, 'v1', '2020-01-01'),

-- Semiconductors (Fast)
('Semiconductors', 'fast', ARRAY['3M','6M','1Y','2Y'], 2, 'v1', '2020-01-01'),

-- Utilities (Slow)
('Utilities - Regulated Electric', 'slow', ARRAY['2Y','3Y','5Y'], 5, 'v1', '2020-01-01'),
('Utilities - Diversified', 'slow', ARRAY['2Y','3Y','5Y'], 5, 'v1', '2020-01-01'),
('Utilities - Independent Power Producers', 'slow', ARRAY['2Y','3Y','5Y'], 5, 'v1', '2020-01-01'),

-- Industrials (Medium)
('Industrial Distribution', 'medium', ARRAY['6M','1Y','2Y','3Y'], 3, 'v1', '2020-01-01'),
('Farm & Heavy Construction Machinery', 'medium', ARRAY['6M','1Y','2Y','3Y'], 3, 'v1', '2020-01-01'),

-- Financials (Medium)
('Banks - Regional', 'medium', ARRAY['6M','1Y','2Y','3Y'], 3, 'v1', '2020-01-01'),
('Asset Management', 'medium', ARRAY['6M','1Y','2Y','3Y'], 3, 'v1', '2020-01-01')

ON CONFLICT (industry_code) DO NOTHING;

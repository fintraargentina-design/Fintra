CREATE TABLE IF NOT EXISTS industry_performance (
  industry TEXT NOT NULL,
  window_code TEXT NOT NULL,
  performance_date DATE NOT NULL,
  return_percent NUMERIC NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (industry, window_code, performance_date)
);

-- Add index for efficient querying by date and window
CREATE INDEX IF NOT EXISTS idx_industry_performance_date_window ON industry_performance(performance_date, window_code);

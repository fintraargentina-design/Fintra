create table if not exists sector_performance (
  sector text not null,
  window_code text not null,
  performance_date date not null,
  return_percent numeric,
  source text default 'fmp_sector',
  created_at timestamptz default now(),
  primary key (sector, window_code, performance_date)
);

-- Optional: Add index for faster queries by sector/date
create index if not exists idx_sector_performance_lookup 
on sector_performance (sector, performance_date);

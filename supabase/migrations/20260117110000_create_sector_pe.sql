create table if not exists sector_pe (
  sector text not null,
  pe_date date not null,
  pe numeric,
  source text default 'fmp_sector_pe',
  created_at timestamptz default now(),
  primary key (sector, pe_date)
);

create index if not exists idx_sector_pe_lookup
on sector_pe (sector, pe_date);


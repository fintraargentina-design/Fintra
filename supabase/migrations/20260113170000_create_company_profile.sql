-- Create company_profile table
create table if not exists public.company_profile (
  ticker text primary key,
  company_name text,
  description text,
  sector text,
  industry text,
  country text,
  website text,
  ceo text,
  employees integer,
  source text not null default 'fmp',
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.company_profile enable row level security;

-- Allow public read access (for frontend)
create policy "Allow public read access"
  on public.company_profile
  for select
  to public
  using (true);

-- Allow service role full access (for cron)
-- (Service role bypasses RLS by default, but good to be explicit if needed, though usually not required for service_role)

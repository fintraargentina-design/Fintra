// cron/backfill/backfillSectorStats.ts

import { supabaseAdmin } from '@/lib/supabase-admin';

const METRICS = [
  'revenue_cagr',
  'earnings_cagr',
  'fcf_margin',
  'roic',
  'operating_margin',
  'debt_to_equity',
  'interest_coverage'
];

export async function backfillSectorStatsForDate(date: string) {
  for (const metric of METRICS) {
    const query = `
with latest_data as (
  select distinct on (df.ticker)
    df.ticker,
    c.sector,
    df.${metric} as val
  from datos_financieros df
  join fintra_universe c on c.ticker = df.ticker
  where df.period_type in ('TTM','FY')
    and df.period_end_date <= '${date}'::date
    and df.${metric} is not null
    and c.sector is not null
  order by df.ticker, df.period_end_date desc
)
insert into sector_stats (
  sector,
  metric,
  stats_date,
  p10, p25, p50, p75, p90,
  mean,
  std_dev,
  sample_size
)
select
  sector,
  '${metric}',
  '${date}'::date,

  percentile_cont(0.10) within group (order by val),
  percentile_cont(0.25) within group (order by val),
  percentile_cont(0.50) within group (order by val),
  percentile_cont(0.75) within group (order by val),
  percentile_cont(0.90) within group (order by val),

  avg(val),
  stddev(val),
  count(*)

from latest_data
group by sector

on conflict (sector, metric, stats_date)
do update set
  p10 = excluded.p10,
  p25 = excluded.p25,
  p50 = excluded.p50,
  p75 = excluded.p75,
  p90 = excluded.p90,
  mean = excluded.mean,
  std_dev = excluded.std_dev,
  sample_size = excluded.sample_size;
`;


    const { error } = await supabaseAdmin.rpc('execute_sql', {
      sql: query
    });

    if (error) throw error;
  }
}

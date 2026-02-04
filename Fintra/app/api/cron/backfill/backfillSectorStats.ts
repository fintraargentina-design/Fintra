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
  // 1. Obtener lista de sectores (Fetch all and unique in JS to be safe)
  const { data: allRows, error: sectorsError } = await supabaseAdmin
    .from('fintra_universe')
    .select('sector')
    .not('sector', 'is', null);

  if (sectorsError) throw sectorsError;
  
  // Unique sectors
  const sectors = [...new Set((allRows || []).map((r: any) => r.sector))].sort();
  console.log(`Found ${sectors.length} sectors to process.`);

  for (const metric of METRICS) {
    console.log(`Processing metric: ${metric}`);
    
    for (const sector of sectors) {
        const safeSector = sector.replace(/'/g, "''");

        const query = `
with latest_data as (
  select
    c.sector,
    l.val
  from fintra_universe c
  cross join lateral (
    select df.${metric} as val
    from datos_financieros df
    where df.ticker = c.ticker
      and df.period_type in ('TTM','FY')
      and df.period_end_date <= '${date}'::date
      and df.${metric} is not null
    order by df.period_end_date desc
    limit 1
  ) l
  where c.sector = '${safeSector}'
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

      if (error) {
          console.error(`Error in sector ${sector} metric ${metric}:`, error);
          throw error;
      }
    }
  }
}

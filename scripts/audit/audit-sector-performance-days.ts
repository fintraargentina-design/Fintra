import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const { data, error } = await supabaseAdmin.rpc('execute_sql', {
    sql: `
WITH latest AS (
  SELECT max(performance_date) AS as_of_date
  FROM sector_performance
  WHERE window_code = '1D'
),
base AS (
  SELECT
    sp.sector,
    sp.performance_date,
    sp.return_percent,
    latest.as_of_date
  FROM sector_performance sp
  CROSS JOIN latest
  WHERE sp.window_code = '1D'
    AND sp.sector IS NOT NULL
    AND sp.performance_date <= latest.as_of_date
),
counts AS (
  SELECT
    sector,
    min(performance_date) AS first_date,
    max(performance_date) AS last_date,
    count(*) AS total_rows,
    count(*) FILTER (WHERE return_percent IS NOT NULL) AS total_valid,
    count(*) FILTER (
      WHERE performance_date >= date_trunc('year', as_of_date::timestamp)::date
        AND performance_date <= as_of_date
        AND return_percent IS NOT NULL
    ) AS ytd_valid,
    as_of_date
  FROM base
  GROUP BY sector, as_of_date
)
SELECT
  as_of_date,
  sector,
  first_date,
  last_date,
  total_rows,
  total_valid,
  ytd_valid,
  total_valid >= 5 AS can_1w,
  total_valid >= 21 AS can_1m,
  total_valid >= 252 AS can_1y,
  total_valid >= 756 AS can_3y,
  total_valid >= 1260 AS can_5y,
  ytd_valid >= 10 AS can_ytd
FROM counts
ORDER BY sector;
    `,
  });

  if (error) {
    console.error('Error running audit query:', error);
    process.exit(1);
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.log('No 1D data found in sector_performance');
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error('Unexpected error in audit-sector-performance-days:', err);
  process.exit(1);
});


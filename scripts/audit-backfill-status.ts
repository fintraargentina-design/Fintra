
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import dayjs from 'dayjs';

// --------------------------------------------------
// CONFIGURATION & CONSTANTS
// --------------------------------------------------

const EXPECTED_SECTOR_COUNT = 11;
const MIN_YEARS_HISTORY = 5;
const STALE_DAYS_THRESHOLD = 5;
const EXPECTED_INDUSTRY_MIN = 50; 
const LOW_SAMPLE_SIZE_THRESHOLD = 5;
const MARKET_BENCHMARK_TICKER = 'SPY';
const SKEW_THRESHOLD = 5; // Mean > 5x Median implies dominance/skew

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type AlertLevel = 'critical' | 'high' | 'warning';

interface BackfillAlert {
  level: AlertLevel;
  code: string;
  entity: string;
  details: string;
}

interface AuditSummary {
  status: 'ok' | 'warning' | 'degraded' | 'critical';
  alerts_count: {
    critical: number;
    high: number;
    warning: number;
  };
  alerts: BackfillAlert[];
}

// --------------------------------------------------
// SUPABASE SETUP
// --------------------------------------------------

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false }
  }
);

// --------------------------------------------------
// STATE
// --------------------------------------------------

const ALERTS: BackfillAlert[] = [];

function addAlert(level: AlertLevel, code: string, entity: string, details: string) {
  ALERTS.push({ level, code, entity, details });
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

async function getMinMaxDate(table: string, dateCol: string) {
  const minP = supabase.from(table).select(dateCol).order(dateCol, { ascending: true }).limit(1);
  const maxP = supabase.from(table).select(dateCol).order(dateCol, { ascending: false }).limit(1);
  const [minRes, maxRes] = await Promise.all([minP, maxP]);
  return {
    min: (minRes.data?.[0] as any)?.[dateCol] as string | undefined,
    max: (maxRes.data?.[0] as any)?.[dateCol] as string | undefined,
    error: minRes.error || maxRes.error
  };
}

async function getDistinctCount(table: string, col: string, dateCol?: string, dateVal?: string) {
  let query = supabase.from(table).select(col, { count: 'exact', head: true });
  if (dateCol && dateVal) {
    query = supabase.from(table).select(col); // We need actual rows to count distinct if not using .distinct() which supabase doesn't support directly on count
    // Optimisation: For "distinct entities on date", we can just fetch the entities column for that date
    query = query.eq(dateCol, dateVal);
  } else {
      // If we just want distinct count of a column over whole table, it's hard with Supabase API efficiently without RPC.
      // We will approximate or use 'head: true' on a distinct query if possible, but PostgREST doesn't support distinct count easily.
      // Fallback: Fetch all distinct values if the cardinality is low (sectors/industries).
      query = supabase.from(table).select(col);
  }
  
  const { data, error } = await query;
  if (error) return { count: 0, error };
  
  // Client-side distinct count
  const distinct = new Set(data.map((r: any) => r[col]));
  return { count: distinct.size, error: null };
}

// --------------------------------------------------
// AUDIT LOGIC
// --------------------------------------------------

async function checkCoverage(table: string, dateCol: string, entityCol: string, entityType: 'sector' | 'industry') {
  const { min, max, error } = await getMinMaxDate(table, dateCol);
  
  if (error) {
    addAlert('critical', 'SCRIPT_RAN_BUT_NO_ROWS', table, `Query error: ${error.message}`);
    return;
  }
  
  if (!min || !max) {
    addAlert('critical', 'SCRIPT_RAN_BUT_NO_ROWS', table, 'Table is empty');
    return;
  }

  // 1. Time Range (MISSING_TIME_RANGE)
  const expectedStart = dayjs().subtract(MIN_YEARS_HISTORY, 'year');
  const actualStart = dayjs(min);
  const actualEnd = dayjs(max);
  const yesterday = dayjs().subtract(1, 'day');

  if (actualStart.isAfter(expectedStart.add(6, 'month'))) {
     addAlert('critical', 'MISSING_TIME_RANGE', table, `Start date ${min} is later than expected ${expectedStart.format('YYYY-MM-DD')}`);
  }

  if (actualEnd.isBefore(yesterday.subtract(STALE_DAYS_THRESHOLD, 'day'))) {
     addAlert('critical', 'MISSING_TIME_RANGE', table, `End date ${max} is too old (stale)`);
  }

  // 2. Entity Count (MISSING_ENTITIES)
  // Check count on MAX date
  let { count, error: countError } = await getDistinctCount(table, entityCol, dateCol, max);
  
  let checkDate = max;
  let finalCount = count;

  // If latest date has low count, check if it's potentially an incomplete "today"
  const minExpected = entityType === 'sector' ? EXPECTED_SECTOR_COUNT : EXPECTED_INDUSTRY_MIN;
  
  if (count < minExpected) {
      const today = dayjs().format('YYYY-MM-DD');
      // If max date is today (or very recent), check previous date before screaming "Critical"
      if (max === today) {
          const { data: prevDateRows } = await supabase.from(table)
              .select(dateCol)
              .lt(dateCol, max)
              .order(dateCol, { ascending: false })
              .limit(1);
          
          const prevDate = (prevDateRows?.[0] as any)?.[dateCol];
          if (prevDate) {
              const { count: prevCount } = await getDistinctCount(table, entityCol, dateCol, prevDate);
              
              if (prevCount >= minExpected) {
                  // Previous day is healthy. Today is just in-progress.
                  addAlert('warning', 'PARTIAL_DATA_TODAY', table, `Latest date ${max} has ${count} entities (partial). Previous date ${prevDate} is healthy (${prevCount}).`);
                  return; // Stop here, do not trigger critical alert
              } else {
                  // Previous day is ALSO bad. This is a real issue.
                  checkDate = prevDate;
                  finalCount = prevCount;
              }
          }
      }
  }

  if (entityType === 'sector') {
      if (finalCount < EXPECTED_SECTOR_COUNT) {
          addAlert('critical', 'MISSING_ENTITIES', table, `Found ${finalCount} sectors on ${checkDate}, expected >= ${EXPECTED_SECTOR_COUNT}`);
      }
  } else if (entityType === 'industry') {
      if (finalCount < EXPECTED_INDUSTRY_MIN) {
          addAlert('critical', 'MISSING_ENTITIES', table, `Found ${finalCount} industries on ${checkDate}, expected >= ${EXPECTED_INDUSTRY_MIN}`);
      }
  }

  // 3. Gaps in Series (GAPS_IN_SERIES)
  // Check time-series continuity for a sample entity instead of the whole table
  // to avoid fetching millions of rows or hitting default limits (1000 rows).
  const { data: sampleRow } = await supabase.from(table).select(entityCol).limit(1);
  const sampleEntity = (sampleRow?.[0] as any)?.[entityCol];

  if (sampleEntity) {
      const oneYearAgo = dayjs().subtract(1, 'year').format('YYYY-MM-DD');
      
      // Fetch dates ONLY for this entity
      const { data: dates } = await supabase.from(table)
        .select(dateCol)
        .eq(entityCol, sampleEntity)
        .gte(dateCol, oneYearAgo)
        .limit(1000); // ample buffer for 1 year (~252 trading days)
      
      if (dates) {
        const uniqueDates = new Set(dates.map((r: any) => r[dateCol]));
        const businessDays = 252;
        const threshold = businessDays * 0.7; // Allow ~30% missing before flagging (holidays, etc)
        
        // Only trigger if we have a full year of history for this entity
        // We use 'min' from the whole table as a proxy for history existence
        if (dayjs(min).isBefore(dayjs().subtract(1, 'year'))) {
            if (uniqueDates.size < threshold) {
                addAlert('high', 'GAPS_IN_SERIES', table, `Sample entity '${sampleEntity}' has only ${uniqueDates.size} distinct dates in last year (expected > ~${Math.floor(threshold)})`);
            }
        }
      }
  }
}

async function checkPricesDaily() {
    const table = 'prices_daily';
    // Use limit(1) to check if empty (faster than count(*))
    const { data: oneRow, error: emptyCheckError } = await supabase.from(table).select('ticker').limit(1);
    
    if (emptyCheckError) {
        addAlert('critical', 'SCRIPT_RAN_BUT_NO_ROWS', table, `Error checking emptiness: ${emptyCheckError.message}`);
        return;
    }
    
    if (!oneRow || oneRow.length === 0) {
        addAlert('critical', 'SCRIPT_RAN_BUT_NO_ROWS', table, 'prices_daily is empty');
        return;
    }

    // Check Market Benchmark (SPY) - MISSING_BENCHMARK_REFERENCE
    const { data: spyData } = await supabase.from(table)
        .select('price_date')
        .eq('ticker', MARKET_BENCHMARK_TICKER)
        .order('price_date', { ascending: false })
        .limit(1);
    
    if (!spyData || spyData.length === 0) {
        addAlert('critical', 'MISSING_BENCHMARK_REFERENCE', table, `Market benchmark ${MARKET_BENCHMARK_TICKER} missing`);
    } else {
        // STALE_BENCHMARK
        const spyDate = dayjs(spyData[0].price_date);
        if (spyDate.isBefore(dayjs().subtract(STALE_DAYS_THRESHOLD, 'day'))) {
            addAlert('high', 'STALE_BENCHMARK', table, `${MARKET_BENCHMARK_TICKER} data is stale (${spyDate.format('YYYY-MM-DD')})`);
        }
    }

    // Check Coverage vs Universe (PARTIAL_WRITE / MISSING_ENTITIES)
    const { data: universe } = await supabase.from('fintra_universe').select('ticker').eq('is_active', true);
    if (!universe) return;

    // Proxy: Count rows in last 5 days
    const cutoff = dayjs().subtract(5, 'day').format('YYYY-MM-DD');
    const { count: recentRows, error: recentError } = await supabase.from(table)
        .select('*', { count: 'exact', head: true })
        .gte('price_date', cutoff);
    
    if (recentError) {
        addAlert('warning', 'CHECK_FAILED', table, `Failed to count recent rows: ${recentError.message}`);
    } else {
        const expectedRows = universe.length * 3; // Approx 3 trading days
        // If recent rows is very low, it implies we stopped writing for many tickers
        if ((recentRows || 0) < expectedRows * 0.5) {
            addAlert('high', 'PARTIAL_WRITE', table, `Recent rows ${recentRows} << Expected ~${expectedRows}. Many tickers missing recent data.`);
        }
    }
}

async function checkSectorStats() {
    const table = 'sector_stats';
    const { min, max, error } = await getMinMaxDate(table, 'stats_date');
    
    if (error || !max) {
        addAlert('critical', 'SCRIPT_RAN_BUT_NO_ROWS', table, 'Table empty');
        return;
    }

    // Time Range Check
    const yesterday = dayjs().subtract(1, 'day');
    if (dayjs(max).isBefore(yesterday.subtract(STALE_DAYS_THRESHOLD, 'day'))) {
        addAlert('critical', 'MISSING_TIME_RANGE', table, `Latest stats date ${max} is too old`);
    }

    // Low Sample Size Check (LOW_SAMPLE_SIZE)
    const { data: lowSample } = await supabase
        .from(table)
        .select('sector, sample_size, stats_date')
        .eq('stats_date', max)
        .lt('sample_size', LOW_SAMPLE_SIZE_THRESHOLD);

    if (lowSample && lowSample.length > 0) {
        lowSample.forEach(row => {
            addAlert('high', 'LOW_SAMPLE_SIZE', `${table}:${row.sector}`, `Sample size ${row.sample_size} < ${LOW_SAMPLE_SIZE_THRESHOLD}`);
        });
    }

    // Outlier Dominance (OUTLIER_DOMINANCE)
    const { data: skewData } = await supabase
        .from(table)
        .select('sector, mean, p50, metric, stats_date')
        .eq('stats_date', max);

    if (skewData) {
        skewData.forEach(row => {
            if (row.p50 !== null && Math.abs(row.p50) > 0.01) {
                if (Math.abs(row.mean) > Math.abs(row.p50 * SKEW_THRESHOLD)) {
                     addAlert('warning', 'OUTLIER_DOMINANCE', `${table}:${row.sector}`, `Metric ${row.metric} Mean (${row.mean.toFixed(2)}) >> P50 (${row.p50.toFixed(2)}) indicates extreme skew`);
                }
            }
        });
    }

    // Missing Entities (Sectors)
    const { data: distinctSectors } = await supabase.from(table).select('sector').eq('stats_date', max);
    const unique = new Set(distinctSectors?.map(s => s.sector));
    if (unique.size < EXPECTED_SECTOR_COUNT) {
        addAlert('critical', 'MISSING_ENTITIES', table, `Latest date has ${unique.size} sectors, expected ${EXPECTED_SECTOR_COUNT}`);
    }
}

async function checkMisalignedWindows() {
    // Check MISALIGNED_WINDOWS between sector_performance and industry_performance
    const { max: sectorMax } = await getMinMaxDate('sector_performance', 'performance_date');
    const { max: industryMax } = await getMinMaxDate('industry_performance', 'performance_date');

    if (sectorMax && industryMax) {
        const sDate = dayjs(sectorMax);
        const iDate = dayjs(industryMax);
        const diff = Math.abs(sDate.diff(iDate, 'day'));
        if (diff > 5) {
             addAlert('high', 'MISALIGNED_WINDOWS', 'industry_vs_sector', `Industry Max ${industryMax} != Sector Max ${sectorMax}`);
        }
    }
}

async function checkIndustryBenchmarkIntegrity() {
    // MISSING_BENCHMARK_REFERENCE: Industry without sector benchmark
    // We check if industries in 'industry_performance' have a valid sector in 'fintra_universe'
    // 1. Get all active industries
    const { data: industries } = await supabase
        .from('fintra_universe')
        .select('industry, sector')
        .eq('is_active', true)
        .not('industry', 'is', null);

    if (!industries) return;

    // Check for industries with null sectors (if database allows, but fintra_universe should have it)
    const industriesWithoutSector = industries.filter(i => !i.sector);
    if (industriesWithoutSector.length > 0) {
        const examples = industriesWithoutSector.slice(0, 3).map(i => i.industry).join(', ');
        addAlert('critical', 'MISSING_BENCHMARK_REFERENCE', 'fintra_universe', `Found ${industriesWithoutSector.length} industries without sector mapping (e.g. ${examples})`);
    }
    
    // Check if backfilled industries exist in universe
    const { data: backfilledInds } = await supabase
        .from('industry_performance')
        .select('industry')
        .limit(1000); // Check sample or recent
    
    // Actually, checking "Industry without sector benchmark" implies the *benchmark data* is missing.
    // If an industry exists, does its sector have performance data?
    // We already checked sector_performance coverage.
    // So if sector_performance is empty, that covers it.
    // But if sector_performance has specific sectors missing?
    
    // Let's check: For every industry in industry_performance, is its sector in sector_performance?
    // This requires joining or multiple queries.
    // Simpler: Check if all sectors from universe are present in sector_performance.
    const { data: sectorPerfSectors } = await supabase.from('sector_performance').select('sector');
    const backfilledSectors = new Set(sectorPerfSectors?.map(s => s.sector));
    
    const universeSectors = new Set(industries.map(i => i.sector).filter(Boolean));
    const missingSectors = [...universeSectors].filter(s => !backfilledSectors.has(s));
    
    if (missingSectors.length > 0) {
        addAlert('critical', 'MISSING_BENCHMARK_REFERENCE', 'sector_performance', `Sectors missing from backfill but required by industries: ${missingSectors.join(', ')}`);
    }
}

async function main() {
  try {
    // 1. Audit Sector Performance
    await checkCoverage('sector_performance', 'performance_date', 'sector', 'sector');
    
    // 2. Audit Sector PE
    await checkCoverage('sector_pe', 'pe_date', 'sector', 'sector');
    
    // 3. Audit Industry Performance
    await checkCoverage('industry_performance', 'performance_date', 'industry', 'industry');
    
    // 4. Audit Industry PE
    await checkCoverage('industry_pe', 'pe_date', 'industry', 'industry');

    // 5. Audit Prices Daily
    await checkPricesDaily();

    // 6. Audit Sector Stats
    await checkSectorStats();

    // 7. Cross-Check Benchmarks & Consistency
    await checkMisalignedWindows();
    await checkIndustryBenchmarkIntegrity();

  } catch (err: any) {
    addAlert('critical', 'SCRIPT_RAN_BUT_NO_ROWS', 'SYSTEM', `Audit script crashed: ${err.message}`);
  }

  // Summary
  const counts = {
    critical: ALERTS.filter(a => a.level === 'critical').length,
    high: ALERTS.filter(a => a.level === 'high').length,
    warning: ALERTS.filter(a => a.level === 'warning').length
  };

  let status: AuditSummary['status'] = 'ok';
  let exitCode = 0;

  if (counts.critical > 0) {
    status = 'critical';
    exitCode = 3;
  } else if (counts.high > 0) {
    status = 'degraded';
    exitCode = 2;
  } else if (counts.warning > 0) {
    status = 'warning';
    exitCode = 1;
  }

  const output: AuditSummary = {
    status,
    alerts_count: counts,
    alerts: ALERTS
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(exitCode);
}

main();

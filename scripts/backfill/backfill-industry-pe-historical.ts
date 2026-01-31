import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

// Increased throttle slightly for parallel safety, but overall faster due to concurrency
const THROTTLE_MS = 200; 
const CONCURRENCY = 5; 
const SOURCE = 'fmp_historical_industry_pe';

type HistoricalIndustryPeRecord = {
  date: string;
  industry: string;
  pe: number | null;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const isNetworkError =
        err?.code === 'ECONNRESET' ||
        err?.message?.includes('fetch failed') ||
        err?.message?.includes('network') ||
        (err?.status && err.status >= 500);

      if (!isNetworkError && i < retries - 1) {
         // Retry logic
      }

      console.warn(`    ⚠️ Operation failed (attempt ${i + 1}/${retries}). Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      delayMs *= 2; 
    }
  }
  throw lastError;
}

// CHANGED: Yearly segments instead of monthly for faster bulk fetch
function buildYearlySegments(startYear: number, endYear: number) {
  const segments: { from: string; to: string; year: number }[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    segments.push({ from, to, year });
  }

  return segments;
}

async function main() {
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const { fmpGet } = await import('@/lib/fmp/server');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const startYearArg = args[0] ? parseInt(args[0], 10) : undefined;
  const endYearArg = args[1] ? parseInt(args[1], 10) : undefined;

  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const startYear = Number.isFinite(startYearArg as number) ? (startYearArg as number) : currentYear - 6;
  const endYear = Number.isFinite(endYearArg as number) ? (endYearArg as number) : currentYear;

  if (endYear < startYear) {
    console.error('❌ endYear must be >= startYear');
    process.exit(1);
  }

  console.log(`🚀 Historical backfill for industry_pe from ${startYear} to ${endYear}`);
  console.log(`⚡ Strategy: Parallel (x${CONCURRENCY}) + Yearly Batches + Smart Skip`);

  // Use fintra_universe as the source of truth for industries
  const { data: industryRows, error: industriesError } = await supabaseAdmin
    .from('fintra_universe')
    .select('industry')
    .not('industry', 'is', null);

  if (industriesError) {
    console.error('❌ Error fetching industries from fintra_universe:', industriesError);
    process.exit(1);
  }

  const industrySet = new Set<string>();
  for (const r of industryRows || []) {
    const raw = (r as any).industry as string | null;
    if (!raw) continue;
    const clean = raw.trim();
    if (!clean) continue;
    industrySet.add(clean);
  }

  const industries = Array.from(industrySet).sort();

  if (!industries.length) {
    console.warn('⚠️ No industries found in fintra_universe. Nothing to backfill.');
    process.exit(0);
  }

  console.log(`📊 Discovered ${industries.length} industries to backfill.`);

  const segments = buildYearlySegments(startYear, endYear);
  console.log(`📅 Yearly segments to query: ${segments.length} (from ${startYear} to ${endYear})`);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkippedExisting = 0;

  // Worker function
  const processIndustry = async (industry: string) => {
    // console.log(`\n🏭 Starting Industry: ${industry}`);
    
    for (const seg of segments) {
      // 1. SMART CHECK: Do we already have data for this year?
      // A trading year has ~252 days. If we have > 200 records, we can assume it's done.
      // Or just check if we have ANY data for this month? No, year is better.
      try {
        const { count, error: countError } = await supabaseAdmin
          .from('industry_pe')
          .select('pe_date', { count: 'exact', head: true })
          .eq('industry', industry)
          .gte('pe_date', seg.from)
          .lte('pe_date', seg.to);

        if (!countError && count !== null && count > 240) {
           // console.log(`    ⏩ Skipped ${industry} ${seg.year} (Found ${count} records)`);
           totalSkippedExisting += count;
           continue;
        }
      } catch (e) {
        // ignore count error and proceed to fetch
      }

      // console.log(`  ➜ Fetching ${industry} ${seg.year}`);

      try {
        const rows = await fmpGet<HistoricalIndustryPeRecord[]>(
          '/stable/historical-industry-pe',
          {
            industry,
            from: seg.from,
            to: seg.to,
          },
        );

        const fetchedCount = Array.isArray(rows) ? rows.length : 0;
        totalFetched += fetchedCount;

        if (!Array.isArray(rows) || rows.length === 0) {
          await sleep(THROTTLE_MS);
          continue;
        }

        const insertBuffer = rows
            .filter(r => r.date && r.date.length >= 10)
            .map(rec => ({
                industry,
                pe_date: rec.date,
                pe: rec.pe ?? null,
                source: SOURCE,
            }));

        if (insertBuffer.length > 0) {
          // Use upsert to handle partial overlaps without errors
          const { error: insertError } = await withRetry(async () => {
            return await supabaseAdmin
              .from('industry_pe')
              .upsert(insertBuffer, { onConflict: 'industry, pe_date', ignoreDuplicates: true });
          });

          if (insertError) {
            console.error(`    ❌ Error inserting ${industry} ${seg.year}:`, insertError.message);
          } else {
            totalInserted += insertBuffer.length;
             // console.log(`    ✅ Inserted ${insertBuffer.length} for ${industry} ${seg.year}`);
          }
        }
      } catch (err: any) {
        const msg = String(err?.message || err);
        const codeMatch = msg.match(/FMP (\d{3}) /);
        const statusCode = codeMatch ? codeMatch[1] : 'unknown';

        if (statusCode === '402' || statusCode === '403') {
           // Limit reached or forbidden
           console.error(`    ⚠️ FMP ${statusCode} for ${industry}.`);
        } else {
           console.error(`    ❌ Error for ${industry} ${seg.year}:`, msg);
        }
      }

      await sleep(THROTTLE_MS);
    }
    console.log(`✅ Completed ${industry}`);
  };

  // Run with concurrency limit
  const queue = [...industries];
  const activeWorkers = [];

  for (let i = 0; i < CONCURRENCY; i++) {
    activeWorkers.push((async () => {
        while (queue.length > 0) {
            const industry = queue.shift();
            if (industry) {
                await processIndustry(industry);
            }
        }
    })());
  }

  await Promise.all(activeWorkers);

  console.log('\n✅ Historical backfill completed.');
  console.log(`   Total rows fetched: ${totalFetched}`);
  console.log(`   Total rows inserted: ${totalInserted}`);
  console.log(`   Total rows skipped (estimated via check): ${totalSkippedExisting}`);
}

main().catch((err) => {
  console.error('💥 Unhandled error in backfill-industry-pe-historical:', err);
  process.exit(1);
});

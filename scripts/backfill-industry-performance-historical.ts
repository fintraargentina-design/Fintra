import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const THROTTLE_MS = 850;
const WINDOW_CODE = '1D';
const SOURCE = 'fmp_historical';

type HistoricalIndustryRecord = {
  date: string;
  industry: string;
  averageChange: number | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMonthlySegments(startYear: number, endYear: number) {
  const segments: { from: string; to: string }[] = [];

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 0; month < 12; month++) {
      const fromDate = new Date(Date.UTC(year, month, 1));
      const toDate = new Date(Date.UTC(year, month + 1, 0));

      const from = fromDate.toISOString().slice(0, 10);
      const to = toDate.toISOString().slice(0, 10);

      segments.push({ from, to });
    }
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

  console.log(`🚀 Historical backfill for industry_performance 1D from ${startYear} to ${endYear}`);

  // 1) Discover industries from existing 1D data
  const { data: industryRows, error: industriesError } = await supabaseAdmin
    .from('industry_performance')
    .select('industry')
    .eq('window_code', WINDOW_CODE)
    .not('industry', 'is', null);

  if (industriesError) {
    console.error('❌ Error fetching industries from industry_performance:', industriesError);
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
    console.warn('⚠️ No industries found in industry_performance (1D). Nothing to backfill.');
    process.exit(0);
  }

  console.log(`📊 Discovered ${industries.length} industries to backfill.`);

  const segments = buildMonthlySegments(startYear, endYear);
  console.log(`📅 Monthly segments to query: ${segments.length} (from ${segments[0].from} to ${segments[segments.length - 1].to})`);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkippedExisting = 0;

  for (const industry of industries) {
    console.log(`\n🏭 Industry: ${industry}`);

    for (const seg of segments) {
      console.log(`  ➜ Month ${seg.from.slice(0, 7)} | range ${seg.from} → ${seg.to}`);

      try {
        const rows = await fmpGet<HistoricalIndustryRecord[]>(
          '/stable/historical-industry-performance',
          {
            industry,
            from: seg.from,
            to: seg.to,
          },
        );

        const fetchedCount = Array.isArray(rows) ? rows.length : 0;
        totalFetched += fetchedCount;

        console.log(`    · Fetched rows: ${fetchedCount}`);

        if (!Array.isArray(rows) || rows.length === 0) {
          // Nothing to insert for this month
          await sleep(THROTTLE_MS);
          continue;
        }

        // Preload existing PKs for this (industry, month) to avoid overwrite
        const monthDates = rows
          .map((r) => r.date)
          .filter((d) => typeof d === 'string' && d.length >= 10);

        const uniqueDates = Array.from(new Set(monthDates));

        let existingPk = new Set<string>();
        if (uniqueDates.length > 0) {
          const { data: existingRows, error: existingError } = await supabaseAdmin
            .from('industry_performance')
            .select('performance_date')
            .eq('industry', industry)
            .eq('window_code', WINDOW_CODE)
            .in('performance_date', uniqueDates);

          if (existingError) {
            console.error('    ❌ Error checking existing PKs:', existingError);
            // Abort-safe: stop script to avoid inconsistent state
            process.exit(1);
          }

          existingPk = new Set(
            (existingRows || []).map((r: any) => `${industry}|${r.performance_date}`),
          );
        }

        const insertBuffer: any[] = [];
        let insertedThisSeg = 0;
        let skippedExistingThisSeg = 0;

        for (const rec of rows) {
          const date = rec.date;
          if (!date) continue;

          const pkKey = `${industry}|${date}`;
          if (existingPk.has(pkKey)) {
            skippedExistingThisSeg++;
            continue;
          }

          insertBuffer.push({
            industry,
            window_code: WINDOW_CODE,
            performance_date: date,
            return_percent: rec.averageChange,
            source: SOURCE,
          });
        }

        if (insertBuffer.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('industry_performance')
            .insert(insertBuffer);

          if (insertError) {
            console.error('    ❌ Error inserting rows:', insertError);
            process.exit(1);
          }

          insertedThisSeg = insertBuffer.length;
          totalInserted += insertedThisSeg;
        }

        totalSkippedExisting += skippedExistingThisSeg;

        console.log(
          `    · Inserted: ${insertedThisSeg}, Skipped existing PKs: ${skippedExistingThisSeg}`,
        );
      } catch (err: any) {
        const msg = String(err?.message || err);
        const codeMatch = msg.match(/FMP (\d{3}) /);
        const statusCode = codeMatch ? codeMatch[1] : 'unknown';

        if (statusCode === '402' || statusCode === '403') {
          console.error(
            `    ⚠️ FMP ${statusCode} for industry=${industry} range=${seg.from}→${seg.to}. Skipping month.`,
          );
          // Skip this month, continue with next
        } else {
          console.error(
            `    ❌ Unexpected error for industry=${industry} range=${seg.from}→${seg.to}:`,
            msg,
          );
          // Abort-safe: stop script on non-auth errors
          process.exit(1);
        }
      }

      await sleep(THROTTLE_MS);
    }
  }

  console.log('\n✅ Historical backfill completed.');
  console.log(`   Total rows fetched: ${totalFetched}`);
  console.log(`   Total rows inserted: ${totalInserted}`);
  console.log(`   Total rows skipped due to existing PK: ${totalSkippedExisting}`);
}

main().catch((err) => {
  console.error('💥 Unhandled error in backfill-industry-performance-historical:', err);
  process.exit(1);
});


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
      // Check if it's a network/connection error or a 5xx server error
      const isNetworkError =
        err?.code === 'ECONNRESET' ||
        err?.message?.includes('fetch failed') ||
        err?.message?.includes('network') ||
        (err?.status && err.status >= 500);

      if (!isNetworkError && i < retries - 1) {
         // If it's not a clear network error, we might still want to retry just in case,
         // but maybe with less confidence. For now, let's retry everything except known bad requests.
      }

      console.warn(`    ⚠️ Operation failed (attempt ${i + 1}/${retries}). Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      delayMs *= 2; // Exponential backoff
    }
  }
  throw lastError;
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

  console.log(`🚀 Historical backfill for industry_pe from ${startYear} to ${endYear}`);

  const { data: industryRows, error: industriesError } = await supabaseAdmin
    .from('industry_performance')
    .select('industry')
    .eq('window_code', '1D')
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

        console.log(`    · Fetched rows: ${fetchedCount}`);

        if (!Array.isArray(rows) || rows.length === 0) {
          await sleep(THROTTLE_MS);
          continue;
        }

        const monthDates = rows
          .map((r) => r.date)
          .filter((d) => typeof d === 'string' && d.length >= 10);

        const uniqueDates = Array.from(new Set(monthDates));

        let existingPk = new Set<string>();
        if (uniqueDates.length > 0) {
          try {
            const { data: existingRows, error: existingError } = await withRetry(async () => {
              return await supabaseAdmin
                .from('industry_pe')
                .select('pe_date')
                .eq('industry', industry)
                .in('pe_date', uniqueDates);
            });

            if (existingError) {
              console.error('    ❌ Error checking existing PKs (skipped segment):', existingError);
              continue; // Skip this segment, don't crash
            }

            existingPk = new Set(
              (existingRows || []).map((r: any) => `${industry}|${r.pe_date}`),
            );
          } catch (err) {
             console.error('    ❌ Retry failed for checking existing PKs:', err);
             continue;
          }
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
            pe_date: date,
            pe: rec.pe ?? null,
            source: SOURCE,
          });
        }

        if (insertBuffer.length > 0) {
          try {
            const { error: insertError } = await withRetry(async () => {
              return await supabaseAdmin
                .from('industry_pe')
                .insert(insertBuffer);
            });

            if (insertError) {
              console.error('    ❌ Error inserting rows (skipped segment):', insertError);
              continue; // Skip this segment, don't crash
            }

            insertedThisSeg = insertBuffer.length;
            totalInserted += insertedThisSeg;
          } catch (err) {
            console.error('    ❌ Retry failed for inserting rows:', err);
            continue;
          }
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
        } else {
          console.error(
            `    ❌ Unexpected error for industry=${industry} range=${seg.from}→${seg.to}:`,
            msg,
          );
          // Don't exit on unexpected errors (like network blips), just skip this segment
          // process.exit(1);
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
  console.error('💥 Unhandled error in backfill-industry-pe-historical:', err);
  process.exit(1);
});


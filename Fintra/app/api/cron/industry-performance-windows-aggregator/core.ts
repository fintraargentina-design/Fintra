import { supabaseAdmin } from '@/lib/supabase-admin';

const WINDOW_CONFIG: { code: string; days?: number }[] = [
  // Excluded from structural calculations by canonical window policy (Phase 9)
  // { code: '1W', days: 5 },
  { code: '1M', days: 21 },
  { code: '3M', days: 63 },
  { code: '6M', days: 126 },
  // { code: 'YTD' }, // Excluded (Phase 9)
  { code: '1Y', days: 252 },
  { code: '2Y', days: 504 },
  { code: '3Y', days: 756 },
  { code: '5Y', days: 1260 },
];

type IndustryDailyRow = {
  industry: string;
  performance_date: string;
  return_percent: number | null;
};

type AggregatorResult = {
  ok: boolean;
  as_of_date: string | null;
  windows_written: number;
  industries_processed: number;
  windows_skipped: number;
};

function computeCompoundedPercent(
  returns: (number | null | undefined)[],
  minCount: number,
  mode: 'lastN' | 'all' = 'lastN',
): number | null {
  if (!returns.length || minCount <= 0) return null;

  const valid = returns.filter((r) => typeof r === 'number' && Number.isFinite(r)) as number[];
  if (valid.length < minCount) return null;

  const series = mode === 'lastN' ? valid.slice(-minCount) : valid;
  if (!series.length) return null;

  let product = 1;
  for (const r of series) {
    product *= 1 + r / 100;
  }

  const compounded = product - 1;
  return compounded * 100;
}

export async function runIndustryPerformanceWindowsAggregator(): Promise<AggregatorResult> {
  try {
    const { data: latest, error: latestError } = await supabaseAdmin
      .from('industry_performance')
      .select('performance_date')
      .eq('window_code', '1D')
      .order('performance_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error('[industry-performance-windows] Error fetching latest 1D date:', latestError);
      return {
        ok: false,
        as_of_date: null,
        windows_written: 0,
        industries_processed: 0,
        windows_skipped: 0,
      };
    }

    if (!latest?.performance_date) {
      console.warn('[industry-performance-windows] No 1D data found. Aborting.');
      return {
        ok: false,
        as_of_date: null,
        windows_written: 0,
        industries_processed: 0,
        windows_skipped: 0,
      };
    }

    const asOfDate = latest.performance_date as string;
    console.log(`[industry-performance-windows] Using as_of_date=${asOfDate}`);

    const upserts: any[] = [];
    let industriesProcessed = 0;
    let windowsWritten = 0;
    let windowsSkipped = 0;

    const { data: industryRows, error: industriesError } = await supabaseAdmin
      .from('industry_performance')
      .select('industry')
      .eq('window_code', '1D')
      .lte('performance_date', asOfDate)
      .not('industry', 'is', null);

    if (industriesError) {
      console.error('[industry-performance-windows] Error fetching distinct industries:', industriesError);
      return {
        ok: false,
        as_of_date: asOfDate,
        windows_written: 0,
        industries_processed: 0,
        windows_skipped: 0,
      };
    }

    const industrySet = new Set<string>();
    for (const r of industryRows || []) {
      const raw = (r as any).industry as string | null;
      if (!raw) continue;
      const clean = raw.trim();
      if (!clean) continue;
      industrySet.add(clean);
    }

    const industries = Array.from(industrySet);

    if (!industries.length) {
      console.warn('[industry-performance-windows] No industries found with 1D data.');
      return {
        ok: false,
        as_of_date: asOfDate,
        windows_written: 0,
        industries_processed: 0,
        windows_skipped: 0,
      };
    }

    const PAGE_SIZE = 1000;

    for (const industry of industries) {
      try {
        const history: IndustryDailyRow[] = [];

        let from = 0;
        for (;;) {
          const { data: page, error: pageError } = await supabaseAdmin
            .from('industry_performance')
            .select('industry, performance_date, return_percent')
            .eq('window_code', '1D')
            .eq('industry', industry)
            .lte('performance_date', asOfDate)
            .order('performance_date', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

          if (pageError) {
            throw pageError;
          }

          if (!page || page.length === 0) {
            break;
          }

          history.push(...(page as IndustryDailyRow[]));

          if (page.length < PAGE_SIZE) {
            break;
          }

          from += PAGE_SIZE;
        }

        if (!history.length) {
          console.warn(`[industry-performance-windows] Skipping industry without 1D data: ${industry}`);
          continue;
        }

        const totalValid = history.filter(
          (h) => typeof h.return_percent === 'number' && Number.isFinite(h.return_percent),
        ).length;
        console.log(
          `[industry-performance-windows] Industry=${industry} history_len=${history.length} valid_1d=${totalValid}`,
        );

        for (const cfg of WINDOW_CONFIG) {
          if (!cfg.days) {
            continue;
          }

          const allReturns = history.map((d) => d.return_percent);
          const validCount = allReturns.filter(
            (r) => typeof r === 'number' && Number.isFinite(r),
          ).length;

          const val = computeCompoundedPercent(allReturns, cfg.days, 'lastN');
          if (val == null || !Number.isFinite(val)) {
            console.warn(
              `[industry-performance-windows] Skipping ${cfg.code} for industry=${industry}: total=${history.length} valid=${validCount} min=${cfg.days}`,
            );
            windowsSkipped++;
            continue;
          }

          upserts.push({
            industry,
            window_code: cfg.code,
            performance_date: asOfDate,
            return_percent: val,
            source: 'derived_from_1d',
          });
          windowsWritten++;
        }

        industriesProcessed++;
      } catch (err) {
        console.error('[industry-performance-windows] Error processing industry', industry, err);
      }
    }

    if (upserts.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('industry_performance')
        .upsert(upserts, {
          onConflict: 'industry,window_code,performance_date',
        });

      if (upsertError) {
        console.error('[industry-performance-windows] Upsert error:', upsertError);
        return {
          ok: false,
          as_of_date: asOfDate,
          windows_written: windowsWritten,
          industries_processed: industriesProcessed,
          windows_skipped: windowsSkipped,
        };
      }
    }

    console.log(
      `[industry-performance-windows] Completed. as_of_date=${asOfDate}, industries=${industriesProcessed}, windows_written=${windowsWritten}, windows_skipped=${windowsSkipped}`,
    );

    return {
      ok: true,
      as_of_date: asOfDate,
      windows_written: windowsWritten,
      industries_processed: industriesProcessed,
      windows_skipped: windowsSkipped,
    };
  } catch (err) {
    console.error('[industry-performance-windows] Fatal error:', err);
    return {
      ok: false,
      as_of_date: null,
      windows_written: 0,
      industries_processed: 0,
      windows_skipped: 0,
    };
  }
}


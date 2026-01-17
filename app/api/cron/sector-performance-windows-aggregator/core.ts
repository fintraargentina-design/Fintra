import { supabaseAdmin } from '@/lib/supabase-admin';

const WINDOW_CONFIG: { code: string; days?: number }[] = [
  { code: '1W', days: 5 },
  { code: '1M', days: 21 },
  { code: 'YTD' },
  { code: '1Y', days: 252 },
  { code: '3Y', days: 756 },
  { code: '5Y', days: 1260 },
];

type SectorDailyRow = {
  sector: string;
  performance_date: string;
  return_percent: number | null;
};

type AggregatorResult = {
  ok: boolean;
  as_of_date: string | null;
  windows_written: number;
  sectors_processed: number;
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

export async function runSectorPerformanceWindowsAggregator(): Promise<AggregatorResult> {
  try {
    const { data: latest, error: latestError } = await supabaseAdmin
      .from('sector_performance')
      .select('performance_date')
      .eq('window_code', '1D')
      .order('performance_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error('[sector-performance-windows] Error fetching latest 1D date:', latestError);
      return {
        ok: false,
        as_of_date: null,
        windows_written: 0,
        sectors_processed: 0,
        windows_skipped: 0,
      };
    }

    if (!latest?.performance_date) {
      console.warn('[sector-performance-windows] No 1D data found. Aborting.');
      return {
        ok: false,
        as_of_date: null,
        windows_written: 0,
        sectors_processed: 0,
        windows_skipped: 0,
      };
    }

    const asOfDate = latest.performance_date as string;
    console.log(`[sector-performance-windows] Using as_of_date=${asOfDate}`);

    const upserts: any[] = [];
    let sectorsProcessed = 0;
    let windowsWritten = 0;
    let windowsSkipped = 0;

    const { data: sectorRows, error: sectorsError } = await supabaseAdmin
      .from('sector_performance')
      .select('sector')
      .eq('window_code', '1D')
      .lte('performance_date', asOfDate)
      .not('sector', 'is', null);

    if (sectorsError) {
      console.error('[sector-performance-windows] Error fetching distinct sectors:', sectorsError);
      return {
        ok: false,
        as_of_date: asOfDate,
        windows_written: 0,
        sectors_processed: 0,
        windows_skipped: 0,
      };
    }

    const sectorSet = new Set<string>();
    for (const r of sectorRows || []) {
      const raw = (r as any).sector as string | null;
      if (!raw) continue;
      const clean = raw.trim();
      if (!clean) continue;
      sectorSet.add(clean);
    }

    const sectors = Array.from(sectorSet);

    if (!sectors.length) {
      console.warn('[sector-performance-windows] No sectors found with 1D data.');
      return {
        ok: false,
        as_of_date: asOfDate,
        windows_written: 0,
        sectors_processed: 0,
        windows_skipped: 0,
      };
    }

    const PAGE_SIZE = 1000;

    for (const sector of sectors) {
      try {
        const history: SectorDailyRow[] = [];

        let from = 0;
        for (;;) {
          const { data: page, error: pageError } = await supabaseAdmin
            .from('sector_performance')
            .select('sector, performance_date, return_percent')
            .eq('window_code', '1D')
            .eq('sector', sector)
            .lte('performance_date', asOfDate)
            .order('performance_date', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

          if (pageError) {
            throw pageError;
          }

          if (!page || page.length === 0) {
            break;
          }

          history.push(...(page as SectorDailyRow[]));

          if (page.length < PAGE_SIZE) {
            break;
          }

          from += PAGE_SIZE;
        }

        if (!history.length) {
          console.warn(`[sector-performance-windows] Skipping sector without 1D data: ${sector}`);
          continue;
        }

        const totalValid = history.filter(
          (h) => typeof h.return_percent === 'number' && Number.isFinite(h.return_percent),
        ).length;
        console.log(
          `[sector-performance-windows] Sector=${sector} history_len=${history.length} valid_1d=${totalValid}`,
        );

        const asOfYear = asOfDate.slice(0, 4);
        const ytdStart = `${asOfYear}-01-01`;
        const ytdHistory = history.filter(
          (h) => h.performance_date >= ytdStart && h.performance_date <= asOfDate,
        );

        for (const cfg of WINDOW_CONFIG) {
          if (cfg.code === 'YTD') {
            const ytdReturns = ytdHistory.map((d) => d.return_percent);
            const ytdValid = ytdReturns.filter(
              (r) => typeof r === 'number' && Number.isFinite(r),
            ).length;
            const val = computeCompoundedPercent(ytdReturns, 10, 'all');
            if (val == null || !Number.isFinite(val)) {
              console.warn(
                `[sector-performance-windows] Skipping YTD for sector=${sector}: ytd_len=${ytdHistory.length} valid=${ytdValid} min=10`,
              );
              windowsSkipped++;
              continue;
            }

            upserts.push({
              sector,
              window_code: 'YTD',
              performance_date: asOfDate,
              return_percent: val,
              source: 'derived_from_1d',
            });
            windowsWritten++;
            continue;
          }

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
              `[sector-performance-windows] Skipping ${cfg.code} for sector=${sector}: total=${history.length} valid=${validCount} min=${cfg.days}`,
            );
            windowsSkipped++;
            continue;
          }

          upserts.push({
            sector,
            window_code: cfg.code,
            performance_date: asOfDate,
            return_percent: val,
            source: 'derived_from_1d',
          });
          windowsWritten++;
        }

        sectorsProcessed++;
      } catch (err) {
        console.error('[sector-performance-windows] Error processing sector', sector, err);
      }
    }

    if (upserts.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('sector_performance')
        .upsert(upserts, {
          onConflict: 'sector,window_code,performance_date',
        });

      if (upsertError) {
        console.error('[sector-performance-windows] Upsert error:', upsertError);
        return {
          ok: false,
          as_of_date: asOfDate,
          windows_written: windowsWritten,
          sectors_processed: sectorsProcessed,
          windows_skipped: windowsSkipped,
        };
      }
    }

    console.log(
      `[sector-performance-windows] Completed. as_of_date=${asOfDate}, sectors=${sectorsProcessed}, windows_written=${windowsWritten}, windows_skipped=${windowsSkipped}`,
    );

    return {
      ok: true,
      as_of_date: asOfDate,
      windows_written: windowsWritten,
      sectors_processed: sectorsProcessed,
      windows_skipped: windowsSkipped,
    };
  } catch (err) {
    console.error('[sector-performance-windows] Fatal error:', err);
    return {
      ok: false,
      as_of_date: null,
      windows_written: 0,
      sectors_processed: 0,
      windows_skipped: 0,
    };
  }
}

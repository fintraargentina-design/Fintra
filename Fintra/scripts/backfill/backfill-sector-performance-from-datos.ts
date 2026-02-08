/**
 * BACKFILL: Sector Performance 1D Historical
 *
 * Strategy:
 * 1. Load datos_performance (ticker returns by window for daily dates)
 * 2. For each date, aggregate by sector (market-cap weighted average)
 * 3. Write to sector_performance with window_code='1D'
 * 4. Run stored procedure: calculate_sector_windows_from_returns()
 *
 * This enables IFS Live calculations by providing 3M, 6M, 2Y windows.
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

interface PerformanceRow {
  ticker: string;
  performance_date: string;
  window_code: string;
  return_percent: number;
}

interface UniverseRow {
  ticker: string;
  sector: string;
  market_cap: number | null;
}

async function main() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  console.log("🚀 BACKFILL: Sector Performance 1D Historical\n");

  // 1. Get date range from datos_performance
  console.log("📅 Identificando rango de fechas...");

  const { data: minDateData } = await supabaseAdmin
    .from("datos_performance")
    .select("performance_date")
    .eq("window_code", "1D")
    .order("performance_date", { ascending: true })
    .limit(1);

  const { data: maxDateData } = await supabaseAdmin
    .from("datos_performance")
    .select("performance_date")
    .eq("window_code", "1D")
    .order("performance_date", { ascending: false })
    .limit(1);

  if (
    !minDateData ||
    !maxDateData ||
    minDateData.length === 0 ||
    maxDateData.length === 0
  ) {
    console.error("❌ No se encontraron datos en datos_performance");
    return;
  }

  const startDate = minDateData[0].performance_date;
  const endDate = maxDateData[0].performance_date;

  console.log(`   Rango: ${startDate} → ${endDate}`);

  // 2. Get all unique dates
  const { data: allDates } = await supabaseAdmin
    .from("datos_performance")
    .select("performance_date")
    .eq("window_code", "1D")
    .order("performance_date", { ascending: true });

  const uniqueDates = [
    ...new Set(allDates?.map((d) => d.performance_date) || []),
  ];
  console.log(`   Total días disponibles: ${uniqueDates.length}\n`);

  if (uniqueDates.length < 90) {
    console.warn(
      `⚠️  ADVERTENCIA: Solo ${uniqueDates.length} días disponibles.`,
    );
    console.warn(`   IFS Live requiere:`);
    console.warn(`   - 3M window: 90 días`);
    console.warn(`   - 6M window: 180 días`);
    console.warn(`   - 2Y window: 730 días\n`);
  }

  // 3. Load universe (ticker → sector + market_cap)
  console.log("📊 Cargando universo (ticker → sector)...");

  const universeMap = new Map<string, { sector: string; market_cap: number }>();
  const PAGE_SIZE = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data } = await supabaseAdmin
      .from("fintra_universe")
      .select("ticker, sector")
      .not("sector", "is", null)
      .range(from, to)
      .order("ticker", { ascending: true });

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    data.forEach((row: any) => {
      if (row.ticker && row.sector) {
        universeMap.set(row.ticker, {
          sector: row.sector,
          market_cap: 1, // Default equal weight (no market cap in fintra_universe)
        });
      }
    });

    hasMore = data.length === PAGE_SIZE;
    page++;
  }

  console.log(`   ✅ Cargados ${universeMap.size} tickers con sector\n`);

  // 4. Get existing sector_performance dates to avoid reprocessing
  const { data: existingDates } = await supabaseAdmin
    .from("sector_performance")
    .select("performance_date")
    .eq("window_code", "1D")
    .order("performance_date", { ascending: false });

  const existingSet = new Set(
    existingDates?.map((d) => d.performance_date) || [],
  );
  const datesToProcess = uniqueDates.filter((d) => !existingSet.has(d));

  if (datesToProcess.length === 0) {
    console.log(
      "✅ Todos los días ya están procesados en sector_performance (1D)",
    );
    console.log(
      "\n🔄 Ejecutando stored procedure para calcular windows derivados...",
    );
    await runStoredProcedure(supabaseAdmin);
    return;
  }

  console.log(
    `📋 Días pendientes: ${datesToProcess.length} de ${uniqueDates.length}`,
  );
  console.log(`   Ya procesados: ${existingSet.size}`);
  console.log(`   Por procesar: ${datesToProcess.length}\n`);

  // 5. Process each date
  let processed = 0;
  let inserted = 0;

  const BATCH_SIZE = 10; // Process 10 dates at a time

  for (let i = 0; i < datesToProcess.length; i += BATCH_SIZE) {
    const batch = datesToProcess.slice(i, i + BATCH_SIZE);

    for (const date of batch) {
      // Fetch performance data for this date
      const CHUNK_SIZE = 1000;
      const allPerformance: PerformanceRow[] = [];
      let perfPage = 0;
      let hasMorePerf = true;

      while (hasMorePerf) {
        const { data: perfData } = await supabaseAdmin
          .from("datos_performance")
          .select("ticker, performance_date, window_code, return_percent")
          .eq("performance_date", date)
          .eq("window_code", "1D")
          .range(perfPage * CHUNK_SIZE, (perfPage + 1) * CHUNK_SIZE - 1);

        if (!perfData || perfData.length === 0) {
          hasMorePerf = false;
          break;
        }

        allPerformance.push(...(perfData as PerformanceRow[]));
        hasMorePerf = perfData.length === CHUNK_SIZE;
        perfPage++;
      }

      // Aggregate by sector
      const sectorAgg = new Map<
        string,
        { sum: number; count: number; weight: number }
      >();

      for (const row of allPerformance) {
        const universeData = universeMap.get(row.ticker);
        if (!universeData) continue;

        const sector = universeData.sector;
        const weight = universeData.market_cap;

        if (!sectorAgg.has(sector)) {
          sectorAgg.set(sector, { sum: 0, count: 0, weight: 0 });
        }

        const agg = sectorAgg.get(sector)!;
        agg.sum += row.return_percent * weight;
        agg.weight += weight;
        agg.count++;
      }

      // Prepare rows for insertion
      const rowsToInsert = Array.from(sectorAgg.entries()).map(
        ([sector, agg]) => ({
          sector: sector,
          window_code: "1D",
          performance_date: date,
          return_percent: agg.sum / agg.weight, // Weighted average
          source: "backfill_from_datos",
        }),
      );

      if (rowsToInsert.length > 0) {
        const { error } = await supabaseAdmin
          .from("sector_performance")
          .upsert(rowsToInsert, {
            onConflict: "sector, performance_date, window_code",
          });

        if (error) {
          console.error(`❌ Error insertando ${date}:`, error.message);
        } else {
          inserted += rowsToInsert.length;
        }
      }

      processed++;

      if (processed % 50 === 0) {
        console.log(
          `   ⏳ Procesados: ${processed}/${datesToProcess.length} días (${inserted} sector rows)`,
        );
      }
    }
  }

  console.log(`\n✅ Backfill completado:`);
  console.log(`   Días procesados: ${processed}`);
  console.log(`   Sector rows insertados: ${inserted}`);

  // 6. Run stored procedure to calculate derived windows
  console.log(
    "\n🔄 Ejecutando stored procedure para calcular windows derivados (3M, 6M, 2Y)...",
  );
  await runStoredProcedure(supabaseAdmin);

  console.log("\n🎉 ¡Backfill completo!");
  console.log("\n📋 Próximos pasos:");
  console.log("   1. Verificar sector_performance tiene windows: 3M, 6M, 2Y");
  console.log(
    "   2. Re-ejecutar snapshots: npx tsx scripts/pipeline/16-fmp-bulk-snapshots.ts",
  );
  console.log("   3. Verificar IFS Live en UI");
}

async function runStoredProcedure(supabaseAdmin: any) {
  // Get latest date with 1D data
  const { data: latestDate } = await supabaseAdmin
    .from("sector_performance")
    .select("performance_date")
    .eq("window_code", "1D")
    .order("performance_date", { ascending: false })
    .limit(1);

  if (!latestDate || latestDate.length === 0) {
    console.error(
      "❌ No hay datos 1D en sector_performance para ejecutar stored procedure",
    );
    return;
  }

  const targetDate = latestDate[0].performance_date;
  console.log(`   Target date: ${targetDate}`);

  // Call stored procedure (if exists)
  const { data, error } = await supabaseAdmin.rpc(
    "calculate_sector_windows_from_returns",
    {
      target_date: targetDate,
    },
  );

  if (error) {
    console.error(`❌ Error en stored procedure:`, error.message);
    console.log(
      "\n⚠️  Si el stored procedure no existe, los windows 3M/6M/2Y deben calcularse manualmente.",
    );
  } else {
    console.log(`   ✅ Stored procedure ejecutado exitosamente`);
    if (data) {
      console.log(`   Resultado:`, data);
    }
  }
}

main().catch(console.error);

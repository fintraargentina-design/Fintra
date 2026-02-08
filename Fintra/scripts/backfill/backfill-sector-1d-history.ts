import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load env vars
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

async function backfillSector1DHistory() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  console.log("🚀 Starting Sector 1D History Backfill...");

  // 1. Load Ticker -> Sector Map from fintra_universe (canonical source)
  console.log("Loading ticker -> sector mapping...");
  const { data: universeData, error: universeError } = await supabaseAdmin
    .from("fintra_universe")
    .select("ticker, sector")
    .not("sector", "is", null);

  if (universeError) {
    console.error("❌ Failed to load universe:", universeError);
    process.exit(1);
  }

  const tickerToSector = new Map<string, string>();
  universeData?.forEach((row) => {
    if (row.ticker && row.sector) {
      tickerToSector.set(row.ticker, row.sector);
    }
  });

  console.log(`✅ Loaded ${tickerToSector.size} ticker-sector mappings.`);

  // 2. Define Date Range (730 days = 2 years for 2Y window)
  const endDate = new Date(); // Today
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 730); // 2 years back

  const daysToProcess = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    daysToProcess.push(d.toISOString().split("T")[0]);
  }

  console.log(
    `📅 Processing ${daysToProcess.length} days from ${daysToProcess[0]} to ${daysToProcess[daysToProcess.length - 1]}`,
  );

  // 3. Process each day
  let processedDays = 0;
  let skippedDays = 0;
  let totalSectorRows = 0;

  for (const dateStr of daysToProcess) {
    // Fetch 1D returns for this date
    const { data: returns, error: returnsError } = await supabaseAdmin
      .from("datos_performance")
      .select("ticker, return_percent")
      .eq("window_code", "1D")
      .eq("performance_date", dateStr);

    if (returnsError) {
      console.error(
        `❌ Error fetching returns for ${dateStr}:`,
        returnsError.message,
      );
      continue;
    }

    if (!returns || returns.length === 0) {
      skippedDays++;
      continue;
    }

    // Aggregate by Sector
    const sectorStats = new Map<string, { sum: number; count: number }>();

    for (const row of returns) {
      const sector = tickerToSector.get(row.ticker);
      if (!sector) continue;

      if (!sectorStats.has(sector)) {
        sectorStats.set(sector, { sum: 0, count: 0 });
      }
      const stats = sectorStats.get(sector)!;
      // Handle null/undefined return_percent if necessary, though type says numeric
      if (row.return_percent !== null && row.return_percent !== undefined) {
        stats.sum += Number(row.return_percent);
        stats.count += 1;
      }
    }

    if (sectorStats.size === 0) {
      skippedDays++;
      continue;
    }

    // Prepare Upsert
    const upsertRows = [];
    for (const [sector, stats] of sectorStats.entries()) {
      if (stats.count > 0) {
        upsertRows.push({
          sector: sector,
          window_code: "1D",
          performance_date: dateStr,
          return_percent: stats.sum / stats.count,
          source: "aggregated_from_stocks",
        });
      }
    }

    // Write to DB
    const { error: upsertError } = await supabaseAdmin
      .from("sector_performance")
      .upsert(upsertRows, {
        onConflict: "sector, performance_date, window_code",
      });

    if (upsertError) {
      console.error(`❌ Failed to upsert for ${dateStr}:`, upsertError.message);
    } else {
      processedDays++;
      totalSectorRows += upsertRows.length;
      if (processedDays % 50 === 0) {
        console.log(
          `\n   Progreso: ${processedDays}/${daysToProcess.length} días (${Math.round((processedDays / daysToProcess.length) * 100)}%)`,
        );
      } else {
        process.stdout.write("."); // Progress indicator
      }
    }
  }

  console.log("\n\n✅ Backfill de datos 1D completado!");
  console.log(`📊 Resumen:`);
  console.log(`   - Días procesados: ${processedDays}`);
  console.log(`   - Días sin datos: ${skippedDays}`);
  console.log(`   - Total sector rows insertadas: ${totalSectorRows}`);

  // 4. Ejecutar aggregator para calcular windows 3M, 6M, 2Y
  console.log("\n🔄 Ejecutando Sector Performance Windows Aggregator...");
  const today = new Date().toISOString().slice(0, 10);

  const { error: rpcError } = await supabaseAdmin.rpc(
    "calculate_sector_windows_from_returns",
    {
      p_as_of_date: today,
    },
  );

  if (rpcError) {
    console.error("❌ Error ejecutando aggregator:", rpcError);
  } else {
    console.log("✅ Aggregator ejecutado exitosamente!");
    console.log(
      "\n🎉 Backfill completo! Los windows 3M, 6M, 2Y deberían estar disponibles ahora.",
    );
  }
}

backfillSector1DHistory().catch(console.error);

/**
 * BACKFILL: datos_performance Historical (730 days)
 *
 * Strategy:
 * 1. Load active tickers from fintra_universe
 * 2. Download historical prices from FMP (730 days back)
 * 3. Calculate 1D returns for each ticker
 * 4. Write to datos_performance with window_code='1D'
 * 5. After completion, run sector_performance backfill
 *
 * Time estimate: 2-4 hours (depending on universe size and API limits)
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const FMP_API_KEY = process.env.FMP_API_KEY;
const LOOKBACK_DAYS = 730; // 2 years

interface PriceData {
  date: string;
  close: number;
  adjClose: number;
}

interface PerformanceRow {
  ticker: string;
  performance_date: string;
  window_code: string;
  return_percent: number;
  volatility: number | null;
  max_drawdown: number | null;
  source: string;
}

async function fetchHistoricalPrices(
  ticker: string,
  fromDate: string,
  toDate: string,
): Promise<PriceData[]> {
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?from=${fromDate}&to=${toDate}&apikey=${FMP_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`⚠️  Rate limit hit for ${ticker}, waiting 1s...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchHistoricalPrices(ticker, fromDate, toDate); // Retry
      }
      return [];
    }

    const data = await response.json();

    if (!data.historical || !Array.isArray(data.historical)) {
      return [];
    }

    return data.historical.map((h: any) => ({
      date: h.date,
      close: h.close,
      adjClose: h.adjClose || h.close,
    }));
  } catch (error) {
    console.error(`❌ Error fetching ${ticker}:`, error);
    return [];
  }
}

function calculateDailyReturns(prices: PriceData[]): PerformanceRow[] {
  if (prices.length < 2) return [];

  // Sort by date ascending
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));

  const returns: PerformanceRow[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const today = sorted[i];
    const yesterday = sorted[i - 1];

    const returnPercent =
      ((today.adjClose - yesterday.adjClose) / yesterday.adjClose) * 100;

    returns.push({
      ticker: "", // Will be set by caller
      performance_date: today.date,
      window_code: "1D",
      return_percent: returnPercent,
      volatility: null, // Can be calculated later if needed
      max_drawdown: null,
      source: "backfill_fmp_historical",
    });
  }

  return returns;
}

async function main() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  console.log("🚀 BACKFILL: datos_performance Historical (730 days)\n");

  if (!FMP_API_KEY) {
    console.error("❌ FMP_API_KEY no encontrado en .env.local");
    process.exit(1);
  }

  // Calculate date range
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - LOOKBACK_DAYS);

  const fromDate = startDate.toISOString().split("T")[0];
  const toDate = today.toISOString().split("T")[0];

  console.log(
    `📅 Rango de fechas: ${fromDate} → ${toDate} (${LOOKBACK_DAYS} días)\n`,
  );

  // 1. Load universe
  console.log("📊 Cargando universo de tickers...");

  const tickers: string[] = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data } = await supabaseAdmin
      .from("fintra_universe")
      .select("ticker, sector")
      .eq("is_active", true)
      .eq("instrument_type", "EQUITY")
      .not("sector", "is", null)
      .range(from, to)
      .order("ticker", { ascending: true });

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    data.forEach((row: any) => {
      if (row.ticker) {
        tickers.push(row.ticker);
      }
    });

    hasMore = data.length === PAGE_SIZE;
    page++;
  }

  console.log(`   ✅ Cargados ${tickers.length} tickers activos\n`);

  if (tickers.length === 0) {
    console.error("❌ No se encontraron tickers activos");
    return;
  }

  // 2. Check existing coverage
  console.log("🔍 Verificando cobertura existente...");

  const { data: existingTickers } = await supabaseAdmin
    .from("datos_performance")
    .select("ticker")
    .eq("window_code", "1D")
    .gte("performance_date", fromDate)
    .lte("performance_date", toDate);

  const existingSet = new Set(existingTickers?.map((row) => row.ticker) || []);
  const tickersToProcess = tickers.filter((t) => !existingSet.has(t));

  console.log(`   Ya procesados: ${existingSet.size}`);
  console.log(`   Por procesar: ${tickersToProcess.length}\n`);

  if (tickersToProcess.length === 0) {
    console.log("✅ Todos los tickers ya tienen datos históricos");
    console.log("\n📋 Ejecutar backfill de sector_performance:");
    console.log(
      "   npx tsx scripts/backfill/backfill-sector-performance-from-datos.ts",
    );
    return;
  }

  // 3. Process tickers in batches
  console.log(`🔄 Procesando ${tickersToProcess.length} tickers...\n`);
  console.log("⚙️  Configuración:");
  console.log(`   - Batch size: 10 tickers (secuencial con rate limiting)`);
  console.log(`   - DB write chunk: 5000 rows\n`);

  let processedTickers = 0;
  let totalRowsInserted = 0;
  let skippedNoData = 0;
  let skippedErrors = 0;

  const TICKER_BATCH_SIZE = 10; // Process 10 tickers, then write to DB
  const DB_CHUNK_SIZE = 5000; // Max rows per upsert

  const startTime = Date.now();

  for (let i = 0; i < tickersToProcess.length; i += TICKER_BATCH_SIZE) {
    const batch = tickersToProcess.slice(i, i + TICKER_BATCH_SIZE);
    const batchRows: PerformanceRow[] = [];

    // Fetch prices for each ticker in batch (sequential to respect rate limits)
    for (const ticker of batch) {
      try {
        const prices = await fetchHistoricalPrices(ticker, fromDate, toDate);

        if (prices.length < 2) {
          skippedNoData++;
          if (processedTickers < 5) {
            console.log(
              `   ⚠️  ${ticker}: Sin suficientes datos (${prices.length} días)`,
            );
          }
          processedTickers++;
          continue;
        }

        const returns = calculateDailyReturns(prices);
        returns.forEach((r) => (r.ticker = ticker));
        batchRows.push(...returns);

        if (processedTickers < 5) {
          console.log(`   ✅ ${ticker}: ${returns.length} returns calculados`);
        }

        processedTickers++;

        // Small delay to respect rate limits (100ms = 10 req/sec)
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error procesando ${ticker}:`, error);
        skippedErrors++;
        processedTickers++;
      }
    }

    // Write batch to DB in chunks
    if (batchRows.length > 0) {
      const chunks = [];
      for (let j = 0; j < batchRows.length; j += DB_CHUNK_SIZE) {
        chunks.push(batchRows.slice(j, j + DB_CHUNK_SIZE));
      }

      for (const chunk of chunks) {
        const { error } = await supabaseAdmin
          .from("datos_performance")
          .upsert(chunk, {
            onConflict: "ticker, performance_date, window_code",
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`❌ Error insertando chunk:`, error.message);
        } else {
          totalRowsInserted += chunk.length;
        }
      }
    }

    // Progress report
    const progress = (
      (processedTickers / tickersToProcess.length) *
      100
    ).toFixed(1);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const tickersPerSec = processedTickers / elapsed;
    const remaining = Math.floor(
      (tickersToProcess.length - processedTickers) / tickersPerSec,
    );

    console.log(
      `   ⏳ Progreso: ${processedTickers}/${tickersToProcess.length} (${progress}%) | ${totalRowsInserted.toLocaleString()} rows | ETA: ${Math.floor(remaining / 60)}m ${remaining % 60}s`,
    );
  }

  const totalTime = Math.floor((Date.now() - startTime) / 1000);

  console.log(
    `\n✅ Backfill completado en ${Math.floor(totalTime / 60)}m ${totalTime % 60}s:`,
  );
  console.log(`   Tickers procesados: ${processedTickers}`);
  console.log(`   Rows insertados: ${totalRowsInserted.toLocaleString()}`);
  console.log(`   Skipped (sin datos): ${skippedNoData}`);
  console.log(`   Skipped (errores): ${skippedErrors}`);

  // 4. Verify coverage
  console.log("\n🔍 Verificando cobertura final...");

  const { data: finalDates } = await supabaseAdmin
    .from("datos_performance")
    .select("performance_date")
    .eq("window_code", "1D")
    .gte("performance_date", fromDate)
    .lte("performance_date", toDate);

  const uniqueDates = new Set(finalDates?.map((d) => d.performance_date) || []);
  console.log(`   Días únicos con datos: ${uniqueDates.size}`);

  if (uniqueDates.size >= 90) {
    console.log("   ✅ Suficiente para 3M window (90+ días)");
  }
  if (uniqueDates.size >= 180) {
    console.log("   ✅ Suficiente para 6M window (180+ días)");
  }
  if (uniqueDates.size >= 730) {
    console.log("   ✅ Suficiente para 2Y window (730+ días)");
  }

  console.log("\n📋 Próximos pasos:");
  console.log("   1. Ejecutar backfill de sector_performance:");
  console.log(
    "      npx tsx scripts/backfill/backfill-sector-performance-from-datos.ts",
  );
  console.log("   2. Verificar sector_performance tiene windows: 3M, 6M, 2Y");
  console.log("   3. Re-ejecutar snapshots con IFS Live");
}

main().catch(console.error);

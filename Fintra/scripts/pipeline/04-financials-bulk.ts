import "tsconfig-paths/register";
import { loadEnv } from "../utils/load-env";

loadEnv();

console.log("DEBUG: Script started");
console.log("DEBUG: Loading runFinancialsBulk...");

async function main() {
  let runFinancialsBulk;
  try {
    const mod = await import("@/app/api/cron/financials-bulk/core");
    runFinancialsBulk = mod.runFinancialsBulk;

    console.log("DEBUG: runFinancialsBulk loaded successfully");
  } catch (e) {
    console.error("DEBUG: Failed to load module:", e);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let limit: number | undefined;
  let offset: number = 0; // Default offset
  let targetTicker: string | undefined;
  let years: number[] | undefined;
  let forceUpdate = false;
  let batchSize: number = 2000; // Default batch size (2000 tickers × ~10 rows = 20000 rows → chunked into 5000-row batches)
  let fullSync = false; // NEW: Full historical sync mode
  let verbose = false;

  // Simple arg parsing
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--limit") {
      limit = parseInt(args[++i], 10);
    } else if (arg === "--offset") {
      offset = parseInt(args[++i], 10);
    } else if (arg === "--ticker") {
      targetTicker = args[++i];
    } else if (arg === "--years") {
      const yearStr = args[++i];
      if (yearStr.includes("-")) {
        const [start, end] = yearStr.split("-").map((y) => parseInt(y, 10));
        years = [];
        for (let y = start; y <= end; y++) years.push(y);
      } else {
        years = yearStr.split(",").map((y) => parseInt(y, 10));
      }
    } else if (arg === "--batch-size") {
      const val = parseInt(args[++i], 10);
      if (val >= 50 && val <= 2000) {
        batchSize = val;
      } else {
        console.error("❌ Error: --batch-size must be between 50 and 2000");
        process.exit(1);
      }
    } else if (arg === "--force") {
      forceUpdate = true;
    } else if (arg === "--verbose") {
      verbose = true;
    } else if (arg === "--full") {
      fullSync = true;
      // Generate full year range from 2015 to current+1
      const currentYear = new Date().getFullYear();
      years = [];
      for (let y = 2015; y <= currentYear + 1; y++) {
        years.push(y);
      }
      console.log(
        `🔄 FULL SYNC MODE: Will process years ${years[0]}-${years[years.length - 1]}`,
      );
    } else if (!arg.startsWith("--") && !limit && !targetTicker && !years) {
      // Legacy support for plain limit argument if no flags used
      const val = parseInt(arg, 10);
      if (!isNaN(val)) limit = val;
    }
  }

  console.log(`🚀 Running Financials Bulk...`);
  console.log(
    `   - Mode: ${fullSync ? "FULL SYNC (2015-present)" : "DAILY (mutable years only)"}`,
  );
  console.log(`   - Limit: ${limit || "ALL"}`);
  console.log(`   - Offset: ${offset}`);
  console.log(`   - Ticker: ${targetTicker || "ALL"}`);
  console.log(
    `   - Years: ${years ? years.join(", ") : "Auto (mutable years)"}`,
  );
  console.log(`   - Batch Size: ${batchSize} tickers`);
  console.log(`   - Force Update: ${forceUpdate}`);
  console.log(`   - Verbose: ${verbose}`);

  try {
    await runFinancialsBulk(
      targetTicker,
      limit,
      years,
      forceUpdate,
      false,
      batchSize,
      offset,
      verbose,
    );
    console.log("✅ Financials Bulk completed.");
  } catch (e) {
    console.error("❌ Financials Bulk failed:", e);
    process.exit(1);
  }
}

main();

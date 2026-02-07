import { loadEnv } from "../utils/load-env";

loadEnv();

async function main() {
  const { runFmpBulk } = await import("@/app/api/cron/fmp-bulk/core");

  const args = process.argv.slice(2);
  const arg1 = args[0];
  const arg2 = args[1];
  const arg3 = args[2];

  let limit: number | undefined = undefined;
  let ticker: string | undefined = undefined;
  let batchSize: number = 200;

  // Simple parsing: if first arg is number -> limit, else -> ticker
  if (arg1) {
    const parsed = parseInt(arg1, 10);
    if (!isNaN(parsed) && parsed.toString() === arg1) {
      limit = parsed;
      if (arg2) ticker = arg2;
    } else {
      ticker = arg1;
    }
  }

  // Parse Batch Size (3rd arg, or 2nd if ticker is not present, logic can be fuzzy so we assume explicit 3rd pos usually)
  // To keep it simple: if arg3 is present and is number, use it.
  if (arg3) {
    const parsedBatch = parseInt(arg3, 10);
    if (!isNaN(parsedBatch)) batchSize = parsedBatch;
  }

  console.log(
    `🚀 Running FMP Bulk Snapshots (Limit: ${limit || "ALL"}, Ticker: ${ticker || "ALL"}, BatchSize: ${batchSize})...`,
  );
  try {
    await runFmpBulk(ticker, limit, batchSize);
    console.log("✅ FMP Bulk Snapshots completed.");
  } catch (e) {
    console.error("❌ FMP Bulk Snapshots failed:", e);
    process.exit(1);
  }
}

main();

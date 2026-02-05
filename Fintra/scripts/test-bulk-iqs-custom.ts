import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllFmpData } from '@/app/api/cron/fmp-bulk/fetchBulk';
import { buildSnapshot } from '@/app/api/cron/fmp-bulk/buildSnapshots';
import { upsertSnapshots } from '@/app/api/cron/fmp-bulk/upsertSnapshots';
import {
  fetchFinancialHistory,
  fetchPerformanceHistory,
  fetchValuationHistory,
  fetchSectorPerformanceHistory,
  computeGrowthRows
} from '@/app/api/cron/fmp-bulk/fetchGrowthData';

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

async function main() {
  const fmpKey = process.env.FMP_API_KEY!;
  if (!fmpKey) throw new Error("Missing FMP_API_KEY");

  const testTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'BRK.B', 'V', 'JNJ'];
  console.log(`🚀 Starting Test Bulk Update for ${testTickers.length} tickers...`);
  console.log(`Tickers: ${testTickers.join(', ')}`);

  // 1. Fetch Bulk Data
  console.log("Fetching Bulk Data from FMP...");
  const [profilesRes, ratiosRes, metricsRes, scoresRes] = await Promise.all([
    fetchAllFmpData("profiles", fmpKey),
    fetchAllFmpData("ratios", fmpKey),
    fetchAllFmpData("metrics", fmpKey),
    fetchAllFmpData("scores", fmpKey),
  ]);

  if (!profilesRes.ok) throw new Error(`Profiles Fetch Failed: ${profilesRes.error?.message}`);

  const profilesMap = new Map(profilesRes.data.map((p: any) => [p.symbol, p]));
  const ratiosMap = new Map(ratiosRes.data.map((r: any) => [r.symbol, r]));
  const metricsMap = new Map(metricsRes.data.map((m: any) => [m.symbol, m]));
  const scoresMap = new Map(scoresRes.data.map((s: any) => [s.symbol, s]));

  // 2. Fetch History & Sector Data
  console.log("Fetching History & Sector Data...");
  const sectorPerformanceMap = await fetchSectorPerformanceHistory(supabaseAdmin);
  const historyMap = await fetchFinancialHistory(supabaseAdmin, testTickers);
  const performanceMap = await fetchPerformanceHistory(supabaseAdmin, [...testTickers, "SPY"]);
  const valuationMap = await fetchValuationHistory(supabaseAdmin, testTickers);
  const benchmarkRows = performanceMap.get("SPY") || [];

  // 3. Build Snapshots
  console.log("Building Snapshots...");
  const snapshots: any[] = [];

  for (const ticker of testTickers) {
    const profile = profilesMap.get(ticker);
    const ratios = ratiosMap.get(ticker);
    const metrics = metricsMap.get(ticker);
    const scores = scoresMap.get(ticker);

    if (!profile) {
      console.warn(`Missing profile for ${ticker}`);
      continue;
    }

    const financialHistory = historyMap.get(ticker) || [];
    console.log(`[DEBUG] ${ticker} financialHistory type: ${typeof financialHistory}, isArray: ${Array.isArray(financialHistory)}, length: ${financialHistory.length}`);
    
    const growthRows = computeGrowthRows(financialHistory);
    const performanceRows = performanceMap.get(ticker) || [];
    const valuationRows = valuationMap.get(ticker) || [];

    const snapshot = await buildSnapshot(
      ticker,
      profile,
      ratios || {},
      metrics || {},
      null, // quote
      null, // priceChange
      scores || {},
      growthRows, // incomeGrowthRows
      growthRows, // cashflowGrowthRows
      financialHistory, // financialHistory
      performanceRows,
      valuationRows,
      benchmarkRows,
      sectorPerformanceMap
    );

    if (snapshot) {
      snapshots.push(snapshot);
      // Check IQS (ifs_fy)
      if (snapshot.ifs_fy) {
        console.log(`✅ [${ticker}] IQS Calculated: ${JSON.stringify(snapshot.ifs_fy).substring(0, 100)}...`);
      } else {
        console.warn(`⚠️ [${ticker}] IQS Missing (ifs_fy is null)`);
      }
    }
  }

  // 4. Upsert
  if (snapshots.length > 0) {
    try {
    console.log(`📤 Upserting ${snapshots.length} snapshots to Supabase...`);
    await upsertSnapshots(supabaseAdmin, snapshots);
    console.log("✅ Upsert successful.");
  } catch (err: any) {
    console.error("❌ Upsert failed:", err.message || err);
    process.exit(1);
  }

  // 5. Verify in DB
  console.log("Verifying data in Supabase...");
      const { data: dbSnapshots, error: dbError } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('ticker, ifs_fy')
        .in('ticker', testTickers)
        .eq('snapshot_date', new Date().toISOString().slice(0, 10));
      
      if (dbError) {
        console.error("Error checking DB:", dbError);
      } else {
        console.log("DB Verification Results:");
        dbSnapshots?.forEach((s: any) => {
           console.log(`  ${s.ticker}: ifs_fy=${s.ifs_fy ? 'PRESENT' : 'NULL'}`);
        });
      }
    } else {
      console.warn("No snapshots generated.");
    }
}

main().catch(console.error);

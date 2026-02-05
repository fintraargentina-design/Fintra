
import { loadEnv } from "../utils/load-env";
import { fmpGet } from "@/lib/fmp/server";

loadEnv();

const BATCH_SIZE = 50;
const CONCURRENCY = 10;
const RETRY_DELAY = 2000;

interface EnterpriseValueData {
  symbol: string;
  date: string;
  numberOfShares: number;
}

async function getTickersWithMissingShares(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  
  // We want tickers that have ANY row with missing shares, 
  // or maybe just prioritize ones with MANY missing.
  // For simplicity, let's get all active tickers and we'll check/update them.
  // Or better: querying directly for missing shares.
  
  const { data, error } = await supabaseAdmin
    .from("datos_financieros")
    .select("ticker")
    .is("weighted_shares_out", null)
    .in("period_type", ["Q", "FY"]) // Only care about Q and FY
    .csv(); // CSV is faster for large datasets if we just want IDs, but here we want distinct tickers.
    
  if (error) {
    console.error("❌ Error fetching tickers:", error);
    return [];
  }

  // Parse CSV or use RPC if available. 
  // Actually, standard select with distinct is better but Supabase JS doesn't do distinct easily without RPC.
  // Let's just fetch all active tickers and process them. 
  // The user says "51%" so it's half the universe.
  
  const { data: universe, error: uError } = await supabaseAdmin
    .from("fintra_universe")
    .select("ticker")
    .eq("is_active", true);
    
  if (uError) {
      console.error("❌ Error fetching universe:", uError);
      return [];
  }
  
  return universe.map(t => t.ticker);
}

async function fetchEnterpriseValues(ticker: string, period: 'annual' | 'quarter'): Promise<EnterpriseValueData[]> {
    try {
        const data = await fmpGet<EnterpriseValueData[]>(`/v3/enterprise-values/${ticker}`, { 
            period, 
            limit: 80 // 20 years of quarters or 80 years of annual
        });
        return Array.isArray(data) ? data : [];
    } catch (e) {
        // 404 or other error
        // console.warn(`   ⚠️ Failed to fetch ${period} EV for ${ticker}: ${(e as Error).message}`);
        return [];
    }
}

async function processTicker(ticker: string) {
    const { supabaseAdmin } = await import("@/lib/supabase-admin");
    let updated = 0;
    
    // 1. Fetch EV Data
    const [annualEV, quarterlyEV] = await Promise.all([
        fetchEnterpriseValues(ticker, 'annual'),
        fetchEnterpriseValues(ticker, 'quarter')
    ]);
    
    if (annualEV.length === 0 && quarterlyEV.length === 0) {
        return { updated: 0, msg: "No EV data found" };
    }
    
    const evMap = new Map<string, number>();
    
    // Helper to add to map
    const addToMap = (items: EnterpriseValueData[]) => {
        items.forEach(item => {
            if (item.numberOfShares > 0) {
                evMap.set(item.date, item.numberOfShares);
            }
        });
    };
    
    addToMap(annualEV);
    addToMap(quarterlyEV);
    
    // 2. Fetch existing financials that need update (or all to be safe?)
    // Let's fetch rows that have NULL shares OR we can just upsert updates.
    // Fetching is better to avoid unnecessary writes.
    const { data: rows, error } = await supabaseAdmin
        .from("datos_financieros")
        .select("id, period_end_date, weighted_shares_out")
        .eq("ticker", ticker)
        .in("period_type", ["Q", "FY"]);
        
    if (error || !rows) return { updated: 0, msg: "DB Error" };
    
    const updates: { id: number; weighted_shares_out: number }[] = [];
    
    for (const row of rows) {
        // If shares missing, try to find in EV map
        if (!row.weighted_shares_out) {
            const shares = evMap.get(row.period_end_date);
            if (shares) {
                updates.push({
                    id: row.id,
                    weighted_shares_out: shares
                });
            }
        }
    }
    
    // 3. Perform Updates
    // Bulk update is tricky in Supabase without RPC or iterating.
    // We'll iterate for now, or use upsert if we had all fields.
    // Since we only update one field, we have to do it by ID.
    // Parallelize updates
    
    if (updates.length > 0) {
        // We can group by updates? No, unique IDs.
        // Let's do it in chunks or parallel promises.
        const updatePromises = updates.map(u => 
            supabaseAdmin
                .from("datos_financieros")
                .update({ weighted_shares_out: u.weighted_shares_out })
                .eq("id", u.id)
        );
        
        await Promise.all(updatePromises);
        updated = updates.length;
    }
    
    return { updated, msg: updated > 0 ? `Updated ${updated} rows` : "No updates needed" };
}

async function main() {
  console.log("🚀 Starting Weighted Shares Backfill (from Enterprise Values)...");
  
  const allTickers = await getTickersWithMissingShares();
  console.log(`📋 Found ${allTickers.length} active tickers to check.`);
  
  let processed = 0;
  let totalUpdated = 0;
  
  // Batch processing
  for (let i = 0; i < allTickers.length; i += BATCH_SIZE) {
      const batch = allTickers.slice(i, i + BATCH_SIZE);
      console.log(`\n🔄 Processing Batch ${i + 1} - ${Math.min(i + BATCH_SIZE, allTickers.length)}...`);
      
      // Concurrency within batch
      for (let j = 0; j < batch.length; j += CONCURRENCY) {
          const chunk = batch.slice(j, j + CONCURRENCY);
          const promises = chunk.map(async (ticker) => {
              try {
                  const res = await processTicker(ticker);
                  return { ticker, ...res };
              } catch (e) {
                  return { ticker, updated: 0, msg: `Error: ${(e as Error).message}` };
              }
          });
          
          const results = await Promise.all(promises);
          
          for (const res of results) {
              if (res.updated > 0) {
                  console.log(`   ✅ ${res.ticker}: ${res.msg}`);
                  totalUpdated += res.updated;
              } else if (res.msg.includes("Error")) {
                  console.log(`   ❌ ${res.ticker}: ${res.msg}`);
              } else {
                  // console.log(`   . ${res.ticker}: ${res.msg}`); // Verbose
                  process.stdout.write(".");
              }
              processed++;
          }
      }
      console.log(""); // Newline
      
      // Rate limit protection
      await new Promise(r => setTimeout(r, 500));
  }
  
  console.log("\n✨ Backfill Complete!");
  console.log(`   Total Tickers Processed: ${processed}`);
  console.log(`   Total Rows Updated: ${totalUpdated}`);
}

main().catch(console.error);

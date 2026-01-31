import * as dotenv from 'dotenv';
import dayjs from 'dayjs';

dotenv.config({ path: '.env.local' });

/**
 * Script to backfill FULL historical prices for a specific ticker.
 * Uses FMP's /historical-price-full endpoint which returns up to 5 years (or more) of data.
 * 
 * Usage: npx tsx scripts/backfill-ticker-full.ts --ticker=SPY
 */

async function backfillTickerFull(ticker: string) {
  console.log(`\n🚀 Starting Full Backfill for ${ticker}...`);

  // Dynamic imports to ensure env vars are loaded
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const { fmpGet } = await import('@/lib/fmp/server');

  try {
    const endpoint = `/api/v3/historical-price-full/${ticker}`;

    const toDate = dayjs().format('YYYY-MM-DD');
    const fromDate = dayjs().subtract(6, 'year').format('YYYY-MM-DD');

    console.log(`fetching ${endpoint} from ${fromDate} to ${toDate}...`);
    
    const data = await fmpGet<any>(endpoint, { from: fromDate, to: toDate });
    
    if (!data || !data.historical) {
      console.error(`❌ No historical data found for ${ticker}`);
      return;
    }

    const history = data.historical;
    console.log(`✅ Fetched ${history.length} rows for ${ticker}.`);

    if (history.length === 0) return;

    // 2. Transform to DB Schema
    const rows = history.map((d: any) => {
        return {
            ticker: ticker.toUpperCase(),
            price_date: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            adj_close: d.adjClose,
            volume: d.volume,
            source: 'fmp_full_history'
        };
    });

    // 3. Batch Upsert to Supabase
    const BATCH_SIZE = 1000;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabaseAdmin
            .from('prices_daily')
            .upsert(batch, { onConflict: 'ticker,price_date' });

        if (error) {
            console.error(`❌ Error inserting batch ${i}-${i + BATCH_SIZE}:`, error.message);
            errors += batch.length;
        } else {
            inserted += batch.length;
            process.stdout.write(`\rInserted ${inserted}/${rows.length} rows...`);
        }
    }

    console.log(`\n\n✨ Completed for ${ticker}. Inserted: ${inserted}, Errors: ${errors}`);

  } catch (err: any) {
    console.error(`\n💥 Critical Error:`, err.message);
  }
}

// --- Main Execution ---
const args = process.argv.slice(2);
const tickerArg = args.find(a => a.startsWith('--ticker='))?.split('=')[1];

if (!tickerArg) {
  console.error('Usage: npx tsx scripts/backfill-ticker-full.ts --ticker=SYMBOL');
  process.exit(1);
}

backfillTickerFull(tickerArg)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

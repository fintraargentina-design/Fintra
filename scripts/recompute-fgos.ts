import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log(`Loading env from ${envLocalPath}`);
  dotenv.config({ path: envLocalPath, override: true });
} else {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log(`Loading env from ${envPath}`);
    dotenv.config({ path: envPath });
  } else {
    console.warn('⚠️ No .env or .env.local found!');
  }
}

const WATCHLIST_MVP = [
  'AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'ADBE',
  'GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'TMUS', 'VZ',
  'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'LOW',
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'PM', 'MO',
  'JPM', 'BAC', 'V', 'MA', 'BRKC', 'GS', 'MS',
  'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'PFE', 'TMO',
  'CAT', 'GE', 'HON', 'UNP', 'UPS', 'BA', 'DE',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'OXY', 'MPC',
  'LIN', 'SHW', 'FCX', 'SCCO', 'NEM', 'DOW', 'APD',
  'PLD', 'AMT', 'EQIX', 'CCI', 'O', 'SPG', 'PSA',
  'NEE', 'SO', 'DUK', 'SRE', 'AEP', 'D', 'PEG'
];

async function main() {
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const { recomputeFGOSForTicker } = await import('@/lib/engine/fgos-recompute');

  const args = process.argv.slice(2);
  const universeArg = args.find(a => a.startsWith('--universe='));
  const universe = (universeArg ? universeArg.split('=')[1] : 'MVP').toUpperCase();

  if (universe !== 'MVP') {
    console.error(`Unsupported universe: ${universe}. Only MVP is supported in this script.`);
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  console.log(`🚀 Starting FGOS recompute for universe=${universe} on ${today}`);

  const { data, error } = await supabaseAdmin
    .from('fintra_snapshots')
    .select('ticker')
    .eq('snapshot_date', today)
    .in('ticker', WATCHLIST_MVP);

  if (error) {
    console.error('Error fetching MVP snapshots:', error);
    process.exit(1);
  }

  const tickers = Array.from(new Set((data || []).map(d => d.ticker)));

  console.log(`📋 Found ${tickers.length} MVP snapshots for today.`);

  if (tickers.length === 0) {
    console.log('⚠️ No MVP snapshots found for today. Make sure FMP Bulk has run.');
    process.exit(0);
  }

  let success = 0;
  let pending = 0;
  let failed = 0;

  const CHUNK_SIZE = 25;
  const TOTAL = tickers.length;

  for (let i = 0; i < TOTAL; i += CHUNK_SIZE) {
    const chunk = tickers.slice(i, i + CHUNK_SIZE);

    await Promise.all(
      chunk.map(async ticker => {
        try {
          const res: any = await recomputeFGOSForTicker(ticker, today);
          const status = res.fgos_status || res.status;

          if (status === 'computed') {
            success++;
          } else {
            pending++;
          }
        } catch {
          failed++;
        }
      })
    );

    const progress = Math.min(i + CHUNK_SIZE, TOTAL);
    const percent = ((progress / TOTAL) * 100).toFixed(1);
    process.stdout.write(
      `\rProcessing: ${progress}/${TOTAL} (${percent}%) | ✅ OK: ${success} | ⏳ Pending: ${pending} | ❌ Fail: ${failed}`
    );
  }

  console.log('\n✅ FGOS recompute for MVP finished.');
}

main();


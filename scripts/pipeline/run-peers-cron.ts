import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('Error loading .env.local:', envResult.error);
}

async function main() {
  try {
    const { runPeersBulk } = await import('@/app/api/cron/fmp-peers-bulk/core');

    const targetTicker = process.env.FMP_PEERS_DEBUG_TICKER || 'AAPL';
    const limit = Number(process.env.FMP_PEERS_DEBUG_LIMIT || '1');

    console.log(`\n--- Running FMP Peers Cron (runPeersBulk) ---`);
    console.log(`Target Ticker: ${targetTicker} | Limit: ${limit}`);

    const result = await runPeersBulk(targetTicker, limit);

    console.log('✅ Peers cron completado');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error en runPeersBulk:', error);
    process.exit(1);
  }
}

main();


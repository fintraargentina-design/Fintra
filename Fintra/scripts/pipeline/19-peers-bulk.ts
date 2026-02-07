import { loadEnv } from '../utils/load-env';

loadEnv();

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


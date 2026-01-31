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
    const { runPeersBulkFromFile } = await import('@/app/api/cron/fmp-peers-bulk/core');
    console.log('\n--- Running Peers Bulk from local CSV ---');
    const runResult = await runPeersBulkFromFile();

    console.log('✅ Peers bulk desde archivo completado');
    console.log(JSON.stringify(runResult, null, 2));
  } catch (error) {
    console.error('❌ Error en runPeersBulkFromFile:', error);
    process.exit(1);
  }
}

main();

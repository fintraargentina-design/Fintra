import dotenv from 'dotenv';
import path from 'path';
// backfill-sector-performance.ts
const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('Error loading .env.local:', envResult.error);
}

async function main() {
  try {
    const { runSectorPerformanceWindowsAggregator } = await import(
      '@/app/api/cron/sector-performance-windows-aggregator/core'
    );

    console.log(`\n--- Running Sector Performance Windows Aggregator ---`);

    const result = await runSectorPerformanceWindowsAggregator();

    console.log('✅ Sector-performance-windows aggregator completado');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error en sector-performance-windows-aggregator:', error);
    process.exit(1);
  }
}

main();


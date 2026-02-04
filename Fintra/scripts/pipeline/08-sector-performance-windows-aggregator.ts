import { loadEnv } from '../utils/load-env';

loadEnv();

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


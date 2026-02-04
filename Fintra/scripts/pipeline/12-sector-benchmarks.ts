import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
    const { runSectorBenchmarks } = await import('@/app/api/cron/sector-benchmarks/core');
    
    console.log(`🚀 Running Sector Benchmarks...`);
    
    try {
        await runSectorBenchmarks();
        console.log('✅ Sector Benchmarks completed.');
    } catch (e) {
        console.error('❌ Sector Benchmarks failed:', e);
        process.exit(1);
    }
}

main();

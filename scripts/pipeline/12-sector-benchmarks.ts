import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
} else {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

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

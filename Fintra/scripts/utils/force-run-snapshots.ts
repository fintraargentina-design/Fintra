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
    const { runFmpBulk } = await import('@/app/api/cron/fmp-bulk/core');
    
    // Parse limit from CLI
    const args = process.argv.slice(2);
    const limitArg = args[0] ? parseInt(args[0], 10) : 2000;
    const limit = isNaN(limitArg) ? 2000 : limitArg;

    console.log(`🚀 Forcing runFmpBulk with limit ${limit}...`);
    
    try {
        await runFmpBulk(undefined, limit);
        console.log('✅ runFmpBulk completed.');
    } catch (e) {
        console.error('❌ runFmpBulk failed:', e);
        process.exit(1);
    }
}

main();

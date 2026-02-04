
import { execSync } from 'child_process';

const startYear = 2014;
const endYear = 2026;

console.log(`🚀 Starting Sequential Historical Data Load (${startYear}-${endYear})...`);

for (let year = startYear; year <= endYear; year++) {
    console.log(`\n----------------------------------------`);
    console.log(`📅 Processing Year: ${year}`);
    console.log(`----------------------------------------`);
    
    try {
        // Run with increased memory limit using npx tsx directly
        // Passing NODE_OPTIONS via env to increase heap size
        execSync(`npx tsx scripts/pipeline/04-financials-bulk.ts --years ${year}-${year}`, { 
            stdio: 'inherit',
            env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' }
        });
        console.log(`✅ Year ${year} completed successfully.`);
    } catch (e) {
        console.error(`❌ Failed to process year ${year}`);
        // We might want to continue or stop. Let's stop to be safe and inspect.
        // But for bulk load, maybe continue? 
        // Let's stop so the user sees the error.
        process.exit(1);
    }
}

console.log(`\n🎉 All years processed successfully!`);

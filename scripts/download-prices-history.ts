import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

// Load Environment Variables
const envPath = path.resolve(process.cwd(), '.env.local');
const result = dotenv.config({ path: envPath });
if (result.error) {
    // Fallback to .env
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

async function main() {
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
        console.error('❌ Missing FMP_API_KEY in .env or .env.local');
        process.exit(1);
    }

    // Default: Last 10 years
    let start = dayjs().subtract(10, 'year');
    let end = dayjs();

    // Optional override via args
    const args = process.argv.slice(2);
    const startArg = args.find(a => a.startsWith('--start='))?.split('=')[1];
    const endArg = args.find(a => a.startsWith('--end='))?.split('=')[1];

    if (startArg) start = dayjs(startArg);
    if (endArg) end = dayjs(endArg);

    console.log(`\n🚀 STARTING RAW DOWNLOAD: ${start.format('YYYY-MM-DD')} -> ${end.format('YYYY-MM-DD')}`);
    console.log(`📁 Target Folder: data/fmp-eod-bulk`);
    console.log('--------------------------------------------------');

    const cacheDir = path.join(process.cwd(), 'data', 'fmp-eod-bulk');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    let current = start;
    let downloaded = 0;
    let skipped = 0;
    let errors = 0;

    while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD');
        const dayOfWeek = current.day(); // 0=Sun, 6=Sat

        // Skip Weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            // console.log(`[${dateStr}] Skipping Weekend`);
            current = current.add(1, 'day');
            continue;
        }

        const fileName = `eod_${dateStr}.csv`;
        const filePath = path.join(cacheDir, fileName);

        if (fs.existsSync(filePath)) {
            // Check file size to ensure it's not empty/corrupt
            const stats = fs.statSync(filePath);
            if (stats.size > 100) { // Arbitrary small size check
                console.log(`[${dateStr}] ✅ Exists (Skipping)`);
                skipped++;
                current = current.add(1, 'day');
                continue;
            } else {
                console.log(`[${dateStr}] ⚠️ File too small, re-downloading...`);
            }
        }

        console.log(`[${dateStr}] ⬇️ Downloading...`);
        
        try {
            const url = `https://financialmodelingprep.com/stable/eod-bulk?date=${dateStr}&apikey=${apiKey}&datatype=csv`;
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`[${dateStr}] ❌ HTTP ${response.status} ${response.statusText}`);
                errors++;
            } else {
                if (!response.body) {
                    console.error(`[${dateStr}] ❌ Empty Body`);
                    errors++;
                } else {
                    const fileStream = fs.createWriteStream(filePath);
                    // @ts-ignore
                    await pipeline(Readable.fromWeb(response.body), fileStream);
                    
                    // Verify size
                    const stats = fs.statSync(filePath);
                    console.log(`[${dateStr}] ✅ Saved (${(stats.size / 1024).toFixed(1)} KB)`);
                    downloaded++;
                }
            }
        } catch (err: any) {
            console.error(`[${dateStr}] 💥 Error: ${err.message}`);
            errors++;
        }

        // Delay to avoid rate limits (safe buffer)
        await new Promise(r => setTimeout(r, 10000));
        current = current.add(1, 'day');
    }

    console.log('\n--------------------------------------------------');
    console.log(`✨ DONE.`);
    console.log(`📥 Downloaded: ${downloaded}`);
    console.log(`⏭️ Skipped (Exists): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
}

main().catch(console.error);

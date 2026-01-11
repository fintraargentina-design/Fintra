import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env or .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function findFiles(dir: string, pattern: RegExp): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, pattern));
    } else {
      if (pattern.test(file)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

async function migratePrices() {
  console.log('🚀 Starting Price Migration...');
  
  // 1. Find all price CSVs
  const dataDir = path.resolve(process.cwd(), 'data');
  // Match prices_*.csv
  const files = findFiles(dataDir, /^prices_.*\.csv$/);

  console.log(`📂 Found ${files.length} price files.`);

  for (const file of files) {
    console.log(`Processing ${path.basename(file)}...`);
    const content = fs.readFileSync(file, 'utf8');
    
    // Parse CSV
    const { data, errors } = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });

    if (errors.length > 0) {
      console.warn(`⚠️ CSV errors in ${path.basename(file)}:`, errors.slice(0, 5));
    }

    const validRows: any[] = [];
    let skipped = 0;

    // Transform and Validate
    for (const row of data as any[]) {
      const ticker = row.symbol?.toString().trim().toUpperCase();
      const date = row.date;
      const close = Number(row.close);

      if (!ticker || !date || isNaN(close)) {
        skipped++;
        continue;
      }

      // Map to DB schema
      validRows.push({
        ticker,
        price_date: date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: close,
        adj_close: row.adjClose,
        volume: row.volume,
        source: 'fmp_csv',
        data_freshness: 0 // Historical data is 0 days fresh relative to itself? Or just 0.
      });
    }

    console.log(`Parsed ${validRows.length} valid rows (skipped ${skipped}).`);

    // Batch Insert
    const BATCH_SIZE = 1000;
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('prices_daily')
        .upsert(batch, { onConflict: 'ticker,price_date' });

      if (error) {
        console.error(`❌ Error inserting batch ${i}:`, error.message);
      } else {
        process.stdout.write('.');
      }
    }
    console.log('\nDone with file.');
  }

  console.log('✅ Migration Complete.');
}

migratePrices().catch(console.error);

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const API_KEY = process.env.FMP_API_KEY;
const BASE_URL = process.env.FMP_BASE_URL || 'https://financialmodelingprep.com';

if (!API_KEY) {
  console.error('Missing FMP_API_KEY in environment');
  process.exit(1);
}

const CACHE_DIR = path.join(process.cwd(), 'data', 'fmp-bulk');

type StatementType = {
  key: 'income' | 'balance' | 'cashflow';
  endpoint: string;
};

const STATEMENT_TYPES: StatementType[] = [
  { key: 'income', endpoint: 'income-statement-bulk' },
  { key: 'balance', endpoint: 'balance-sheet-statement-bulk' },
  { key: 'cashflow', endpoint: 'cash-flow-statement-bulk' },
];

const PERIODS = ['FY', 'Q1', 'Q2', 'Q3', 'Q4'] as const;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadToFile(url: string, destPath: string) {
  const res = await fetch(url);

  if (res.status === 429) {
    console.error(`429 Rate Limit from FMP for ${url}`);
    return false;
  }

  if (!res.ok) {
    console.error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    return false;
  }

  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
  return true;
}

async function main() {
  await ensureDir(CACHE_DIR);

  const args = process.argv.slice(2);
  const startArg = args.find((a) => a.startsWith('--startYear='));
  const endArg = args.find((a) => a.startsWith('--endYear='));

  if (!startArg) {
    console.error('Usage: npx tsx scripts/download-fmp-bulk.ts --startYear=YYYY [--endYear=YYYY]');
    process.exit(1);
  }

  const startYear = parseInt(startArg.split('=')[1], 10);
  if (!Number.isFinite(startYear) || startYear < 1900) {
    console.error('Invalid startYear');
    process.exit(1);
  }

  const currentYear = new Date().getFullYear();
  const endYear = endArg ? parseInt(endArg.split('=')[1], 10) : currentYear;

  if (!Number.isFinite(endYear) || endYear < startYear) {
    console.error('Invalid endYear');
    process.exit(1);
  }

  console.log(`Downloading FMP bulk CSVs from ${startYear} to ${endYear}`);

  for (let year = startYear; year <= endYear; year++) {
    for (const period of PERIODS) {
      for (const type of STATEMENT_TYPES) {
        const fileName = `${type.key}_${year}_${period}.csv`;
        const filePath = path.join(CACHE_DIR, fileName);

        if (fs.existsSync(filePath)) {
          console.log(`HIT ${fileName}, skipping download`);
          continue;
        }

        const url = `${BASE_URL}/stable/${type.endpoint}?year=${year}&period=${period}&apikey=${API_KEY}`;
        console.log(`Downloading ${fileName} from ${url}`);

        const ok = await downloadToFile(url, filePath);
        await sleep(10_000);

        if (!ok) {
          console.log(`Skipped ${fileName} due to fetch error`);
        } else {
          console.log(`Saved ${fileName}`);
        }
      }
    }
  }

  const ttmFiles = [
    { key: 'metrics_ttm', endpoint: 'key-metrics-ttm-bulk' },
    { key: 'ratios_ttm', endpoint: 'ratios-ttm-bulk' },
  ];

  for (const t of ttmFiles) {
    const fileName = `${t.key}.csv`;
    const filePath = path.join(CACHE_DIR, fileName);

    if (fs.existsSync(filePath)) {
      console.log(`HIT ${fileName}, skipping download`);
      continue;
    }

    const url = `${BASE_URL}/stable/${t.endpoint}?apikey=${API_KEY}`;
    console.log(`Downloading ${fileName} from ${url}`);

    const ok = await downloadToFile(url, filePath);
    await sleep(10_000);

    if (!ok) {
      console.log(`Skipped ${fileName} due to fetch error`);
    } else {
      console.log(`Saved ${fileName}`);
    }
  }

  console.log('Done downloading FMP bulk files');
}

main().catch((err) => {
  console.error('Fatal error in download-fmp-bulk.ts:', err);
  process.exit(1);
});


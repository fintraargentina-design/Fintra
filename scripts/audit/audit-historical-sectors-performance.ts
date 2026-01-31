import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

type HistoricalSectorRecord = {
  date: string;
  [key: string]: number | string | null;
};

async function main() {
  const yearArg = process.argv.find((a) => a.startsWith('--year='));
  const year = yearArg ? parseInt(yearArg.split('=')[1], 10) : new Date().getFullYear() - 1;
  const { fmpGet } = await import('@/lib/fmp/server');

  console.log(`Auditing FMP /v3/historical-sectors-performance for year ${year}`);
  console.log(`Monthly ranges within ${year} (from → to):`);

  const urlPath = '/api/v3/historical-sectors-performance';

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const from = `${year}-${mm}-01`;

    const nextYear = m === 12 ? year + 1 : year;
    const nextMonth = m === 12 ? 1 : m + 1;
    const mmNext = String(nextMonth).padStart(2, '0');
    const to = `${nextYear}-${mmNext}-01`;

    console.log(`\n>>> Month ${mm}: ${from} → ${to}`);

    const rows = await fmpGet<HistoricalSectorRecord[]>(urlPath, { from, to });

    if (!Array.isArray(rows)) {
      console.error('Response is not an array for month', mm);
      continue;
    }

    console.log(`Rows: ${rows.length}`);

    if (!rows.length) {
      continue;
    }

    const dates = rows
      .map((r) => r.date)
      .filter((d): d is string => typeof d === 'string' && d.length >= 10)
      .sort();

    if (dates.length > 0) {
      console.log(`First date: ${dates[0]}`);
      console.log(`Last date:  ${dates[dates.length - 1]}`);
    }

    const first = rows[0] as any;
    console.log('Sample keys:', Object.keys(first));
    console.log('Sample row:', JSON.stringify(first));
  }
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});

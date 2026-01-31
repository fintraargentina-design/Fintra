import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const SLEEP_MS = 700;
const YEARS_BACK = 6;

const SECTORS: string[] = [
  'Basic Materials',
  'Communication Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Energy',
  'Financial Services',
  'Healthcare',
  'Industrials',
  'Real Estate',
  'Technology',
  'Utilities',
];

type HistoricalSectorPeRecord = {
  date: string;
  pe?: number | string | null;
  [key: string]: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildMonthlySegments(): { from: string; to: string }[] {
  const today = new Date();
  const end = new Date(fmt(today));

  const start = new Date(end);
  start.setFullYear(start.getFullYear() - YEARS_BACK);
  start.setDate(1);

  const segments: { from: string; to: string }[] = [];

  let cur = new Date(start);
  while (cur <= end) {
    const year = cur.getFullYear();
    const month = cur.getMonth();

    const fromDate = new Date(year, month, 1);
    const toDate = new Date(year, month + 1, 1);

    const fromStr = fmt(fromDate);
    const toStr = fmt(toDate);

    segments.push({ from: fromStr, to: toStr });

    cur = new Date(year, month + 1, 1);
  }

  return segments;
}

async function main() {
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const { fmpGet } = await import('@/lib/fmp/server');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  console.log(`🚀 Backfill de sector_pe para ${YEARS_BACK} años`);

  const segments = buildMonthlySegments();
  console.log('Segmentos mensuales de consulta:', segments);

  let totalRows = 0;
  let totalUpserts = 0;

  for (const sector of SECTORS) {
    console.log(`\n📊 Sector: ${sector}`);

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      console.log(`\n📡 ${sector} — Segmento ${i + 1}/${segments.length}: ${seg.from} → ${seg.to}`);

      try {
        const rows = await fmpGet<HistoricalSectorPeRecord[]>(
          '/stable/historical-sector-pe',
          {
            sector,
            from: seg.from,
            to: seg.to,
          },
        );

        if (!Array.isArray(rows) || rows.length === 0) {
          console.log('   → 0 filas recibidas');
          continue;
        }

        console.log(`   → ${rows.length} filas recibidas`);

        const sorted = [...rows].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        const firstDate = sorted[0]?.date;
        const lastDate = sorted[sorted.length - 1]?.date;
        console.log(`   [DEBUG] first_date=${firstDate} last_date=${lastDate}`);

        const upsertBuffer: {
          sector: string;
          pe_date: string;
          pe: number | null;
          source: string;
        }[] = [];

        for (const rec of rows) {
          const d = rec.date;
          if (!d) continue;

          const rawPe = rec.pe;
          let peValue: number | null = null;

          if (typeof rawPe === 'number') {
            peValue = Number.isFinite(rawPe) ? rawPe : null;
          } else if (typeof rawPe === 'string') {
            const parsed = parseFloat(rawPe);
            peValue = Number.isFinite(parsed) ? parsed : null;
          } else {
            peValue = null;
          }

          upsertBuffer.push({
            sector,
            pe_date: d,
            pe: peValue,
            source: 'fmp_historical_sector_pe',
          });

          totalRows++;
        }

        const BATCH_SIZE = 500;
        for (let j = 0; j < upsertBuffer.length; j += BATCH_SIZE) {
          const batch = upsertBuffer.slice(j, j + BATCH_SIZE);
          if (!batch.length) continue;

          const { error, count } = await supabaseAdmin
            .from('sector_pe')
            .upsert(batch, {
              onConflict: 'sector,pe_date',
              count: 'exact',
            });

          if (error) {
            console.error('❌ Error al upsert batch:', error.message || error);
          } else {
            totalUpserts += batch.length;
            console.log(
              `   ↳ Upsert batch ${j}/${upsertBuffer.length} (filas=${batch.length}, count=${count ?? 'n/a'})`,
            );
          }
        }
      } catch (err: any) {
        console.error('💥 Error crítico en segmento', sector, seg, '→', err?.message || err);
      }

      if (i < segments.length - 1) {
        console.log(`⏳ Esperando ${SLEEP_MS / 1000}s antes de la próxima consulta...`);
        await sleep(SLEEP_MS);
      }
    }
  }

  console.log('\n✅ Backfill sector_pe completado');
  console.log('   Filas procesadas (potenciales):', totalRows);
  console.log('   Filas upsert ejecutadas:', totalUpserts);
}

main().catch((err) => {
  console.error('💥 Error no controlado en backfill-sector-pe:', err);
  process.exit(1);
});


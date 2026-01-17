import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
// backfill-sector-performance.ts
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const SLEEP_MS = 500;
const YEARS_BACK = 10;
const WINDOW_CODE = '1D';

const SECTOR_KEY_MAP: Record<string, string> = {
	basicMaterialsChangesPercentage: 'Basic Materials',
	communicationServicesChangesPercentage: 'Communication Services',
	consumerCyclicalChangesPercentage: 'Consumer Cyclical',
	consumerDefensiveChangesPercentage: 'Consumer Defensive',
	energyChangesPercentage: 'Energy',
	financialServicesChangesPercentage: 'Financial Services',
	healthcareChangesPercentage: 'Healthcare',
	industrialsChangesPercentage: 'Industrials',
	realEstateChangesPercentage: 'Real Estate',
	technologyChangesPercentage: 'Technology',
	utilitiesChangesPercentage: 'Utilities',
};

type HistoricalSectorRecord = {
  date: string;
  [key: string]: number | string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildSegments(): { from: string; to: string; days: number }[] {
  const today = new Date();
  const end = new Date(fmt(today));

  const start = new Date(end);
  start.setFullYear(start.getFullYear() - YEARS_BACK);
  start.setDate(1);

  const segments: { from: string; to: string; days: number }[] = [];

  let cur = new Date(start);
  while (cur <= end) {
    const year = cur.getFullYear();
    const month = cur.getMonth();

    const segFromDate = new Date(year, month, 1);
    let segToDate = new Date(year, month + 1, 0);
    if (segToDate > end) segToDate = new Date(end);

    const fromStr = fmt(segFromDate);
    const toStr = fmt(segToDate);

    const diffMs = segToDate.getTime() - segFromDate.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

    segments.push({ from: fromStr, to: toStr, days });

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

  console.log(`🚀 Backfill de sector_performance para ${YEARS_BACK} años (window=${WINDOW_CODE})`);

  const segments = buildSegments();
  console.log('Segmentos de consulta:', segments);

  let totalRows = 0;
  let totalUpserts = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    console.log(`\n📡 Segmento ${i + 1}/${segments.length}: ${seg.from} → ${seg.to}`);
    console.log(`   [DEBUG] Segmento mensual ${seg.from.slice(0, 7)} con ~${seg.days} días naturales`);

    try {
      const urlPath = '/api/v3/historical-sectors-performance';
      const rows = await fmpGet<HistoricalSectorRecord[]>(urlPath, {
        from: seg.from,
        to: seg.to,
      });

      if (!Array.isArray(rows) || rows.length === 0) {
        console.warn('⚠️ Respuesta vacía o no array para segmento', seg);
      } else {
        console.log(`   → ${rows.length} filas recibidas`);
        const sample = rows[0] as any;
        console.log('   [DEBUG] Claves ejemplo:', Object.keys(sample));
        console.log('   [DEBUG] Fila ejemplo:', JSON.stringify(sample));
      }

      const upsertBuffer: any[] = [];

      for (const rec of rows || []) {
        const date = rec.date;
        if (!date) continue;

        for (const [key, val] of Object.entries(rec)) {
          if (key === 'date') continue;

          const sector = SECTOR_KEY_MAP[key];
          if (!sector) continue;

          const num =
            typeof val === 'number'
              ? val
              : typeof val === 'string'
              ? parseFloat(val.replace('%', ''))
              : NaN;

          if (!Number.isFinite(num)) continue;

          upsertBuffer.push({
            sector,
            window_code: WINDOW_CODE,
            performance_date: date,
            return_percent: num,
            source: 'fmp_historical_sectors',
          });

          totalRows++;
        }
      }

      const BATCH_SIZE = 500;
      for (let j = 0; j < upsertBuffer.length; j += BATCH_SIZE) {
        const batch = upsertBuffer.slice(j, j + BATCH_SIZE);
        if (!batch.length) continue;

        const { error, count } = await supabaseAdmin
          .from('sector_performance')
          .upsert(batch, { onConflict: 'sector,window_code,performance_date', count: 'exact' });

        if (error) {
          console.error('❌ Error al upsert batch:', error.message || error);
        } else {
          totalUpserts += batch.length;
          console.log(`   ↳ Upsert batch ${j}/${upsertBuffer.length} (filas=${batch.length}, count=${count ?? 'n/a'})`);
        }
      }
    } catch (err: any) {
      console.error('💥 Error crítico en segmento', seg, '→', err?.message || err);
    }

    if (i < segments.length - 1) {
      console.log(`⏳ Esperando ${SLEEP_MS / 1000}s antes de la próxima consulta...`);
      await sleep(SLEEP_MS);
    }
  }

  console.log('\n✅ Backfill completado');
  console.log('   Filas procesadas (potenciales):', totalRows);
  console.log('   Filas upsert ejecutadas:', totalUpserts);
}

main().catch((err) => {
  console.error('💥 Error no controlado en backfill-sector-performance:', err);
  process.exit(1);
});

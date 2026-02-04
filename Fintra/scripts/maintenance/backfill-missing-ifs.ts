
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { supabaseAdmin } from '@/lib/supabase-admin';
import { recomputeFGOSForTicker } from '@/lib/engine/fgos-recompute';

async function backfillMissingIFS() {
  console.log('🔍 Buscando snapshots con IFS faltante pero con datos de performance...');

  // Select snapshots where IFS is null but we have at least 1M or 1Y relative performance
  // limiting to a batch to avoid timeouts, can be run in loop
  const { data: candidates, error } = await supabaseAdmin
    .from('fintra_snapshots')
    .select('ticker, snapshot_date')
    .is('ifs', null)
    .not('relative_vs_sector_1m', 'is', null) // We need at least one valid block
    .order('snapshot_date', { ascending: false })
    .limit(500);

  if (error) {
    console.error('❌ Error fetching candidates:', error);
    return;
  }

  if (!candidates || candidates.length === 0) {
    console.log('✅ No hay snapshots pendientes de cálculo de IFS.');
    return;
  }

  console.log(`📋 Encontrados ${candidates.length} candidatos. Iniciando recálculo...`);

  let successCount = 0;
  let errorCount = 0;

  for (const { ticker, snapshot_date } of candidates) {
    try {
      // process.stdout.write(`Processing ${ticker} (${snapshot_date})... `);
      const result = await recomputeFGOSForTicker(ticker, snapshot_date);
      
      if (result.status === 'computed') {
        // process.stdout.write('✅ OK\n');
        successCount++;
      } else {
        console.warn(`⚠️ ${ticker}: ${result.reason || 'Unknown status'}`);
        errorCount++;
      }
    } catch (err) {
      console.error(`❌ ${ticker}: Error`, err);
      errorCount++;
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`   ✅ Procesados exitosamente: ${successCount}`);
  console.log(`   ❌ Fallos: ${errorCount}`);
}

// Run
backfillMissingIFS()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

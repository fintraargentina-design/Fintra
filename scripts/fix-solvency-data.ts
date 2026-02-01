/**
 * fix-solvency-data.ts
 *
 * Ejecuta los 2 cron jobs necesarios para solucionar Solvency/Efficiency NULL:
 * 1. financials-bulk - Pobla interest_coverage
 * 2. fmp-bulk - Recalcula snapshots con Solvency/Efficiency
 *
 * USO:
 *   npx tsx scripts/fix-solvency-data.ts
 *
 * DURACIÓN ESPERADA: 30-60 minutos total
 */

import { runFinancialsBulk } from '../app/api/cron/financials-bulk/core';
import { runFmpBulk } from '../app/api/cron/fmp-bulk/core';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  FIX SOLVENCY/EFFICIENCY - AUTOMATED PIPELINE                ║');
  console.log('║  Step 1: Populate interest_coverage (financials-bulk)        ║');
  console.log('║  Step 2: Recalculate snapshots (fmp-bulk)                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();

  try {
    // ────────────────────────────────────────────────────────
    // STEP 1: Populate interest_coverage in datos_financieros
    // ────────────────────────────────────────────────────────
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ STEP 1: FINANCIALS BULK (Populate Interest Coverage)       │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('⏱️  Expected duration: 15-30 minutes');
    console.log('📥 Downloading Income Statements from FMP...');
    console.log('🔢 Calculating interest_coverage = operating_income / interest_expense');
    console.log('💾 Inserting into datos_financieros...');
    console.log('');

    const t1 = Date.now();
    const result1 = await runFinancialsBulk();
    const duration1 = ((Date.now() - t1) / 1000 / 60).toFixed(2);

    console.log('');
    console.log('✅ STEP 1 COMPLETED');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Financials Bulk Results:');
    console.log(`   Processed tickers: ${result1.stats?.processed || 0}`);
    console.log(`   FY rows: ${result1.stats?.fy_built || 0}`);
    console.log(`   Quarterly rows: ${result1.stats?.q_built || 0}`);
    console.log(`   TTM rows: ${result1.stats?.ttm_built || 0}`);
    console.log(`   Total rows written: ${result1.stats?.total_written || 0}`);
    console.log(`   Duration: ${duration1} minutes`);
    console.log('');

    // Validación rápida
    console.log('🔍 Quick Validation:');
    console.log('   Run this query to verify interest_coverage was populated:');
    console.log('   SELECT COUNT(*) FROM datos_financieros WHERE interest_coverage IS NOT NULL;');
    console.log('');

    // ────────────────────────────────────────────────────────
    // STEP 2: Recalculate snapshots with Solvency/Efficiency
    // ────────────────────────────────────────────────────────
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ STEP 2: FMP BULK (Recalculate Snapshots with Solvency)     │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('⏱️  Expected duration: 20-40 minutes');
    console.log('🧮 Building snapshots with FGOS engine...');
    console.log('📊 Calculating Solvency from interest_coverage...');
    console.log('📊 Calculating Efficiency from asset_turnover...');
    console.log('💾 Upserting snapshots...');
    console.log('');

    const t2 = Date.now();
    const result2 = await runFmpBulk();
    const duration2 = ((Date.now() - t2) / 1000 / 60).toFixed(2);

    console.log('');
    console.log('✅ STEP 2 COMPLETED');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 FMP Bulk Results:');
    console.log(`   Snapshots processed: ${result2.processed || 0}`);
    console.log(`   Duration: ${duration2} minutes`);
    console.log('');

    // ────────────────────────────────────────────────────────
    // FINAL SUMMARY
    // ────────────────────────────────────────────────────────
    const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    🎉 PROCESS COMPLETED                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('✅ SUCCESS - Solvency/Efficiency Data Fix Applied');
    console.log('');
    console.log('📊 SUMMARY:');
    console.log(`   Step 1 Duration: ${duration1} minutes`);
    console.log(`   Step 2 Duration: ${duration2} minutes`);
    console.log(`   Total Duration: ${totalDuration} minutes`);
    console.log('');
    console.log('🔍 VALIDATION QUERIES:');
    console.log('');
    console.log('   1. Verify interest_coverage populated:');
    console.log('      SELECT COUNT(*) FROM datos_financieros');
    console.log('      WHERE interest_coverage IS NOT NULL AND period_type = \'TTM\';');
    console.log('      -- Expected: ~6,000-8,000 rows (80%+ of active tickers)');
    console.log('');
    console.log('   2. Verify Solvency calculated:');
    console.log('      SELECT COUNT(*) FROM fintra_snapshots');
    console.log('      WHERE (fgos_components->>\'solvency\')::float IS NOT NULL');
    console.log('        AND snapshot_date >= \'2024-01-01\';');
    console.log('      -- Expected: ~50,000+ rows (95%+ of snapshots)');
    console.log('');
    console.log('   3. Check Solvency distribution:');
    console.log('      SELECT');
    console.log('        CASE');
    console.log('          WHEN (fgos_components->>\'solvency\')::float >= 70 THEN \'High\'');
    console.log('          WHEN (fgos_components->>\'solvency\')::float >= 40 THEN \'Medium\'');
    console.log('          ELSE \'Low\'');
    console.log('        END as band,');
    console.log('        COUNT(*) as count');
    console.log('      FROM fintra_snapshots');
    console.log('      WHERE (fgos_components->>\'solvency\')::float IS NOT NULL');
    console.log('      GROUP BY 1;');
    console.log('      -- Expected: High ~25%, Medium ~50%, Low ~25%');
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('   1. Run the validation queries above');
    console.log('   2. Check dashboard to see FGOS categories populated');
    console.log('   3. Schedule financials-bulk to run weekly (Sundays 2 AM)');
    console.log('');

  } catch (error: any) {
    console.error('');
    console.error('╔═══════════════════════════════════════════════════════════════╗');
    console.error('║                    ❌ ERROR OCCURRED                          ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('Error details:', error);
    console.error('');
    console.error('Stack trace:', error.stack);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   - Check that .env.local has all required variables');
    console.error('   - Verify FMP_API_KEY is valid');
    console.error('   - Check Supabase connection');
    console.error('   - Review logs above for specific error');
    console.error('');
    process.exit(1);
  }
}

main();

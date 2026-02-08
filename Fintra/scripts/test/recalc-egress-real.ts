console.log("📊 RECÁLCULO EGRESS CON BATCH SIZE REAL\n");

const batchSize = 10; // Real batch size usado
const totalTickers = 53000;
const totalBatches = Math.ceil(totalTickers / batchSize);

console.log(`Batch size: ${batchSize}`);
console.log(`Total tickers: ${totalTickers.toLocaleString()}`);
console.log(`Total batches: ${totalBatches.toLocaleString()}\n`);

// Estimaciones basadas en sample de 10 tickers
const avgFinancialsPerBatch = 0.15; // MB
const avgValuationPerBatch = 0.05; // MB (sin fix)
const avgValuationFixed = 0.019; // MB (con fix limit 1000)
const industryPrefetch = 0.35; // MB (actual tiene 2.4k rows)
const universePrefetch = 12.69; // MB

// ANTES del fix
const totalFinancialsGB = (avgFinancialsPerBatch * totalBatches) / 1024;
const totalValuationGB = (avgValuationPerBatch * totalBatches) / 1024;
const prefetchGB = (industryPrefetch + universePrefetch) / 1024;
const totalGBBefore = prefetchGB + totalFinancialsGB + totalValuationGB;

console.log("❌ ANTES (sin fix):");
console.log(`  - industry_performance: ${industryPrefetch} MB`);
console.log(`  - fintra_universe: ${universePrefetch} MB`);
console.log(
  `  - datos_financieros: ${avgFinancialsPerBatch} MB × ${totalBatches.toLocaleString()} = ${totalFinancialsGB.toFixed(2)} GB`,
);
console.log(
  `  - datos_valuacion: ${avgValuationPerBatch} MB × ${totalBatches.toLocaleString()} = ${totalValuationGB.toFixed(2)} GB`,
);
console.log(`  📦 TOTAL: ${totalGBBefore.toFixed(2)} GB\n`);

// DESPUÉS del fix
const totalValAfterGB = (avgValuationFixed * totalBatches) / 1024;
const totalGBAfter = prefetchGB + totalFinancialsGB + totalValAfterGB;

console.log("✅ DESPUÉS (con fix):");
console.log(
  `  - datos_valuacion: ${avgValuationFixed} MB × ${totalBatches.toLocaleString()} = ${totalValAfterGB.toFixed(2)} GB`,
);
console.log(`  📦 TOTAL: ${totalGBAfter.toFixed(2)} GB\n`);

// Reducción
const reduction = totalGBBefore - totalGBAfter;
console.log("=".repeat(80));
console.log("💰 SAVINGS");
console.log("=".repeat(80));
console.log(
  `\n🎯 Reducción: ${reduction.toFixed(2)} GB por ejecución (${((reduction / totalGBBefore) * 100).toFixed(1)}%)`,
);
console.log(
  `🔄 Por 6 ejecuciones (spike real): ${(reduction * 6).toFixed(2)} GB ahorrados\n`,
);

// Explicación del spike
console.log("⚠️  NOTA IMPORTANTE:");
console.log(
  `El spike real de 133GB NO cuadra completamente con esta estimación:`,
);
console.log(
  `  - Estimación: ~${totalGBBefore.toFixed()} GB × 6 = ~${(totalGBBefore * 6).toFixed()} GB`,
);
console.log(`  - Spike real: 133.8 GB`);
console.log(`\nPosibles explicaciones de la diferencia:`);
console.log(
  `  1. Auditorías masivas de prices_daily (3 ejecuciones × ~10GB cada una)`,
);
console.log(`  2. Backfills históricos previos al spike`);
console.log(`  3. Otros cron jobs ejecutados el mismo día`);
console.log(`  4. Cache invalidations que forzaron re-reads\n`);

console.log(
  `✅ Lo importante: Los fixes reducen egress ~${reduction.toFixed(2)} GB por ejecución`,
);
console.log(
  `✅ Egress futuro: ~${totalGBAfter.toFixed(1)} GB por ejecución (aceptable)\n`,
);

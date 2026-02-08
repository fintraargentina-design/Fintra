/**
 * EGRESS IMPACT ESTIMATION
 *
 * Test script para estimar el impacto de egress de queries bulk
 * ANTES y DESPUÉS de los fixes aplicados.
 *
 * Usage: npx tsx scripts/test/estimate-egress-impact.ts
 */

import { supabaseAdmin } from "@/lib/supabase-admin";

interface EgressEstimate {
  query: string;
  rowCount: number;
  avgRowSizeBytes: number;
  totalSizeMB: number;
  description: string;
}

async function estimateEgress() {
  console.log("🔍 EGRESS IMPACT ESTIMATION - Post-Fix Validation\n");

  const estimates: EgressEstimate[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // ==========================================
  // 1. industry_performance (CRÍTICO)
  // ==========================================
  console.log("📊 Testing industry_performance...");

  // ANTES (sin fix): .lte("performance_date", today) - toda la historia
  const { count: industryCountBefore } = await supabaseAdmin
    .from("industry_performance")
    .select("*", { count: "exact", head: true })
    .lte("performance_date", today);

  // DESPUÉS (con fix): .eq("performance_date", today) - solo hoy
  const { count: industryCountAfter } = await supabaseAdmin
    .from("industry_performance")
    .select("*", { count: "exact", head: true })
    .eq("performance_date", today);

  const industryRowSizeBytes = 150; // ~industry + window + return + date

  estimates.push({
    query: "industry_performance (ANTES - sin fix)",
    rowCount: industryCountBefore || 0,
    avgRowSizeBytes: industryRowSizeBytes,
    totalSizeMB:
      ((industryCountBefore || 0) * industryRowSizeBytes) / (1024 * 1024),
    description: "Query sin limit - lee toda la historia",
  });

  estimates.push({
    query: "industry_performance (DESPUÉS - con fix)",
    rowCount: industryCountAfter || 0,
    avgRowSizeBytes: industryRowSizeBytes,
    totalSizeMB:
      ((industryCountAfter || 0) * industryRowSizeBytes) / (1024 * 1024),
    description: "Solo fecha actual - optimizado",
  });

  // ==========================================
  // 2. fintra_universe (OK - ya tiene paginación)
  // ==========================================
  console.log("📊 Testing fintra_universe...");

  const { count: universeCount } = await supabaseAdmin
    .from("fintra_universe")
    .select("*", { count: "exact", head: true });

  const universeRowSizeBytes = 150; // ticker + sector + industry

  estimates.push({
    query: "fintra_universe (paginado)",
    rowCount: universeCount || 0,
    avgRowSizeBytes: universeRowSizeBytes,
    totalSizeMB: ((universeCount || 0) * universeRowSizeBytes) / (1024 * 1024),
    description: "88k tickers - paginado correctamente",
  });

  // ==========================================
  // 3. datos_financieros (sample batch)
  // ==========================================
  console.log("📊 Testing datos_financieros...");

  // Simular batch de 100 tickers (batch size típico)
  const sampleTickers = await supabaseAdmin
    .from("fintra_universe")
    .select("ticker")
    .eq("is_active", true)
    .limit(100);

  const tickerList = sampleTickers.data?.map((t) => t.ticker) || [];

  // ANTES (sin fix): sin limit
  const { count: financialsCountBefore } = await supabaseAdmin
    .from("datos_financieros")
    .select("*", { count: "exact", head: true })
    .in("ticker", tickerList)
    .in("period_type", ["FY", "Q", "TTM"]);

  // DESPUÉS (con fix): limit 5000
  const financialsCountAfter = Math.min(financialsCountBefore || 0, 5000);

  const financialsRowSizeBytes = 500; // ~15 campos numéricos

  estimates.push({
    query: "datos_financieros (ANTES - 100 tickers)",
    rowCount: financialsCountBefore || 0,
    avgRowSizeBytes: financialsRowSizeBytes,
    totalSizeMB:
      ((financialsCountBefore || 0) * financialsRowSizeBytes) / (1024 * 1024),
    description: "Sin limit - todos los períodos históricos",
  });

  estimates.push({
    query: "datos_financieros (DESPUÉS - 100 tickers)",
    rowCount: financialsCountAfter,
    avgRowSizeBytes: financialsRowSizeBytes,
    totalSizeMB:
      (financialsCountAfter * financialsRowSizeBytes) / (1024 * 1024),
    description: "Limitado a 5000 rows - optimizado",
  });

  // ==========================================
  // 4. datos_valuacion (sample batch)
  // ==========================================
  console.log("📊 Testing datos_valuacion...");

  // ANTES (sin fix): sin limit
  const { count: valuationCountBefore } = await supabaseAdmin
    .from("datos_valuacion")
    .select("*", { count: "exact", head: true })
    .in("ticker", tickerList);

  // DESPUÉS (con fix): limit 1000
  const valuationCountAfter = Math.min(valuationCountBefore || 0, 1000);

  const valuationRowSizeBytes = 200; // ticker + date + 4 ratios

  estimates.push({
    query: "datos_valuacion (ANTES - 100 tickers)",
    rowCount: valuationCountBefore || 0,
    avgRowSizeBytes: valuationRowSizeBytes,
    totalSizeMB:
      ((valuationCountBefore || 0) * valuationRowSizeBytes) / (1024 * 1024),
    description: "Sin limit - todos los días históricos",
  });

  estimates.push({
    query: "datos_valuacion (DESPUÉS - 100 tickers)",
    rowCount: valuationCountAfter,
    avgRowSizeBytes: valuationRowSizeBytes,
    totalSizeMB: (valuationCountAfter * valuationRowSizeBytes) / (1024 * 1024),
    description: "Limitado a 1000 rows - optimizado",
  });

  // ==========================================
  // PRINT RESULTS
  // ==========================================
  console.log("\n" + "=".repeat(100));
  console.log("📋 EGRESS IMPACT ESTIMATION RESULTS");
  console.log("=".repeat(100) + "\n");

  estimates.forEach((est) => {
    console.log(`\n🔹 ${est.query}`);
    console.log(`   Description: ${est.description}`);
    console.log(`   Rows: ${est.rowCount.toLocaleString()}`);
    console.log(`   Avg Row Size: ${est.avgRowSizeBytes} bytes`);
    console.log(`   Total Size: ${est.totalSizeMB.toFixed(2)} MB`);
  });

  // ==========================================
  // SUMMARY PER EXECUTION
  // ==========================================
  console.log("\n" + "=".repeat(100));
  console.log("📊 EGRESS PER FULL EXECUTION (53k tickers)");
  console.log("=".repeat(100) + "\n");

  // ANTES del fix
  const industryBeforeMB = estimates[0].totalSizeMB;
  const financialsPerBatchMB = estimates[3].totalSizeMB; // 100 tickers
  const valuationPerBatchMB = estimates[5].totalSizeMB; // 100 tickers
  const universeOnceMB = estimates[2].totalSizeMB;

  const totalBatches = Math.ceil(53000 / 100); // 530 batches

  const egressBeforeGB =
    (industryBeforeMB +
      universeOnceMB +
      (financialsPerBatchMB + valuationPerBatchMB) * totalBatches) /
    1024;

  console.log("❌ ANTES (sin fixes):");
  console.log(`   - industry_performance: ${industryBeforeMB.toFixed(2)} MB`);
  console.log(`   - fintra_universe: ${universeOnceMB.toFixed(2)} MB`);
  console.log(
    `   - datos_financieros: ${financialsPerBatchMB.toFixed(2)} MB × ${totalBatches} batches = ${((financialsPerBatchMB * totalBatches) / 1024).toFixed(2)} GB`,
  );
  console.log(
    `   - datos_valuacion: ${valuationPerBatchMB.toFixed(2)} MB × ${totalBatches} batches = ${((valuationPerBatchMB * totalBatches) / 1024).toFixed(2)} GB`,
  );
  console.log(`   📦 TOTAL: ${egressBeforeGB.toFixed(2)} GB`);

  // DESPUÉS del fix
  const industryAfterMB = estimates[1].totalSizeMB;
  const financialsPerBatchAfterMB = estimates[4].totalSizeMB;
  const valuationPerBatchAfterMB = estimates[6].totalSizeMB;

  const egressAfterGB =
    (industryAfterMB +
      universeOnceMB +
      (financialsPerBatchAfterMB + valuationPerBatchAfterMB) * totalBatches) /
    1024;

  console.log("\n✅ DESPUÉS (con fixes):");
  console.log(`   - industry_performance: ${industryAfterMB.toFixed(2)} MB`);
  console.log(`   - fintra_universe: ${universeOnceMB.toFixed(2)} MB`);
  console.log(
    `   - datos_financieros: ${financialsPerBatchAfterMB.toFixed(2)} MB × ${totalBatches} batches = ${((financialsPerBatchAfterMB * totalBatches) / 1024).toFixed(2)} GB`,
  );
  console.log(
    `   - datos_valuacion: ${valuationPerBatchAfterMB.toFixed(2)} MB × ${totalBatches} batches = ${((valuationPerBatchAfterMB * totalBatches) / 1024).toFixed(2)} GB`,
  );
  console.log(`   📦 TOTAL: ${egressAfterGB.toFixed(2)} GB`);

  // IMPROVEMENT
  const reductionPercent =
    ((egressBeforeGB - egressAfterGB) / egressBeforeGB) * 100;
  const reductionGB = egressBeforeGB - egressAfterGB;

  console.log("\n" + "=".repeat(100));
  console.log("💰 SAVINGS");
  console.log("=".repeat(100));
  console.log(
    `\n🎯 Reducción: ${reductionGB.toFixed(2)} GB (${reductionPercent.toFixed(1)}%)`,
  );
  console.log(
    `🔄 Por 6 ejecuciones (spike real): ${(reductionGB * 6).toFixed(2)} GB ahorrados`,
  );
  console.log(
    `💵 Ahorro en overage: ~$${(reductionGB * 6 * 0.09).toFixed(2)} USD\n`,
  );

  // WARNING
  if (egressAfterGB > 5) {
    console.log("⚠️  WARNING: Egress sigue siendo alto (>5GB). Considerar:");
    console.log("   - Reducir batch size de 100 → 50 tickers");
    console.log("   - Implementar caching Redis para universe/industry data");
    console.log("   - Usar materialized views para datos agregados\n");
  } else {
    console.log("✅ Egress optimizado - aceptable para operación diaria\n");
  }
}

estimateEgress().catch(console.error);

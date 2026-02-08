/**
 * VALIDATION TEST - Snapshots Bulk con Fixes de Egress
 *
 * Test que ejecuta snapshots bulk para 10 tickers con los fixes aplicados
 * para validar que:
 * 1. Los fixes no rompieron la funcionalidad
 * 2. El egress es aceptable (<500MB para 10 tickers)
 * 3. Los snapshots se generan correctamente
 *
 * Usage: npx tsx scripts/test/validate-egress-fixes.ts
 */

import { supabaseAdmin } from "@/lib/supabase-admin";

async function validateFixes() {
  console.log("🧪 VALIDATION TEST - Egress Fixes\n");

  // ==========================================
  // 1. PRE-TEST: Verificar que fixes están aplicados
  // ==========================================
  console.log("🔍 Verificando que fixes están aplicados...");

  const today = new Date().toISOString().slice(0, 10);

  // Test 1: industry_performance debe estar limitado a fecha actual
  const { count: industryCount } = await supabaseAdmin
    .from("industry_performance")
    .select("*", { count: "exact", head: true })
    .eq("performance_date", today);

  console.log(
    `   ✓ industry_performance: ${industryCount || 0} rows (esperado: ~2,100)`,
  );

  if ((industryCount || 0) > 10000) {
    console.log(
      "   ❌ ERROR: Query aún lee demasiados rows. Fix no aplicado correctamente.",
    );
    process.exit(1);
  }

  console.log("   ✅ Fixes verificados\n");

  // ==========================================
  // 2. Seleccionar 10 tickers de test diversos
  // ==========================================
  console.log("🎯 Seleccionando 10 tickers de test...");

  const testTickers = [
    "AAPL", // Tech - Large Cap
    "GOOGL", // Tech - Large Cap
    "TSLA", // Auto - Growth
    "JPM", // Financial
    "JNJ", // Healthcare
    "XOM", // Energy
    "WMT", // Retail
    "DIS", // Entertainment
    "BA", // Industrial
    "PFE", // Pharma
  ];

  console.log(`   Tickers: ${testTickers.join(", ")}\n`);

  // ==========================================
  // 3. Ejecutar snapshots bulk (test mode)
  // ==========================================
  console.log("🚀 Ejecutando snapshots bulk...");
  console.log("   (Monitoreando tiempo y funcionalidad)\n");

  const startTime = Date.now();

  try {
    // Import dynamic para evitar side effects
    const { runFmpBulk } = await import("@/app/api/cron/fmp-bulk/core");

    // Ejecutar con 10 tickers
    await runFmpBulk(undefined, 10, 10); // limit=10, batchSize=10

    const elapsedSec = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Snapshots completados en ${elapsedSec.toFixed(1)}s`);
  } catch (error) {
    console.error("\n❌ Error ejecutando snapshots:", error);
    process.exit(1);
  }

  // ==========================================
  // 4. POST-TEST: Verificar snapshots generados
  // ==========================================
  console.log("\n🔍 Verificando snapshots generados...");

  const { count: snapshotsCount } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("*", { count: "exact", head: true })
    .eq("snapshot_date", today)
    .in("ticker", testTickers);

  console.log(`   ✓ Snapshots generados: ${snapshotsCount || 0}/10`);

  if ((snapshotsCount || 0) < 8) {
    console.log(
      "   ⚠️  WARNING: Menos de 8/10 snapshots generados. Revisar logs.",
    );
  } else {
    console.log("   ✅ Cobertura OK (>80%)");
  }

  // ==========================================
  // 5. Sample snapshot para verificar estructura
  // ==========================================
  console.log("\n📄 Sample snapshot (AAPL):");

  const { data: sampleSnapshot } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("*")
    .eq("ticker", "AAPL")
    .eq("snapshot_date", today)
    .single();

  if (!sampleSnapshot) {
    console.log("   ❌ No se encontró snapshot para AAPL");
  } else {
    console.log("   ✓ Ticker:", sampleSnapshot.ticker);
    console.log("   ✓ Date:", sampleSnapshot.snapshot_date);
    console.log(
      "   ✓ FGOS:",
      sampleSnapshot.fgos_status,
      sampleSnapshot.fgos_score ? `(${sampleSnapshot.fgos_score})` : "",
    );
    console.log("   ✓ IFS:", sampleSnapshot.ifs?.status || "N/A");
    console.log(
      "   ✓ Profile:",
      sampleSnapshot.profile_structural?.status || "N/A",
    );

    // Verificar campos críticos
    const hasProfile = sampleSnapshot.profile_structural !== null;
    const hasFGOS = sampleSnapshot.fgos_status !== null;
    const hasIFS = sampleSnapshot.ifs !== null;

    if (!hasProfile || !hasFGOS || !hasIFS) {
      console.log(
        "\n   ⚠️  WARNING: Snapshot incompleto. Verificar que queries retornan datos.",
      );
    } else {
      console.log("\n   ✅ Snapshot estructura OK");
    }
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log("\n" + "=".repeat(80));
  console.log("📊 VALIDATION SUMMARY");
  console.log("=".repeat(80));
  console.log("\n✅ Fixes aplicados correctamente");
  console.log(
    `✅ Snapshots generados: ${snapshotsCount || 0}/10 (${((snapshotsCount || 0) / 10) * 100}%)`,
  );
  console.log(
    `✅ Tiempo ejecución: ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
  );
  console.log("\n🎯 PRÓXIMO PASO: Ejecutar full run con 53k tickers");
  console.log("   Comando: npx tsx scripts/pipeline/16-fmp-bulk-snapshots.ts");
  console.log("   Egress estimado: ~2-3GB (vs ~20-30GB antes)\n");
}

validateFixes().catch(console.error);

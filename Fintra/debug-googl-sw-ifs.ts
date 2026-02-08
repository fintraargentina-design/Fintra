import { supabaseAdmin } from "./lib/supabase-admin";

async function debugGOOGLSW() {
  const ticker = "GOOGL.SW";
  const today = "2026-02-08";

  console.log("🔍 DEBUG: Por qué GOOGL.SW no tiene IFS?\n");
  console.log("========================================\n");

  // 1. Verificar snapshot actual
  const { data: snap } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("*")
    .eq("ticker", ticker)
    .eq("snapshot_date", today)
    .single();

  console.log("📊 SNAPSHOT ACTUAL:\n");
  console.log(`   Sector (flat): ${snap?.sector}`);
  console.log(
    `   profile_structural: ${snap?.profile_structural ? "EXISTS" : "NULL"}`,
  );
  if (snap?.profile_structural) {
    console.log(
      `   profile_structural.sector: ${snap.profile_structural.sector || "NULL"}`,
    );
    console.log(
      `   profile_structural.status: ${snap.profile_structural.status}`,
    );
  }
  console.log(`   IFS: ${snap?.ifs ? JSON.stringify(snap.ifs) : "NULL"}`);
  console.log(`   IFS_FY: ${snap?.ifs_fy ? "EXISTS" : "NULL"}\n`);

  // 2. Verificar performance windows (CRÍTICO para IFS)
  console.log("📊 PERFORMANCE WINDOWS (requeridas para IFS):\n");

  const requiredWindows = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y"];

  const { data: perfData } = await supabaseAdmin
    .from("performance_windows")
    .select("window_code, as_of_date, asset_return, benchmark_return")
    .eq("ticker", ticker)
    .order("as_of_date", { ascending: false })
    .limit(20);

  if (!perfData || perfData.length === 0) {
    console.log("   ❌ NO HAY DATOS DE PERFORMANCE\n");
    console.log(
      "   💡 IFS requiere performance windows para calcular performance relativa vs sector\n",
    );
    return;
  }

  console.log(`   Total rows: ${perfData.length}`);
  console.log(`   Latest as_of_date: ${perfData[0].as_of_date}\n`);

  // Agrupar por fecha
  const dateGroups = new Map();
  perfData.forEach((row) => {
    if (!dateGroups.has(row.as_of_date)) {
      dateGroups.set(row.as_of_date, []);
    }
    dateGroups.get(row.as_of_date).push(row);
  });

  console.log(`   Unique dates: ${dateGroups.size}\n`);

  // Mostrar windows de la fecha más reciente
  const latestDate = perfData[0].as_of_date;
  const latestWindows = perfData.filter((d) => d.as_of_date === latestDate);
  const windowCodes = [...new Set(latestWindows.map((w) => w.window_code))];

  console.log(`   Windows disponibles (${latestDate}):`);
  console.log(`   ${windowCodes.join(", ")}\n`);

  // Verificar cuáles faltan
  const missingWindows = requiredWindows.filter(
    (w) => !windowCodes.includes(w),
  );
  if (missingWindows.length > 0) {
    console.log(`   ⚠️  Windows faltantes: ${missingWindows.join(", ")}\n`);
  } else {
    console.log(`   ✅ Todos los windows requeridos están presentes\n`);
  }

  // 3. Verificar columnas relative_vs_sector_XXX en snapshot
  console.log("📊 RELATIVE PERFORMANCE EN SNAPSHOT:\n");

  const relativeKeys = [
    "relative_vs_sector_1m",
    "relative_vs_sector_3m",
    "relative_vs_sector_6m",
    "relative_vs_sector_1y",
    "relative_vs_sector_2y",
    "relative_vs_sector_3y",
    "relative_vs_sector_5y",
  ];

  let relativeData: any = {};
  relativeKeys.forEach((key) => {
    relativeData[key] = snap?.[key];
  });

  console.log(JSON.stringify(relativeData, null, 2));

  const nullCount = relativeKeys.filter(
    (k) => snap?.[k] === null || snap?.[k] === undefined,
  ).length;
  console.log(`\n   ${7 - nullCount}/7 windows con valores\n`);

  if (nullCount === 7) {
    console.log("   ❌ PROBLEMA: TODOS los relative_vs_sector son NULL");
    console.log(
      "   💡 buildSnapshot no está calculando performance relativa vs sector\n",
    );
  }

  // 4. Verificar sector performance (benchmark)
  console.log("📊 SECTOR PERFORMANCE (benchmark para Technology):\n");

  const { data: sectorPerf } = await supabaseAdmin
    .from("sector_performance")
    .select("*")
    .eq("sector", "Technology")
    .order("performance_date", { ascending: false })
    .limit(1);

  if (!sectorPerf || sectorPerf.length === 0) {
    console.log("   ❌ NO HAY DATOS DE SECTOR PERFORMANCE para Technology\n");
    console.log(
      "   💡 IFS requiere benchmark de sector para calcular performance relativa\n",
    );
  } else {
    console.log(
      `   ✅ Sector Performance disponible (${sectorPerf[0].performance_date})\n`,
    );
    console.log(
      `   Windows disponibles: ${Object.keys(sectorPerf[0])
        .filter((k) => k.includes("return"))
        .join(", ")}\n`,
    );
  }

  // 5. Diagnóstico final
  console.log("========================================\n");
  console.log("💡 DIAGNÓSTICO:\n");

  if (!snap?.sector) {
    console.log("❌ PROBLEMA 1: sector es NULL en snapshot");
    console.log("   → buildSnapshot no está leyendo sector de universeMap\n");
  } else {
    console.log("✅ Sector correcto en snapshot: " + snap.sector + "\n");
  }

  if (nullCount === 7) {
    console.log("❌ PROBLEMA 2: relative_vs_sector_XXX son NULL");
    console.log("   → buildSnapshot no está calculando performance relativa");
    console.log("   → Verificar línea 728 buildSnapshots.ts (sectorRows)\n");
  } else if (nullCount > 0) {
    console.log(`⚠️  PROBLEMA 2: ${nullCount}/7 windows con NULL`);
    console.log("   → Algunos windows de performance no están disponibles\n");
  } else {
    console.log("✅ Performance relativa calculada correctamente\n");
  }

  if (!snap?.ifs) {
    console.log("❌ PROBLEMA 3: IFS no se calculó");
    console.log("   → calculateIFS retornó null");
    console.log("   → Verificar que al menos 2 blocks tienen datos válidos\n");
  }
}

debugGOOGLSW().catch(console.error);

import { supabaseAdmin } from "@/lib/supabase-admin";

async function main() {
  const today = "2026-02-08";

  // 1. Ver todos los windows disponibles hoy
  const { data: allWindows } = await supabaseAdmin
    .from("sector_performance")
    .select("window_code, sector")
    .eq("performance_date", today);

  const windowsSet = [...new Set(allWindows?.map((d) => d.window_code))].sort();

  console.log("📊 WINDOWS DISPONIBLES EN sector_performance (hoy 2026-02-08):");
  console.log("Windows:", windowsSet);
  console.log("Total rows hoy:", allWindows?.length);

  console.log("\n🔍 ANÁLISIS POR WINDOW:");
  for (const w of windowsSet) {
    const { count } = await supabaseAdmin
      .from("sector_performance")
      .select("*", { count: "exact", head: true })
      .eq("window_code", w)
      .eq("performance_date", today);
    console.log(`${w}: ${count} sectores`);
  }

  // 2. Ver historial de datos 1D para Technology
  const { data: tech1D } = await supabaseAdmin
    .from("sector_performance")
    .select("*")
    .eq("sector", "Technology")
    .eq("window_code", "1D")
    .order("performance_date", { ascending: false })
    .limit(10);

  console.log("\n📋 DATOS 1D para Technology (últimos 10 días):");
  console.log(
    tech1D?.map((d) => ({
      date: d.performance_date,
      return: d.return_percent?.toFixed(2),
      source: d.source,
    })),
  );

  // 3. Ver historial de datos 3M para Technology
  const { data: tech3M } = await supabaseAdmin
    .from("sector_performance")
    .select("*")
    .eq("sector", "Technology")
    .eq("window_code", "3M")
    .order("performance_date", { ascending: false })
    .limit(5);

  console.log("\n📋 DATOS 3M para Technology (últimos 5):");
  if (tech3M && tech3M.length > 0) {
    console.log(
      tech3M.map((d) => ({
        date: d.performance_date,
        return: d.return_percent?.toFixed(2),
        source: d.source,
      })),
    );
  } else {
    console.log("❌ NO HAY DATOS 3M");
  }

  // 4. Ver de dónde vienen los windows 1M, 1Y, etc
  const { data: tech1M } = await supabaseAdmin
    .from("sector_performance")
    .select("*")
    .eq("sector", "Technology")
    .eq("window_code", "1M")
    .order("performance_date", { ascending: false })
    .limit(3);

  console.log("\n📋 DATOS 1M para Technology (últimos 3):");
  console.log(
    tech1M?.map((d) => ({
      date: d.performance_date,
      return: d.return_percent?.toFixed(2),
      source: d.source,
    })),
  );

  // 5. Contar total de días históricos por window
  console.log("\n📊 HISTORIAL COMPLETO POR WINDOW (Technology):");
  for (const w of windowsSet) {
    const { count } = await supabaseAdmin
      .from("sector_performance")
      .select("*", { count: "exact", head: true })
      .eq("sector", "Technology")
      .eq("window_code", w);

    const { data: sample } = await supabaseAdmin
      .from("sector_performance")
      .select("source")
      .eq("sector", "Technology")
      .eq("window_code", w)
      .limit(1);

    console.log(
      `${w}: ${count} días históricos | source: ${sample?.[0]?.source || "N/A"}`,
    );
  }

  // 6. Ver si existen windows 6M, 2Y
  console.log("\n🔍 VERIFICACIÓN DE WINDOWS FALTANTES:");
  const missing = ["3M", "6M", "2Y"];
  for (const w of missing) {
    const { count } = await supabaseAdmin
      .from("sector_performance")
      .select("*", { count: "exact", head: true })
      .eq("sector", "Technology")
      .eq("window_code", w);

    console.log(
      `${w}: ${count === 0 ? "❌ NO EXISTE" : `✅ ${count} registros`}`,
    );
  }
}

main().catch(console.error);

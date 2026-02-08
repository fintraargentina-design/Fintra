import { supabaseAdmin } from "@/lib/supabase-admin";

async function main() {
  console.log("🔍 VERIFICANDO FUENTES DE DATOS PARA BACKFILL\n");

  // 1. performance_windows
  const { data: perfSample } = await supabaseAdmin
    .from("performance_windows")
    .select("*")
    .limit(5);

  console.log("1. performance_windows (sample):");
  console.log(JSON.stringify(perfSample, null, 2));

  // 2. Verificar si podemos agregar por sector desde tickers individuales
  const { data: techTickers } = await supabaseAdmin
    .from("fintra_universe")
    .select("ticker")
    .eq("sector", "Technology")
    .eq("is_active", true)
    .limit(100);

  console.log("\n2. Tickers Technology activos:", techTickers?.length);

  // 3. Verificar si FMP historical-sectors-performance tiene más historia
  console.log("\n3. Opciones de backfill:");
  console.log("   A) Agregar desde performance_windows individuales");
  console.log("   B) Derivar desde FMP historical-sectors-performance");
  console.log("   C) Calcular desde prices_daily (si existen)");

  // 4. Ver qué tenemos en sector_performance histórico
  const { data: sectorHist } = await supabaseAdmin
    .from("sector_performance")
    .select("sector, window_code, performance_date")
    .eq("sector", "Technology")
    .order("performance_date", { ascending: true })
    .limit(10);

  console.log("\n4. sector_performance histórico (Technology):");
  console.log(sectorHist);

  // 5. Verificar estructura de industry_performance (puede tener 1D)
  const { data: indPerf } = await supabaseAdmin
    .from("industry_performance")
    .select("*")
    .limit(3);

  console.log("\n5. industry_performance (sample):");
  console.log(JSON.stringify(indPerf, null, 2));
}

main().catch(console.error);

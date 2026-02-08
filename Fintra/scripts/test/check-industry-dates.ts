import { supabaseAdmin } from "@/lib/supabase-admin";

async function checkDates() {
  console.log("📅 Verificando fechas disponibles en industry_performance...\n");

  // Últimas fechas
  const { data: recentDates } = await supabaseAdmin
    .from("industry_performance")
    .select("performance_date")
    .order("performance_date", { ascending: false })
    .limit(10);

  console.log("Últimas 10 fechas:");
  const uniqueDates = [...new Set(recentDates?.map((r) => r.performance_date))];
  uniqueDates.forEach((date) => console.log(`  - ${date}`));

  // Check hoy
  const today = "2026-02-08";
  const { count: todayCount } = await supabaseAdmin
    .from("industry_performance")
    .select("*", { count: "exact", head: true })
    .eq("performance_date", today);

  console.log(`\n📊 Rows para ${today}: ${todayCount || 0}`);

  // Primera fecha disponible
  const { data: firstDate } = await supabaseAdmin
    .from("industry_performance")
    .select("performance_date")
    .order("performance_date", { ascending: true })
    .limit(1);

  console.log(`📅 Primera fecha: ${firstDate?.[0]?.performance_date || "N/A"}`);

  // Total rows
  const { count: totalCount } = await supabaseAdmin
    .from("industry_performance")
    .select("*", { count: "exact", head: true });

  console.log(`📦 Total rows: ${totalCount?.toLocaleString() || 0}\n`);
}

checkDates().catch(console.error);

// Audit: IFS Memory Coverage
import { loadEnv } from "./utils/load-env";
loadEnv();

import { supabaseAdmin } from "@/lib/supabase-admin";

async function auditIFSMemoryCoverage() {
  console.log("🔍 Auditoría de Cobertura IFS Memory\n");

  // 1. Total snapshots con IFS
  const { data: allIFS, error: errorIFS } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, ifs, ifs_memory")
    .not("ifs", "is", null)
    .order("ticker", { ascending: true });

  if (errorIFS) {
    console.error("❌ Error fetching IFS snapshots:", errorIFS);
    return;
  }

  console.log(`📊 Total snapshots con IFS: ${allIFS.length}\n`);

  // 2. Agrupar por ticker (tomar último snapshot)
  const tickerMap = new Map<string, any>();
  for (const row of allIFS) {
    if (!tickerMap.has(row.ticker)) {
      tickerMap.set(row.ticker, row);
    }
  }

  const uniqueTickers = Array.from(tickerMap.values());
  console.log(`📈 Tickers únicos con IFS: ${uniqueTickers.length}\n`);

  // 3. Clasificar por estado de ifs_memory
  let withMemory = 0;
  let withTimeline = 0;
  let withoutMemory = 0;
  let memoryButNoTimeline = 0;

  const tickersWithTimeline: string[] = [];
  const tickersWithoutTimeline: string[] = [];

  for (const row of uniqueTickers) {
    if (row.ifs_memory) {
      withMemory++;
      if (row.ifs_memory.timeline && row.ifs_memory.timeline.length > 0) {
        withTimeline++;
        tickersWithTimeline.push(row.ticker);
      } else {
        memoryButNoTimeline++;
        tickersWithoutTimeline.push(row.ticker);
      }
    } else {
      withoutMemory++;
      tickersWithoutTimeline.push(row.ticker);
    }
  }

  // 4. Calcular percentages
  const memoryPercent = (withMemory / uniqueTickers.length) * 100;
  const timelinePercent = (withTimeline / uniqueTickers.length) * 100;

  // 5. Reporte
  console.log("=".repeat(60));
  console.log("📊 RESULTADOS DE COBERTURA");
  console.log("=".repeat(60));
  console.log(
    `\n🟢 Con ifs_memory:                 ${withMemory.toLocaleString().padStart(8)} (${memoryPercent.toFixed(1)}%)`,
  );
  console.log(
    `   └─ Con timeline válido:         ${withTimeline.toLocaleString().padStart(8)} (${timelinePercent.toFixed(1)}%)`,
  );
  console.log(
    `   └─ Sin timeline (solo metadata): ${memoryButNoTimeline.toLocaleString().padStart(8)}`,
  );
  console.log(
    `\n🔴 Sin ifs_memory:                 ${withoutMemory.toLocaleString().padStart(8)} (${((withoutMemory / uniqueTickers.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `\n📈 Total tickers con IFS:          ${uniqueTickers.length.toLocaleString().padStart(8)}`,
  );
  console.log("=".repeat(60));

  // 6. Muestra de tickers con timeline
  if (tickersWithTimeline.length > 0) {
    console.log(`\n✅ Muestra de tickers CON timeline (primeros 20):`);
    for (const ticker of tickersWithTimeline.slice(0, 20)) {
      const row = tickerMap.get(ticker);
      const timeline = row?.ifs_memory?.timeline || [];
      const years = row?.ifs_memory?.observed_years || 0;
      console.log(
        `   ${ticker.padEnd(8)} | ${years} años | ${timeline.join(" → ")}`,
      );
    }
  }

  // 7. Muestra de tickers sin timeline
  if (tickersWithoutTimeline.length > 0) {
    console.log(`\n❌ Muestra de tickers SIN timeline (primeros 10):`);
    for (const ticker of tickersWithoutTimeline.slice(0, 10)) {
      const row = tickerMap.get(ticker);
      const hasMemory = row?.ifs_memory
        ? "(tiene ifs_memory pero sin timeline)"
        : "(sin ifs_memory)";
      console.log(`   ${ticker.padEnd(8)} ${hasMemory}`);
    }
  }

  // 8. Análisis por posición IFS
  console.log("\n📊 Distribución por Posición IFS:");
  const byPosition = { leader: 0, follower: 0, laggard: 0 };
  const byPositionWithTimeline = { leader: 0, follower: 0, laggard: 0 };

  for (const row of uniqueTickers) {
    const position = row.ifs?.position;
    if (
      position &&
      (position === "leader" ||
        position === "follower" ||
        position === "laggard")
    ) {
      byPosition[position as "leader" | "follower" | "laggard"]++;
      if (row.ifs_memory?.timeline?.length > 0) {
        byPositionWithTimeline[position as "leader" | "follower" | "laggard"]++;
      }
    }
  }

  console.log(
    `   Leader:   ${byPositionWithTimeline.leader}/${byPosition.leader} con timeline (${byPosition.leader > 0 ? ((byPositionWithTimeline.leader / byPosition.leader) * 100).toFixed(1) : "0"}%)`,
  );
  console.log(
    `   Follower: ${byPositionWithTimeline.follower}/${byPosition.follower} con timeline (${byPosition.follower > 0 ? ((byPositionWithTimeline.follower / byPosition.follower) * 100).toFixed(1) : "0"}%)`,
  );
  console.log(
    `   Laggard:  ${byPositionWithTimeline.laggard}/${byPosition.laggard} con timeline (${byPosition.laggard > 0 ? ((byPositionWithTimeline.laggard / byPosition.laggard) * 100).toFixed(1) : "0"}%)`,
  );

  // 9. Conclusión
  console.log("\n" + "=".repeat(60));
  if (timelinePercent >= 95) {
    console.log("✅ PIPELINE FUNCIONANDO CORRECTAMENTE (>95% con timeline)");
  } else if (timelinePercent >= 50) {
    console.log("⚠️ PIPELINE PARCIAL (50-95% con timeline)");
  } else {
    console.log("❌ PIPELINE BROKEN (<50% con timeline)");
  }
  console.log("=".repeat(60) + "\n");
}

auditIFSMemoryCoverage().catch(console.error);

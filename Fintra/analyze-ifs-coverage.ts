import { supabaseAdmin } from "./lib/supabase-admin";

async function analyzeIFSCoverage() {
  const today = "2026-02-07";

  console.log("🔍 ANÁLISIS DE COBERTURA IFS vs SECTOR\n");
  console.log("========================================\n");

  // 1. Cobertura general
  const { count: totalSnaps } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("*", { count: "exact", head: true })
    .eq("snapshot_date", today);

  const { count: withIFS } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("*", { count: "exact", head: true })
    .eq("snapshot_date", today)
    .not("ifs", "is", null);

  console.log("📊 COBERTURA GENERAL:");
  console.log(`   Total snapshots: ${totalSnaps}`);
  console.log(
    `   Con IFS: ${withIFS} (${((withIFS / totalSnaps) * 100).toFixed(1)}%)`,
  );
  console.log(
    `   Sin IFS: ${totalSnaps - withIFS} (${(((totalSnaps - withIFS) / totalSnaps) * 100).toFixed(1)}%)\n`,
  );

  // 2. Snapshots con IFS pero SIN SECTOR en profile_structural
  const { data: ifsWithoutSector } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, ifs, profile_structural")
    .eq("snapshot_date", today)
    .not("ifs", "is", null)
    .limit(10);

  console.log("📊 SAMPLE DE SNAPSHOTS CON IFS:\n");
  let countWithSector = 0;
  let countWithoutSector = 0;

  for (const snap of ifsWithoutSector || []) {
    const hasSector =
      snap.profile_structural?.sector !== null &&
      snap.profile_structural?.sector !== undefined;
    const hasIFS = snap.ifs !== null;

    if (hasSector) countWithSector++;
    else countWithoutSector++;

    console.log(
      `${snap.ticker.padEnd(12)} → IFS: ${hasIFS ? "✅" : "❌"} | Sector: ${hasSector ? snap.profile_structural.sector : "NULL"}`,
    );
  }

  console.log(`\n   Con sector: ${countWithSector}/10`);
  console.log(`   Sin sector: ${countWithoutSector}/10\n`);

  // 3. Verificar TODOS los snapshots con IFS
  const { count: ifsWithSectorCount } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("*", { count: "exact", head: true })
    .eq("snapshot_date", today)
    .not("ifs", "is", null)
    .not("profile_structural->sector", "is", null);

  const { count: ifsWithoutSectorCount } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("*", { count: "exact", head: true })
    .eq("snapshot_date", today)
    .not("ifs", "is", null)
    .filter("profile_structural->sector", "is", null);

  console.log("📊 ANÁLISIS COMPLETO - SNAPSHOTS CON IFS:\n");
  console.log(`   Con IFS + Con Sector: ${ifsWithSectorCount}`);
  console.log(`   Con IFS + Sin Sector: ${ifsWithoutSectorCount}`);
  console.log(
    `   Total con IFS: ${ifsWithSectorCount + ifsWithoutSectorCount}\n`,
  );

  if (ifsWithoutSectorCount > 0) {
    console.log("   ⚠️  INCONSISTENCIA DETECTADA:");
    console.log(
      `   ${ifsWithoutSectorCount} snapshots tienen IFS calculado SIN SECTOR en profile_structural\n`,
    );

    // Obtener samples de esta inconsistencia
    const { data: samples } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ticker, ifs, profile_structural, sector")
      .eq("snapshot_date", today)
      .not("ifs", "is", null)
      .filter("profile_structural->sector", "is", null)
      .limit(20);

    console.log(
      "   📋 Samples de tickers con IFS pero sin sector en profile_structural:\n",
    );
    for (const s of samples || []) {
      console.log(
        `   ${s.ticker.padEnd(12)} → sector (flat): ${s.sector || "NULL"} | IFS: ${s.ifs.position}`,
      );
    }
  }

  // 4. Verificar columna flat "sector" vs profile_structural->sector
  const { data: flatSectorSample } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, sector, profile_structural")
    .eq("snapshot_date", today)
    .not("ifs", "is", null)
    .limit(10);

  console.log(
    "\n\n📊 COMPARACIÓN: sector (columna flat) vs profile_structural->sector:\n",
  );
  for (const s of flatSectorSample || []) {
    const flatSector = s.sector;
    const psSector = s.profile_structural?.sector;
    const match = flatSector === psSector ? "✅" : "⚠️";

    console.log(
      `   ${match} ${s.ticker.padEnd(12)} → Flat: ${flatSector || "NULL".padEnd(25)} | PS: ${psSector || "NULL"}`,
    );
  }
}

analyzeIFSCoverage().catch(console.error);

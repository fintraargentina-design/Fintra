// Fintra/app/api/cron/fmp-bulk/upsertSnapshots.ts

export async function upsertSnapshots(supabase: any, rows: any[]) {
  if (rows.length === 0) return;

  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await processSnapshotChunk(supabase, chunk);
  }
}

async function processSnapshotChunk(supabase: any, rows: any[]) {
  const today = rows[0].snapshot_date;
  const tickers = rows.map((r) => r.ticker);

  console.log(
    `[UPSERT] Processing chunk of ${tickers.length} tickers for ${today}`,
  );

  // 1. Protection: On-Demand & Idempotency
  // Check if we already have data for TODAY (idempotency)
  const { data: existingSnapshots } = await supabase
    .from("fintra_snapshots")
    .select("ticker, sector, profile_structural, snapshot_date")
    .in("ticker", tickers)
    .eq("snapshot_date", today);

  const protectionMap = new Map<string, any>();

  if (existingSnapshots) {
    const now = new Date();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    for (const existing of existingSnapshots) {
      const ps = existing.profile_structural;
      if (ps?.source === "on_demand" && ps?.last_updated) {
        const lastUpdate = new Date(ps.last_updated).getTime();
        // Check freshness (< 24h)
        if (now.getTime() - lastUpdate < ONE_DAY_MS) {
          protectionMap.set(existing.ticker, existing);
          console.log(`[${existing.ticker}] Protected on-demand data (fresh)`);
        }
      }
    }
  }

  // 2. Recovery: Missing Sector/Profile (NEVER overwrite with null)
  // Identify tickers that are missing critical structural data in the NEW rows
  const missingStructural = rows.filter(
    (r) => !r.sector || !r.profile_structural,
  );
  const recoveryMap = new Map<string, any>();

  if (missingStructural.length > 0) {
    const missingTickers = missingStructural.map((r) => r.ticker);

    // Fetch recent history (last 30 days) to find a backup
    // We intentionally exclude 'today' to avoid self-referencing if we are re-running a buggy batch
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);
    const minDateStr = lookbackDate.toISOString().slice(0, 10);

    const { data: history } = await supabase
      .from("fintra_snapshots")
      .select("ticker, sector, profile_structural, snapshot_date")
      .in("ticker", missingTickers)
      .lt("snapshot_date", today) // Strictly past data
      .gte("snapshot_date", minDateStr)
      .order("snapshot_date", { ascending: false });

    if (history) {
      for (const row of history) {
        if (!recoveryMap.has(row.ticker)) {
          // First one found is the latest due to sort order
          recoveryMap.set(row.ticker, row);
        }
      }
    }
  }

  // 3. Merge & Upsert
  const finalRows = rows.map((row) => {
    // Priority 1: On-Demand Protection (highest)
    const protectedData = protectionMap.get(row.ticker);
    if (protectedData) {
      // Preserve existing profile and sector
      return {
        ...row,
        sector: protectedData.sector,
        profile_structural: protectedData.profile_structural,
        // Note: We deliberately overwrite other fields (metrics, ratios) from bulk
        // as they might be newer/better, and "profile" scope is strict.
      };
    }

    // Priority 2: Recovery from History (if missing in current)
    const recoveryData = recoveryMap.get(row.ticker);
    let sector = row.sector;
    let profile = row.profile_structural;

    if (!sector && recoveryData?.sector) {
      sector = recoveryData.sector;
    }
    if (!profile && recoveryData?.profile_structural) {
      profile = recoveryData.profile_structural;
    }

    return {
      ...row,
      sector,
      profile_structural: profile,
    };
  });

  // 4. Perform the Upsert
  const { error } = await supabase.from("fintra_snapshots").upsert(finalRows, {
    onConflict: "ticker,snapshot_date,engine_version",
  });

  if (error) {
    console.error(
      `[UPSERT] FAILED for chunk of ${tickers.length} tickers:`,
      error.message,
    );
    // Log individual tickers for debugging
    tickers.forEach((ticker) => {
      console.error(
        `[${ticker}] [${new Date().toISOString()}] UPSERT FAILED: ${error.message}`,
      );
    });
    throw error;
  }

  console.log(
    `[UPSERT] SUCCESS: ${tickers.length} tickers upserted for ${today}`,
  );
}

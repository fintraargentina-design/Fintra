import { loadEnv } from "../utils/load-env";

loadEnv();

// Dynamic import will be used inside main to ensure env vars are loaded first
// import { supabaseAdmin } from '@/lib/supabase-admin';

type SnapshotRow = {
  ticker: string;
  snapshot_date: string;
  engine_version: string;
  ifs: {
    position?: "leader" | "follower" | "laggard";
  } | null;
};

type IfsMemory = {
  window_years: number;
  observed_years: number;
  distribution: {
    leader: number;
    follower: number;
    laggard: number;
  };
  timeline?: ("leader" | "follower" | "laggard")[];
  current_streak: {
    position: "leader" | "follower" | "laggard" | null;
    years: number;
  };
};

async function main() {
  console.log("🚀 Starting IFS Memory Aggregator...");

  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  // 1. Fetch all snapshots with IFS data
  const allRows: SnapshotRow[] = [];
  let page = 0;
  const pageSize = 1000; // Match Supabase default limit to avoid skipping rows

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ticker, snapshot_date, engine_version, ifs")
      .not("ifs", "is", null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("❌ Error fetching snapshots:", error);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    // Validate IFS structure slightly (must have position)
    const validRows = data.filter((r: any) => r.ifs?.position);
    allRows.push(...validRows);

    console.log(
      `  Fetched ${data.length} rows (total valid: ${allRows.length})...`,
    );

    if (data.length < pageSize) break;
    page++;
  }

  console.log(`✅ Loaded ${allRows.length} valid snapshots.`);

  // 2. Group by Ticker
  const byTicker = new Map<string, SnapshotRow[]>();
  for (const row of allRows) {
    if (!byTicker.has(row.ticker)) {
      byTicker.set(row.ticker, []);
    }
    byTicker.get(row.ticker)?.push(row);
  }

  console.log(`📊 Processing ${byTicker.size} tickers...`);

  const updates: any[] = [];

  for (const [ticker, rows] of byTicker.entries()) {
    // 3. Sort by date DESC (newest → oldest)
    rows.sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));

    // The most recent snapshot (the one we will update)
    const latestSnapshot = rows[0];

    // 4. Take up to window_years (5) most recent snapshots with valid IFS
    // This is a MAXIMUM lookback, not a minimum requirement
    const window_years = 5;
    const recentSnapshots = rows.slice(0, window_years);

    // 5. Compute Metrics from historical snapshots
    const distribution = {
      leader: 0,
      follower: 0,
      laggard: 0,
    };

    for (const snap of recentSnapshots) {
      const pos = snap.ifs?.position;
      if (pos === "leader") distribution.leader++;
      else if (pos === "follower") distribution.follower++;
      else if (pos === "laggard") distribution.laggard++;
    }

    // Current Streak (from most recent backwards)
    let streakYears = 0;
    let streakPos: "leader" | "follower" | "laggard" | null = null;

    if (recentSnapshots.length > 0) {
      streakPos = recentSnapshots[0].ifs?.position || null;
      if (streakPos) {
        for (const snap of recentSnapshots) {
          if (snap.ifs?.position === streakPos) {
            streakYears++;
          } else {
            break;
          }
        }
      }
    }

    // Build timeline: reverse to get chronological order (oldest → newest)
    const timeline =
      recentSnapshots.length > 0
        ? recentSnapshots
            .map((snap) => snap.ifs?.position)
            .filter(
              (pos): pos is "leader" | "follower" | "laggard" =>
                pos !== undefined,
            )
            .reverse()
        : undefined;

    const memory: IfsMemory = {
      window_years: 5,
      observed_years: recentSnapshots.length,
      distribution,
      timeline,
      current_streak: {
        position: streakPos,
        years: streakYears,
      },
    };

    // 7. Prepare Update
    updates.push({
      ticker: latestSnapshot.ticker,
      snapshot_date: latestSnapshot.snapshot_date,
      engine_version: latestSnapshot.engine_version,
      ifs_memory: memory,
    });
  }

  // 8. Execute Updates (Using UPDATE instead of UPSERT to avoid NOT NULL constraints on other columns)
  if (updates.length > 0) {
    console.log(`💾 Persisting ifs_memory for ${updates.length} tickers...`);

    const concurrency = 20;
    let processed = 0;

    for (let i = 0; i < updates.length; i += concurrency) {
      const batch = updates.slice(i, i + concurrency);

      await Promise.all(
        batch.map(async (upd) => {
          const { error } = await supabaseAdmin
            .from("fintra_snapshots")
            .update({ ifs_memory: upd.ifs_memory })
            .match({
              ticker: upd.ticker,
              snapshot_date: upd.snapshot_date,
              engine_version: upd.engine_version,
            });

          if (error) {
            console.error(
              `❌ Error updating ${upd.ticker} (${upd.snapshot_date}):`,
              error.message,
            );
          }
        }),
      );

      processed += batch.length;
      if (processed % 200 === 0 || processed === updates.length) {
        console.log(`  Updated ${processed}/${updates.length}...`);
      }
    }
  }

  console.log("✅ IFS Memory Aggregation Complete.");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});

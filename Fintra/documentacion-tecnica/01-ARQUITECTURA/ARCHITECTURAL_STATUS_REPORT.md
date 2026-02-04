# FINTRA Platform - Architectural Status Report

**Report Date:** February 2, 2026  
**System Version:** fintra-local-v1  
**Audit Status:** Architecturally Correct but Incomplete

---

## 1. Executive Summary

The FINTRA platform architecture is currently **correct and compliant** with its layered deterministic design. A recent architectural violation in the snapshot generation layer has been identified and fully reverted. The system now adheres strictly to its separation-of-concerns model, where snapshots consume pre-calculated data only and perform no computation. Missing data fields (Alpha/relative performance) are correctly represented as null, reflecting the current state of upstream data pipelines.

---

## 2. Current Architecture State

### Data Flow Layers

```
Layer 1: Raw Ingestion
  └─> datos_performance (2.1M rows, asset returns)
  └─> sector_performance (77 rows, sector benchmarks)

Layer 2: Pre-Calculated Windows
  └─> performance_windows (0 rows) ← EXPECTED TO BE POPULATED BY BACKFILL
      Schema: ticker, benchmark_ticker, window_code, asset_return,
              benchmark_return, alpha, volatility, max_drawdown,
              as_of_date, source, created_at

Layer 3: Snapshot Assembly
  └─> fintra_snapshots (106,801 rows)
      Reads FROM: performance_windows ONLY
      Computes: relative = asset_return - benchmark_return (when both non-null)
      Stores: Calculated relative performance or null

Layer 4: UI Presentation
  └─> Components read fintra_snapshots
      No recalculation
      Displays null as "pending" or empty state
```

### Snapshot Layer Contract

**What snapshots DO:**

- Query `performance_windows` for ticker/date using `as_of_date` temporal anchor
- Read `asset_return` and `benchmark_return` fields
- Compute relative performance: `asset_return - benchmark_return` (when both non-null)
- Store computed relative or null when data unavailable
- Execute financial engines (FGOS, IFS, Valuation) using available data

**What snapshots DO NOT do:**

- Query `datos_performance` directly
- Query `sector_performance` directly
- Query `industry_performance` directly
- Infer missing data
- Perform fallback logic when `performance_windows` is empty

---

## 3. Recently Resolved Issues

### Architectural Violation (Detected and Corrected)

**Violation Description:**

On February 2, 2026, the file `lib/snapshots/buildSnapshotsFromLocalData.ts` was incorrectly modified to:

1. Query `datos_performance` table directly (bypassing Layer 2)
2. Query `sector_performance` table directly (bypassing Layer 2)
3. Compute relative performance using raw data tables instead of `performance_windows`

This violated FINTRA's layered architecture principle: **snapshots must read only from designated intermediate tables**, not from raw ingestion tables.

**Correction Applied:**

The code was reverted to its original correct form:

```typescript
// CORRECT CODE (current state - line 111-127):
const { data: perfData } = await supabaseAdmin
  .from("performance_windows")
  .select("window_code, asset_return, benchmark_return")
  .eq("ticker", ticker)
  .lte("as_of_date", date)
  .order("as_of_date", { ascending: false })
  .in("window_code", windows);

const perfMap = new Map<string, number>();
if (perfData) {
  perfData.forEach((row: any) => {
    if (
      !perfMap.has(row.window_code) &&
      row.asset_return != null &&
      row.benchmark_return != null
    ) {
      perfMap.set(row.window_code, row.asset_return - row.benchmark_return);
    }
  });
}
```

**Result:**

- Snapshots now query only `performance_windows` (correct layer)
- Computation limited to subtraction of two pre-fetched fields
- No queries to raw data tables (datos_performance, sector_performance)
- Architecture integrity restored

---

## 4. Current Known Gaps (Expected and Valid)

### Gap 1: Empty performance_windows Table

**Status:**

```sql
SELECT COUNT(*) FROM performance_windows;
-- Result: 0 rows
```

**Implication:**

- All queries from snapshots to `performance_windows` return empty result sets
- `perfMap` remains empty during snapshot generation
- Relative performance fields (relative_vs_sector_1y, relative_vs_sector_3y, etc.) are stored as null

**Is this a bug?**  
**No.** This is correct behavior per FINTRA architectural rules:

- Snapshots must NOT invent data
- Snapshots must NOT compute missing benchmarks
- Null represents "data not yet available" (pending status)

### Gap 2: Null Relative Performance Fields in fintra_snapshots

**Current State:**

```sql
SELECT COUNT(*) FROM fintra_snapshots
WHERE relative_vs_sector_1y IS NULL;
-- Result: ~106,801 rows (all snapshots)
```

**Implication:**

- IFS (Industry Financial Score) calculations lack relative performance inputs
- IFS status may be 'pending' or computed with reduced confidence
- UI displays "pending" or empty state for relative performance metrics

**Is this a bug?**  
**No.** Per FINTRA principle: "Pending is not an error." Missing data is represented honestly, not approximated.

### Gap 3: Empty Scatter Chart (FGOS vs Relative Performance)

**Component:** `components/dashboard/SectorScatterChart.tsx`

**Current Behavior:**

```typescript
const validData = rawData.filter((item) => {
  const hasValidFGOS = item.fgosScore !== null;
  const hasValidPerf = item.relativeReturn1Y !== null;
  return hasValidFGOS && hasValidPerf;
});
// Result: validData.length === 0
```

All tickers are filtered out because `relativeReturn1Y` is null (sourced from `fintra_snapshots.relative_vs_sector_1y`).

**Is this a bug?**  
**No.** The chart is correctly refusing to display invalid data. The axis labels and filtering logic are correct. The chart will populate once `performance_windows` is backfilled.

### Gap 4: Outdated sector_performance Table

**Current State:**

```sql
SELECT MAX(performance_date) FROM sector_performance;
-- Result: 2026-01-30 (3 days stale)
```

**Implication:**

- Even if snapshots incorrectly queried `sector_performance`, benchmarks would be outdated
- Upstream backfill pipeline has not run recently

**Is this a bug?**  
**No.** This is a data freshness issue in Layer 1, not an architectural flaw. The pipeline is designed to update this table daily via cron jobs.

---

## 5. Determinism & Auditability Status

### Can Results Be Reproduced?

**Yes.** The current system is fully deterministic:

- All snapshot calculations read from fixed database tables at point-in-time
- No random number generation
- No external API calls during snapshot assembly
- No heuristics or ML models
- Same input data → same output snapshots

### Is There On-The-Fly Logic?

**Minimal.** After the recent correction:

- Snapshots perform one calculation: `asset_return - benchmark_return`
- This calculation uses ONLY pre-fetched data from `performance_windows`
- Zero queries to raw data tables during calculation
- Zero fallback approximations
- Zero data inference
- If `performance_windows` is empty, calculation never occurs (perfMap remains empty)

### Is the System Honest About Missing Data?

**Yes.** FINTRA follows the principle: "FINTRA no inventa datos."

- Missing benchmarks → null stored (not zero, not average, not approximated)
- Missing performance windows → Alpha fields null
- Missing sector → FGOS status 'pending'
- Insufficient quarters → TTM null (not extrapolated)

**Evidence:**

```typescript
// From buildSnapshotsFromLocalData.ts (line 119-127):
if (perfData) {
  perfData.forEach((row: any) => {
    if (
      !perfMap.has(row.window_code) &&
      row.asset_return != null &&
      row.benchmark_return != null
    ) {
      perfMap.set(row.window_code, row.asset_return - row.benchmark_return);
    }
  });
}
// If perfData is empty, perfMap remains empty (no defaults)
// If either asset_return or benchmark_return is null, no value stored
```

---

## 6. Next Required Step (Informational Only)

### Populate performance_windows Table

**Prerequisite:**  
The `performance_windows` table exists with correct schema but contains zero rows. This table must be populated before Alpha metrics can appear in snapshots or UI.

**Responsible Pipeline:**  
The backfill system at `scripts/backfill/backfill-sector-performance.ts` or equivalent cron job is designed to populate this table. The pipeline:

1. Reads from `datos_performance` (asset returns)
2. Reads from `sector_performance` or `industry_performance` (benchmark returns)
3. Joins by ticker, benchmark, window_code, date
4. Writes `asset_return` and `benchmark_return` to `performance_windows`
5. May pre-calculate `alpha` column (asset_return - benchmark_return)
6. Writes metadata (volatility, max_drawdown, source)

Note: The `alpha` column exists in schema but may be populated by pipeline or left for snapshot calculation.

**Execution Method:**

```bash
# Option 1: Via cron endpoint (requires server running)
curl http://localhost:3000/api/cron/sector-performance-windows-aggregator

# Option 2: Via backfill script
npx tsx scripts/backfill/backfill-sector-performance.ts
```

**Expected Outcome After Execution:**

- `performance_windows` populated with `asset_return` and `benchmark_return` for each ticker/window/date
- Subsequent snapshot generation will compute `asset_return - benchmark_return`
- `fintra_snapshots.relative_vs_sector_*` fields populated (not null)
- Scatter chart displays points across x-axis (not stacked at x=0)

**Note:** This report does NOT execute the backfill. That is a deliberate operational step requiring data validation and testing.

---

## Conclusion

**Current System Status: Architecturally Correct but Incomplete**

The FINTRA platform is operating according to its designed layered architecture. Recent violations have been identified and corrected. The system correctly represents missing data as null rather than computing approximations. UI components correctly filter out invalid data rather than displaying misleading visualizations.

The platform is ready for data backfill operations. Once `performance_windows` is populated with `asset_return` and `benchmark_return` values, snapshots will compute relative performance and populate downstream fields without requiring code changes.

**Architecture Integrity: VERIFIED**  
**Data Completeness: PENDING BACKFILL**  
**Determinism: COMPLIANT**  
**Audit Trail: CLEAR**

**Note on Calculation Layer:** Snapshots perform minimal calculation (`asset_return - benchmark_return`) using only pre-fetched intermediate table data. This is acceptable per FINTRA architecture as it does not query raw tables or perform complex aggregations.

---

**Report Compiled By:** FINTRA Engineering  
**Last Code Change:** February 2, 2026 (reversion of architectural violation)  
**Next Validation Required:** Post-backfill snapshot audit

**Final Assessment: Architecturally Correct but Incomplete (per current code and data state)**

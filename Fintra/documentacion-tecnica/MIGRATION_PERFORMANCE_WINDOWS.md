# Migration Guide: Flat Columns → performance_windows JSONB

## Overview

Fintra is migrating from flat performance columns to a JSONB structure for better flexibility and maintainability.

## Timeline

| Phase   | Date     | Status         | Description                    |
| ------- | -------- | -------------- | ------------------------------ |
| Phase 1 | Feb 2026 | ✅ Complete    | Deprecate columns, stop writes |
| Phase 2 | Mar 2026 | 🚧 In Progress | Migrate all reads to JSONB     |
| Phase 3 | Q2 2026  | ⏳ Planned     | Remove deprecated columns      |

## Migration Mapping

### sector_rank → performance_windows

**Before (Flat):**

```typescript
const rank = snapshot.sector_rank;
const total = snapshot.sector_rank_total;
```

**After (JSONB):**

```typescript
const rank = snapshot.performance_windows?.["1M"]?.sector_rank;
const total = snapshot.performance_windows?.["1M"]?.sector_total;
```

**SQL Before:**

```sql
SELECT ticker, sector_rank
FROM fintra_snapshots
WHERE sector_rank <= 10;
```

**SQL After:**

```sql
SELECT
  ticker,
  (performance_windows->'1M'->>'sector_rank')::int as sector_rank
FROM fintra_snapshots
WHERE (performance_windows->'1M'->>'sector_rank')::int <= 10;
```

### relative*vs_sector*\* → performance_windows

**Before (Flat):**

```typescript
const rel1m = snapshot.relative_vs_sector_1m;
const rel3m = snapshot.relative_vs_sector_3m;
```

**After (JSONB):**

```typescript
const rel1m = snapshot.performance_windows?.["1M"]?.vs_sector;
const rel3m = snapshot.performance_windows?.["3M"]?.vs_sector;
```

**SQL Before:**

```sql
SELECT ticker, relative_vs_sector_1m
FROM fintra_snapshots
WHERE relative_vs_sector_1m > 0.05;
```

**SQL After:**

```sql
SELECT
  ticker,
  (performance_windows->'1M'->>'vs_sector')::numeric as rel_sector_1m
FROM fintra_snapshots
WHERE (performance_windows->'1M'->>'vs_sector')::numeric > 0.05;
```

## Helper Functions

### TypeScript Helper

```typescript
/**
 * Safely get performance metric from JSONB
 */
function getPerformanceMetric(
  snapshot: FintraSnapshot,
  window: string,
  metric: "sector_rank" | "sector_total" | "vs_sector" | "vs_market",
): number | null {
  return snapshot.performance_windows?.[window]?.[metric] ?? null;
}

// Usage:
const rank = getPerformanceMetric(snapshot, "1M", "sector_rank");
```

### SQL Function

```sql
CREATE OR REPLACE FUNCTION get_performance_metric(
  perf_windows JSONB,
  window_key TEXT,
  metric_key TEXT
) RETURNS NUMERIC AS $$
BEGIN
  RETURN (perf_windows->window_key->>metric_key)::NUMERIC;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage:
SELECT
  ticker,
  get_performance_metric(performance_windows, '1M', 'sector_rank') as rank
FROM fintra_snapshots;
```

## Audit Your Code

Run the audit script to find all usages:

```bash
pnpm audit:deprecated-columns
```

This will generate a report showing all files that need updating.

## Questions?

See `docs/architecture/performance_windows.md` for full JSONB schema.

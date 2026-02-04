# IQS Refactoring Complete

## Summary

Refactored IFS FY to be architecturally correct, removing temporal ambiguity and implementing proper percentile-based industry ranking.

## Key Changes

### 1. **Conceptual Clarity**

- **PUBLIC NAME**: IQS (Industry Quality Score)
- **INTERNAL FIELD**: `ifs_fy` (DB column)
- **NATURE**: STRUCTURAL metric (separate from IFS Live)
- **COMPARISON**: Industry ONLY (never sector)

### 2. **Removed Temporal Ambiguity**

Eliminated fields that implied inferred duration:

- ❌ `observed_years` - Implied temporal continuity
- ❌ `timeline` - Lost explicit fiscal year mapping
- ❌ `trend` - Narrative inference violates determinism

### 3. **New Explicit Structure**

```typescript
interface IQSResult {
  mode: "fy_industry_structural";
  fiscal_years: string[]; // Explicit FY list: ["2021", "2022", "2023"]
  fiscal_positions: IQSFiscalYearPosition[]; // One per REAL fiscal year
  current_fy: {
    fiscal_year: string;
    position: IQSPosition;
  };
  confidence: number; // Based ONLY on FY count (not trend)
}

interface IQSFiscalYearPosition {
  fiscal_year: string; // Explicit: "2023"
  position: "leader" | "follower" | "laggard";
  percentile: number; // 0-100 within industry
}
```

### 4. **Scoring Refactored**

**Before (WRONG):**

- Absolute normalization with magic bounds
- `normalizeMetric(value, { min: -10, max: 40, optimal: 25 })`
- O(N²) peer loops (calculated each peer's score inline)

**After (CORRECT):**

- Percentile-based RELATIVE to industry
- `calculatePercentile(value, distributions.roic_values)`
- Single batch query per metric (no O(N²) loops)
- Composite percentile weighted by category

**Weights:**

- ROIC: 30%
- Operating Margin: 25%
- Growth: 20%
- Leverage: 15% (inverted)
- FCF: 10%

### 5. **Confidence Simplified**

**Before:** Encoded trend + consistency (narrative)  
**After:** FY count only (deterministic)

```typescript
1 FY = 20%
2 FY = 40%
3 FY = 60%
4 FY = 80%
5 FY = 100%
```

### 6. **UI Updates**

- All user-facing text: **IQS (Industry Quality Score)**
- Pie chart: One slice per explicit fiscal year
- Tooltip shows: `FY 2023: leader (85th percentile)`
- No trend arrows or improvement indicators

## Files Modified

1. **Types** - [lib/engine/types.ts](lib/engine/types.ts)
   - `IFSFYResult` → `IQSResult`
   - Added `fiscal_positions` with explicit `fiscal_year` strings
   - Added `IndustryFYBenchmark` (for future precomputed benchmarks)

2. **Engine** - [lib/engine/ifs-fy.ts](lib/engine/ifs-fy.ts)
   - Removed absolute normalization
   - Implemented percentile-based scoring
   - Batch peer queries (not O(N²))
   - Simplified confidence calculation

3. **UI Components**:
   - [components/visuals/IFSFYPie.tsx](components/visuals/IFSFYPie.tsx)
     - Renamed to `IQSPie`
     - Uses `fiscal_positions` array
     - Shows explicit FY in tooltips
   - [components/tables/IFSDualCell.tsx](components/tables/IFSDualCell.tsx)
     - Updated to new `IQSResult` structure
     - Tooltip: `FY 2023: leader | 2021, 2022, 2023 | Confidence: 60%`

4. **Integration** - [app/api/cron/fmp-bulk/buildSnapshots.ts](app/api/cron/fmp-bulk/buildSnapshots.ts)
   - Updated logs: `IQS: FY 2023 - leader (3 FY, confidence: 60%)`
   - Changed type import to `IQSResult`

5. **Test Script** - [scripts/test-ifs-fy.ts](scripts/test-ifs-fy.ts)
   - Updated to show fiscal_positions details
   - Shows explicit FY and percentiles

## Validation

Run test:

```bash
pnpm tsx scripts/test-ifs-fy.ts
```

Expected output:

```
🧪 Testing IQS - Industry Quality Score (STRUCTURAL)
================================================================================

📊 AAPL (Consumer Electronics)
   Expectation: Should have multiple FY, likely leader in recent years
--------------------------------------------------------------------------------
   ✅ Mode: fy_industry_structural
   📅 Fiscal Years: 2021, 2022, 2023
   📊 Positions: 🟢 🟢 🟢
   🎯 Current: FY 2023 - LEADER
   🎲 Confidence: 60%
   📈 Details:
      🟢 FY 2021: leader (82th percentile)
      🟢 FY 2022: leader (85th percentile)
      🟢 FY 2023: leader (87th percentile)
   💡 Medium confidence - 3 FY available
```

## Architecture Notes

### Dual Head Contract

- Web UI: Reads `ifs_fy` from `fintra_snapshots`
- Desktop (future): Reads same field
- Both display: IQS pie chart with fiscal year slices

### Performance Optimization (Future)

Current implementation queries industry peers per ticker.  
**TODO**: Precompute industry FY benchmarks:

```sql
CREATE TABLE industry_fy_benchmarks (
  industry TEXT,
  fiscal_year TEXT,
  roic_distribution NUMERIC[],
  margin_distribution NUMERIC[],
  sample_size INTEGER,
  computed_at TIMESTAMP
);
```

### Golden Rule Compliance

✅ No inferred duration  
✅ No temporal ambiguity  
✅ No narrative persistence  
✅ Truth > visual richness  
✅ Determinism > convenience

## Migration Already Applied

Column `ifs_fy` exists in `fintra_snapshots` (JSONB).  
Next snapshot run will populate with new `IQSResult` structure.

## Next Steps

1. **Run Snapshot** to populate IQS data:

   ```bash
   pnpm tsx app/api/cron/fmp-bulk/buildSnapshots.ts
   ```

2. **Verify Coverage**:

   ```sql
   SELECT
     COUNT(*) FILTER (WHERE ifs_fy IS NOT NULL) as with_iqs,
     COUNT(*) as total,
     ROUND(100.0 * COUNT(*) FILTER (WHERE ifs_fy IS NOT NULL) / COUNT(*), 2) as pct
   FROM fintra_snapshots
   WHERE snapshot_date = CURRENT_DATE;
   ```

3. **Test UI Display** - Navigate to any stock detail page and verify IQS pie appears next to IFS Live badge

4. **Optimize** (Optional) - Create precomputed industry benchmark table to avoid repeated peer queries

## Conclusion

IQS is now:

- ✅ Architecturally correct (no temporal ambiguity)
- ✅ Epistemologically sound (percentile-based, deterministic)
- ✅ Performant (batch queries, not O(N²))
- ✅ UI-ready (explicit fiscal years, correct terminology)
- ✅ Fintra-compliant (no data invention, null when insufficient)

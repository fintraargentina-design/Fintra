# TTM Historical Valuation Implementation

## Overview

This implementation creates a **materialized historical TTM valuation system** that strictly follows Fintra's architectural principles.

## Core Principles (NON-NEGOTIABLE)

1. **TTM is INTERNAL** - Derived ONLY from 4 closed fiscal quarters
2. **No Approximations** - If any quarter is missing, skip that TTM
3. **No Interpolations** - Historical TTM is NEVER recalculated
4. **Materialized History** - TTM rows are written once and never modified
5. **Point-in-Time Prices** - Uses nearest closing price <= valuation_date
6. **Idempotent Operations** - Safe to re-run without duplicates

---

## Architecture

### Database Schema

**Table:** `public.datos_valuacion_ttm`

**Key Fields:**

- `ticker` + `valuation_date` (UNIQUE) - One row per ticker per quarter-end
- `price` + `price_date` - Point-in-time market price
- TTM fundamentals: `revenue_ttm`, `ebitda_ttm`, `net_income_ttm`, `eps_ttm`, `free_cash_flow_ttm`
- Valuation ratios: `pe_ratio`, `ev_ebitda`, `price_to_sales`, `price_to_fcf`
- Context: `market_cap`, `enterprise_value`, `net_debt`, `shares_outstanding`
- Audit: `quarters_used` (e.g., "2023Q1,2023Q2,2023Q3,2023Q4")

**Migration:** `supabase/migrations/20260203_create_datos_valuacion_ttm.sql`

---

## Components

### 1. Backfill Script

**File:** `scripts/backfill/backfill-ttm-valuation-history.ts`

**Purpose:** Populate historical TTM data for all available quarter-end dates

**Usage:**

```bash
# Single ticker
npx tsx scripts/backfill/backfill-ttm-valuation-history.ts AAPL

# All tickers (respects fintra_universe.is_active)
npx tsx scripts/backfill/backfill-ttm-valuation-history.ts

# Limited batch (for testing)
npx tsx scripts/backfill/backfill-ttm-valuation-history.ts --limit=10
```

**Logic:**

1. Fetch all quarterly financials for ticker
2. For each window of 4 consecutive quarters:
   - Check if TTM already exists (skip if yes)
   - Compute TTM by summing income statement items
   - Fetch nearest price <= quarter-end date
   - Fetch net debt from balance sheet
   - Calculate valuation ratios
   - Insert row (UNIQUE constraint prevents duplicates)

**Fault Tolerance:**

- Skips tickers with <4 quarters
- Skips TTM windows with missing data
- Skips if no price available
- Continues on error (logs and moves to next ticker)

---

### 2. Incremental Cron Job

**File:** `scripts/pipeline/incremental-ttm-valuation.ts`

**Purpose:** Detect newly closed quarters and compute ONE new TTM row per quarter

**API Route:** `app/api/cron/incremental-ttm-valuation/route.ts`

**Endpoint:** `GET /api/cron/incremental-ttm-valuation`

**Frequency:** Daily (recommended after `financials-bulk` cron)

**Logic:**

1. For each active ticker:
   - Get latest quarter-end date from `datos_financieros`
   - Get latest TTM date from `datos_valuacion_ttm`
   - If quarter-end > TTM date → new quarter detected
   - Fetch last 4 quarters (must be complete)
   - Compute TTM metrics
   - Fetch nearest price
   - Insert new row

**Key Behavior:**

- Creates ONLY new rows (does NOT touch existing)
- If no new quarter → skip (no-op)
- If quarter incomplete (< 4 quarters available) → skip
- Idempotent (safe to run multiple times per day)

**Execution:**

```bash
# Direct execution
npx tsx scripts/pipeline/incremental-ttm-valuation.ts

# Via HTTP (production)
curl http://localhost:3000/api/cron/incremental-ttm-valuation
```

---

## Execution Workflow

### Initial Setup

1. **Create table:**

   ```bash
   # Apply migration to Supabase
   # (Using Supabase CLI or Supabase Studio)
   ```

2. **Backfill historical data:**

   ```bash
   # Test with a few tickers first
   npx tsx scripts/backfill/backfill-ttm-valuation-history.ts AAPL
   npx tsx scripts/backfill/backfill-ttm-valuation-history.ts MSFT
   npx tsx scripts/backfill/backfill-ttm-valuation-history.ts GOOGL

   # Verify data
   # SELECT * FROM datos_valuacion_ttm WHERE ticker = 'AAPL' ORDER BY valuation_date DESC LIMIT 10;

   # Full backfill (all active tickers)
   npx tsx scripts/backfill/backfill-ttm-valuation-history.ts
   ```

3. **Verify backfill results:**

   ```sql
   -- Count TTM rows per ticker
   SELECT ticker, COUNT(*) as ttm_count
   FROM datos_valuacion_ttm
   GROUP BY ticker
   ORDER BY ttm_count DESC
   LIMIT 20;

   -- Check date coverage for a specific ticker
   SELECT valuation_date, pe_ratio, ev_ebitda, quarters_used
   FROM datos_valuacion_ttm
   WHERE ticker = 'AAPL'
   ORDER BY valuation_date DESC
   LIMIT 20;

   -- Check for null ratios (expected if fundamentals missing)
   SELECT ticker, valuation_date, pe_ratio, ev_ebitda
   FROM datos_valuacion_ttm
   WHERE ticker IN ('AAPL', 'MSFT', 'GOOGL')
   AND (pe_ratio IS NULL OR ev_ebitda IS NULL)
   ORDER BY valuation_date DESC;
   ```

### Daily Operations

**Add to cron schedule (after `financials-bulk`):**

```json
// vercel.json or similar
{
  "crons": [
    {
      "path": "/api/cron/financials-bulk",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/incremental-ttm-valuation",
      "schedule": "0 4 * * *" // 1 hour after financials
    }
  ]
}
```

**Manual trigger:**

```bash
curl http://localhost:3000/api/cron/incremental-ttm-valuation
```

**Expected output:**

```
🔄 Starting Incremental TTM Valuation Cron...
═══════════════════════════════════════════════════════════
📋 Processing 21988 active tickers

[1/21988] AAPL
  📊 New quarter detected: 2025-12-31 (previous TTM: 2025-09-30)
  ✅ Inserted TTM for 2025-12-31 (Price: $195.50, PE: 28.45)

[2/21988] MSFT
  (No new quarter)

...

═══════════════════════════════════════════════════════════
✨ Incremental TTM Cron Complete!
   Processed: 21988 tickers
   New TTM rows: 342
═══════════════════════════════════════════════════════════
```

---

## Data Integrity Rules

### TTM Calculation Rules

1. **Sum of 4 Quarters (Income Statement):**
   - `revenue_ttm = Q1.revenue + Q2.revenue + Q3.revenue + Q4.revenue`
   - Same for: `ebitda_ttm`, `net_income_ttm`, `eps_ttm`, `free_cash_flow_ttm`
   - If ANY quarter is NULL → entire TTM metric is NULL

2. **Latest Quarter Snapshot (Balance Sheet):**
   - `shares_outstanding` = most recent quarter
   - `net_debt` = most recent balance sheet <= valuation_date

3. **Point-in-Time Price:**
   - Query: `SELECT close FROM datos_eod WHERE ticker = ? AND price_date <= ? ORDER BY price_date DESC LIMIT 1`
   - NEVER use future prices

4. **Valuation Ratios:**

   ```typescript
   market_cap = price * shares_outstanding
   enterprise_value = market_cap + net_debt

   pe_ratio = market_cap / net_income_ttm  (only if net_income_ttm > 0)
   ev_ebitda = enterprise_value / ebitda_ttm  (only if ebitda_ttm > 0)
   price_to_sales = market_cap / revenue_ttm  (only if revenue_ttm > 0)
   price_to_fcf = market_cap / free_cash_flow_ttm  (only if free_cash_flow_ttm > 0)
   ```

5. **No Negative Ratios:**
   - If denominator is negative → ratio = NULL
   - Examples: Negative earnings → PE = NULL, Negative EBITDA → EV/EBITDA = NULL

### Validation Queries

```sql
-- 1. Check for duplicate dates (should be 0)
SELECT ticker, valuation_date, COUNT(*)
FROM datos_valuacion_ttm
GROUP BY ticker, valuation_date
HAVING COUNT(*) > 1;

-- 2. Check for future prices (price_date > valuation_date, should be 0)
SELECT ticker, valuation_date, price_date
FROM datos_valuacion_ttm
WHERE price_date > valuation_date;

-- 3. Check for impossible ratios (negative or absurdly high)
SELECT ticker, valuation_date, pe_ratio, ev_ebitda
FROM datos_valuacion_ttm
WHERE pe_ratio < 0 OR pe_ratio > 1000
   OR ev_ebitda < 0 OR ev_ebitda > 500;

-- 4. Check completeness (tickers with <10 TTM rows might be incomplete)
SELECT ticker, COUNT(*) as ttm_count
FROM datos_valuacion_ttm
GROUP BY ticker
HAVING COUNT(*) < 10
ORDER BY ttm_count ASC;
```

---

## Integration Points

### Future Use Cases

This TTM historical data enables:

1. **Sentiment Calculation:**
   - Query TTM, TTM_1Y, TTM_3Y, TTM_5Y from `datos_valuacion_ttm`
   - Calculate valuation rerating intensity
   - Detect secular trends (expanding vs. contracting multiples)

2. **Peer Comparison (Historical):**
   - Compare PE, EV/EBITDA across peers at same point in time
   - Historical sector median valuation

3. **Backtest Valuation Strategies:**
   - Test "buy when PE < 15" rule across history
   - Validate sector rotation signals

4. **Quality Metrics (Future):**
   - FCF consistency (TTM FCF variance over time)
   - Earnings quality (net income vs. FCF divergence)

### Example Query for Sentiment

```typescript
// Fetch valuation timeline for sentiment calculation
async function getValuationTimeline(ticker: string, asOfDate: string) {
  const dates = {
    ttm: asOfDate,
    ttm_1y: dayjs(asOfDate).subtract(1, "year").format("YYYY-MM-DD"),
    ttm_3y: dayjs(asOfDate).subtract(3, "years").format("YYYY-MM-DD"),
    ttm_5y: dayjs(asOfDate).subtract(5, "years").format("YYYY-MM-DD"),
  };

  const { data } = await supabaseAdmin
    .from("datos_valuacion_ttm")
    .select("valuation_date, pe_ratio, ev_ebitda, price_to_sales, price_to_fcf")
    .eq("ticker", ticker)
    .in("valuation_date", Object.values(dates))
    .order("valuation_date", { ascending: false });

  return data;
}
```

---

## Troubleshooting

### Issue: "No price data" for recent quarters

**Cause:** `datos_eod` table missing recent prices

**Solution:**

```bash
# Ensure prices-daily-bulk cron ran recently
curl http://localhost:3000/api/cron/prices-daily-bulk
```

### Issue: "Insufficient quarters" for many tickers

**Cause:** `datos_financieros` missing quarterly data

**Solution:**

```bash
# Ensure financials-bulk cron ran
curl http://localhost:3000/api/cron/financials-bulk

# Check quarter coverage
SELECT ticker, COUNT(*) as quarter_count
FROM datos_financieros
WHERE period_type = 'Q'
GROUP BY ticker
HAVING COUNT(*) < 4
ORDER BY quarter_count ASC;
```

### Issue: TTM rows not appearing for recent quarters

**Cause:** Incremental cron not running or financials delayed

**Solution:**

1. Check if new quarter data exists in `datos_financieros`
2. Manually trigger incremental cron
3. Check logs for errors

### Issue: Backfill taking too long

**Recommendation:**

- Run backfill in batches (use `--limit` flag)
- Run overnight or during low-usage periods
- Estimate: ~5-10 seconds per ticker with full history

**Batch execution:**

```bash
# Process 100 tickers per batch
for i in {1..220}; do
  npx tsx scripts/backfill/backfill-ttm-valuation-history.ts --limit=100
  sleep 10  # Brief pause between batches
done
```

---

## Testing Checklist

Before deploying to production:

- [ ] Migration applied to Supabase
- [ ] Backfill script tested on 5-10 tickers
- [ ] Validation queries show no duplicates or impossible ratios
- [ ] Incremental cron creates new row when quarter added to `datos_financieros`
- [ ] Incremental cron is idempotent (no duplicates on re-run)
- [ ] API endpoint returns 200 OK with duration metrics
- [ ] Future prices validation (price_date <= valuation_date)
- [ ] TTM windows correctly use last 4 quarters (check `quarters_used` field)

---

## Performance Notes

**Backfill Duration:**

- ~5-10 seconds per ticker (depends on quarter count)
- 21,988 tickers × 7 seconds ≈ 42 hours
- Recommendation: Run in batches overnight

**Incremental Cron Duration:**

- Typically 2-5 minutes (most tickers have no new quarters)
- On earnings season peak: 10-15 minutes (5-10% of tickers report)

**Database Size Estimate:**

- ~40 quarters per ticker (10 years × 4)
- 21,988 tickers × 40 rows ≈ 880,000 rows
- Storage: ~200-300 MB

---

## Changelog

**2026-02-03 - Initial Implementation**

- Created `datos_valuacion_ttm` table schema
- Implemented backfill script with fault tolerance
- Implemented incremental cron job
- Added API route for production scheduling
- Documentation complete

---

## Status: ✅ READY FOR TESTING

**Next Steps:**

1. Apply migration to Supabase
2. Test backfill with 5-10 tickers (AAPL, MSFT, GOOGL, etc.)
3. Verify data integrity with validation queries
4. Test incremental cron (add new quarter to `datos_financieros`, run cron)
5. Schedule incremental cron in production (after `financials-bulk`)

**Author:** GitHub Copilot  
**Date:** February 3, 2026  
**Version:** 1.0

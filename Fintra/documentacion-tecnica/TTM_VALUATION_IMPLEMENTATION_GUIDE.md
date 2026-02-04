# TTM Historical Valuation - Implementation Guide

## Overview

This implementation creates a **deterministic, materialized TTM valuation system** that strictly follows Fintra's architectural principles.

---

## ✅ Files Created

### 1. Database Migration

**File:** `supabase/migrations/20260203_create_datos_valuacion_ttm.sql`

Creates the `datos_valuacion_ttm` table with:

- Primary key: `(ticker, valuation_date)`
- TTM fundamentals: revenue, EBITDA, net income, EPS, FCF
- Valuation ratios: PE, EV/EBITDA, P/S, P/FCF
- Context: price, market cap, enterprise value, net debt
- Audit: quarters_used, timestamps

### 2. Backfill Script

**File:** `scripts/backfill/backfill-ttm-valuation.ts`

**Purpose:** Populate historical TTM data for all available quarter-end dates

**Usage:**

```powershell
# Single ticker
pnpm tsx scripts/backfill/backfill-ttm-valuation.ts AAPL

# All active tickers
pnpm tsx scripts/backfill/backfill-ttm-valuation.ts

# Limited batch (testing)
pnpm tsx scripts/backfill/backfill-ttm-valuation.ts --limit=10
```

**Logic:**

1. Fetch all quarterly financials for ticker
2. For each window of 4 consecutive quarters:
   - Check if TTM already exists (skip if yes)
   - Compute TTM by summing income statement items
   - Fetch nearest price <= quarter-end date
   - Calculate valuation ratios
   - Insert row (UNIQUE constraint prevents duplicates)

**Key Features:**

- ✅ Idempotent (safe to re-run)
- ✅ Fault-tolerant (continues on error)
- ✅ Skips if <4 quarters available
- ✅ Skips if no price data
- ✅ Logs progress every 25 tickers

### 3. Incremental Cron Script

**File:** `scripts/pipeline/ttm-valuation-cron.ts`

**Purpose:** Detect newly closed quarters and compute ONE new TTM row per quarter

**Usage:**

```powershell
# Direct execution
pnpm tsx scripts/pipeline/ttm-valuation-cron.ts

# Via HTTP API
curl http://localhost:3000/api/cron/ttm-valuation-cron
```

**Logic:**

1. For each active ticker:
   - Get latest quarter-end date from `datos_financieros`
   - Get latest TTM date from `datos_valuacion_ttm`
   - If quarter-end > TTM date → new quarter detected
   - Fetch last 4 quarters
   - Compute TTM metrics
   - Insert new row

**Key Features:**

- ✅ Creates ONLY new rows (never modifies existing)
- ✅ No-op if no new quarter
- ✅ Idempotent (safe to run multiple times)
- ✅ Silent for tickers without new quarters
- ✅ Logs only when TTM created

### 4. API Route

**File:** `app/api/cron/ttm-valuation-cron/route.ts`

**Endpoint:** `GET /api/cron/ttm-valuation-cron`

**Configuration:**

- Max duration: 5 minutes
- Dynamic rendering
- Returns: success status, duration, error (if any)

---

## 🔒 Strict Rules Enforced

### 1. TTM Data Source

- ✅ TTM derived ONLY from 4 closed fiscal quarters
- ✅ No FY data used as proxy
- ✅ Skip if any quarter missing
- ✅ Period type must be 'Q'

### 2. Temporal Accuracy

- ✅ valuation_date = quarter_end_date of most recent quarter
- ✅ price = nearest closing price <= valuation_date
- ✅ net_debt = most recent balance sheet <= valuation_date
- ✅ No future data used (prevents look-ahead bias)

### 3. Data Integrity

- ✅ No interpolation or estimation
- ✅ No approximations or smoothing
- ✅ If insufficient data → skip insert
- ✅ Null propagates correctly (no default values)

### 4. Computation Rules

- ✅ Revenue TTM = sum of 4 quarters
- ✅ EBITDA TTM = sum of 4 quarters
- ✅ Net Income TTM = sum of 4 quarters
- ✅ EPS TTM = sum of 4 quarters
- ✅ FCF TTM = sum of 4 quarters
- ✅ Shares outstanding = most recent quarter
- ✅ Net debt = total_debt - cash (most recent quarter)

### 5. Valuation Ratios

- ✅ PE = market_cap / net_income_ttm (only if positive earnings)
- ✅ EV/EBITDA = enterprise_value / ebitda_ttm (only if positive EBITDA)
- ✅ P/S = market_cap / revenue_ttm (only if positive revenue)
- ✅ P/FCF = market_cap / fcf_ttm (only if positive FCF)
- ✅ Negative denominators → ratio = null

### 6. Idempotency

- ✅ UNIQUE constraint on (ticker, valuation_date)
- ✅ Backfill checks for existing rows before inserting
- ✅ Cron creates only new rows (never updates)
- ✅ Safe to re-run at any time

---

## 📋 Execution Workflow

### Phase 1: Initial Setup

**1. Apply Database Migration**

Option A (Supabase CLI):

```powershell
supabase db push
```

Option B (Supabase Studio):

1. Open Supabase Studio → SQL Editor
2. Copy content from `supabase/migrations/20260203_create_datos_valuacion_ttm.sql`
3. Execute migration

**2. Verify Table Created**

```sql
SELECT * FROM datos_valuacion_ttm LIMIT 1;

-- Should return empty result with correct columns
```

### Phase 2: Historical Backfill

**1. Test with Single Ticker**

```powershell
pnpm tsx scripts/backfill/backfill-ttm-valuation.ts AAPL
```

**Expected Output:**

```
🚀 Starting TTM Valuation Backfill...
═══════════════════════════════════════════════════════════
📌 Single ticker mode: AAPL

[1/1] AAPL
   ✅ Inserted 40 TTM rows
   ⏭️  Skipped 0 rows (existing or incomplete data)

═══════════════════════════════════════════════════════════
✨ Backfill Complete!

   Processed: 1 tickers
   Inserted:  40 TTM rows
   Skipped:   0 rows
   Errors:    0 tickers
═══════════════════════════════════════════════════════════
```

**2. Verify Data**

```sql
SELECT
  valuation_date,
  pe_ratio,
  ev_ebitda,
  price_to_sales,
  quarters_used
FROM datos_valuacion_ttm
WHERE ticker = 'AAPL'
ORDER BY valuation_date DESC
LIMIT 10;
```

**3. Test with Small Batch**

```powershell
pnpm tsx scripts/backfill/backfill-ttm-valuation.ts --limit=10
```

**4. Full Backfill (All Active Tickers)**

```powershell
# Run overnight or in batches
pnpm tsx scripts/backfill/backfill-ttm-valuation.ts
```

**Estimated Duration:**

- ~5-10 seconds per ticker
- 21,988 tickers × 7 seconds ≈ 42 hours
- Recommendation: Run in batches or overnight

### Phase 3: Daily Operations

**1. Add to Cron Schedule**

Add to `app/api/cron/master-all/route.ts` or run separately:

```typescript
// After financials-bulk
await runTTMValuationCron();
```

**2. Vercel Cron Configuration**

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/financials-bulk",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/ttm-valuation-cron",
      "schedule": "0 4 * * *"
    }
  ]
}
```

**3. Manual Trigger**

```powershell
# Direct execution
pnpm tsx scripts/pipeline/ttm-valuation-cron.ts

# Via HTTP
curl http://localhost:3000/api/cron/ttm-valuation-cron
```

---

## 🧪 Validation Queries

### 1. Check for Duplicates (Should be 0)

```sql
SELECT ticker, valuation_date, COUNT(*)
FROM datos_valuacion_ttm
GROUP BY ticker, valuation_date
HAVING COUNT(*) > 1;
```

### 2. Check for Future Prices (Should be 0)

```sql
SELECT ticker, valuation_date, price_date
FROM datos_valuacion_ttm
WHERE price_date > valuation_date;
```

### 3. Check for Impossible Ratios

```sql
SELECT ticker, valuation_date, pe_ratio, ev_ebitda
FROM datos_valuacion_ttm
WHERE pe_ratio < 0 OR pe_ratio > 1000
   OR ev_ebitda < 0 OR ev_ebitda > 500;
```

### 4. Check Coverage per Ticker

```sql
SELECT
  ticker,
  COUNT(*) as ttm_count,
  MIN(valuation_date) as earliest,
  MAX(valuation_date) as latest
FROM datos_valuacion_ttm
WHERE ticker IN ('AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA')
GROUP BY ticker;
```

### 5. Check Completeness (Tickers with <10 TTM rows)

```sql
SELECT ticker, COUNT(*) as ttm_count
FROM datos_valuacion_ttm
GROUP BY ticker
HAVING COUNT(*) < 10
ORDER BY ttm_count ASC;
```

---

## 🔧 Troubleshooting

### Issue: "No price data" for recent quarters

**Cause:** `datos_eod` missing recent prices

**Solution:**

```powershell
# Run prices cron
curl http://localhost:3000/api/cron/prices-daily-bulk
```

### Issue: "Insufficient quarters" for many tickers

**Cause:** `datos_financieros` missing quarterly data

**Solution:**

````powershell
# Run financials cron
curl http://localhost:3000/api/cron/financials-bulk

# Check quarter coverage
```sql
SELECT ticker, COUNT(*) as quarter_count
FROM datos_financieros
WHERE period_type = 'Q'
GROUP BY ticker
HAVING COUNT(*) < 4
ORDER BY quarter_count ASC;
````

````

### Issue: Backfill very slow

**Solution:** Run in batches
```powershell
# Process 100 tickers per batch
pnpm tsx scripts/backfill/backfill-ttm-valuation.ts --limit=100

# Wait, then run again (idempotent, will process next 100)
pnpm tsx scripts/backfill/backfill-ttm-valuation.ts --limit=100
````

### Issue: Script execution error

**Check:**

1. Environment variables loaded (`.env.local` exists)
2. Supabase connection working
3. Table created (migration applied)
4. Node modules installed (`pnpm install`)

---

## 📊 Expected Results

### After Backfill (AAPL Example)

- **Rows:** ~40-50 (depending on data availability)
- **Date Range:** 10+ years of quarterly data
- **PE Ratio:** 15-35 (typical for AAPL)
- **EV/EBITDA:** 10-20 (typical for AAPL)
- **Quarters Used:** E.g., "2023Q1,2023Q2,2023Q3,2023Q4"

### After Daily Cron

- **On earnings season:** 5-10% of tickers get new TTM row
- **Off-season:** 0-2% of tickers get new TTM row
- **Duration:** 2-5 minutes typical, 10-15 minutes on earnings peak

---

## 🎯 Integration Points

### Future Use: Sentiment Calculation

With `datos_valuacion_ttm` populated, you can now compute sentiment:

```typescript
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

### Future Use: Historical Peer Comparison

Compare valuations across peers at same point in time:

```sql
SELECT
  ticker,
  pe_ratio,
  ev_ebitda,
  price_to_sales
FROM datos_valuacion_ttm
WHERE ticker IN ('AAPL', 'MSFT', 'GOOGL')
  AND valuation_date = '2023-12-31'
ORDER BY pe_ratio ASC;
```

---

## ✅ Implementation Checklist

### Database Setup

- [ ] Migration applied to Supabase
- [ ] Table `datos_valuacion_ttm` exists
- [ ] RLS policies configured

### Backfill Execution

- [ ] Tested with single ticker (AAPL)
- [ ] Validated data integrity (validation queries)
- [ ] Tested with small batch (--limit=10)
- [ ] Full backfill executed or scheduled

### Cron Configuration

- [ ] Incremental cron tested (detects new quarters)
- [ ] API route returns 200 OK
- [ ] Cron scheduled after financials-bulk
- [ ] Vercel cron config updated (production)

### Validation

- [ ] No duplicate rows (unique constraint working)
- [ ] No future prices (temporal accuracy verified)
- [ ] No impossible ratios (calculation logic correct)
- [ ] Coverage adequate (10+ TTM rows per ticker)

---

## 📝 Summary

**Architecture:**

- Layer 2 (Pre-calculated): `datos_valuacion_ttm`
- Materialized history (never recalculated)
- Deterministic (same inputs → same outputs)

**Scripts:**

- Backfill: `scripts/backfill/backfill-ttm-valuation.ts`
- Cron: `scripts/pipeline/ttm-valuation-cron.ts`
- API: `/api/cron/ttm-valuation-cron`

**Data Flow:**

1. `datos_financieros` (quarterly) → TTM computation
2. `datos_eod` (daily prices) → valuation context
3. `datos_valuacion_ttm` (materialized) → historical TTM

**Key Benefits:**

- ✅ Single source of truth for TTM valuation
- ✅ Enables sentiment calculation (historical comparison)
- ✅ Enables peer benchmarking (same point in time)
- ✅ No real-time calculation needed (pre-computed)

---

**Status:** ✅ READY FOR TESTING

**Next Step:** Apply migration and test backfill with AAPL

**Author:** GitHub Copilot  
**Date:** February 3, 2026  
**Version:** 1.0

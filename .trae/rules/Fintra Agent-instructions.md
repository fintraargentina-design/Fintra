# GitHub Copilot Instructions for Fintra

This file configures GitHub Copilot's behavior for the Fintra project.
All code generated must follow these strict rules.

---

## Project Overview

**Fintra** is a financial analysis platform that calculates proprietary scores (FGOS, IFS, Valuation, Life Cycle) for publicly traded companies.

**Tech Stack:**

- Next.js 14 (App Router, TypeScript strict mode)
- Supabase (PostgreSQL + Auth)
- TailwindCSS
- Data Source: Financial Modeling Prep (FMP) API

**Architecture:**

- Cron jobs (nightly) calculate scores and store in `fintra_snapshots` table
- Frontend reads pre-calculated snapshots (no real-time calculations)
- All financial logic in `/lib/engine/`

---

## Core Principles (NON-NEGOTIABLE)

### 1. Fintra Never Invents Data

> "Fintra no inventa datos. Fintra calcula con lo que existe, marca lo que falta y explica por qué."

**Rules:**

- If data is missing → `status: 'pending'` (NEVER throw exception)
- If metric doesn't apply → store `null` (NEVER use default values)
- If sector is unknown → `fgos_status: 'pending'` (NEVER infer sector)

**Examples:**

```typescript
// ✅ CORRECT
if (!sector) {
  return { fgos_status: "pending", reason: "Sector missing" };
}

// ❌ WRONG
if (!sector) {
  sector = "Technology"; // NEVER infer
  throw new Error("Sector required"); // NEVER throw
}
```

### 2. Pending is Not an Error

**Rules:**

- Missing data is EXPECTED, not an error
- Use `status: 'pending'` to mark incomplete calculations
- NEVER abort snapshot if one metric fails
- Log warnings, don't throw exceptions

**Examples:**

```typescript
// ✅ CORRECT
{
  fgos_status: 'pending',
  fgos_score: null,
  reason: 'Insufficient metrics'
}

// ❌ WRONG
throw new Error('Cannot calculate FGOS without ROIC');
```

### 3. Fault Tolerance in Cron Jobs

**Rules:**

- An error in ONE ticker must NOT stop the loop
- An error in ONE chunk must NOT abort the cron
- Always log: SNAPSHOT START, PROFILE MISSING, SECTOR MISSING, SNAPSHOT OK, UPSERT FAILED

**Examples:**

```typescript
// ✅ CORRECT
for (const ticker of tickers) {
  try {
    await processSnapshot(ticker);
    console.log(`[${ticker}] SNAPSHOT OK`);
  } catch (error) {
    console.error(`[${ticker}] SNAPSHOT FAILED:`, error);
    // Continue with next ticker
  }
}

// ❌ WRONG
for (const ticker of tickers) {
  await processSnapshot(ticker); // Will abort on first error
}
```

---

## Financial Logic Rules

### FGOS (Fintra Growth & Operations Score)

**Calculation Requirements:**

```typescript
// ✅ CORRECT - Check requirements before calculating
if (!sector || !hasMinimumMetrics(data)) {
  return {
    fgos_status: "pending",
    fgos_score: null,
    reason: sector ? "Insufficient metrics" : "Sector missing",
  };
}

const score = calculateFGOS(data, sectorBenchmarks);
const confidence = calculateConfidence(data);

return {
  fgos_status: "computed",
  fgos_score: score,
  fgos_confidence: confidence, // ALWAYS include
  fgos_category: categorizeFGOS(score),
};
```

**Prohibited:**

- Inferring sector from company name
- Comparing against wrong sector benchmarks
- Averaging without sector basis
- Omitting confidence score

**Confidence Interpretation:**

- 80-100 → High confidence
- 60-79 → Medium confidence
- <60 → Low confidence

### TTM (Trailing Twelve Months) Construction

**Critical Rules:**

```typescript
// ✅ CORRECT - Sum last 4 quarters
const last4Quarters = getLastNQuarters(ticker, 4);
if (last4Quarters.length < 4) {
  return null; // Do NOT approximate
}

const ttmRevenue = last4Quarters.reduce((sum, q) => sum + q.revenue, 0);
const ttmNetIncome = last4Quarters.reduce((sum, q) => sum + q.netIncome, 0);

// Margins: weighted by revenue
const ttmOperatingMargin =
  last4Quarters.reduce((sum, q) => sum + q.operatingIncome * q.revenue, 0) /
  ttmRevenue;
```

**Prohibited:**

- Computing TTM using averages
- Approximating with fewer than 4 quarters
- Inferring missing quarters from FY

### Temporal Consistency

**Rules:**

- NEVER mix market dates with financial period dates
- NEVER use future data for past calculations (look-ahead bias)
- Always use `as_of_date` for point-in-time calculations

**Examples:**

```typescript
// ✅ CORRECT
async function calculateFGOS(ticker: string, asOfDate: Date) {
  const benchmark = await getBenchmark(sector, asOfDate); // Point-in-time
  const metrics = await getMetrics(ticker, asOfDate); // Only past data
}

// ❌ WRONG
async function calculateFGOS(ticker: string) {
  const benchmark = await getLatestBenchmark(sector); // Uses future data!
}
```

---

## TypeScript & Code Style

### Strict Type Safety

**Rules:**

- TypeScript strict mode is ENABLED
- `any` is ONLY allowed in: bulk ingestion, CSV parsing
- `any` is PROHIBITED in: financial logic, scoring, verdicts

**Examples:**

```typescript
// ✅ CORRECT
interface CompanyMetrics {
  roic: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
}

function calculateFGOS(metrics: CompanyMetrics): FGOSResult {
  // Typed logic
}

// ❌ WRONG
function calculateFGOS(metrics: any): any {
  // NEVER use any here
  // Financial logic
}

// ✅ ACCEPTABLE (bulk ingestion only)
async function parseBulkCSV(csvData: any) {
  // Parsing raw CSV is OK to use any
  const rows = csvData.map((row: any) => ({
    ticker: String(row.ticker),
    revenue: parseFloat(row.revenue) || null,
  }));
}
```

### Naming Conventions

**File/Folder Structure:**

```
✅ CORRECT (kebab-case):
/lib/engine/sector-benchmarks.ts
/lib/engine/fmp-bulk-ingestion.ts

❌ WRONG:
/lib/engine/sectorBenchmarks.ts
/lib/engine/fmp_bulk_ingestion.ts
```

---

## Server Actions Pattern (Data Fetching)

**Critical Architecture Rule:**

### When to Use Server Actions (`lib/actions/*.ts`)

Use Server Actions for:

- ✅ Fetching data for **multiple tickers** (panels, lists, tables)
- ✅ Complex queries with filters/joins/aggregations
- ✅ Data transformations before sending to client
- ✅ Operations requiring admin privileges

**Examples:**

- `lib/actions/resumen.ts` → Ticker detail page (assembles data from 5+ tables)
- `lib/actions/sector-analysis.ts` → Sector panel (filtered list of stocks)
- `lib/actions/peers-analysis.ts` → Peers comparison (competitive analysis)

### When to Use Services (`lib/services/*.ts`)

Use Services for:

- ✅ Fetching data for **single ticker** (individual views)
- ✅ Shared business logic (not DB queries)
- ✅ Type transformations and mappers

**Examples:**

- `lib/services/ticker-view.service.ts` → Single ticker full view

### Pattern Structure

**Server Action (PREFERRED for multi-ticker):**

```typescript
"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { EnrichedStockData } from "@/lib/engine/types";

export async function fetchSectorStocks(filters: {
  sector?: string;
  industry?: string;
  country?: string;
}): Promise<EnrichedStockData[]> {
  // Queries run on SERVER with ADMIN privileges
  const { data } = await supabaseAdmin
    .from("fintra_market_state")
    .select("*")
    .eq("sector", filters.sector);

  return transformData(data);
}
```

**Custom Hook (Orchestration only):**

```typescript
// hooks/useSectorData.ts
import { fetchSectorStocks } from "@/lib/actions/sector-analysis";

export function useSectorData(filters) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchSectorStocks(filters).then(setData);
  }, [filters]);

  return { data };
}
```

### Benefits of Server Actions

| Aspect          | Server Action          | Client Query          |
| --------------- | ---------------------- | --------------------- |
| **Execution**   | Server-side            | Client-side           |
| **Client**      | `supabaseAdmin`        | `supabase` (anon)     |
| **Privileges**  | ✅ Full (service role) | ⚠️ Limited (anon key) |
| **Bundle size** | ✅ No impact           | ❌ Increases          |
| **Security**    | ✅ Queries hidden      | ⚠️ Queries exposed    |
| **Caching**     | ✅ Next.js automatic   | ❌ Manual             |

### Prohibited Patterns

```typescript
// ❌ WRONG - Don't query Supabase directly from hooks for multi-ticker
export function useSectorData() {
  useEffect(() => {
    supabase.from('fintra_market_state').select('*')...
  }, []);
}

// ✅ CORRECT - Use Server Action
export function useSectorData() {
  useEffect(() => {
    fetchSectorStocks(filters).then(setData);
  }, []);
}
```

**Golden Rule:**

> "Multi-ticker queries → Server Actions (`lib/actions/`)
> Single-ticker queries → Services (`lib/services/`)"

---

## Supabase Client Separation

**Critical Security Rule:**

```typescript
// ✅ CORRECT - Frontend/Public APIs
import { supabase } from "@/lib/supabase";

// ✅ CORRECT - Server Actions/Cron jobs/Admin operations
import { supabaseAdmin } from "@/lib/supabase-admin";
```

**Prohibited:**

```typescript
// ❌ WRONG - NEVER use anon key in server actions or crons
import { supabase } from "@/lib/supabase"; // in /lib/actions/** or /app/api/cron/**

// Reason: Server operations need SERVICE ROLE privileges
```

**Rule Summary:**

- `@/lib/supabase` → Frontend and public APIs only
- `@/lib/supabase-admin` → Server Actions, cron jobs, backfills, internal jobs

---

## Data Ingestion from FMP API

### Core Principles

1. **NEVER invent data** - If FMP doesn't provide it, store NULL
2. **NEVER infer missing quarters** - Each quarter is independent
3. **NEVER mix temporal contexts** - Separate financial periods from market dates
4. **Store NULL for non-applicable metrics** - (e.g., EBITDA for banks)

### API-Specific Rules

#### Company Profile Bulk (`/stable/profile-bulk`)

```typescript
// ✅ CORRECT
const profile = {
  ticker: data.symbol,
  sector: data.sector || null, // Store null if missing
  industry: data.industry || null,
  country: data.country || null,
};

// ❌ WRONG
const profile = {
  sector: data.sector || "Unknown", // NEVER use defaults
  marketCap: data.mktCap, // DON'T treat as financial statement data
};
```

#### Financial Statements Bulk

```typescript
// ✅ CORRECT - Store each period separately
for (const statement of statements) {
  await insertFinancialData({
    ticker,
    period_type: statement.period, // 'Q' or 'FY'
    period_label: `${statement.fiscalYear}${statement.period}`,
    period_end_date: statement.date,
    revenue: statement.revenue || null,
    netIncome: statement.netIncome || null,
  });
}

// ❌ WRONG - Aggregating quarters into FY
const fyRevenue = quarters.reduce((sum, q) => sum + q.revenue, 0);
```

#### TTM Construction (CRITICAL)

```typescript
// ✅ CORRECT
async function constructTTM(ticker: string) {
  const quarters = await getLastNQuarters(ticker, 4);

  if (quarters.length < 4) {
    return null; // Do NOT approximate
  }

  // Income statement items: SUM
  const ttmRevenue = quarters.reduce((sum, q) => sum + q.revenue, 0);
  const ttmNetIncome = quarters.reduce((sum, q) => sum + q.netIncome, 0);

  // Margins: weighted by revenue
  const totalRevenue = ttmRevenue;
  const ttmOperatingMargin =
    quarters.reduce(
      (sum, q) => sum + (q.operatingIncome / totalRevenue) * q.revenue,
      0,
    ) / totalRevenue;

  // Balance sheet: latest quarter snapshot
  const ttmTotalAssets = quarters[0].totalAssets;

  return { ttmRevenue, ttmNetIncome, ttmOperatingMargin, ttmTotalAssets };
}

// ❌ WRONG - Using averages
const ttmRevenue = quarters.reduce((sum, q) => sum + q.revenue, 0) / 4; // NEVER average
```

---

## Database Schema Conventions

### Snapshot Structure

**Main table:** `fintra_snapshots`

```typescript
interface FintraSnapshot {
  ticker: string;
  snapshot_date: string; // ISO date

  // Profile (structural data)
  profile_structural: {
    status: "computed" | "pending";
    sector?: string;
    industry?: string;
    marketCap?: number;
  } | null;

  // FGOS
  fgos_status: "computed" | "pending";
  fgos_score: number | null;
  fgos_confidence: number | null; // ALWAYS include if computed
  fgos_category: "High" | "Medium" | "Low" | null;

  // IFS
  ifs: {
    status: "computed" | "pending";
    position?: "Leader" | "Follower" | "Laggard";
    pressure?: 0 | 1 | 2 | 3;
    confidence?: number; // 0-100
  } | null;

  // Valuation
  valuation_relative: {
    status: "computed" | "pending";
    verdict?: "Very Cheap" | "Cheap" | "Fair" | "Expensive" | "Very Expensive";
    percentile?: number; // 0-100
    confidence?: "Low" | "Medium" | "High";
  } | null;

  // Life Cycle
  life_cycle: {
    stage: "Mature" | "Developing" | "Early-Stage" | "Incomplete";
    confidence: number; // 0-100
    trajectory?: "Improving" | "Stable" | "Deteriorating";
  } | null;
}
```

**Critical Rules:**

- Every engine has a `status` field
- `status: 'pending'` is VALID and EXPECTED
- NEVER store partial calculations as 'computed'
- Confidence scores are MANDATORY when status is 'computed'

---

## Error Handling Patterns

### Cron Job Error Handling

```typescript
// ✅ CORRECT - Fault tolerant loop
async function snapshotCron() {
  const tickers = await getAllTickers();

  for (const ticker of tickers) {
    try {
      console.log(`[${ticker}] SNAPSHOT START`);

      const snapshot = await calculateSnapshot(ticker);

      if (!snapshot.profile_structural) {
        console.warn(`[${ticker}] PROFILE MISSING`);
      }

      if (!snapshot.profile_structural?.sector) {
        console.warn(`[${ticker}] SECTOR MISSING`);
      }

      await upsertSnapshot(ticker, snapshot);
      console.log(`[${ticker}] SNAPSHOT OK`);
    } catch (error) {
      console.error(`[${ticker}] UPSERT FAILED:`, error);
      // Continue with next ticker - DO NOT throw
    }
  }
}
```

### API Call Error Handling

```typescript
// ✅ CORRECT
async function fetchFMPData(endpoint: string) {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.error(`FMP API error: ${response.status}`);
      return null; // Return null, don't throw
    }
    return await response.json();
  } catch (error) {
    console.error(`Network error:`, error);
    return null; // Tolerate network failures
  }
}
```

---

## Testing Requirements

### Unit Tests for Financial Logic

```typescript
// ✅ CORRECT - Test edge cases
describe("TTM Construction", () => {
  it("returns null when fewer than 4 quarters", () => {
    const quarters = [q1, q2, q3]; // Only 3 quarters
    const result = constructTTM(quarters);
    expect(result).toBeNull(); // Must NOT approximate
  });

  it("sums revenue correctly for 4 quarters", () => {
    const quarters = [
      { revenue: 100, netIncome: 10 },
      { revenue: 110, netIncome: 12 },
      { revenue: 105, netIncome: 11 },
      { revenue: 115, netIncome: 13 },
    ];
    const result = constructTTM(quarters);
    expect(result.ttmRevenue).toBe(430);
  });

  it("handles null values correctly", () => {
    const quarters = [
      { revenue: 100, netIncome: null }, // Missing data
      { revenue: 110, netIncome: 12 },
      { revenue: 105, netIncome: 11 },
      { revenue: 115, netIncome: 13 },
    ];
    const result = constructTTM(quarters);
    expect(result.ttmNetIncome).toBeNull(); // Propagate null
  });
});
```

---

## Common Patterns

### Reading Snapshot Data

```typescript
// ✅ CORRECT - Always check status
async function getCompanyFGOS(ticker: string) {
  const { data } = await supabase
    .from("fintra_snapshots")
    .select("fgos_status, fgos_score, fgos_confidence")
    .eq("ticker", ticker)
    .single();

  if (data.fgos_status === "pending") {
    return {
      available: false,
      reason: "FGOS calculation pending",
    };
  }

  return {
    available: true,
    score: data.fgos_score,
    confidence: data.fgos_confidence,
  };
}
```

### Calculating with Benchmarks

```typescript
// ✅ CORRECT - Validate benchmark before using
async function calculateMetricScore(
  value: number,
  sector: string,
  metric: string,
) {
  const benchmark = await getSectorBenchmark(sector, metric);

  if (!benchmark) {
    console.warn(`No benchmark for ${sector} ${metric}`);
    return null; // Cannot score without benchmark
  }

  if (benchmark.universe_size < 20) {
    console.warn(`Low confidence benchmark (n=${benchmark.universe_size})`);
    // Apply low confidence adjustment
  }

  // Interpolate percentile
  const percentile = interpolatePercentile(value, benchmark);
  return percentile;
}
```

---

## Architecture Patterns

### Dual Head Architecture (Web + Desktop)

**Rule:** The desktop client (future C#/.NET app) must ONLY read `fintra_snapshots`.

**Prohibited:**

```csharp
// ❌ WRONG - Desktop client recalculating FGOS
var fgos = CalculateFGOS(metrics); // NEVER do this

// ✅ CORRECT - Desktop client reads snapshot
var snapshot = await supabase
  .From<FintraSnapshot>("fintra_snapshots")
  .Where(x => x.Ticker == ticker)
  .Single();
```

**Rationale:**

- Single source of truth (cron jobs calculate once)
- Web and Desktop always show same numbers
- No logic duplication

---

## What to Ask When Uncertain

If GitHub Copilot is generating code and encounters ambiguity, it should prompt you to clarify:

**Financial Logic:**

- "Should this metric be calculated for financial sector? (e.g., ROIC for banks)"
- "What should happen if fewer than 4 quarters are available for TTM?"
- "Should this comparison use sector or industry benchmarks?"

**Data Handling:**

- "Should missing data return null or 'pending' status?"
- "Should this error stop the cron or continue to next ticker?"

**Temporal Logic:**

- "Is this calculation as-of a specific date or using latest data?"
- "Should this use point-in-time benchmarks or current benchmarks?"

---

## Quick Reference Checklist

Before committing code, verify:

- [ ] No `any` types in financial logic
- [ ] Missing data returns `null` or `status: 'pending'` (not exceptions)
- [ ] Cron loops are fault-tolerant (try-catch per ticker)
- [ ] TTM uses sum of 4 quarters (not averages)
- [ ] Confidence scores included when status is 'computed'
- [ ] Supabase admin client used in crons (not anon client)
- [ ] File names use kebab-case
- [ ] Temporal consistency maintained (no look-ahead bias)
- [ ] Logs include required events (SNAPSHOT START, etc.)
- [ ] Null propagates correctly (no default fallbacks)

---

## Project File Structure Reference

```
fintra/
├── app/
│   ├── api/
│   │   └── cron/           # Uses @/lib/supabase-admin
│   └── (routes)/           # Uses @/lib/supabase
├── lib/
│   ├── actions/            # Server Actions (multi-ticker queries)
│   │   ├── resumen.ts           # Ticker detail page assembly
│   │   ├── sector-analysis.ts   # Sector panel data fetching
│   │   └── peers-analysis.ts    # Peers comparison data
│   ├── services/           # Services (single-ticker queries)
│   │   └── ticker-view.service.ts  # Single ticker full view
│   ├── engine/             # Financial calculation logic
│   │   ├── fintra-brain.ts      # FGOS calculator
│   │   ├── ifs-calculator.ts    # IFS calculator
│   │   ├── valuation-calculator.ts
│   │   └── life-cycle-calculator.ts
│   ├── supabase.ts         # Anon client (frontend)
│   ├── supabase-admin.ts   # Service role (server actions, crons)
│   └── utils/
├── hooks/                  # Custom React hooks (orchestration only)
│   ├── useSectorData.ts         # Calls fetchSectorStocks (Server Action)
│   └── usePeersData.ts          # Calls fetchPeersData (Server Action)
└── docs/
    ├── metodologia/
    │   ├── fgos.md
    │   ├── ifs.md
    │   └── valuation.md
    └── reglas/              # Rule files (uploaded)
        ├── principiofundamental.md
        ├── pendingnoeserror.md
        ├── fgos.md
        ├── cronjobs.md
        └── manejodeapidefmp.md
```

---

## Final Reminder

**When in doubt, follow this hierarchy:**

1. **Financial correctness** > UI convenience
2. **Data integrity** > Performance
3. **Explicit null** > Inferred defaults
4. **Fault tolerance** > Fast failure
5. **Point-in-time** > Latest data (for backtesting)

**Golden Rule:**

> "If financial correctness and UI convenience conflict, financial correctness ALWAYS wins."

---

**Version:** 1.0  
**Last Updated:** 2025-02-01  
**Maintained by:** Fintra Engineering Team

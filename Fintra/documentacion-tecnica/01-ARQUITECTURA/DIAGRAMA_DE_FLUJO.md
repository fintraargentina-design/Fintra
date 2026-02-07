# 📊 DIAGRAMA DE FLUJO - FINTRA

**Última actualización:** 2026-02-07  
**Versión:** 1.1  
**Propósito:** Visualización completa de la arquitectura y flujo de datos de Fintra

---

## 🎯 ÍNDICE

1. [Arquitectura General](#1-arquitectura-general)
2. [Flujo de Datos (Data Pipeline)](#2-flujo-de-datos-data-pipeline)
3. [Orden de Ejecución de Cron Jobs](#3-orden-de-ejecución-de-cron-jobs)
4. [Engines de Scoring](#4-engines-de-scoring)
5. [Flujo Frontend](#5-flujo-frontend)
6. [Backfills y Mantenimiento](#6-backfills-y-mantenimiento)
7. [Arquitectura de Base de Datos](#7-arquitectura-de-base-de-datos)

---

## 1. ARQUITECTURA GENERAL

### 1.1 Vista de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                         FINTRA PLATFORM                         │
│                   Financial Analysis System                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
         ┌──────▼──────┐                 ┌──────▼──────┐
         │  WEB CLIENT │                 │ DESKTOP APP │
         │  (Next.js)  │                 │  (C#/.NET)  │
         └──────┬──────┘                 └──────┬──────┘
                │                               │
                └───────────────┬───────────────┘
                                │
                     ┌──────────▼──────────┐
                     │  SUPABASE (Server)  │
                     │  - PostgreSQL DB    │
                     │  - Auth             │
                     │  - Storage          │
                     └──────────┬──────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
         ┌──────▼──────┐ ┌──────▼──────┐ ┌────▼─────┐
         │   RAW DATA  │ │ LAYER 2 TTM │ │ LAYER 3  │
         │ (L1 Tables) │ │  (Pre-calc) │ │(Snapshots)│
         └─────────────┘ └─────────────┘ └──────────┘
```

### 1.2 Principios Arquitectónicos

**🔐 Reglas de Oro:**

1. **Fintra no inventa datos** → `NULL` > defaults
2. **Single source of truth** → Cron jobs calculan 1 vez
3. **Dual head** → Web y Desktop leen mismos snapshots
4. **Fault tolerant** → Error en 1 ticker ≠ abort total
5. **Point-in-time** → No look-ahead bias

**📦 Layers:**

- **Layer 1:** Raw data (FMP API → datos_financieros, prices_daily)
- **Layer 2:** Pre-calculated (TTM, performance windows)
- **Layer 3:** Snapshots (FGOS, IFS, Valuation, Scenarios)

---

## 2. FLUJO DE DATOS (Data Pipeline)

### 2.1 Pipeline Completo

```
╔═══════════════════════════════════════════════════════════════╗
║                    DATA INGESTION (LAYER 1)                   ║
╚═══════════════════════════════════════════════════════════════╝
                                │
                    ┌───────────┴───────────┐
                    │                       │
            ┌───────▼────────┐    ┌────────▼─────────┐
            │   FMP API      │    │   EOD Prices     │
            │ /v3/bulk/...   │    │  /v3/historical  │
            └───────┬────────┘    └────────┬─────────┘
                    │                      │
        ┌───────────┼──────────────────────┼────────────┐
        │           │                      │            │
┌───────▼──────┐ ┌──▼────────┐ ┌──────────▼─┐ ┌────────▼──────┐
│company_      │ │datos_      │ │ prices_    │ │ dividends     │
│profiles      │ │financieros │ │ daily      │ │               │
│              │ │(Quarterly) │ │            │ │               │
└───────┬──────┘ └──┬─────────┘ └──────────┬─┘ └────────┬──────┘
        │           │                      │            │
╔═══════╧═══════════╧══════════════════════╧════════════╧═══════╗
║             TRANSFORMATION & AGGREGATION (LAYER 2)            ║
╚═══════════════════════════════════════════════════════════════╝
                                │
                    ┌───────────┴───────────┐
                    │                       │
        ┌───────────▼─────────┐   ┌────────▼──────────┐
        │   TTM Calculator    │   │ Industry Grouping │
        │  computeTTMv2()     │   │  Classification   │
        └───────────┬─────────┘   └────────┬──────────┘
                    │                      │
        ┌───────────┼──────────────────────┼───────────┐
        │           │                      │           │
┌───────▼──────┐ ┌──▼────────┐ ┌──────────▼─┐ ┌───────▼──────┐
│datos_        │ │sector_     │ │industry_   │ │performance_  │
│valuacion_ttm │ │benchmarks  │ │performance │ │windows       │
│              │ │            │ │            │ │              │
└───────┬──────┘ └──┬─────────┘ └──────────┬─┘ └───────┬──────┘
        │           │                      │           │
╔═══════╧═══════════╧══════════════════════╧═══════════╧═══════╗
║                  SCORING & ENGINES (LAYER 3)                  ║
╚═══════════════════════════════════════════════════════════════╝
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
    ┌───────▼──────┐    ┌───────▼──────┐   ┌───────▼──────┐
    │  FGOS Engine │    │  IFS Engine  │   │ IQS Engine   │
    │  (Quality)   │    │  (Momentum)  │   │ (Structural) │
    └───────┬──────┘    └───────┬──────┘   └───────┬──────┘
            │                   │                   │
            │         ┌─────────┼─────────┐         │
            │         │                   │         │
    ┌───────▼─────────▼─────┐   ┌─────────▼─────────▼────┐
    │   Moat & Sentiment    │   │  Valuation Analysis    │
    │   Quality Brakes      │   │  Relative Positioning  │
    └───────┬───────────────┘   └─────────┬──────────────┘
            │                             │
            └──────────────┬──────────────┘
                           │
                  ┌────────▼────────┐
                  │ fintra_snapshots│
                  │                 │
                  │  - FGOS         │
                  │  - IFS          │
                  │  - IQS (IFS_FY) │
                  │  - Moat         │
                  │  - Sentiment    │
                  │  - Valuation    │
                  └────────┬────────┘
                           │
╔═══════════════════════════╧═══════════════════════════════════╗
║                      CONSUMPTION LAYER                        ║
╚═══════════════════════════════════════════════════════════════╝
                           │
            ┌──────────────┼──────────────┐
            │                             │
    ┌───────▼──────┐              ┌───────▼──────┐
    │  Web Client  │              │Desktop Client│
    │  (Next.js)   │              │   (C#/.NET)  │
    │              │              │              │
    │  - Actions   │              │  - Read Only │
    │  - Services  │              │  - Snapshots │
    │  - Components│              │              │
    └──────────────┘              └──────────────┘
```

---

## 3. ORDEN DE EJECUCIÓN DE CRON JOBS

### 3.1 Ejecución Secuencial (Nightly)

```
⏰ EXECUTION ORDER (Daily @ 2-4 AM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔵 NIVEL 1: RAW DATA INGESTION
┌────────────────────────────────────────────┐
│ 1. fmp-bulk                   [30-60 min] │
│    ↳ company_profiles                     │
│    ↳ datos_financieros                    │
│    ↳ datos_performance                    │
│    ↳ datos_valuacion                      │
│                                            │
│ 2. dividends-bulk-v2           [5-10 min] │
│    ↳ dividends                            │
│                                            │
│ 3. eod-prices-bulk             [20-30 min]│
│    ↳ prices_daily                         │
└────────────────────────────────────────────┘
         ⬇️  (Wait for completion)

🟢 NIVEL 2: CLASSIFICATION & TTM
┌────────────────────────────────────────────┐
│ 4. industry-classification-sync [5 min]   │
│    ↳ industry_classification              │
│    ↳ asset_industry_map                   │
│                                            │
│ 5. ttm-valuation-cron          [15-20 min]│
│    ↳ datos_valuacion_ttm                  │
│                                            │
│ 6. master-benchmark            [10-15 min]│
│    ↳ sector_benchmarks                    │
│    ↳ sector_stats                         │
│    ↳ industry_stats                       │
└────────────────────────────────────────────┘
         ⬇️  (Wait for completion)

🟡 NIVEL 3: PERFORMANCE & AGGREGATIONS
┌────────────────────────────────────────────┐
│ 7. industry-performance-aggregator        │
│    ↳ industry_performance         [10 min]│
│                                            │
│ 8. performance-windows-cron               │
│    ↳ performance_windows         [15 min] │
└────────────────────────────────────────────┘
         ⬇️  (Wait for completion)

🔴 NIVEL 4: SCORING & SNAPSHOTS (CRITICAL)
┌────────────────────────────────────────────┐
│ 9. bulk-update                 [60-120 min]│
│    ↳ Calcula FGOS (Quality Score)        │
│    ↳ Calcula IFS (Industry Position)     │
│    ↳ Calcula IQS (Structural Quality)    │
│    ↳ Calcula Moat & Sentiment            │
│    ↳ Calcula Valuation (Relative)        │
│    ↳ Aplica Quality Brakes               │
│    ↳ Genera Scenarios & Verdicts         │
│    ↳ OUTPUT: fintra_snapshots (FINAL)    │
└────────────────────────────────────────────┘
         ⬇️  (READY)

✅ NIVEL 5: FRONTEND READS FROM SNAPSHOTS
┌────────────────────────────────────────────┐
│ Web & Desktop clients                      │
│ ↳ Read fintra_snapshots (read-only)       │
│ ↳ NO calculations on client side          │
└────────────────────────────────────────────┘

⏱️  TOTAL EXECUTION TIME: 2-4 hours
```

### 3.2 Dependencias Críticas

```
fmp-bulk (L1)
    │
    ├─→ industry-classification-sync (L2)
    │   └─→ industry-performance-aggregator (L3)
    │
    ├─→ ttm-valuation-cron (L2)
    │   └─→ Usa: datos_financieros + prices_daily
    │
    ├─→ master-benchmark (L2)
    │   └─→ bulk-update (L4) ← Requiere benchmarks
    │
    └─→ bulk-update (L4)
        ├─→ FGOS (usa sector_benchmarks)
        ├─→ IFS (usa performance_windows)
        ├─→ IQS (usa datos_financieros FY)
        ├─→ Moat (usa ratios históricos)
        ├─→ Valuation (usa sector PE, datos_valuacion_ttm)
        └─→ Scenarios (usa all engines)
```

---

## 4. ENGINES DE SCORING

### 4.1 FGOS (Financial Growth & Operations Score)

```
┌──────────────────────────────────────────────────────┐
│              FGOS CALCULATION ENGINE                 │
└──────────────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼─────┐ ┌────▼─────┐ ┌───▼──────────┐
│Profitability│ │Efficiency│ │   Solvency   │
│  (30%)      │ │  (25%)   │ │    (20%)     │
│             │ │          │ │              │
│- ROIC       │ │- Margin  │ │- Debt/Equity │
│- ROE        │ │- ROA     │ │- Current R.  │
│- ROA        │ │- Turnover│ │- ICR         │
└───────┬─────┘ └────┬─────┘ └───┬──────────┘
        │            │           │
        └────────────┼───────────┘
                     │
            ┌────────▼────────┐
            │  Growth (25%)   │
            │- Revenue growth │
            │- Income growth  │
            └────────┬────────┘
                     │
        ┌────────────▼────────────┐
        │  SECTOR BENCHMARK       │
        │  COMPARISON             │
        │  (Percentile-based)     │
        └────────┬────────────────┘
                 │
        ┌────────▼────────┐
        │ CONFIDENCE      │
        │ ADJUSTMENT      │
        │ (Data quality)  │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ QUALITY BRAKES  │
        │ - Altman Z<1.8  │
        │ - Piotroski ≤3  │
        └────────┬────────┘
                 │
            ┌────▼─────┐
            │   FGOS   │
            │  0-100   │
            │          │
            │ + Category│
            │ + Confidence│
            └──────────┘
```

### 4.2 IFS (Industry Financial Standing)

```
┌──────────────────────────────────────────────────────┐
│         IFS CALCULATION ENGINE (Live Windows)        │
└──────────────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼─────┐ ┌────▼─────┐ ┌───▼──────┐
│SHORT BLOCK  │ │MID BLOCK │ │LONG BLOCK│
│  (2 votes)  │ │(3 votes) │ │(2 votes) │
│             │ │          │ │          │
│- 1M window  │ │- 6M      │ │- 3Y      │
│- 3M window  │ │- 1Y      │ │- 5Y      │
│             │ │- 2Y      │ │          │
└───────┬─────┘ └────┬─────┘ └───┬──────┘
        │            │           │
        └────────────┼───────────┘
                     │
        ┌────────────▼────────────┐
        │  BLOCK VOTING SYSTEM    │
        │  - Leader if win 2/3    │
        │  - Laggard if lose 2/3  │
        │  - Follower otherwise   │
        └────────┬────────────────┘
                 │
        ┌────────▼────────┐
        │ CONFIDENCE      │
        │ (0-100)         │
        │ Based on:       │
        │ - Data coverage │
        │ - Consistency   │
        └────────┬────────┘
                 │
            ┌────▼─────┐
            │   IFS    │
            │ Position │
            │          │
            │ Leader / │
            │ Follower/│
            │ Laggard  │
            └──────────┘
```

### 4.3 IQS (Industry Quality Score - IFS_FY)

```
┌──────────────────────────────────────────────────────┐
│      IQS CALCULATION ENGINE (Structural/Annual)      │
└──────────────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼─────┐ ┌────▼─────┐ ┌───▼──────────┐
│  FY 2021    │ │ FY 2022  │ │   FY 2023    │
│             │ │          │ │              │
│- ROIC       │ │- ROIC    │ │- ROIC        │
│- Margin     │ │- Margin  │ │- Margin      │
│- Growth     │ │- Growth  │ │- Growth      │
│- Leverage   │ │- Leverage│ │- Leverage    │
│- FCF Yield  │ │- FCF Y.  │ │- FCF Yield   │
└───────┬─────┘ └────┬─────┘ └───┬──────────┘
        │            │           │
        └────────────┼───────────┘
                     │
        ┌────────────▼────────────┐
        │  PERCENTILE SCORING     │
        │  vs INDUSTRY (not sect) │
        │                         │
        │  Weights:               │
        │  - ROIC: 30%            │
        │  - Margin: 25%          │
        │  - Growth: 20%          │
        │  - Leverage: 15%        │
        │  - FCF Yield: 10%       │
        └────────┬────────────────┘
                 │
        ┌────────▼────────┐
        │ CONFIDENCE      │
        │ Based on:       │
        │ - Data quality  │
        │ - Industry size │
        └────────┬────────┘
                 │
            ┌────▼─────┐
            │   IQS    │
            │ By FY    │
            │          │
            │ Percentile│
            │ Position  │
            └──────────┘
```

### 4.4 Integration Flow

```
        ┌──────────┐
        │   FGOS   │────┐
        │ (Quality)│    │
        └──────────┘    │
                        │
        ┌──────────┐    │
        │   IFS    │────┤
        │(Momentum)│    │
        └──────────┘    │
                        │     ┌────────────────┐
        ┌──────────┐    │     │                │
        │   IQS    │────┼────→│  FINAL VERDICT │
        │(Structural)   │     │                │
        └──────────┘    │     │  Exceptional   │
                        │     │  Strong        │
        ┌──────────┐    │     │  Balanced      │
        │   Moat   │────┤     │  Fragile       │
        │          │    │     │  Speculative   │
        └──────────┘    │     │                │
                        │     └────────────────┘
        ┌──────────┐    │
        │Sentiment │────┤
        │          │    │
        └──────────┘    │
                        │
        ┌──────────┐    │
        │Valuation │────┘
        │          │
        └──────────┘
```

---

## 5. FLUJO FRONTEND

### 5.1 Arquitectura Web (Next.js)

```
┌─────────────────────────────────────────────────────────────┐
│                      USER REQUEST                           │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼────────┐    ┌────────▼──────────┐
        │  ROUTE         │    │  API ROUTE        │
        │  /ticker/[id]  │    │  /api/chat        │
        └───────┬────────┘    └────────┬──────────┘
                │                      │
                │              ┌───────▼────────┐
                │              │ OPENAI API     │
                │              │ (AI Analysis)  │
                │              └───────┬────────┘
                │                      │
        ┌───────▼──────────────────────▼──────┐
        │    SERVER ACTIONS                   │
        │    (lib/actions/*.ts)               │
        │                                     │
        │    - fetchResumen.ts                │
        │    - fetchSectorAnalysis.ts         │
        │    - fetchPeersAnalysis.ts          │
        └───────┬─────────────────────────────┘
                │
                │ (Server-side queries)
                │
        ┌───────▼─────────────┐
        │  SUPABASE ADMIN     │
        │  (Service Role)     │
        │                     │
        │  - Full privileges  │
        │  - Complex queries  │
        │  - Joins/aggregates │
        └───────┬─────────────┘
                │
        ┌───────▼─────────────┐
        │  fintra_snapshots   │
        │  (Read-only)        │
        │                     │
        │  NO calculations    │
        │  here - all         │
        │  pre-computed       │
        └───────┬─────────────┘
                │
        ┌───────▼─────────────┐
        │  COMPONENTS         │
        │  (React/Next.js)    │
        │                     │
        │  - Cards            │
        │  - Charts           │
        │  - Tables           │
        │  - Scenarios        │
        └─────────────────────┘
```

### 5.2 Data Flow Pattern

```
USER
  │
  ▼
COMPONENT (RSC)
  │
  ├─→ Server Action (lib/actions/resumen.ts)
  │     │
  │     ├─→ supabaseAdmin.from('fintra_snapshots')
  │     │     .select('fgos_*, ifs, ifs_memory, quality_brakes')
  │     │     .eq('ticker', 'AAPL')
  │     │
  │     ├─→ supabaseAdmin.from('datos_valuacion_ttm')
  │     │     .select('*')
  │     │     .eq('ticker', 'AAPL')
  │     │     .order('valuation_date', desc)
  │     │
  │     └─→ supabaseAdmin.from('company_profiles')
  │           .select('sector, industry')
  │           .eq('ticker', 'AAPL')
  │
  └─→ ASSEMBLED DATA OBJECT
        │
        └─→ RENDER COMPONENT
              │
              ├─→ FGOSCard (score + breakdown)
              ├─→ IFSCard (position + windows)
              ├─→ ValuationCard (PE, EV/EBITDA)
              ├─→ ScenariosPanel (alerts + focus)
              └─→ VerdictCard (final synthesis)
```

---

## 6. BACKFILLS Y MANTENIMIENTO

### 6.1 Backfill Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKFILL DECISION TREE                   │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼────────┐    ┌────────▼──────────┐
        │ HISTORICAL     │    │ INCREMENTAL       │
        │ BACKFILL       │    │ UPDATE            │
        │ (First time)   │    │ (Daily cron)      │
        └───────┬────────┘    └────────┬──────────┘
                │                      │
                │                      │
    ┌───────────▼───────────┐  ┌───────▼────────────┐
    │ TTM Valuation         │  │ ttm-valuation-cron │
    │ backfill-ttm-         │  │ (Auto-incremental) │
    │ valuation.ts          │  │                    │
    │                       │  │ Detects new        │
    │ - Process ALL tickers │  │ quarters only      │
    │ - Batches of 100      │  └────────────────────┘
    │ - Automatic loop      │
    │ - Idempotent          │
    └───────────┬───────────┘
                │
                │
    ┌───────────▼───────────┐
    │ Performance Windows   │
    │ backfill-performance- │
    │ windows.ts            │
    │                       │
    │ - Populates from      │
    │   datos_performance   │
    │ - 7 windows/ticker    │
    │ - Adds alpha calc     │
    └───────────┬───────────┘
                │
                │
    ┌───────────▼───────────┐
    │ Shares Outstanding    │
    │ backfill-shares-      │
    │ from-ev.ts            │
    │                       │
    │ - Calculates shares   │
    │   from EV formula     │
    │ - Fills gaps in data  │
    └───────────────────────┘
```

### 6.2 Maintenance Scripts

```
BACKFILLS (scripts/backfill/)
│
├─ backfill-ttm-valuation.ts ✅
│  └─ Status: OPERATIONAL (TTM historical ratios)
│
├─ backfill-performance-windows.ts ✅
│  └─ Status: DISPONIBLE (Popula performance_windows)
│
├─ backfill-shares-from-ev.ts ✅
│  └─ Status: DISPONIBLE (Shares from EV calculation)
│
├─ backfill-ticker-full.ts ✅
│  └─ Status: WORKING (Price history)
│
├─ backfill-sector-performance.ts ✅
│  └─ Status: WORKING
│
├─ backfill-industry-performance-historical.ts ✅
│  └─ Status: WORKING
│
└─ backfill-valuation-history.ts ✅
   └─ Status: WORKING (Alternative valuation backfill)
```

---

## 7. ARQUITECTURA DE BASE DE DATOS

### 7.1 Tablas Principales (Schema)

```
┌──────────────────────────────────────────────────────────────┐
│                     SUPABASE TABLES                          │
└──────────────────────────────────────────────────────────────┘

LAYER 1: RAW DATA
├─ company_profiles          (40K rows)
│  └─ ticker, sector, industry, country, marketCap
│
├─ datos_financieros         (1.6M rows)
│  └─ ticker, period_type, period_end_date
│     revenue, ebitda, net_income, total_debt
│     cash_and_equivalents, weighted_shares_out
│     (cash viene directo de FMP, no requiere backfill)
│
├─ prices_daily              (50M+ rows)
│  └─ ticker, price_date, open, high, low, close, volume
│
└─ dividends                 (500K rows)
   └─ ticker, ex_date, amount, type

LAYER 2: PRE-CALCULATED
├─ datos_valuacion_ttm           (1.6M target)
│  └─ ticker, valuation_date, price
│     revenue_ttm, ebitda_ttm, net_income_ttm
│     eps_ttm, pe_ratio, ev_ebitda
│     market_cap, enterprise_value
│
├─ sector_benchmarks         (500 rows)
│  └─ sector, metric, p10-p90, mean, std_dev
│
├─ industry_classification   (300 rows)
│  └─ industry, sector, category
│
├─ industry_performance      (10K rows)
│  └─ industry, window, return_pct, rank
│
└─ performance_windows       (Populated via backfill)
   └─ ticker, window, return_pct, vs_sector, alpha
      (7 windows × ~40K tickers = ~280K rows)

LAYER 3: SNAPSHOTS
└─ fintra_snapshots          (40K rows)
   └─ ticker, snapshot_date
      fgos_*, ifs, ifs_memory, quality_brakes
      moat_*, sentiment_*, valuation_*
      scenarios, verdict

SUPPORTING
├─ fintra_universe           (40K rows)
│  └─ ticker, is_active, exchange
│
├─ asset_industry_map        (40K rows)
│  └─ ticker, industry
│
└─ sector_stats              (500 rows)
   └─ sector, metric, value, updated_at
```

### 7.2 Relaciones (Entity Relationship)

```
company_profiles (1)
    │
    │ ticker
    │
    ├───→ fintra_snapshots (1:1)
    │     └─ Main output table
    │
    ├───→ datos_financieros (1:N)
    │     └─ Quarterly/Annual data
    │
    ├───→ datos_valuacion_ttm (1:N)
    │     └─ TTM ratios historical
    │
    ├───→ prices_daily (1:N)
    │     └─ Daily OHLCV
    │
    └───→ dividends (1:N)
          └─ Dividend history

industry_classification (1)
    │
    │ industry
    │
    ├───→ asset_industry_map (1:N)
    │     └─ ticker → industry
    │
    └───→ industry_performance (1:N)
          └─ Aggregated returns

sector_benchmarks (1)
    │
    │ sector
    │
    └───→ Used by FGOS scoring
```

---

## 8. PUNTOS CRÍTICOS DE INTEGRACIÓN

### 8.1 Data Quality Checkpoints

```
┌────────────────────────────────────────────────────────────┐
│             QUALITY GATES & VALIDATIONS                    │
└────────────────────────────────────────────────────────────┘

1️⃣  FMP Bulk Ingestion
    ├─ Verify: datos_financieros count > 1.5M
    ├─ Verify: Weighted_shares_out coverage > 50%
    └─ Alert: If cash_and_equivalents = 0%

2️⃣  TTM Valuation
    ├─ Verify: 4 quarters exist before computing TTM
    ├─ Propagate NULL: If any quarter metric is NULL
    └─ Skip: If price data missing for valuation_date

3️⃣  Sector Benchmarks
    ├─ Require: Min 20 companies per sector
    ├─ Alert: If confidence < 60%
    └─ Fallback: Use super-sector if industry too small

4️⃣  FGOS Scoring
    ├─ Check: Sector benchmark exists
    ├─ Apply: Quality Brakes (Altman Z, Piotroski)
    └─ Status: 'pending' if insufficient data

5️⃣  Snapshots
    ├─ Upsert: Always update existing snapshot
    ├─ Log: Missing profile, sector, or industry
    └─ Continue: Don't abort on single ticker failure
```

---

## 9. DECISIONES ARQUITECTÓNICAS CLAVE

### 9.1 Por qué Snapshots?

**Problema:** Calcular scores en tiempo real es costoso
**Solución:** Pre-calcular todo en cron jobs nocturnos

**Ventajas:**

- ⚡ Frontend ultra-rápido (solo lecturas)
- 🔒 Consistencia garantizada (mismo cálculo para todos)
- 🎯 Desktop client simplificado (no lógica de negocio)
- 🛡️ Resilencia (si calculation falla, frontend sigue up)

### 9.2 Por qué Server Actions?

**Problema:** Queries complejas con múltiples joins
**Solución:** Server Actions con supabaseAdmin

**Ventajas:**

- 🔐 Full privileges (service role)
- 📦 Bundling automático (no impacta client size)
- 🔍 Queries ocultas (no expuestas al navegador)
- ⚡ Next.js caching automático

### 9.3 Por qué NULL > 0?

**Problema:** Datos faltantes
**Solución:** "Fintra no inventa datos"

**Ventajas:**

- 🎯 Transparencia total
- 🔍 Facilita debugging (NULL = dato faltante, no error)
- 📊 Análisis honestos (no oculta problemas de data)
- 🛡️ Evita decisiones basadas en datos falsos

---

## 🔗 REFERENCIAS

### Documentación Consolidada (Feb 2026)

**04-ENGINES/** - Motores de Análisis

- [README.md](04-ENGINES/README.md) - Índice principal
- [FINTRA_SCORES_EXPLICACION.md](04-ENGINES/FINTRA_SCORES_EXPLICACION.md) - Documentación técnica completa (11 scores, 2,315 líneas)
- [INFORME_CONCEPTOS_FUNDAMENTALES.md](04-ENGINES/INFORME_CONCEPTOS_FUNDAMENTALES.md) - Resumen ejecutivo
- [QUALITY_BRAKES_GUIDE.md](04-ENGINES/QUALITY_BRAKES_GUIDE.md) - Frenos de calidad

**05-CRON-JOBS/** - Ejecución y Orden

- [README.md](05-CRON-JOBS/README.md) - Índice principal
- [CRON_JOBS_MASTER_GUIDE.md](05-CRON-JOBS/CRON_JOBS_MASTER_GUIDE.md) - Guía completa de ejecución (consolidado)
- [RUN-CRONS-README.md](05-CRON-JOBS/RUN-CRONS-README.md) - Scripts ejecutables

**06-BACKFILLS/** - Scripts de Poblado Inicial

- [README.md](06-BACKFILLS/README.md) - Índice y guía rápida
- [00-BACKFILL_INSTRUCTIONS.md](06-BACKFILLS/00-BACKFILL_INSTRUCTIONS.md) - Catálogo completo de backfills
- [TTM_HISTORICAL_VALUATION_IMPLEMENTATION.md](06-BACKFILLS/TTM_HISTORICAL_VALUATION_IMPLEMENTATION.md) - Implementación técnica

**Otras Carpetas:**

- [01-ARQUITECTURA/](01-ARQUITECTURA/) - Documentos de diseño
- [03-DATA-PIPELINE/](03-DATA-PIPELINE/) - Detalles de ingesta
- [08-DATABASE/](08-DATABASE/) - Schema completo
- [10-TROUBLESHOOTING/](10-TROUBLESHOOTING/) - Resolución de problemas

---

**Última revisión:** 2026-02-07  
**Versión:** 1.1  
**Mantenido por:** Fintra Engineering Team
**Consolidación:** Feb 2026 (10 docs en 04-ENGINES → 4, 4 docs en 05-CRON-JOBS → 2)

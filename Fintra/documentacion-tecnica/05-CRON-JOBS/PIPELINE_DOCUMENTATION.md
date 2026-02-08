# 📊 Documentación Completa del Pipeline de Datos - Fintra

**Fecha de Documentación:** 6 de febrero de 2026  
**Autor:** Sistema de auditoría técnica  
**Versión:** 1.0

---

## 🎯 RESUMEN EJECUTIVO

El pipeline de Fintra es un sistema de **19 jobs orquestados** que ejecutan secuencialmente cada noche para:

1. **Sincronizar universo de tickers** (10,000+ empresas)
2. **Descargar datos financieros** de FMP API (estados financieros, precios, ratios)
3. **Calcular métricas agregadas** (sectores, industrias, benchmarks)
4. **Generar snapshots diarios** con engines propietarios (FGOS, IFS, Valuation, etc.)

**Tiempo total de ejecución:** 2-4 horas (dependiendo de volumen)  
**Fuente principal de datos:** Financial Modeling Prep (FMP) API  
**Base de datos:** Supabase (PostgreSQL)  
**Orquestador:** `run-master-cron.ts`

---

## 📋 ÍNDICE

1. [Diagrama de Flujo del Pipeline](#diagrama-de-flujo)
2. [Descripción Detallada de Cada Job](#jobs-detallados)
3. [Dependencias entre Jobs](#dependencias)
4. [Tablas de Supabase Utilizadas](#tablas)
5. [Flujo de Datos Completo](#flujo-datos)
6. [Troubleshooting](#troubleshooting)

---

## 🔄 DIAGRAMA DE FLUJO DEL PIPELINE {#diagrama-de-flujo}

```
┌─────────────────────────────────────────────────────────────────┐
│                    INICIO DEL PIPELINE DIARIO                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 01 - SYNC UNIVERSE                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  FMP API (profile-bulk)                                   │
│ PROCESO: Descarga 10,000+ perfiles de empresas                  │
│ OUTPUT: fintra_universe (tickers activos)                       │
│ FUNCIÓN: Define el universo de trabajo del día                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 02 - INDUSTRY CLASSIFICATION SYNC                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (fintra_universe, company_profile)             │
│ PROCESO: Sincroniza clasificaciones de industria                │
│ OUTPUT: industry_metadata                                       │
│ FUNCIÓN: Mantiene coherencia sector → industrias                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 03 - PRICES DAILY BULK                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  FMP API (eod-bulk)                                       │
│ PROCESO: Descarga precios EOD (últimos 5 días por default)      │
│ OUTPUT: prices_daily                                            │
│ FUNCIÓN: Base para cálculos de performance y market state       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 04 - FINANCIALS BULK (CRÍTICO)                                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  FMP API (income/balance/cashflow bulk, TTM bulk)        │
│ PROCESO:                                                         │
│   1. Descarga 3 estados financieros (FY + Q)                    │
│   2. Descarga key-metrics-ttm y ratios-ttm                      │
│   3. Deriva métricas (ROIC, margins, ratios)                    │
│   4. Chunking defensivo (2000 tickers/batch)                    │
│ OUTPUT: datos_financieros (50,000+ rows/día)                   │
│ FUNCIÓN: Core financials para TODOS los engines                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 04B - INCREMENTAL TTM VALUATION                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (datos_financieros - últimos 4 quarters)       │
│ PROCESO:                                                         │
│   1. Detecta tickers con Latest Quarter > Latest TTM            │
│   2. Construye TTM (suma 4 quarters para P&L, last Q para BS)   │
│   3. Calcula valuation multiples (P/E, EV/EBITDA, P/FCF)        │
│ OUTPUT: datos_financieros (rows con period_type='TTM')         │
│ FUNCIÓN: Actualiza TTM solo cuando hay new quarter cerrado      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 05 - COMPANY PROFILE BULK                                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  FMP API (profile-bulk)                                   │
│ PROCESO: Enriquece perfiles (descripción, CEO, employees, etc.) │
│ OUTPUT: company_profile                                         │
│ FUNCIÓN: Data descriptiva para UI y contexto                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 06 - INDUSTRY PERFORMANCE AGGREGATOR (1D)                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (prices_daily - today vs yesterday)            │
│ PROCESO: Calcula % change promedio ponderado por industry       │
│ OUTPUT: industry_performance_aggregated                         │
│ FUNCIÓN: Tracking de performance 1D por industria               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 07 - SECTOR PERFORMANCE AGGREGATOR (1D)                          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (prices_daily - today vs yesterday)            │
│ PROCESO: Calcula % change promedio ponderado por sector         │
│ OUTPUT: sector_performance_aggregated                           │
│ FUNCIÓN: Tracking de performance 1D por sector                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 08 - SECTOR PERFORMANCE WINDOWS AGGREGATOR                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (prices_daily - last 252 trading days)         │
│ PROCESSO:                                                        │
│   1. Calcula 7 ventanas: 1D, 5D, 1M, 3M, 6M, YTD, 1Y            │
│   2. Agrega por sector (market-cap weighted average)            │
│ OUTPUT: sector_performance_windows                              │
│ FUNCIÓN: Heatmaps de performance sectorial multi-período        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 09 - INDUSTRY PERFORMANCE WINDOWS AGGREGATOR                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (prices_daily - last 252 trading days)         │
│ PROCESSO: Calcula 7 ventanas por industria                      │
│ OUTPUT: industry_performance_windows                            │
│ FUNCIÓN: Drill-down de performance por industria                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10 - SECTOR PE AGGREGATOR                                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (datos_financieros - TTM earnings, price)      │
│ PROCESSO:                                                        │
│   1. Calcula P/E por ticker (price / TTM EPS)                   │
│   2. Agrega por sector (weighted average + median)              │
│ OUTPUT: sector_pe_aggregated                                    │
│ FUNCIÓN: Valuation context sectorial (expensive vs cheap)       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 11 - INDUSTRY PE AGGREGATOR                                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (datos_financieros - TTM earnings, price)      │
│ PROCESSO: Calcula P/E agregado por industria                    │
│ OUTPUT: industry_pe_aggregated                                  │
│ FUNCIÓN: Valuation granular a nivel industria                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 12 - SECTOR BENCHMARKS (CRÍTICO)                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (datos_financieros - TTM metrics)              │
│ PROCESSO:                                                        │
│   1. Agrupa por sector (11 sectores GICS)                       │
│   2. Calcula percentiles (p10, p25, p50, p75, p90, p95)         │
│   3. Métricas: ROIC, ROE, ROA, margins, leverage, liquidity     │
│ OUTPUT: sector_benchmarks                                       │
│ FUNCIÓN: Base para scoring FGOS/IQS (percentile ranking)        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 12B - INDUSTRY BENCHMARKS AGGREGATOR                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (datos_financieros - TTM metrics)              │
│ PROCESSO: Calcula percentiles a nivel industria (~150 industries)│
│ OUTPUT: industry_benchmarks                                     │
│ FUNCIÓN: IQS (Industry Quality Score) percentile-based          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 13 - PERFORMANCE BULK                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (prices_daily - last 252 days)                 │
│ PROCESSO:                                                        │
│   1. Calcula % returns vs sector average                        │
│   2. Calcula alpha (ticker return - sector return)              │
│   3. 7 ventanas: 1D, 5D, 1M, 3M, 6M, YTD, 1Y                    │
│ OUTPUT: performance_relative                                    │
│ FUNCIÓN: IFS Pressure (underperforming detection)               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 13B - PERFORMANCE WINDOWS AGGREGATOR                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (performance_relative)                         │
│ PROCESSO: Agrega windows para UI tables                         │
│ OUTPUT: performance_windows                                     │
│ FUNCIÓN: Vista consolidada de performance multi-período         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 14 - MARKET STATE BULK (CRÍTICO)                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (múltiples fuentes):                           │
│         - prices_daily (precio, volumen)                        │
│         - datos_financieros (TTM metrics)                       │
│         - sector_benchmarks (percentiles)                       │
│         - performance_relative (alpha)                          │
│ PROCESSO:                                                        │
│   1. Ensambla snapshot completo por ticker                      │
│   2. Valuation multiples (P/E, EV/EBITDA, P/FCF)                │
│   3. Quality metrics (ROIC, margins, cash flow)                 │
│   4. Percentile positions vs sector                             │
│ OUTPUT: fintra_market_state (10,000+ rows/día)                 │
│ FUNCIÓN: Single source of truth para UI y engines               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 15 - DIVIDENDS BULK V2                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  FMP API (historical-price-full/stock_dividend/{ticker}) │
│ PROCESSO: Descarga historial completo de dividendos (10 años)   │
│ OUTPUT: datos_dividendos                                        │
│ FUNCIÓN: Análisis de dividend yield, payout ratio, consistency  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 16 - FMP BULK SNAPSHOTS (CRÍTICO)                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  FMP API (bulk snapshots - 20+ métricas)                 │
│ PROCESSO:                                                        │
│   1. Descarga key ratios (P/E, P/B, EV/EBITDA, etc.)            │
│   2. Descarga price data (52w high/low, avg volume)             │
│   3. Descarga quality metrics (Altman Z, Piotroski F)           │
│ OUTPUT: fintra_snapshots (esqueleto base)                       │
│ FUNCIÓN: Inicializa snapshot diario (será enriquecido con engines)│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 17 - HEALTHCHECK SNAPSHOTS                                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase (fintra_snapshots - hoy)                       │
│ PROCESSO:                                                        │
│   1. Valida cobertura (tickers activos sin snapshot)            │
│   2. Detecta snapshots stale (sin updates en 7+ días)           │
│   3. Verifica integridad de campos críticos                     │
│ OUTPUT: Logs + alertas (no escribe DB)                          │
│ FUNCIÓN: Observability y early warning de data gaps             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 18 - RECOMPUTE FGOS ALL (ENGINE CRÍTICO)                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  Supabase:                                                │
│         - fintra_snapshots (snapshot base del día)              │
│         - sector_benchmarks (percentiles sectoriales)           │
│         - datos_financieros (TTM metrics)                       │
│ PROCESSO:                                                        │
│   1. Calcula FGOS (4 pilares: Growth, Profitability, Efficiency, Solvency)│
│   2. Compara vs sector benchmarks (percentile ranking)          │
│   3. Aplica confidence scoring (data completeness)              │
│   4. Low confidence impact (penaliza benchmarks con poca data)  │
│ OUTPUT: fintra_snapshots.fgos_* (score, status, confidence)    │
│ FUNCIÓN: Score absoluto 0-100 de fundamentals                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 19 - PEERS BULK                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ INPUT:  FMP API (stock_peers/{ticker})                          │
│ PROCESSO:                                                        │
│   1. Descarga lista de peers por ticker (según FMP algorithm)   │
│   2. Filtra peers activos (presentes en fintra_universe)        │
│   3. Almacena relaciones peer-to-peer                           │
│ OUTPUT: peers                                                   │
│ FUNCIÓN: Radar charts, peers comparison (IFS vs Peers)          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            ENGINES ADICIONALES (POST-PIPELINE)                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Estos se ejecutan DESPUÉS del pipeline principal:               │
│                                                                  │
│ • IFS Live v1.2 (Industry Fit Score - posición competitiva)     │
│ • IQS (Industry Quality Score - scoring fiscal FY)              │
│ • Valuation Relative (P/E vs sector percentiles)                │
│ • Moat (coherence check - high quality growth)                  │
│ • Competitive Advantage (3-axis: returns, stability, capital)   │
│ • Quality Brakes (Altman Z, Piotroski F)                        │
│ • Fundamentals Maturity (consecutividad fiscal)                 │
│                                                                  │
│ Todos escriben a: fintra_snapshots (columnas específicas)       │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 PIPELINE COMPLETO - SNAPSHOT FINAL               │
│                                                                  │
│ fintra_snapshots contiene:                                       │
│   - Profile structural (sector, industry, market cap)           │
│   - FGOS (score 0-100 + confidence)                             │
│   - IFS (position: leader/follower/laggard + pressure 0-3)      │
│   - IQS (percentile fiscal ranking)                             │
│   - Valuation (verdict: cheap/fair/expensive + percentile)      │
│   - Moat (coherence score 0-100)                                │
│   - Competitive Advantage (weak/defendable/strong)              │
│   - Quality Brakes (Z-Score, F-Score)                           │
│   - Life Cycle (stage + trajectory)                             │
│                                                                  │
│ 📊 DESTINO FINAL: Dashboard, Ticker Detail, Sector Analysis     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 JOBS DETALLADOS {#jobs-detallados}

### 01 - Sync Universe

**Archivo:** `01-sync-universe.ts`  
**Core:** `app/api/cron/sync-universe/core.ts`

#### 📥 INPUT

- **API:** FMP `profile-bulk` (endpoint estable)
- **Frecuencia:** Diaria (cada ejecución del master cron)
- **Volumen:** ~10,000-15,000 perfiles de empresas

#### 🔄 PROCESO

1. Descarga bulk CSV de FMP (usando `fetchAllFmpData` con cache)
2. Parsea cada perfil con campos:
   - `symbol` (ticker)
   - `companyName`
   - `sector` (GICS sector)
   - `industry`
   - `country`
   - `exchange`
   - `isEtf`, `isAdr`, `isFund` (flags de tipo de instrumento)
3. Filtra duplicados (evita error "cannot affect row a second time")
4. Clasifica `instrument_type`:
   - `EQUITY` (default)
   - `ETF` (si `isEtf=true`)
   - `ADR` (si `isAdr=true`)
   - `FUND` (si `isFund=true`)
   - `CRYPTO` (si `exchange=CRYPTO`)
5. Upsert en batches de 1,000 rows

#### 📤 OUTPUT

- **Tabla:** `fintra_universe`
- **Campos escritos:**
  - `ticker` (PK)
  - `company_name`
  - `sector`
  - `industry`
  - `country`
  - `exchange`
  - `instrument_type`
  - `is_active` (true por default)
  - `updated_at`

#### 🎯 FUNCIÓN EN FINTRA

- Define el **universo de trabajo** para todos los jobs subsiguientes
- Solo tickers con `is_active=true` son procesados
- Base para filtros por sector/industria en UI
- Excluye ETFs/ADRs/Funds de análisis fundamental (opcionalmente)

#### 📊 MÉTRICAS TÍPICAS

- Procesados: ~10,500 tickers
- Nuevos: 5-20/día (IPOs, listados)
- Tiempo: ~30-60 segundos

---

### 02 - Industry Classification Sync

**Archivo:** `02-industry-classification-sync.ts`  
**Core:** `app/api/cron/industry-classification-sync/core.ts`

#### 📥 INPUT

- **Supabase:**
  - `fintra_universe` (sector, industry por ticker)
  - `company_profile` (clasificaciones alternativas)

#### 🔄 PROCESO

1. Lee todos los tickers activos
2. Extrae combinaciones únicas de `sector` → `industry`
3. Detecta industrias sin clasificación en `industry_metadata`
4. Asigna sector padre y crea metadata
5. Verifica coherencia (industrias sin sector padre → alerta)

#### 📤 OUTPUT

- **Tabla:** `industry_metadata`
- **Campos:**
  - `industry_name` (PK)
  - `sector_name` (parent)
  - `is_active`
  - `description` (opcional)

#### 🎯 FUNCIÓN EN FINTRA

- Mantiene **jerarquía sector → industria** para drill-downs
- Permite agregación correcta en industry benchmarks
- Valida que toda industria tenga sector padre

#### 📊 MÉTRICAS TÍPICAS

- Industrias tracked: ~150
- Nuevas clasificaciones: 0-3/mes

---

### 03 - Prices Daily Bulk

**Archivo:** `03-prices-daily-bulk.ts`  
**Core:** `app/api/cron/prices-daily-bulk/core.ts`

#### 📥 INPUT

- **API:** FMP `eod-bulk/{date}` (End of Day prices)
- **Parámetros:**
  - `--start=YYYY-MM-DD` (default: today - 4 days)
  - `--end=YYYY-MM-DD` (default: today)
- **Volumen:** ~10,000 precios por día

#### 🔄 PROCESO

1. Itera por cada día en el rango (skip weekends)
2. Descarga CSV bulk de FMP para fecha específica
3. Parsea campos:
   - `symbol`, `date`, `open`, `high`, `low`, `close`, `volume`
   - `adjClose` (ajustado por splits/dividendos)
4. Filtra tickers no presentes en `fintra_universe`
5. Upsert en `prices_daily` (ON CONFLICT DO UPDATE)

#### 📤 OUTPUT

- **Tabla:** `prices_daily`
- **Campos:**
  - `ticker` (FK → fintra_universe)
  - `date`
  - `open`, `high`, `low`, `close`
  - `adj_close`
  - `volume`

#### 🎯 FUNCIÓN EN FINTRA

- **Base para todo cálculo de performance**
- Alimenta: sector/industry performance aggregators
- Alimenta: performance windows (1D, 5D, 1M, etc.)
- Alimenta: market_state (precio actual)

#### 📊 MÉTRICAS TÍPICAS

- Rows insertadas/día: ~10,000
- Backfill típico: 5 días (cron diario)
- Tiempo: ~5-10 minutos por día

---

### 04 - Financials Bulk (CRÍTICO)

**Archivo:** `04-financials-bulk.ts`  
**Core:** `app/api/cron/financials-bulk/core.ts` (1,238 líneas)

#### 📥 INPUT

- **API FMP (5 endpoints bulk):**
  1. `income-statement-bulk/{year}/{period}` (por FY y Q)
  2. `balance-sheet-statement-bulk/{year}/{period}`
  3. `cash-flow-statement-bulk/{year}/{period}`
  4. `key-metrics-ttm-bulk`
  5. `ratios-ttm-bulk`
- **Parámetros:**
  - `--years`: Años a procesar (default: mutable years = current, current+1)
  - `--batch-size`: Tickers por batch (default: 2000)
  - `--full`: Modo full sync (2015-2027)

#### 🔄 PROCESO

**Fase 1: Descarga y Cache**

1. Descarga CSVs de FMP para cada combinación `year × period`
2. Cache local en `data/fmp-bulk/` (evita re-downloads)
3. Agrupa por ticker (groupByTicker)

**Fase 2: Processing por Ticker**
Para cada ticker en batch:

1. **Merge Statements:** Combina income + balance + cashflow por período
2. **Derive Metrics:** Calcula métricas derivadas:
   - `roic = NOPAT / invested_capital`
   - `roe = net_income / shareholder_equity`
   - `roa = net_income / total_assets`
   - `operating_margin = operating_income / revenue`
   - `net_margin = net_income / revenue`
   - `cash_conversion = (operating_cashflow - capex) / operating_income`
   - `current_ratio = current_assets / current_liabilities`
   - `debt_to_equity = total_debt / equity`
3. **TTM Metrics:** Ingiere `key-metrics-ttm` y `ratios-ttm` de FMP
4. **Preflight Checks:**
   - Detecta períodos duplicados
   - Detecta date mismatches entre statements
   - Detecta missing statements
5. **Transform to DB Format:**
   ```typescript
   {
     ticker,
     period_type: 'FY' | 'Q',
     period_label: '2024FY' | '2024Q3',
     period_end_date: '2024-09-30',
     revenue,
     netIncome,
     totalAssets,
     // + 50 campos más
   }
   ```

**Fase 3: Bulk Upsert**

1. Agrupa rows procesadas por ticker
2. Chunking defensivo:
   - 2,000 tickers/batch × ~10 rows/ticker = 20,000 rows
   - Split en chunks de 5,000 rows para Supabase
3. Parallel upserts (4 chunks simultáneos)
4. Log detallado por chunk

#### 📤 OUTPUT

- **Tabla:** `datos_financieros`
- **Campos clave (70+ columnas):**
  - **Identificación:** `ticker`, `period_type`, `period_label`, `period_end_date`
  - **Income Statement:** `revenue`, `costOfRevenue`, `grossProfit`, `operatingIncome`, `netIncome`, `ebitda`, `eps`
  - **Balance Sheet:** `totalAssets`, `totalLiabilities`, `shareholderEquity`, `cash`, `inventory`, `totalDebt`
  - **Cash Flow:** `operatingCashflow`, `investingCashflow`, `financingCashflow`, `capex`, `freeCashflow`
  - **Ratios:** `currentRatio`, `quickRatio`, `debtToEquity`, `returnOnEquity`, `returnOnAssets`
  - **Margins:** `operatingMargin`, `netMargin`, `grossMargin`
  - **Efficiency:** `assetTurnover`, `inventoryTurnover`
  - **Growth:** `revenueGrowth`, `epsgrowth`, `fcfGrowth`
  - **Valuation:** `peRatio`, `pbRatio`, `evToEbitda`, `priceToFreeCashflow`

#### 🎯 FUNCIÓN EN FINTRA

- **CORE DATA LAYER** - Alimenta absolutamente TODO
- Sin financials bulk → NO HAY engines (FGOS, IFS, IQS, Valuation)
- Base para sector/industry benchmarks
- Base para screening, filtering, ranking

#### 📊 MÉTRICAS TÍPICAS (Modo Daily)

- Tickers procesados: ~10,000
- Years procesados: 2-3 (mutable years)
- Rows insertadas: 50,000-80,000
- Tiempo: ~45-90 minutos
- Memoria: ~800 MB (chunking defensivo)

#### 🚨 CONSIDERACIONES CRÍTICAS

1. **NO inventa datos:** Si metric falta → `NULL`
2. **NO infiere quarters:** Cada Q es independiente
3. **Temporal consistency:** NEVER usa datos futuros
4. **Chunking:** Respetar límite 1,000 rows de Supabase
5. **Error tolerance:** Fallo en 1 ticker NO aborta batch

---

### 04B - Incremental TTM Valuation

**Archivo:** `04b-incremental-ttm-valuation.ts`  
**Core:** `app/api/cron/incremental-ttm-valuation-bulk/core.ts`

#### 📥 INPUT

- **Supabase:** `datos_financieros`
  - Quarters: Últimos 4 quarters cerrados
  - TTM rows existentes: Para detectar "dirty" tickers

#### 🔄 PROCESO

**Optimización Vectorizada (Level 2):**

1. **Detect Dirty Tickers:**

   ```sql
   SELECT ticker
   FROM (
     SELECT ticker,
            MAX(CASE WHEN period_type='Q' THEN period_end_date END) as last_q,
            MAX(CASE WHEN period_type='TTM' THEN period_end_date END) as last_ttm
     FROM datos_financieros
     GROUP BY ticker
   )
   WHERE last_q > last_ttm OR last_ttm IS NULL
   ```

   - Solo procesa tickers con new quarter cerrado

2. **Construct TTM per Ticker:**
   - Lee últimos 4 quarters (en orden descendente por date)
   - **Valida:** MUST have exactly 4 quarters (no aproxima)
   - **Income Statement:** SUM de 4 quarters
     ```typescript
     ttmRevenue = Q1.revenue + Q2.revenue + Q3.revenue + Q4.revenue;
     ttmNetIncome = sum(netIncome);
     ttmOperatingIncome = sum(operatingIncome);
     ```
   - **Balance Sheet:** LATEST quarter snapshot
     ```typescript
     ttmTotalAssets = Q1.totalAssets; // Most recent
     ttmTotalLiabilities = Q1.totalLiabilities;
     ```
   - **Margins:** Revenue-weighted
     ```typescript
     ttmOperatingMargin = sum(operatingIncome) / sum(revenue);
     ttmNetMargin = sum(netIncome) / sum(revenue);
     ```

3. **Calculate Valuation Multiples:**
   - `P/E = marketCap / ttmNetIncome`
   - `EV/EBITDA = enterpriseValue / ttmEBITDA`
   - `Price/FCF = marketCap / ttmFreeCashflow`

4. **Bulk Insert:**
   - Process en chunks de 50 tickers
   - Insert rows con `period_type='TTM'`

#### 📤 OUTPUT

- **Tabla:** `datos_financieros` (new rows)
- **Campos específicos TTM:**
  - `period_type = 'TTM'`
  - `period_label = '{latest_quarter_year}TTM'`
  - `period_end_date = {latest_quarter_date}`
  - Todos los campos financieros agregados

#### 🎯 FUNCIÓN EN FINTRA

- **Actualización incremental de TTM** (solo cuando hay new data)
- Evita recalcular TODOS los tickers diariamente
- Performance: 10x más rápido que versión naive (solo 200-500 tickers/día)
- Alimenta: FGOS, IQS, sector benchmarks (todos usan TTM)

#### 📊 MÉTRICAS TÍPICAS

- Dirty tickers detectados: 200-500/día (en earnings season: 1,000+)
- TTM rows creadas: 200-500
- Up to date (skipped): 9,500-9,800
- Tiempo: ~2-5 minutos

---

### 05 - Company Profile Bulk

**Archivo:** `05-company-profile-bulk.ts`  
**Core:** `app/api/cron/company-profile-bulk/core.ts`

#### 📥 INPUT

- **API:** FMP `profile-bulk` (mismo que sync-universe)
- **Supabase:** `fintra_universe` (para filtrar solo activos)

#### 🔄 PROCESO

1. Descarga profiles bulk (cached)
2. Filtra solo tickers activos
3. Enriquece con:
   - `description` (company description largo)
   - `ceo` (CEO name)
   - `fullTimeEmployees` (employee count)
   - `website`
   - `country`, `city`, `address`
4. Upsert en batches con concurrency (5 parallel requests)

#### 📤 OUTPUT

- **Tabla:** `company_profile`
- **Campos:**
  - `ticker` (PK, FK → fintra_universe)
  - `company_name`
  - `description`
  - `sector`, `industry`
  - `country`, `city`, `address`
  - `website`, `ceo`
  - `employees` (int)
  - `source = 'fmp'`
  - `updated_at`

#### 🎯 FUNCIÓN EN FINTRA

- **Data descriptiva** para ticker detail page
- Contexto para usuarios (qué hace la empresa)
- Filtering (e.g., "empresas con más de 50,000 empleados")

#### 📊 MÉTRICAS TÍPICAS

- Profiles processed: ~10,000
- Tiempo: ~30-45 segundos
- Updates diarios: ~50-100 (cambios en CEO, employees, etc.)

---

### 06 - Industry Performance Aggregator (1D)

**Archivo:** `06-industry-performance-aggregator.ts`  
**Core:** `app/api/cron/industry-performance-aggregator/core.ts`

#### 📥 INPUT

- **Supabase:**
  - `prices_daily` (today vs yesterday)
  - `fintra_universe` (sector, industry)
  - `company_profile` (marketCap para weighting)

#### 🔄 PROCESO

1. Calcula % change diario por ticker:
   ```typescript
   pctChange = ((close_today - close_yesterday) / close_yesterday) * 100;
   ```
2. Agrupa por industry
3. Calcula:
   - **Simple average:** mean(pctChange)
   - **Market-cap weighted average:**
     ```typescript
     weighted = sum(pctChange × marketCap) / sum(marketCap)
     ```
   - **Median:** percentile 50
   - **Count:** # de tickers en industria

#### 📤 OUTPUT

- **Tabla:** `industry_performance_aggregated`
- **Campos:**
  - `industry_name` (PK)
  - `date` (PK)
  - `avg_pct_change` (simple)
  - `weighted_avg_pct_change`
  - `median_pct_change`
  - `ticker_count`

#### 🎯 FUNCIÓN EN FINTRA

- Heatmaps de performance 1D por industria
- Identifica industrias hot/cold
- Base para industry analysis dashboard

#### 📊 MÉTRICAS TÍPICAS

- Industrias procesadas: ~150
- Tiempo: ~5-10 segundos

---

### 07 - Sector Performance Aggregator (1D)

**Archivo:** `07-sector-performance-aggregator.ts`  
**Core:** `app/api/cron/sector-performance-aggregator/core.ts`

#### 📥 INPUT

- **Supabase:**
  - `prices_daily` (today vs yesterday)
  - `fintra_universe` (sector)
  - `company_profile` (marketCap)

#### 🔄 PROCESO

Idéntico a industry aggregator pero agrupa por sector (11 GICS sectors).

#### 📤 OUTPUT

- **Tabla:** `sector_performance_aggregated`
- **Campos:** (mismo schema que industry)

#### 🎯 FUNCIÓN EN FINTRA

- Sector rotation analysis
- Dashboard principal (top movers por sector)

#### 📊 MÉTRICAS TÍPICAS

- Sectores procesados: 11
- Tiempo: ~3-5 segundos

---

### 08 - Sector Performance Windows Aggregator

**Archivo:** `08-sector-performance-windows-aggregator.ts`  
**Core:** `app/api/cron/sector-performance-windows-aggregator/core.ts`

#### 📥 INPUT

- **Supabase:** `prices_daily` (últimos 252 trading days)

#### 🔄 PROCESO

1. Define windows:
   - `1D` (today vs yesterday)
   - `5D` (1 week)
   - `1M` (21 trading days)
   - `3M` (63 days)
   - `6M` (126 days)
   - `YTD` (desde Jan 1 del año actual)
   - `1Y` (252 days)

2. Para cada sector:
   - Fetch prices de inicio y fin de cada window
   - Calcula % return ponderado por market cap
   - Formula:
     ```typescript
     return = ((end_price - start_price) / start_price) × 100
     weighted_return = sum(return × marketCap) / sum(marketCap)
     ```

3. Upsert fila con 7 columnas de performance

#### 📤 OUTPUT

- **Tabla:** `sector_performance_windows`
- **Campos:**
  - `sector` (PK)
  - `as_of_date` (PK)
  - `perf_1d`, `perf_5d`, `perf_1m`, `perf_3m`, `perf_6m`, `perf_ytd`, `perf_1y`

#### 🎯 FUNCIÓN EN FINTRA

- **Heatmap multi-período** en dashboard
- Análisis de momentum sectorial
- Comparación cross-sectorial

#### 📊 MÉTRICAS TÍPICAS

- Sectores: 11
- Windows calculadas: 7 × 11 = 77 valores
- Tiempo: ~15-20 segundos

---

### 09 - Industry Performance Windows Aggregator

**Archivo:** `09-industry-performance-windows-aggregator.ts`  
**Core:** `app/api/cron/industry-performance-windows-aggregator/core.ts`

#### 📥 INPUT

- **Supabase:** `prices_daily` (últimos 252 days)

#### 🔄 PROCESO

Idéntico a sector windows pero por industria (~150 industries).

#### 📤 OUTPUT

- **Tabla:** `industry_performance_windows`

#### 🎯 FUNCIÓN EN FINTRA

- Drill-down de performance por industria
- Identifica outliers dentro de sectores

#### 📊 MÉTRICAS TÍPICAS

- Industrias: ~150
- Tiempo: ~30-45 segundos

---

### 10 - Sector PE Aggregator

**Archivo:** `10-sector-pe-aggregator.ts`  
**Core:** `app/api/cron/sector-pe-aggregator/core.ts`

#### 📥 INPUT

- **Supabase:**
  - `datos_financieros` (TTM earnings)
  - `prices_daily` (current price)
  - `fintra_universe` (sector)

#### 🔄 PROCESO

1. Calcula P/E por ticker:
   ```typescript
   PE = marketCap / ttmNetIncome;
   // o alternativamente
   PE = price / ttmEPS;
   ```
2. Filtra outliers (P/E < 0 o > 100)
3. Agrega por sector:
   - **Weighted average P/E:** weighted by market cap
   - **Median P/E**
   - **P10, P25, P75, P90** (percentiles)

#### 📤 OUTPUT

- **Tabla:** `sector_pe_aggregated`
- **Campos:**
  - `sector` (PK)
  - `as_of_date` (PK)
  - `avg_pe`, `median_pe`, `p10_pe`, `p25_pe`, `p75_pe`, `p90_pe`
  - `ticker_count`

#### 🎯 FUNCIÓN EN FINTRA

- **Valuation context sectorial**
- Comparación "expensive vs cheap sector"
- Alimenta: Valuation engine (percentile ranking)

#### 📊 MÉTRICAS TÍPICAS

- Sectores: 11
- Tiempo: ~8-12 segundos

---

### 11 - Industry PE Aggregator

**Archivo:** `11-industry-pe-aggregator.ts`  
**Core:** `app/api/cron/industry-pe-aggregator/core.ts`

#### 📥 INPUT

- **Supabase:** (mismo que sector PE)

#### 🔄 PROCESO

Idéntico a sector PE pero por industria.

#### 📤 OUTPUT

- **Tabla:** `industry_pe_aggregated`

#### 🎯 FUNCIÓN EN FINTRA

- Valuation granular a nivel industria
- Contexto para valuation engine

---

### 12 - Sector Benchmarks (CRÍTICO)

**Archivo:** `12-sector-benchmarks.ts`  
**Core:** `app/api/cron/sector-benchmarks/core.ts`

#### 📥 INPUT

- **Supabase:**
  - `datos_financieros` (TTM metrics para TODOS los tickers del sector)
  - `fintra_universe` (sector classification)

#### 🔄 PROCESO

**Métricas Calculadas (26 métricas):**

**1. Profitability:**

- `roic` (Return on Invested Capital)
- `roe` (Return on Equity)
- `roa` (Return on Assets)
- `roic_5y_avg` (promedio 5 años)

**2. Margins:**

- `operatingMargin`
- `netMargin`
- `grossMargin`
- `ebitdaMargin`

**3. Growth:**

- `revenueGrowth` (YoY)
- `epsgrowth`
- `fcfGrowth`

**4. Efficiency:**

- `assetTurnover`
- `inventoryTurnover`
- `receivablesTurnover`
- `cashConversion` (OCF - Capex) / OpIncome

**5. Leverage:**

- `debtToEquity`
- `debtToAssets`
- `interestCoverage` (EBIT / Interest Expense)

**6. Liquidity:**

- `currentRatio`
- `quickRatio`
- `cashRatio`

**7. Valuation:**

- `peRatio`
- `pbRatio`
- `evToEbitda`
- `priceToFreeCashflow`

**Cálculo de Percentiles:**
Para cada métrica en cada sector:

```typescript
// Ordenar valores (eliminar nulls y outliers)
const sorted = values.filter(v => v !== null && isFinite(v)).sort((a,b) => a-b);

// Calcular percentiles
const p10 = percentile(sorted, 0.10);
const p25 = percentile(sorted, 0.25);
const p50 = percentile(sorted, 0.50); // Median
const p75 = percentile(sorted, 0.75);
const p90 = percentile(sorted, 0.90);
const p95 = percentile(sorted, 0.95);

// Guardar con metadata
{
  sector,
  metric_name,
  p10, p25, p50, p75, p90, p95,
  universe_size: sorted.length,
  as_of_date: today
}
```

#### 📤 OUTPUT

- **Tabla:** `sector_benchmarks`
- **Campos:**
  - `sector` (PK)
  - `metric_name` (PK) - e.g., 'roic', 'operatingMargin'
  - `p10`, `p25`, `p50`, `p75`, `p90`, `p95`
  - `universe_size` (# de tickers en muestra)
  - `as_of_date`

#### 🎯 FUNCIÓN EN FINTRA

- **BASE CRÍTICA para FGOS engine**
- FGOS compara cada ticker contra percentiles sectoriales
- Ejemplo:
  ```typescript
  // Ticker AAPL: ROIC = 45%
  // Sector Technology: p25=15%, p50=22%, p75=32%, p90=42%
  // → AAPL está en top 10% (percentile ~92)
  ```
- Confidence scoring: `universe_size < 20` → low confidence

#### 📊 MÉTRICAS TÍPICAS

- Sectores procesados: 11
- Métricas por sector: 26
- Rows insertadas: 11 × 26 = 286
- Tiempo: ~20-30 segundos

#### 🚨 CONSIDERACIONES CRÍTICAS

1. **Low confidence impact:** Si `universe_size < 20` → penaliza benchmark quality
2. **Temporal consistency:** Usa SOLO TTM data (not FY)
3. **Outlier handling:** Elimina valores < p1 o > p99 antes de calcular percentiles

---

### 12B - Industry Benchmarks Aggregator

**Archivo:** `12b-industry-benchmarks-aggregator.ts`  
**Core:** `app/api/cron/industry-benchmarks-aggregator/core.ts`

#### 📥 INPUT

- **Supabase:** `datos_financieros` (TTM metrics)

#### 🔄 PROCESO

Idéntico a sector benchmarks pero por industria (~150 industries).

**Desafío adicional:**

- Muchas industrias tienen pocas empresas (universe_size < 10)
- Fallback: usar sector benchmark si industry benchmark es low confidence

#### 📤 OUTPUT

- **Tabla:** `industry_benchmarks`

#### 🎯 FUNCIÓN EN FINTRA

- **BASE para IQS engine** (Industry Quality Score)
- IQS hace percentile ranking dentro de industria (más granular que FGOS)

---

### 13 - Performance Bulk

**Archivo:** `13-performance-bulk.ts`  
**Core:** `app/api/cron/performance-bulk/core.ts`

#### 📥 INPUT

- **Supabase:**
  - `prices_daily` (últimos 252 days)
  - `sector_performance_windows` (para calcular alpha)

#### 🔄 PROCESO

1. Para cada ticker:
   - Calcula % returns en 7 ventanas (1D, 5D, 1M, 3M, 6M, YTD, 1Y)
   - Fetch sector average return del mismo período
   - Calcula **alpha** (ticker return - sector return)

   ```typescript
   tickerReturn1M = ((price_today - price_1m_ago) / price_1m_ago) × 100;
   sectorReturn1M = sector_performance_windows[sector].perf_1m;
   alpha1M = tickerReturn1M - sectorReturn1M;
   ```

2. Clasifica performance:
   - `outperforming` (alpha > +5%)
   - `inline` (alpha between -5% and +5%)
   - `underperforming` (alpha < -5%)

#### 📤 OUTPUT

- **Tabla:** `performance_relative`
- **Campos:**
  - `ticker` (PK)
  - `as_of_date` (PK)
  - `return_1d`, `return_5d`, ..., `return_1y`
  - `alpha_1d`, `alpha_5d`, ..., `alpha_1y`
  - `vs_sector_status` ('outperforming' | 'inline' | 'underperforming')

#### 🎯 FUNCIÓN EN FINTRA

- **Alimenta IFS Pressure** (underperforming detection)
- IFS Pressure increments cuando alpha es negativo y persistente
- Screening: "Show me all underperformers in last 3M"

---

### 13B - Performance Windows Aggregator

**Archivo:** `13b-performance-windows-aggregator.ts`  
**Core:** `app/api/cron/performance-windows-aggregator/core.ts`

#### 📥 INPUT

- **Supabase:** `performance_relative`

#### 🔄 PROCESO

1. Lee performance_relative de hoy
2. Transpone a formato consolidado (una fila por ticker)
3. Agrega metadata (sector, industry)

#### 📤 OUTPUT

- **Tabla:** `performance_windows`
- **Campos:**
  - `ticker` (PK)
  - `as_of_date` (PK)
  - `perf_1d`, `perf_5d`, ..., `perf_1y`
  - `alpha_1d`, `alpha_5d`, ..., `alpha_1y`
  - `sector`, `industry`

#### 🎯 FUNCIÓN EN FINTRA

- Vista consolidada para UI tables
- Sorting/filtering en dashboard

---

### 14 - Market State Bulk (CRÍTICO)

**Archivo:** `14-market-state-bulk.ts`  
**Core:** `app/api/cron/market-state-bulk/core.ts`

#### 📥 INPUT

- **Supabase (múltiples tablas):**
  - `prices_daily` (precio actual, volumen)
  - `datos_financieros` (TTM metrics, ratios)
  - `sector_benchmarks` (percentiles para comparación)
  - `performance_relative` (alpha)
  - `company_profile` (marketCap, sector, industry)

#### 🔄 PROCESO

**Ensamblado de Snapshot por Ticker:**

1. **Price Data:**
   - `price` (close actual)
   - `volume`
   - `52w_high`, `52w_low`
   - `52w_high_pct` = (price - 52w_low) / (52w_high - 52w_low)

2. **Fundamental Metrics (TTM):**
   - `revenue`, `netIncome`, `freeCashflow`
   - `totalAssets`, `totalDebt`
   - `roic`, `roe`, `roa`
   - `operatingMargin`, `netMargin`
   - `debtToEquity`, `currentRatio`

3. **Valuation Multiples:**
   - `peRatio`, `pbRatio`, `evToEbitda`, `priceToFreeCashflow`

4. **Growth Metrics:**
   - `revenueGrowth`, `epsgrowth`, `fcfGrowth`

5. **Percentile Positions (vs Sector):**
   - Fetch sector benchmark para cada métrica
   - Interpola percentile del ticker:

   ```typescript
   // Ejemplo: ROIC de AAPL = 45%
   const benchmark = sector_benchmarks['Technology']['roic'];
   // {p10: 10%, p25: 15%, p50: 22%, p75: 32%, p90: 42%, p95: 48%}

   if (value > p95) percentile = 95+
   else if (value > p90) percentile = interpolate(value, p90, p95, 90, 95)
   else if (value > p75) percentile = interpolate(value, p75, p90, 75, 90)
   // etc.
   ```

6. **Performance & Alpha:**
   - `perf_1m`, `perf_3m`, `perf_1y`
   - `alpha_1m`, `alpha_3m`, `alpha_1y`

7. **Market Cap Calculation:**
   ```typescript
   marketCap = price × sharesOutstanding
   ```

#### 📤 OUTPUT

- **Tabla:** `fintra_market_state`
- **Campos (100+ columnas):**
  - **Identification:** `ticker`, `company_name`, `sector`, `industry`
  - **Price:** `price`, `volume`, `marketCap`, `52w_high_pct`
  - **Fundamentals:** `revenue`, `netIncome`, `fcf`, ...
  - **Ratios:** `roic`, `roe`, `margins`, `leverage`, ...
  - **Valuation:** `peRatio`, `pbRatio`, ...
  - **Growth:** `revenueGrowth`, `epsgrowth`, ...
  - **Percentiles:** `roic_pct`, `roe_pct`, `margin_pct`, ...
  - **Performance:** `perf_*`, `alpha_*`
  - **Metadata:** `as_of_date`, `updated_at`

#### 🎯 FUNCIÓN EN FINTRA

- **SINGLE SOURCE OF TRUTH** para UI
- Dashboard principal lee SOLO de market_state
- Ticker detail page lee de market_state
- Facilita queries (todo en 1 tabla vs joins de 10 tablas)

#### 📊 MÉTRICAS TÍPICAS

- Tickers procesados: ~10,000
- Rows insertadas: ~10,000
- Tiempo: ~5-8 minutos

---

### 15 - Dividends Bulk V2

**Archivo:** `15-dividends-bulk-v2.ts`  
**Core:** `app/api/cron/dividends-bulk-v2/core.ts`

#### 📥 INPUT

- **API:** FMP `historical-price-full/stock_dividend/{ticker}`
- **Supabase:** `fintra_universe` (para listar tickers)

#### 🔄 PROCESO

1. Itera por cada ticker activo
2. Descarga historial de dividendos (10 años)
3. Parsea campos:
   - `date` (ex-dividend date)
   - `dividend` (amount en USD)
   - `adjDividend` (adjusted)
4. Filtra duplicados (mismo ticker + date)
5. Bulk insert

#### 📤 OUTPUT

- **Tabla:** `datos_dividendos`
- **Campos:**
  - `ticker` (FK)
  - `date` (ex-dividend date)
  - `dividend`
  - `adj_dividend`

#### 🎯 FUNCIÓN EN FINTRA

- Cálculo de dividend yield
- Identificar dividend aristocrats (25+ años pagando)
- Análisis de payout ratio consistency

#### 📊 MÉTRICAS TÍPICAS

- Tickers con dividendos: ~3,000
- Rows insertadas: ~50,000-80,000 (historial 10 años)
- Tiempo: ~15-20 minutos

---

### 16 - FMP Bulk Snapshots (CRÍTICO)

**Archivo:** `16-fmp-bulk-snapshots.ts`  
**Core:** `app/api/cron/fmp-bulk/core.ts`

#### 📥 INPUT

- **API FMP (múltiples endpoints bulk):**
  - `quote/{ticker}` (precio actual)
  - `key-metrics-ttm/{ticker}` (métricas clave)
  - `ratios-ttm/{ticker}` (ratios financieros)
  - `profile/{ticker}` (profile data)

**Nota:** Este job usa endpoints INDIVIDUALES (no bulk CSV), procesando ticker por ticker.

#### 🔄 PROCESO

1. Fetch lista de tickers activos
2. Para cada ticker:
   - Download JSON de FMP (múltiples endpoints)
   - Parse y estructura:
     ```typescript
     {
       ticker,
       snapshot_date: today,
       price,
       volume,
       marketCap,
       peRatio,
       pbRatio,
       evToEbitda,
       // + 30 campos más
     }
     ```
3. Upsert en `fintra_snapshots` (ON CONFLICT DO UPDATE)

#### 📤 OUTPUT

- **Tabla:** `fintra_snapshots` (esqueleto base)
- **Campos inicializados (~40):**
  - `ticker`, `snapshot_date`
  - `price`, `volume`, `marketCap`
  - `peRatio`, `pbRatio`, `evToEbitda`, `priceToFreeCashflow`
  - `roic`, `roe`, `roa`
  - `operatingMargin`, `netMargin`
  - `debtToEquity`, `currentRatio`
  - `52w_high`, `52w_low`
  - **Campos de engines (null inicialmente):**
    - `fgos_status`, `fgos_score`, `fgos_confidence`
    - `ifs`, `iqs`, `valuation_relative`, etc.

#### 🎯 FUNCIÓN EN FINTRA

- **Inicializa snapshot diario** (estructura base)
- Los engines posteriores (FGOS, IFS, etc.) ESCRIBEN sobre este snapshot
- Permite tener data parcial si algún engine falla

#### 📊 MÉTRICAS TÍPICAS

- Tickers procesados: ~10,000
- Tiempo: ~30-45 minutos (API rate limiting)

---

### 17 - Healthcheck Snapshots

**Archivo:** `17-healthcheck-snapshots.ts`  
**Core:** `app/api/cron/healthcheck-fmp-bulk/core.ts`

#### 📥 INPUT

- **Supabase:**
  - `fintra_snapshots` (snapshots de hoy)
  - `fintra_universe` (tickers activos esperados)

#### 🔄 PROCESO

1. **Coverage Check:**
   - Tickers activos SIN snapshot hoy
   - Log: "Missing snapshots for: [AAPL, GOOGL, ...]"

2. **Staleness Check:**
   - Snapshots sin update en 7+ días
   - Log: "Stale snapshots: [TSLA, ...]"

3. **Integrity Check:**
   - Snapshots con campos críticos null:
     - `price IS NULL`
     - `marketCap IS NULL`
     - `sector IS NULL`
   - Log: "Incomplete snapshots: [MSFT: missing price]"

4. **Engine Status Check:**
   - Count de snapshots por status:
     - `fgos_status='computed'` vs `'pending'`
     - `ifs.status='computed'` vs `'pending'`
   - Log: "FGOS: 9,500 computed, 500 pending"

#### 📤 OUTPUT

- **No escribe DB** (solo logs)
- Opcionalmente: envía alertas si coverage < 90%

#### 🎯 FUNCIÓN EN FINTRA

- **Observability** del pipeline
- Early warning de data gaps
- Debugging (identifica tickers problemáticos)

#### 📊 MÉTRICAS TÍPICAS

- Expected coverage: 100% (10,000/10,000)
- Típicamente: 99.5-99.8% (20-50 missing)
- Missing reasons: API errors, delisted stocks, suspended trading

---

### 18 - Recompute FGOS All (ENGINE CRÍTICO)

**Archivo:** `18-recompute-fgos-all.ts`  
**Core:** `app/api/cron/recompute-fgos-bulk/core.ts`

#### 📥 INPUT

- **Supabase:**
  - `fintra_snapshots` (snapshot base de hoy)
  - `sector_benchmarks` (percentiles sectoriales)
  - `datos_financieros` (TTM metrics)

#### 🔄 PROCESO

**FGOS Calculation (4 Pilares):**

**Pilar 1: Growth (25% weight)**

- `revenueGrowth` vs sector p50 (10%)
- `epsgrowth` vs sector p50 (10%)
- `fcfGrowth` vs sector p50 (5%)

**Pilar 2: Profitability (35% weight)**

- `roic` vs sector p75 (15%)
- `roe` vs sector p75 (10%)
- `netMargin` vs sector p50 (10%)

**Pilar 3: Efficiency (20% weight)**

- `assetTurnover` vs sector p50 (10%)
- `cashConversion` vs sector p50 (10%)

**Pilar 4: Solvency (20% weight)**

- `debtToEquity` vs sector p25 (10% - lower is better)
- `currentRatio` vs sector p50 (10%)

**Scoring Logic:**

```typescript
function scorePillar(value: number, benchmark: Benchmarks, direction: 'higher' | 'lower') {
  const { p10, p25, p50, p75, p90, p95 } = benchmark;

  let percentile: number;

  // Interpolate percentile
  if (value >= p95) percentile = 98;
  else if (value >= p90) percentile = interpolate(value, p90, p95, 90, 95);
  else if (value >= p75) percentile = interpolate(value, p75, p90, 75, 90);
  else if (value >= p50) percentile = interpolate(value, p50, p75, 50, 75);
  else if (value >= p25) percentile = interpolate(value, p25, p50, 25, 50);
  else if (value >= p10) percentile = interpolate(value, p10, p25, 10, 25);
  else percentile = 5;

  // Invert if "lower is better"
  if (direction === 'lower') percentile = 100 - percentile;

  return percentile; // 0-100
}

// Aggregate pillars
const growthScore = (revenueGrowthScore × 0.4 + epsgrowthScore × 0.4 + fcfScore × 0.2);
const profitabilityScore = (roicScore × 0.43 + roeScore × 0.29 + marginScore × 0.29);
const efficiencyScore = (assetTurnoverScore × 0.5 + cashConversionScore × 0.5);
const solvencyScore = (debtScore × 0.5 + liquidityScore × 0.5);

// Weighted average
const fgosScore = (
  growthScore × 0.25 +
  profitabilityScore × 0.35 +
  efficiencyScore × 0.20 +
  solvencyScore × 0.20
);
```

**Confidence Scoring:**

```typescript
let confidence = 100;

// Penalize missing metrics
if (revenueGrowth === null) confidence -= 5;
if (roic === null) confidence -= 10; // Critical metric
if (fcfGrowth === null) confidence -= 5;
// etc.

// Penalize low universe size (benchmark quality)
if (sectorBenchmark.universe_size < 20) confidence -= 15;
if (sectorBenchmark.universe_size < 10) confidence -= 30;

// Cap at 0
confidence = Math.max(0, confidence);
```

**Categorization:**

```typescript
if (fgosScore >= 75) category = "High";
else if (fgosScore >= 50) category = "Medium";
else category = "Low";
```

#### 📤 OUTPUT

- **Tabla:** `fintra_snapshots` (UPDATE existing rows)
- **Campos escritos:**
  - `fgos_status = 'computed' | 'pending'`
  - `fgos_score` (0-100)
  - `fgos_confidence` (0-100)
  - `fgos_category` ('High' | 'Medium' | 'Low')
  - `fgos_components` (JSON con scores de 4 pilares)

#### 🎯 FUNCIÓN EN FINTRA

- **FGOS = Fintra Growth & Operations Score**
- Score absoluto de fundamentals (no relativo a peers)
- Dashboard: filter/sort por FGOS
- Ticker detail: muestra breakdown de 4 pilares

#### 📊 MÉTRICAS TÍPICAS

- Tickers procesados: ~10,000
- Computed: ~9,500 (95%)
- Pending: ~500 (5% - missing data)
- Tiempo: ~10-15 minutos

---

### 19 - Peers Bulk

**Archivo:** `19-peers-bulk.ts`  
**Core:** `app/api/cron/fmp-peers-bulk/core.ts`

#### 📥 INPUT

- **API:** FMP `stock_peers/{ticker}`
- **Supabase:** `fintra_universe` (para validar peers activos)

#### 🔄 PROCESO

1. Para cada ticker:
   - Fetch peers list de FMP
   - Filtra peers que NO están en fintra_universe (skip inactivos)
   - Store relación `ticker → [peer1, peer2, ..., peer5]`

2. Bulk insert en formato:
   ```typescript
   {
     ticker: 'AAPL',
     peer_ticker: 'MSFT',
     source: 'fmp',
     rank: 1 // Order de similitud
   }
   ```

#### 📤 OUTPUT

- **Tabla:** `peers`
- **Campos:**
  - `ticker` (FK)
  - `peer_ticker` (FK)
  - `source` ('fmp')
  - `rank` (1-N)

#### 🎯 FUNCIÓN EN FINTRA

- **Peers comparison** en ticker detail
- Radar charts (FGOS vs peers, IFS vs peers)
- "Empresas similares" recommendation

#### 📊 MÉTRICAS TÍPICAS

- Tickers con peers: ~9,500
- Avg peers/ticker: 5-8
- Rows insertadas: ~60,000
- Tiempo: ~20-30 minutos

---

## 🔗 DEPENDENCIAS ENTRE JOBS {#dependencias}

### Grafo de Dependencias

```
01-sync-universe (ROOT)
    │
    ├──> 02-industry-classification-sync
    │       │
    │       └──> (no outputs críticos aguas abajo)
    │
    ├──> 03-prices-daily-bulk
    │       │
    │       ├──> 06-industry-performance-aggregator
    │       ├──> 07-sector-performance-aggregator
    │       ├──> 08-sector-performance-windows-aggregator
    │       ├──> 09-industry-performance-windows-aggregator
    │       ├──> 10-sector-pe-aggregator
    │       ├──> 11-industry-pe-aggregator
    │       ├──> 13-performance-bulk
    │       └──> 14-market-state-bulk
    │
    ├──> 04-financials-bulk (CRÍTICO)
    │       │
    │       ├──> 04b-incremental-ttm-valuation
    │       │       │
    │       │       └──> (actualiza datos_financieros con TTM rows)
    │       │
    │       ├──> 10-sector-pe-aggregator
    │       ├──> 11-industry-pe-aggregator
    │       ├──> 12-sector-benchmarks (CRÍTICO)
    │       ├──> 12b-industry-benchmarks-aggregator
    │       └──> 14-market-state-bulk
    │
    ├──> 05-company-profile-bulk
    │       │
    │       └──> 14-market-state-bulk (metadata)
    │
    └──> 15-dividends-bulk-v2
            │
            └──> (usado por UI, no afecta engines)

12-sector-benchmarks (OUTPUT CRÍTICO)
    │
    ├──> 18-recompute-fgos-all (DEPENDE 100%)
    ├──> IQS engine
    └──> Valuation engine

13-performance-bulk
    │
    ├──> 13b-performance-windows-aggregator
    └──> IFS engine (pressure calculation)

14-market-state-bulk (CONSOLIDA TODO)
    │
    └──> 16-fmp-bulk-snapshots (inicializa fintra_snapshots)
            │
            ├──> 17-healthcheck-snapshots (valida)
            ├──> 18-recompute-fgos-all (escribe sobre snapshot)
            ├──> IFS engine (escribe sobre snapshot)
            ├──> IQS engine (escribe sobre snapshot)
            └──> Valuation engine (escribe sobre snapshot)

19-peers-bulk (INDEPENDIENTE)
    │
    └──> Usado por UI (peers comparison)
```

### Orden Secuencial Crítico

**FASE 1: Foundation (MUST run first)**

1. `01-sync-universe` → Define universo
2. `02-industry-classification-sync` → Coherencia sector/industry

**FASE 2: Raw Data Ingestion** 3. `03-prices-daily-bulk` → Precios EOD 4. `04-financials-bulk` → Financials FY/Q/TTM (CRÍTICO) 5. `04b-incremental-ttm-valuation` → Actualiza TTM incremental 6. `05-company-profile-bulk` → Profiles descriptivos

**FASE 3: Aggregations (performance & valuation)** 7. `06-industry-performance-aggregator` → Performance 1D 8. `07-sector-performance-aggregator` → Performance 1D 9. `08-sector-performance-windows-aggregator` → Performance multi-período 10. `09-industry-performance-windows-aggregator` → Performance multi-período 11. `10-sector-pe-aggregator` → Valuation sectorial 12. `11-industry-pe-aggregator` → Valuation industry

**FASE 4: Benchmarks (CRÍTICA para engines)** 13. `12-sector-benchmarks` → Percentiles sectoriales 14. `12b-industry-benchmarks-aggregator` → Percentiles industry

**FASE 5: Performance Relative** 15. `13-performance-bulk` → Alpha calculations 16. `13b-performance-windows-aggregator` → Consolidación

**FASE 6: Market State Consolidation** 17. `14-market-state-bulk` → Ensambla snapshot completo

**FASE 7: Dividends (paralelo)** 18. `15-dividends-bulk-v2` → Historial dividendos

**FASE 8: FMP Snapshots (esqueleto)** 19. `16-fmp-bulk-snapshots` → Inicializa fintra_snapshots

**FASE 9: Validation** 20. `17-healthcheck-snapshots` → Valida cobertura

**FASE 10: Engines (el core de Fintra)** 21. `18-recompute-fgos-all` → FGOS scoring 22. [Post-pipeline] IFS, IQS, Valuation, Moat, CA engines

**FASE 11: Peers (independiente)** 23. `19-peers-bulk` → Peers relationships

---

## 📊 TABLAS DE SUPABASE UTILIZADAS {#tablas}

### Tablas de Entrada (Read-Only en pipeline)

| Tabla               | Descripción                  | Población |
| ------------------- | ---------------------------- | --------- |
| `fintra_universe`   | Universo activo de tickers   | Job 01    |
| `industry_metadata` | Jerarquía sector → industria | Job 02    |

### Tablas de Datos Raw

| Tabla               | Descripción                    | Población   | Rows  |
| ------------------- | ------------------------------ | ----------- | ----- |
| `prices_daily`      | Precios EOD históricos         | Job 03      | ~2.5M |
| `datos_financieros` | Estados financieros (FY+Q+TTM) | Job 04, 04b | ~500K |
| `company_profile`   | Profiles descriptivos          | Job 05      | ~10K  |
| `datos_dividendos`  | Historial dividendos           | Job 15      | ~80K  |

### Tablas de Agregación

| Tabla                             | Descripción                             | Población | Rows     |
| --------------------------------- | --------------------------------------- | --------- | -------- |
| `industry_performance_aggregated` | Performance 1D por industria            | Job 06    | ~150/día |
| `sector_performance_aggregated`   | Performance 1D por sector               | Job 07    | ~11/día  |
| `sector_performance_windows`      | Performance multi-período por sector    | Job 08    | ~11/día  |
| `industry_performance_windows`    | Performance multi-período por industria | Job 09    | ~150/día |
| `sector_pe_aggregated`            | P/E agregado por sector                 | Job 10    | ~11/día  |
| `industry_pe_aggregated`          | P/E agregado por industria              | Job 11    | ~150/día |

### Tablas de Benchmarks (CRÍTICAS)

| Tabla                 | Descripción                           | Población | Rows       |
| --------------------- | ------------------------------------- | --------- | ---------- |
| `sector_benchmarks`   | Percentiles de métricas por sector    | Job 12    | ~286/día   |
| `industry_benchmarks` | Percentiles de métricas por industria | Job 12b   | ~3,900/día |

### Tablas de Performance Relativo

| Tabla                  | Descripción                   | Población | Rows     |
| ---------------------- | ----------------------------- | --------- | -------- |
| `performance_relative` | Alpha vs sector (7 windows)   | Job 13    | ~10K/día |
| `performance_windows`  | Vista consolidada performance | Job 13b   | ~10K/día |

### Tablas de Market State (CORE)

| Tabla                 | Descripción                     | Población    | Rows     |
| --------------------- | ------------------------------- | ------------ | -------- |
| `fintra_market_state` | Snapshot consolidado diario     | Job 14       | ~10K/día |
| `fintra_snapshots`    | Snapshot con engines ejecutados | Jobs 16, 18+ | ~10K/día |

### Tablas de Relaciones

| Tabla   | Descripción             | Población | Rows |
| ------- | ----------------------- | --------- | ---- |
| `peers` | Relaciones peer-to-peer | Job 19    | ~60K |

---

## 🌊 FLUJO DE DATOS COMPLETO {#flujo-datos}

### Ejemplo: Cálculo de FGOS para AAPL

**Input Stack:**

```
FMP API (profile-bulk)
  ↓
fintra_universe (AAPL is active)
  ↓
FMP API (financials bulk 2024FY, 2024Q1, Q2, Q3, Q4 + TTM)
  ↓
datos_financieros (AAPL: 50+ rows: FY 2015-2024, Qs 2020-2024, TTM)
  ↓
04b-incremental-ttm-valuation (construye TTM 2024 si new quarter)
  ↓
datos_financieros (AAPL TTM: revenue=$383B, netIncome=$99B, roic=45%, ...)
  ↓
12-sector-benchmarks (Technology sector)
  ├─ roic: {p10:10%, p25:15%, p50:22%, p75:32%, p90:42%, p95:48%}
  ├─ roe: {p10:8%, p25:12%, p50:18%, p75:25%, p90:32%, p95:38%}
  └─ operatingMargin: {...}
  ↓
16-fmp-bulk-snapshots (AAPL snapshot creado: price=$180, marketCap=$2.8T)
  ↓
18-recompute-fgos-all
  ├─ Fetch AAPL TTM metrics
  ├─ Fetch Technology benchmarks
  ├─ Calculate:
  │   Growth: revenueGrowth=-3% (vs p50=8%) → score=35
  │   Profitability: roic=45% (vs p90=42%) → score=92
  │   Efficiency: assetTurnover=1.1 (vs p50=0.9) → score=68
  │   Solvency: debtToEquity=1.8 (vs p25=0.5) → score=40
  │   FGOS = (35×0.25 + 92×0.35 + 68×0.20 + 40×0.20) = 62.45
  ├─ Confidence: 98 (casi todos los campos presentes)
  └─ Category: 'Medium' (50-75 range)
  ↓
fintra_snapshots (AAPL row UPDATED)
  ├─ fgos_status = 'computed'
  ├─ fgos_score = 62.45
  ├─ fgos_confidence = 98
  └─ fgos_category = 'Medium'
  ↓
[IFS engine ejecuta después]
  ├─ Calcula position (leader/follower/laggard)
  ├─ Calcula pressure (0-3)
  └─ UPDATES fintra_snapshots.ifs.*
  ↓
[IQS, Valuation, Moat, CA engines ejecutan]
  └─ Cada uno UPDATE su sección en fintra_snapshots
  ↓
FINAL: fintra_snapshots (AAPL row completo con TODOS los engines)
  ↓
UI Dashboard / Ticker Detail Page
```

---

## 🛠️ TROUBLESHOOTING {#troubleshooting}

### Job 01 - Sync Universe

**Error:** `ON CONFLICT DO UPDATE command cannot affect row a second time`

- **Causa:** Duplicados en FMP profile bulk (mismo ticker aparece 2+ veces)
- **Fix:** Deduplicación en código (ya implementado con `Map`)

**Error:** `Ticker count dropped from 10,000 to 500`

- **Causa:** FMP API error o filtro demasiado restrictivo
- **Fix:** Verificar response de FMP, validar filters (ETF/ADR/FUND)

---

### Job 03 - Prices Daily Bulk

**Error:** `No prices found for date 2025-12-25`

- **Causa:** Mercado cerrado (holiday o weekend)
- **Fix:** Script ya skip weekends, agregar holiday calendar

**Error:** `Supabase error: 1000 row limit exceeded`

- **Causa:** Intentando insertar 20,000 rows en una llamada
- **Fix:** Chunking NO implementado (Job 03 no debería exceder 10K rows/día)

---

### Job 04 - Financials Bulk

**Error:** `Process killed: Out of memory`

- **Causa:** Procesando 10,000 tickers × 50 rows = 500K rows en memoria
- **Fix:** Reducir `--batch-size` de 2000 a 1000 o 500
- **Prevención:** Ya implementado chunking defensivo (5,000 rows/chunk)

**Error:** `Missing TTM metrics for AAPL`

- **Causa:** FMP `key-metrics-ttm-bulk` no tiene data para ticker
- **Fix:** Expected (no todos tienen TTM), job debe continuar

**Error:** `Preflight: Date mismatch for 2024Q3`

- **Causa:** Income statement date ≠ Balance sheet date
- **Fix:** Warning only (no aborta), usar date más reciente

---

### Job 04B - Incremental TTM

**Error:** `Constructed TTM with only 3 quarters`

- **Causa:** Lógica rota - MUST have exactly 4 quarters
- **Fix:** Validación estricta ya implementada (return null si less than 4)

**Error:** `TTM not created after new Q4 released`

- **Causa:** "Dirty ticker" detection no funcionó
- **Fix:** Verificar query de detección (comparar dates como strings o dates?)

---

### Job 12 - Sector Benchmarks

**Error:** `FGOS all pending after Job 12`

- **Causa:** Sector benchmarks NO escritos (Job 12 falló silenciosamente)
- **Fix:** Verificar logs de Job 12, validar upserts a `sector_benchmarks`

**Error:** `Low confidence benchmarks (universe_size=5)`

- **Causa:** Sector nuevo o Industry con pocos tickers
- **Fix:** Expected, FGOS aplicará penalty por low confidence

---

### Job 18 - Recompute FGOS

**Error:** `FGOS status=pending for 9000/10000 tickers`

- **Causa:** Sector benchmarks missing (Job 12 falló)
- **Fix:** Re-run Job 12, luego Job 18

**Error:** `FGOS score=150 (fuera de rango 0-100)`

- **Causa:** Bug en interpolación de percentile
- **Fix:** Validar función `interpolatePercentile`, cap values

---

### Pipeline Completo

**Error:** `Job 18 executed before Job 12`

- **Causa:** Orden de ejecución roto en `run-master-cron.ts`
- **Fix:** Verificar array de jobs en master cron (orden secuencial)

**Error:** `Pipeline toma 8 horas (expected: 2-4 hrs)`

- **Causa:** API rate limiting de FMP o queries lentas en Supabase
- **Fix:**
  - FMP: Verificar plan (bulk endpoints más rápidos)
  - Supabase: Agregar índices (ticker, date, sector)

**Error:** `Snapshot incomplete: missing IFS, Valuation`

- **Causa:** Post-pipeline engines NO ejecutados
- **Fix:** Verificar `run-master-cron.ts` incluye TODOS los engines

---

## 📌 NOTAS FINALES

### Principios de Diseño del Pipeline

1. **Fault Tolerance:**
   - Error en 1 ticker NO aborta batch
   - Try-catch per ticker con logging

2. **Idempotencia:**
   - Jobs pueden re-ejecutarse sin duplicar data
   - Upserts con `ON CONFLICT DO UPDATE`

3. **Temporal Consistency:**
   - NO usar datos futuros para cálculos pasados
   - TTM siempre construido con last 4 closed quarters

4. **Missing Data Handling:**
   - NEVER inventa data
   - NULL propagates correctamente
   - `status='pending'` cuando data insuficiente

5. **Chunking Defensivo:**
   - Supabase limit: 1,000 rows/query (informal, oficial es más alto)
   - Jobs usan 5,000 rows/chunk para safety
   - Parallel processing con `Promise.all()` (I/O only)

6. **Performance Optimizations:**
   - Cache de FMP bulk CSVs (evita re-downloads)
   - Vectorized queries (evita N+1 problem)
   - Batch upserts (reduce DB round-trips)

7. **Observability:**
   - Logs estructurados por ticker
   - Métricas de success/pending/error
   - Healthcheck job valida cobertura

---

## 🔗 REFERENCIAS

### Archivos Relacionados

- **Orquestador:** `scripts/pipeline/run-master-cron.ts`
- **Documentación Engines:** `documentacion-tecnica/04-ENGINES/DOCUMENTACION_ENGINES_MASTER.md`
- **Diagrama de Flujo General:** `documentacion-tecnica/DIAGRAMA_DE_FLUJO.md`
- **Estado del Proyecto:** `documentacion-tecnica/ESTADO_ACTUAL_PROYECTO.md`

### API Referencias

- **FMP API Docs:** https://site.financialmodelingprep.com/developer/docs
- **Supabase Docs:** https://supabase.com/docs

---

**FIN DE LA DOCUMENTACIÓN DEL PIPELINE**

Última actualización: 6 de febrero de 2026  
Versión: 1.0  
Autor: Sistema de auditoría técnica Fintra

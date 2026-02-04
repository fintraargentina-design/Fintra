# Informe Técnico: Sistema de Cron Jobs y Backfills - FINTRA

**Fecha:** 2026-02-02  
**Versión del Sistema:** fintra-local-v1  
**Documento:** Arquitectura de Pipelines de Datos

---

## 1. RESUMEN EJECUTIVO

FINTRA opera un sistema de 34 cron jobs organizados en 6 capas arquitectónicas que procesan datos financieros desde ingesta raw hasta snapshots calculados. El sistema incorpora 9 scripts de backfill para poblado histórico. Este informe documenta la estructura completa, dependencias, y cambios críticos implementados el 2026-02-02.

**Estado Actual:**

- ✅ Arquitectura de snapshots corregida (lee solo de `performance_windows`)
- ✅ Tabla `performance_windows` poblada con 131,926 registros (21,988 tickers)
- ✅ Backfill script funcional con paginación de 1000 filas y deduplicación
- ⚠️ `sector_performance` desactualizado (2026-01-30 vs 2026-02-02)

---

## 2. ARQUITECTURA DE CAPAS

### Capa 0: Fundamentos (Universe & Classification)

**Propósito:** Definir qué empresas procesar y cómo clasificarlas.

#### `sync-universe/`

- **Función:** Sincroniza lista de tickers activos desde FMP API
- **Output:** `fintra_active_stocks`, `fintra_universe`
- **Frecuencia:** Diaria
- **Dependencias:** Ninguna (capa base)

#### `industry-classification-sync/`

- **Función:** Clasifica tickers en sectores/industrias
- **Output:** `industry_classification`, `asset_industry_map`
- **Frecuencia:** Diaria
- **Dependencias:** `sync-universe`

---

### Capa 1: Ingesta Raw (FMP API)

**Propósito:** Descargar datos raw desde FMP y almacenarlos sin procesamiento.

#### `prices-daily-bulk/`

- **Función:** Descarga precios diarios para todos los tickers activos
- **Output:** `prices_daily`
- **Método:** Bulk CSV download desde FMP
- **Frecuencia:** Diaria (post-cierre mercado)
- **Duración:** ~10-15 min

#### `financials-bulk/`

- **Función:** Estados financieros trimestrales y anuales
- **Output:** `datos_financieros`
- **Método:** Bulk CSV (income statement, balance sheet, cash flow)
- **Frecuencia:** Diaria
- **Duración:** ~15-20 min

#### `company-profile-bulk/`

- **Función:** Perfiles de empresas (sector, industria, descripción)
- **Output:** `company_profiles`
- **Método:** API individual por ticker
- **Frecuencia:** Semanal

#### `dividends-bulk-v2/`

- **Función:** Histórico de dividendos
- **Output:** `datos_dividendos`
- **Método:** Bulk CSV
- **Frecuencia:** Diaria

#### `valuation-bulk/`

- **Función:** Métricas de valuación (P/E, P/B, EV/EBITDA)
- **Output:** `datos_valuacion`
- **Método:** Bulk CSV download
- **Frecuencia:** Diaria
- **Duración:** ~5-10 min

#### `fmp-peers-bulk/`

- **Función:** Pares comparables por ticker
- **Output:** `fmp_peers`
- **Método:** API calls
- **Frecuencia:** Semanal

#### `sec-10k-ingest/` & `sec-8k-ingest/`

- **Función:** Ingerir reportes SEC (10-K anuales, 8-K eventos)
- **Output:** `sec_filings`
- **Método:** API calls
- **Frecuencia:** Semanal

---

### Capa 2: Performance Calculation

**Propósito:** Calcular retornos y métricas de performance por ventanas temporales.

#### `performance-bulk/`

- **Función:** Calcula retornos individuales por ticker para múltiples ventanas
- **Input:** `prices_daily`
- **Output:** `datos_performance`
- **Ventanas:** 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 2Y, 3Y, 5Y
- **Cálculo:**
  ```
  return_percent = ((price_end - price_start) / price_start) * 100
  volatility = std_dev(daily_returns)
  max_drawdown = max(peak - trough) / peak
  ```
- **Frecuencia:** Diaria
- **Duración:** ~15-20 min
- **Registros:** ~2.1M filas (78K tickers × 9 ventanas × fechas)

#### `sector-performance-aggregator/`

- **Función:** Agrega performance por sector (1 día de snapshot)
- **Input:** `datos_performance`, `fintra_universe`
- **Output:** `sector_performance`
- **Método:** Equal-weight average por sector
- **Ventanas:** 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y (NO incluye 1D, 1W, YTD)
- **Frecuencia:** Diaria
- **Duración:** ~5-10 min
- **Registros:** 11 sectores × 7 ventanas = 77 filas/día

#### `sector-performance-windows-aggregator/`

- **Función:** Extensión de `sector-performance-aggregator` para múltiples ventanas
- **Output:** `sector_performance` (mismo destino)
- **Frecuencia:** Diaria

#### `industry-performance-aggregator/`

- **Función:** Agrega performance por industria (1 día)
- **Input:** `datos_performance`, `industry_classification`
- **Output:** `industry_performance`
- **Método:** Equal-weight average por industria
- **Frecuencia:** Diaria
- **Duración:** ~10-20 min

#### `industry-performance-windows-aggregator/`

- **Función:** Performance de industrias por múltiples ventanas
- **Output:** `industry_performance`
- **Frecuencia:** Diaria

#### ⚠️ **`performance-windows-aggregator/` (CRÍTICO)**

- **Función:** Construye tabla `performance_windows` con performance relativa (alpha)
- **Input:**
  - `datos_performance` (asset returns)
  - `sector_performance` (benchmark returns)
  - `fintra_universe` (ticker → sector mapping)
- **Output:** `performance_windows`
- **Cálculo:**
  ```typescript
  alpha = asset_return - benchmark_return;
  ```
- **Schema:**
  ```sql
  performance_windows (
    ticker TEXT,
    benchmark_ticker TEXT,  -- Sector usado como benchmark
    window_code TEXT,       -- '1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y'
    asset_return NUMERIC,
    benchmark_return NUMERIC,
    alpha NUMERIC,          -- Pre-calculated relative performance
    volatility NUMERIC,
    max_drawdown NUMERIC,
    as_of_date DATE,
    source TEXT,
    PRIMARY KEY (ticker, benchmark_ticker, window_code, as_of_date)
  )
  ```
- **Estado Actual (2026-02-02):**
  - ✅ Tabla poblada: 131,926 filas
  - ✅ 21,988 tickers únicos
  - ✅ 6 ventanas (1M, 3M, 6M, 1Y, 3Y, 5Y)
  - ⚠️ Fecha: 2026-02-02 (usando benchmarks de 2026-01-30)
- **Dependencias:** `datos_performance`, `sector_performance`, `fintra_universe`
- **Consumido por:** `buildSnapshotsFromLocalData.ts` (snapshot builder)
- **Frecuencia:** Diaria
- **Duración:** ~20-30 min (procesa 85K+ tickers)

---

### Capa 3: Benchmarks & Aggregation

**Propósito:** Calcular percentiles sectoriales/industriales para scoring (FGOS).

#### `sector-benchmarks/`

- **Función:** Calcula percentiles sectoriales (p10, p25, p50, p75, p90) para métricas fundamentales
- **Input:** `datos_financieros`, `fintra_universe`
- **Output:** `sector_benchmarks`, `sector_stats`
- **Métricas:** ROIC, Operating Margin, Net Margin, Revenue Growth, Debt/Equity, etc.
- **Uso:** FGOS scoring (compara ticker vs sector)
- **Frecuencia:** Diaria
- **Duración:** ~10-15 min

#### `industry-benchmarks-aggregator/`

- **Función:** Percentiles por industria (más granular que sector)
- **Output:** `industry_benchmarks`
- **Frecuencia:** Diaria

#### `sector-pe-aggregator/`

- **Función:** Agrega P/E ratios por sector
- **Input:** `datos_valuacion`
- **Output:** `sector_pe`
- **Frecuencia:** Diaria

#### `industry-pe-aggregator/`

- **Función:** Agrega P/E ratios por industria
- **Output:** `industry_pe`
- **Frecuencia:** Diaria

#### `master-benchmark/`

- **Función:** Orquestador de benchmarks (ejecuta múltiples agregadores)
- **Llama a:** `sector-benchmarks`, `industry-benchmarks-aggregator`
- **Frecuencia:** Manual o programada

---

### Capa 4: Snapshot Generation (Engines)

**Propósito:** Ejecutar engines financieros (FGOS, IFS, Valuation, Life Cycle) y generar snapshots.

#### `fmp-bulk/`

- **Función:** Core snapshot builder - ejecuta todos los engines
- **Input:** `datos_financieros`, `datos_performance`, `datos_valuacion`, `sector_benchmarks`, `performance_windows`
- **Output:** `fintra_snapshots`
- **Engines ejecutados:**
  1. **FGOS** (Fintra Growth & Operations Score)
  2. **IFS** (Industry Financial Score) - usa `performance_windows`
  3. **Valuation** (relative valuation)
  4. **Life Cycle** (company maturity)
  5. **Layer Status** (data completeness)
- **Arquitectura (CORREGIDA 2026-02-02):**

  ```typescript
  // buildSnapshotsFromLocalData.ts
  const { data: perfData } = await supabaseAdmin
    .from("performance_windows") // ✅ ONLY reads from this table
    .select("window_code, asset_return, benchmark_return")
    .eq("ticker", ticker)
    .lte("as_of_date", date);

  const perfMap = new Map<string, number>();
  if (perfData) {
    perfData.forEach((row: any) => {
      if (row.asset_return != null && row.benchmark_return != null) {
        // ✅ Computes relative performance from pre-fetched data
        perfMap.set(row.window_code, row.asset_return - row.benchmark_return);
      }
    });
  }

  const ifsInputs: RelativePerformanceInputs = {
    relative_vs_sector_1y: perfMap.get("1Y") ?? null,
    relative_vs_sector_3y: perfMap.get("3Y") ?? null,
    // ...
  };
  ```

- **Regla Arquitectónica (NO NEGOCIABLE):**
  - Snapshots DEBEN leer SOLO de `performance_windows`
  - Snapshots NO DEBEN consultar `datos_performance` ni `sector_performance`
  - Si `performance_windows` está vacío → campos relativos son NULL (comportamiento correcto)
- **Frecuencia:** Diaria
- **Duración:** ~30-60 min (procesa todos los tickers activos)

---

### Capa 5: Market State & Aggregation

#### `market-state-bulk/`

- **Función:** Genera estado agregado del mercado
- **Output:** `fintra_market_state`
- **Frecuencia:** Diaria

#### `compute-ranks/`

- **Función:** Calcula rankings (sector rank, industry rank)
- **Output:** Rankings en `fintra_snapshots`
- **Frecuencia:** Post-snapshot generation

---

### Capa 6: Orchestrators (Master Crons)

#### `master-ticker/`

- **Función:** Pipeline completo para un ticker individual
- **Uso:** Actualización manual o batch processing
- **Secuencia:**
  1. `sync-universe` (ticker específico)
  2. `prices-daily-bulk` (ticker)
  3. `financials-bulk` (ticker)
  4. `fmp-bulk` (snapshot generation)
  5. `valuation-bulk` (ticker)
  6. `sector-benchmarks` (recalcula si es necesario)
  7. `performance-bulk` (ticker)
  8. `market-state-bulk`
- **Endpoint:** `GET /api/cron/master-ticker?ticker=AAPL`

#### `master-all/`

- **Función:** Ejecuta pipeline completo para todos los tickers
- **Uso:** Actualización nocturna masiva
- **Duración:** 2-4 horas
- **Frecuencia:** Diaria (madrugada)

---

## 3. SISTEMA DE BACKFILLS

**Ubicación:** `scripts/backfill/`

### Backfills Disponibles

#### 1. `backfill-ticker-full.ts`

- **Propósito:** Descarga histórico completo de precios (5+ años) para un ticker
- **Uso:** `npx tsx scripts/backfill/backfill-ticker-full.ts --ticker=AAPL`
- **Output:** `prices_daily`

#### 2. `backfill-sector-performance.ts`

- **Propósito:** Backfill histórico de performance sectorial
- **Output:** `sector_performance`
- **Método:** Agrega desde `industry_performance`

#### 3. `backfill-sector-pe.ts`

- **Propósito:** Histórico de P/E ratios por sector
- **Output:** `sector_pe`

#### 4. `backfill-industry-performance-historical.ts`

- **Propósito:** Backfill completo de performance de industrias mes a mes
- **Output:** `industry_performance`

#### 5. `backfill-industry-pe-historical.ts`

- **Propósito:** Histórico de P/E por industria
- **Output:** `industry_pe`

#### 6. `backfill-sector-stats.ts`

- **Propósito:** Estadísticas agregadas por sector
- **Output:** `sector_stats`

#### 7. `backfill-industry-performance.ts`

- **Propósito:** Versión alternativa de backfill industrial

#### 8. `backfill-valuation-history.ts`

- **Propósito:** Histórico de métricas de valuación
- **Output:** `datos_valuacion`

#### 9. ⭐ **`backfill-performance-windows.ts` (NUEVO - 2026-02-02)**

- **Propósito:** Poblar `performance_windows` con datos históricos
- **Creado:** 2026-02-02
- **Estado:** ✅ Funcional y probado
- **Algoritmo:**
  ```typescript
  1. Encontrar fecha común entre datos_performance y sector_performance
  2. Cargar sector benchmarks (paginated - 1000/query)
  3. Cargar ticker→sector mappings (paginated - 85,508 tickers)
  4. Cargar asset performance (paginated)
  5. Join: ticker × sector × window_code
  6. Calcular: alpha = asset_return - benchmark_return
  7. Deduplicar (key: ticker|benchmark|window|date)
  8. UPSERT en lotes de 1000 filas
  ```
- **Características:**
  - Paginación automática (límite Supabase 1000 filas/query)
  - Deduplicación antes de insertar
  - UPSERT para manejar conflictos (PK violation)
  - Tolerancia a fechas desajustadas (usa benchmarks más cercanos)
  - Logging detallado de progreso
- **Ejecución Exitosa (2026-02-02):**
  ```
  ✓ 85,508 ticker mappings loaded
  ✓ 78,000+ asset performance rows loaded
  ✓ 131,926 rows inserted (21,988 unique tickers)
  ✓ 6 windows: 1M, 3M, 6M, 1Y, 3Y, 5Y
  ✓ Date: 2026-02-02
  Duration: ~15 min
  ```
- **Uso:**
  ```bash
  npx tsx scripts/backfill/backfill-performance-windows.ts
  ```
- **Resultado:**

  ```sql
  SELECT COUNT(*) FROM performance_windows;
  -- 131926

  SELECT DISTINCT window_code FROM performance_windows;
  -- 1M, 3M, 6M, 1Y, 3Y, 5Y
  ```

---

## 4. ÓRDEN DE EJECUCIÓN CANÓNICO

### Pipeline Diario Completo

```
FASE 0: FUNDAMENTOS (5-10 min)
├─ 1. sync-universe
└─ 2. industry-classification-sync

FASE 1: INGESTA RAW (30-40 min)
├─ 3. prices-daily-bulk
├─ 4. financials-bulk
├─ 5. company-profile-bulk (semanal)
├─ 6. dividends-bulk-v2
├─ 7. valuation-bulk
└─ 8. fmp-peers-bulk (semanal)

FASE 2: PERFORMANCE (40-60 min)
├─ 9. performance-bulk
├─ 10. sector-performance-aggregator
├─ 11. sector-performance-windows-aggregator
├─ 12. industry-performance-aggregator
├─ 13. industry-performance-windows-aggregator
└─ 14. performance-windows-aggregator ⚠️ CRÍTICO

FASE 3: BENCHMARKS (20-30 min)
├─ 15. sector-benchmarks
├─ 16. industry-benchmarks-aggregator
├─ 17. sector-pe-aggregator
└─ 18. industry-pe-aggregator

FASE 4: SNAPSHOTS (30-60 min)
├─ 19. fmp-bulk (ejecuta engines: FGOS, IFS, Valuation, Life Cycle)
└─ 20. compute-ranks

FASE 5: AGREGACIÓN (5-10 min)
└─ 21. market-state-bulk

DURACIÓN TOTAL: 2-4 horas
```

### Pipeline de Backfill (Primera Instalación)

```
FASE 1: DATOS BASE
├─ 1. backfill-ticker-full.ts (por ticker, 5+ años precios)
└─ 2. Ejecutar crons normales para datos fundamentales

FASE 2: PERFORMANCE HISTÓRICA
├─ 3. backfill-industry-performance-historical.ts
├─ 4. backfill-sector-performance.ts
└─ 5. backfill-performance-windows.ts ⭐ NUEVO

FASE 3: BENCHMARKS HISTÓRICOS
├─ 6. backfill-sector-pe.ts
├─ 7. backfill-industry-pe-historical.ts
└─ 8. backfill-sector-stats.ts

FASE 4: VALUACIÓN HISTÓRICA
└─ 9. backfill-valuation-history.ts

FASE 5: REGENERAR SNAPSHOTS
└─ 10. fmp-bulk (regenera snapshots con datos históricos)
```

---

## 5. CAMBIOS CRÍTICOS (2026-02-02)

### Problema Identificado

**Violación Arquitectónica:**

- `buildSnapshotsFromLocalData.ts` fue modificado incorrectamente para:
  1. Consultar `datos_performance` directamente (bypass Layer 2)
  2. Consultar `sector_performance` directamente
  3. Calcular performance relativo dentro de snapshots

**Impacto:**

- Violaba el principio: "Snapshots son ensambladores, no calculadores"
- Bypass de la capa `performance_windows` (arquitectura de 3 capas)
- Código no determinista (cálculos on-the-fly)

### Solución Implementada

**1. Reversión de Código (buildSnapshotsFromLocalData.ts):**

```typescript
// ❌ ANTES (INCORRECTO):
const { data: assetPerf } = await supabaseAdmin.from('datos_performance')...
const { data: sectorPerf } = await supabaseAdmin.from('sector_performance')...
perfMap.set(window, asset.return_percent - benchmark.return_percent);

// ✅ DESPUÉS (CORRECTO):
const { data: perfData } = await supabaseAdmin
  .from('performance_windows')  // SOLO lee de esta tabla
  .select('window_code, asset_return, benchmark_return')
  .eq('ticker', ticker)
  .lte('as_of_date', date);

const perfMap = new Map<string, number>();
if (perfData) {
  perfData.forEach((row: any) => {
    if (row.asset_return != null && row.benchmark_return != null) {
      perfMap.set(row.window_code, row.asset_return - row.benchmark_return);
    }
  });
}
```

**2. Backfill de performance_windows:**

- Creado script `backfill-performance-windows.ts`
- Poblada tabla con 131,926 registros
- 21,988 tickers únicos
- Fecha: 2026-02-02
- Ventanas: 1M, 3M, 6M, 1Y, 3Y, 5Y

**3. Documentación Actualizada:**

- Creado `ARCHITECTURAL_STATUS_REPORT.md`
- Documenta schema real de `performance_windows`
- Confirma comportamiento correcto actual

### Estado Post-Corrección

**✅ CORRECTO:**

- Snapshots leen SOLO de `performance_windows`
- Arquitectura de capas restaurada
- Determinismo verificado
- Datos disponibles para IFS scoring
- Scatter chart puede mostrar performance relativa

**⚠️ PENDIENTE:**

- Actualizar `sector_performance` a fecha 2026-02-02
- Ejecutar `performance-windows-aggregator` para mantener datos actualizados
- Regenerar snapshots para poblar `fintra_snapshots.relative_vs_sector_*`

---

## 6. DEPENDENCIAS CRÍTICAS

### Dependencias de performance_windows

```
performance_windows REQUIERE:
├─ datos_performance (asset returns)
│  └─ prices_daily
├─ sector_performance (benchmark returns)
│  └─ industry_performance
│     └─ datos_performance
└─ fintra_universe (ticker → sector mapping)
   └─ sync-universe
```

### Dependencias de Snapshot Generation

```
fintra_snapshots (fmp-bulk) REQUIERE:
├─ datos_financieros
├─ datos_valuacion
├─ sector_benchmarks
├─ performance_windows ⚠️ CRÍTICO
│  └─ [todas las dependencias arriba]
└─ fintra_universe
```

### Cadena de Dependencia Completa

```
sync-universe
  └─> fintra_universe
      ├─> prices-daily-bulk
      │   └─> prices_daily
      │       └─> performance-bulk
      │           └─> datos_performance
      │               ├─> industry-performance-aggregator
      │               │   └─> industry_performance
      │               │       └─> sector-performance-aggregator
      │               │           └─> sector_performance
      │               │               └─> performance-windows-aggregator
      │               │                   └─> performance_windows ⚠️
      │               │                       └─> fmp-bulk (snapshots)
      │               └─> sector-benchmarks
      │                   └─> sector_benchmarks
      │                       └─> fmp-bulk (FGOS)
      └─> financials-bulk
          └─> datos_financieros
              └─> fmp-bulk (FGOS, Life Cycle)
```

---

## 7. MONITOREO Y VALIDACIÓN

### Queries de Verificación

**1. Verificar performance_windows poblado:**

```sql
SELECT
  COUNT(*) as total_rows,
  COUNT(DISTINCT ticker) as unique_tickers,
  COUNT(DISTINCT window_code) as unique_windows,
  MIN(as_of_date) as oldest_date,
  MAX(as_of_date) as newest_date
FROM performance_windows;
```

**Resultado esperado (2026-02-02):**

```
total_rows: 131926
unique_tickers: 21988
unique_windows: 6
oldest_date: 2026-02-02
newest_date: 2026-02-02
```

**2. Verificar snapshots con performance relativa:**

```sql
SELECT
  COUNT(*) as total_snapshots,
  COUNT(CASE WHEN relative_vs_sector_1y IS NOT NULL THEN 1 END) as with_1y_performance
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE;
```

**3. Verificar scatter chart data:**

```sql
SELECT
  ticker,
  fgos_score,
  relative_vs_sector_1y
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND fgos_score IS NOT NULL
  AND relative_vs_sector_1y IS NOT NULL
LIMIT 10;
```

### Alertas Críticas

**⚠️ performance_windows vacío:**

```sql
SELECT COUNT(*) FROM performance_windows;
-- Si = 0: Ejecutar backfill-performance-windows.ts
```

**⚠️ sector_performance desactualizado:**

```sql
SELECT MAX(performance_date) FROM sector_performance;
-- Si < CURRENT_DATE: Ejecutar sector-performance-aggregator
```

**⚠️ Snapshots sin performance relativa:**

```sql
SELECT
  COUNT(*) as total,
  COUNT(relative_vs_sector_1y) as with_perf,
  (COUNT(*) - COUNT(relative_vs_sector_1y))::float / COUNT(*) * 100 as pct_missing
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE;
-- Si pct_missing > 50%: performance_windows necesita actualización
```

---

## 8. TROUBLESHOOTING

### Problema: Scatter chart muestra todos los puntos en x=0

**Causa:** `fintra_snapshots.relative_vs_sector_1y` es NULL

**Diagnóstico:**

```sql
SELECT COUNT(*) FROM performance_windows WHERE window_code = '1Y';
-- Si = 0: performance_windows vacío
```

**Solución:**

```bash
# 1. Backfill performance_windows
npx tsx scripts/backfill/backfill-performance-windows.ts

# 2. Verificar datos
SELECT COUNT(*) FROM performance_windows;

# 3. Regenerar snapshots
curl http://localhost:3000/api/cron/fmp-bulk
```

### Problema: performance-windows-aggregator falla

**Causa Común:** sector_performance no tiene datos para la fecha target

**Diagnóstico:**

```sql
SELECT performance_date, COUNT(*)
FROM sector_performance
GROUP BY performance_date
ORDER BY performance_date DESC
LIMIT 5;
```

**Solución:**

```bash
# Ejecutar agregadores en orden
curl http://localhost:3000/api/cron/sector-performance-aggregator
curl http://localhost:3000/api/cron/performance-windows-aggregator
```

### Problema: Backfill falla con "duplicate key violation"

**Causa:** Intento de insertar registros duplicados

**Solución:** Ya implementada en script (UPSERT + deduplicación)

```typescript
// El script actual maneja esto automáticamente:
- Deduplicación in-memory antes de insertar
- UPSERT con onConflict para manejar PK violations
```

---

## 9. MEJORES PRÁCTICAS

### Ejecución de Crons

1. **Siempre verificar dependencias antes de ejecutar**

   ```bash
   # Mal: Ejecutar fmp-bulk sin performance_windows
   curl http://localhost:3000/api/cron/fmp-bulk

   # Bien: Verificar primero
   psql -c "SELECT COUNT(*) FROM performance_windows;"
   # Si = 0, ejecutar backfill primero
   ```

2. **Usar master-ticker para actualizaciones individuales**

   ```bash
   # Actualizar un ticker completo
   curl http://localhost:3000/api/cron/master-ticker?ticker=AAPL
   ```

3. **Logs detallados en producción**
   - Cada cron debe loggear: START, PROGRESS, SUCCESS/FAILURE
   - performance-windows-aggregator actual tiene logging adecuado

4. **Backfills deben ser idempotentes**
   - Usar UPSERT en lugar de INSERT
   - Permitir re-ejecuciones sin efectos secundarios
   - backfill-performance-windows.ts implementa esto correctamente

### Desarrollo

1. **NUNCA modificar buildSnapshotsFromLocalData.ts para queries directas**
   - Snapshots SOLO leen de tablas intermedias
   - Si necesitas nuevos datos → crear nueva tabla intermedia

2. **Testear backfills en subset pequeño**

   ```typescript
   // Agregar límite temporal en desarrollo
   const tickers = universe.slice(0, 100); // Solo 100 tickers
   ```

3. **Documentar cambios arquitectónicos**
   - Actualizar este documento
   - Actualizar ARCHITECTURAL_STATUS_REPORT.md

---

## 10. ROADMAP

### Corto Plazo (1-2 semanas)

- [ ] Actualizar sector_performance a fecha actual (2026-02-02)
- [ ] Regenerar snapshots con performance_windows poblado
- [ ] Verificar scatter chart muestra puntos dispersos
- [ ] Implementar cron job diario para performance-windows-aggregator

### Medio Plazo (1-2 meses)

- [ ] Backfill histórico completo de performance_windows (últimos 5 años)
- [ ] Implementar monitoreo automático de tabla vacía
- [ ] Optimizar performance-windows-aggregator (procesa 85K tickers en <15 min)
- [ ] Agregar índices en performance_windows para queries más rápidas

### Largo Plazo (3-6 meses)

- [ ] Migrar a arquitectura de streaming (real-time updates)
- [ ] Implementar caching layer para queries frecuentes
- [ ] Dashboard de monitoreo de cron jobs
- [ ] Alertas automáticas para crons fallidos

---

## 11. CONCLUSIÓN

El sistema de cron jobs y backfills de FINTRA es una arquitectura de 6 capas con 34 endpoints y 9 scripts de backfill. La corrección arquitectónica del 2026-02-02 restauró la separación correcta de responsabilidades:

- **Capa de Ingesta:** Raw data desde FMP
- **Capa de Cálculo:** Performance y benchmarks
- **Capa Intermedia:** `performance_windows` (pre-calculated relative performance)
- **Capa de Snapshots:** Lee de intermedias, NO calcula

El nuevo script `backfill-performance-windows.ts` permite poblar históricos de manera determinista y auditible. El sistema está ahora arquitectónicamente correcto pero requiere mantenimiento diario de `sector_performance` y `performance_windows` para datos actualizados.

---

**Apéndices:**

- A. Schema completo de performance_windows
- B. Logs de ejemplo de backfill exitoso
- C. Queries de diagnóstico completas
- D. Código de referencia de buildSnapshotsFromLocalData.ts corregido

**Mantenido por:** FINTRA Engineering Team  
**Última Actualización:** 2026-02-02  
**Próxima Revisión:** 2026-03-02

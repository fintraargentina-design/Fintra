# GUÍA DE EJECUCIÓN: CRON DIARIOS Y BACKFILLS

**Fecha:** 2026-02-02  
**Propósito:** Documentar qué ejecutar diariamente vs qué ejecutar una sola vez para poblar la base de datos

---

## PARTE 1: EJECUCIÓN DIARIA (CRONS)

### Opción A: Master Orchestrator + Complementarios (RECOMENDADO)

**Paso 1: Ejecutar Master Orchestrator**

```bash
curl "https://fintra.com/api/cron/master-all"
```

**Esto ejecuta automáticamente (10 crons en orden):**

1. **sync-universe** - Sincronizar universo de tickers
2. **prices-daily-bulk** - Descargar precios diarios (EOD)
3. **financials-bulk** - Estados financieros y TTM
4. **performance-bulk** - Calcular returns, volatility, drawdown
5. **sector-performance-aggregator** - Agregar performance por sector ⭐ NUEVO
6. **performance-windows-aggregator** - Poblar performance_windows ⭐ NUEVO
7. **fmp-bulk** - Generar snapshots (FGOS, IFS, Valuation)
8. **valuation-bulk** - Métricas de valuación
9. **sector-benchmarks** - Percentiles sectoriales
10. **market-state-bulk** - Cache para UI

**Duración Estimada:** 3-4 horas (45,000 tickers)

---

**Paso 2: Ejecutar Crons Complementarios (NO incluidos en master-all)**

Estos ~12 crons adicionales deben ejecutarse por separado:

```bash
# 11. Industry Performance Aggregation
curl "https://fintra.com/api/cron/industry-performance-aggregator"

# 12. Industry Performance Windows
curl "https://fintra.com/api/cron/industry-performance-windows-aggregator"

# 13. Sector Performance Windows
curl "https://fintra.com/api/cron/sector-performance-windows-aggregator"

# 14. Industry Benchmarks
curl "https://fintra.com/api/cron/industry-benchmarks-aggregator"

# 15. Sector P/E Aggregator
curl "https://fintra.com/api/cron/sector-pe-aggregator"

# 16. Industry P/E Aggregator
curl "https://fintra.com/api/cron/industry-pe-aggregator"

# 17. Company Peers Bulk
curl "https://fintra.com/api/cron/fmp-peers-bulk"

# 18. Dividends Bulk
curl "https://fintra.com/api/cron/dividends-bulk-v2"

# 19. Company Profile Bulk (detallado)
curl "https://fintra.com/api/cron/company-profile-bulk"

# 20. SEC 10-K Ingest (opcional - reportes anuales)
curl "https://fintra.com/api/cron/sec-10k-ingest"

# 21. SEC 8-K Ingest (opcional - eventos materiales)
curl "https://fintra.com/api/cron/sec-8k-ingest"

# 22. Compute Ranks (rankings globales)
curl "https://fintra.com/api/cron/compute-ranks"
```

**Total:** ~22 crons diarios (10 en master-all + 12 complementarios)

**Duración Total Estimada:** 4-5 horas

**Modo Testing (100 tickers):**

```bash
curl "https://fintra.com/api/cron/master-all?limit=100"
```

**Logs:**

- Vercel Function Logs
- Supabase Logs (via Dashboard)

---

### Opción B: Todos los Crons Individuales (SOLO SI MASTER FALLA)

Si master-all falla o necesitas control granular, ejecutar en este orden:

**Grupo 1: Ingesta Base (3 crons)**

```bash
# 1. Universe
curl "https://fintra.com/api/cron/sync-universe"

# 2. Prices
curl "https://fintra.com/api/cron/prices-daily-bulk"

# 3. Financials
curl "https://fintra.com/api/cron/financials-bulk"
```

**Grupo 2: Performance Raw (1 cron)**

```bash
# 4. Performance Calculation
curl "https://fintra.com/api/cron/performance-bulk"
```

**Grupo 3: Performance Aggregators (5 crons - CRÍTICOS)**

```bash
# 5. Sector Performance (NEW - CRÍTICO)
curl "https://fintra.com/api/cron/sector-performance-aggregator"

# 6. Industry Performance
curl "https://fintra.com/api/cron/industry-performance-aggregator"

# 7. Performance Windows (NEW - CRÍTICO)
curl "https://fintra.com/api/cron/performance-windows-aggregator"

# 8. Sector Performance Windows
curl "https://fintra.com/api/cron/sector-performance-windows-aggregator"

# 9. Industry Performance Windows
curl "https://fintra.com/api/cron/industry-performance-windows-aggregator"
```

**Grupo 4: Snapshot Generation (1 cron)**

```bash
# 10. Snapshots (FGOS, IFS, Valuation)
curl "https://fintra.com/api/cron/fmp-bulk"
```

**Grupo 5: Valuation & Benchmarks (6 crons)**

```bash
# 11. Valuation
curl "https://fintra.com/api/cron/valuation-bulk"

# 12. Sector Benchmarks
curl "https://fintra.com/api/cron/sector-benchmarks"

# 13. Industry Benchmarks
curl "https://fintra.com/api/cron/industry-benchmarks-aggregator"

# 14. Sector P/E
curl "https://fintra.com/api/cron/sector-pe-aggregator"

# 15. Industry P/E
curl "https://fintra.com/api/cron/industry-pe-aggregator"

# 16. Market State (UI Cache)
curl "https://fintra.com/api/cron/market-state-bulk"
```

**Grupo 6: Datos Complementarios (4 crons)**

```bash
# 17. Company Peers
curl "https://fintra.com/api/cron/fmp-peers-bulk"

# 18. Dividends
curl "https://fintra.com/api/cron/dividends-bulk-v2"

# 19. Company Profile (detallado)
curl "https://fintra.com/api/cron/company-profile-bulk"

# 20. Compute Rankings
curl "https://fintra.com/api/cron/compute-ranks"
```

**Grupo 7: SEC Filings (2 crons - OPCIONAL)**

```bash
# 21. SEC 10-K (reportes anuales)
curl "https://fintra.com/api/cron/sec-10k-ingest"

# 22. SEC 8-K (eventos materiales)
curl "https://fintra.com/api/cron/sec-8k-ingest"
```

**Total:** 22 crons  
**Duración Total:** ~4-5 horas

**⚠️ IMPORTANTE:**

- Los pasos 5, 6 y 7 (aggregators) son CRÍTICOS y NUEVOS
- El Grupo 3 DEBE ejecutarse ANTES del Grupo 4 (snapshots)
- Sin Grupo 3, `performance_windows` queda vacío y el scatter chart falla

---

### Opción C: Single Ticker Update (DEBUGGING)

Para actualizar UN ticker específico:

```bash
curl "https://fintra.com/api/cron/master-ticker?ticker=AAPL"
```

**Esto ejecuta las MISMAS 10 fases pero filtrado para 1 ticker.**

---

## PARTE 2: EJECUCIÓN INICIAL (BACKFILLS)

Estos scripts se ejecutan **UNA SOLA VEZ** para poblar datos históricos.

### ✅ BACKFILLS EJECUTADOS (2026-02-02)

#### 1. Performance Windows ⭐ CRÍTICO

```bash
npx tsx scripts/backfill/backfill-performance-windows.ts
```

**Estado:** ✅ COMPLETADO  
**Filas Insertadas:** 131,926  
**Tickers:** 21,988  
**Ventanas:** 6 (1M, 3M, 6M, 1Y, 3Y, 5Y)  
**Fecha:** 2026-02-02  
**Duración:** ~5-10 minutos

**Resultado:**

- `performance_windows` poblado correctamente
- Scatter chart ahora mostrará dispersión (no todos en x=0)
- Alpha calculations disponibles

---

### ⏳ BACKFILLS PENDIENTES (SI SE NECESITAN HISTÓRICOS)

#### 2. Sector Performance Historical

```bash
npx tsx scripts/backfill/backfill-sector-performance.ts
```

**Propósito:** Poblar histórico de `sector_performance`  
**Cuándo:** Si necesitas benchmarks sectoriales de fechas pasadas  
**Duración:** ~10-20 minutos

---

#### 3. Industry Performance Historical

```bash
npx tsx scripts/backfill/backfill-industry-performance.ts
```

**Propósito:** Poblar histórico de `industry_performance`  
**Cuándo:** Si necesitas benchmarks a nivel industria (más granular que sector)  
**Duración:** ~15-30 minutos

---

#### 4. Sector P/E Historical

```bash
npx tsx scripts/backfill/backfill-sector-pe.ts
```

**Propósito:** Poblar histórico de P/E ratios por sector  
**Tabla Destino:** `sector_pe`  
**Cuándo:** Si necesitas análisis de valuación histórica por sector  
**Duración:** ~5-10 minutos

---

#### 5. Industry P/E Historical

```bash
npx tsx scripts/backfill/backfill-industry-pe-historical.ts
```

**Propósito:** Poblar histórico de P/E ratios por industria  
**Tabla Destino:** `industry_pe`  
**Duración:** ~10-15 minutos

---

#### 6. Ticker Price History (Single Ticker)

```bash
npx tsx scripts/backfill/backfill-ticker-full.ts --ticker=AAPL
```

**Propósito:** Poblar histórico completo de precios para UN ticker  
**Tabla Destino:** `datos_eod`  
**Cuándo:** Si necesitas precios históricos de un ticker específico (más allá de EOD diario)  
**Duración:** ~1-2 minutos por ticker

---

#### 7. Valuation History

```bash
npx tsx scripts/backfill/backfill-valuation-history.ts
```

**Propósito:** Poblar histórico de métricas de valuación  
**Tabla Destino:** `datos_valuation`  
**Cuándo:** Si necesitas análisis de valuación histórica  
**Duración:** ~15-30 minutos

---

#### 8. Sector Stats

```bash
npx tsx scripts/backfill/backfill-sector-stats.ts
```

**Propósito:** Poblar estadísticas agregadas por sector  
**Duración:** ~5-10 minutos

---

## PARTE 3: VERIFICACIÓN POST-EJECUCIÓN

### Después de Ejecutar Todos los Crons Diarios

Verificar que todas las tablas se poblaron correctamente:

```sql
-- GRUPO 1: INGESTA BASE
-- 1. Universe
SELECT COUNT(*) FROM fintra_universe WHERE is_active = true;
-- Esperado: ~45,000 tickers

-- 2. Prices
SELECT COUNT(*) FROM datos_eod WHERE price_date = CURRENT_DATE;
-- Esperado: ~45,000 filas

-- 3. Financials
SELECT COUNT(*) FROM datos_financieros WHERE updated_at::date = CURRENT_DATE;
-- Esperado: ~45,000+ filas (múltiples períodos por ticker)

-- GRUPO 2: PERFORMANCE RAW
-- 4. Performance Raw
SELECT COUNT(*) FROM datos_performance WHERE performance_date = CURRENT_DATE;
-- Esperado: ~270,000 filas (45K tickers × 6 ventanas)

-- GRUPO 3: PERFORMANCE AGGREGATORS (CRÍTICO)
-- 5. Sector Performance
SELECT COUNT(*) FROM sector_performance WHERE performance_date = CURRENT_DATE;
-- Esperado: ~66 filas (11 sectores × 6 ventanas)

-- 6. Industry Performance
SELECT COUNT(*) FROM industry_performance WHERE performance_date = CURRENT_DATE;
-- Esperado: ~400-600 filas (industrias × ventanas)

-- 7. Performance Windows (CRÍTICO)
SELECT COUNT(*) FROM performance_windows WHERE as_of_date = CURRENT_DATE;
-- Esperado: ~130,000 filas (21K tickers activos × 6 ventanas)

-- 8. Sector Performance Windows
SELECT COUNT(*) FROM sector_performance_windows WHERE as_of_date = CURRENT_DATE;
-- Esperado: ~66 filas

-- 9. Industry Performance Windows
SELECT COUNT(*) FROM industry_performance_windows WHERE as_of_date = CURRENT_DATE;
-- Esperado: ~400-600 filas

-- GRUPO 4: SNAPSHOTS
-- 10. Snapshots
SELECT COUNT(*) FROM fintra_snapshots WHERE snapshot_date = CURRENT_DATE;
-- Esperado: ~45,000 filas

-- GRUPO 5: VALUATION & BENCHMARKS
-- 11. Valuation
SELECT COUNT(*) FROM datos_valuation WHERE valuation_date = CURRENT_DATE;
-- Esperado: ~45,000 filas

-- 12. Sector Benchmarks
SELECT COUNT(*) FROM sector_benchmarks WHERE snapshot_date = CURRENT_DATE;
-- Esperado: ~110 filas (11 sectores × ~10 métricas)

-- 13. Industry Benchmarks
SELECT COUNT(*) FROM industry_benchmarks WHERE snapshot_date = CURRENT_DATE;
-- Esperado: ~500-1000 filas (industrias × métricas)

-- 14. Sector P/E
SELECT COUNT(*) FROM sector_pe WHERE snapshot_date = CURRENT_DATE;
-- Esperado: ~11 filas (1 por sector)

-- 15. Industry P/E
SELECT COUNT(*) FROM industry_pe WHERE snapshot_date = CURRENT_DATE;
-- Esperado: ~50-100 filas (1 por industria)

-- 16. Market State
SELECT COUNT(*) FROM fintra_market_state WHERE updated_at::date = CURRENT_DATE;
-- Esperado: ~45,000 filas

-- GRUPO 6: DATOS COMPLEMENTARIOS
-- 17. Company Peers
SELECT COUNT(DISTINCT ticker) FROM company_peers WHERE updated_at::date = CURRENT_DATE;
-- Esperado: ~45,000 tickers

-- 18. Dividends
SELECT COUNT(*) FROM datos_dividendos WHERE updated_at::date = CURRENT_DATE;
-- Esperado: Variable (depende de cuántos pagaron dividendos recientemente)

-- 19. Company Profile (detallado)
SELECT COUNT(*) FROM company_profile WHERE updated_at::date = CURRENT_DATE;
-- Esperado: ~45,000 filas

-- 20. Rankings
SELECT COUNT(*) FROM global_ranks WHERE updated_at::date = CURRENT_DATE;
-- Esperado: ~200-500 filas (Top/Bottom rankings)

-- GRUPO 7: SEC FILINGS (OPCIONAL)
-- 21-22. SEC Filings
SELECT COUNT(*) FROM sec_filings WHERE filing_date = CURRENT_DATE;
-- Esperado: Variable (depende de cuántas empresas reportaron)
```

**Resumen de Verificación:**

```sql
-- Vista consolidada de todas las tablas actualizadas hoy
SELECT
  'fintra_universe' as tabla, COUNT(*) as filas FROM fintra_universe WHERE is_active = true
UNION ALL
SELECT 'datos_eod', COUNT(*) FROM datos_eod WHERE price_date = CURRENT_DATE
UNION ALL
SELECT 'datos_performance', COUNT(*) FROM datos_performance WHERE performance_date = CURRENT_DATE
UNION ALL
SELECT 'sector_performance', COUNT(*) FROM sector_performance WHERE performance_date = CURRENT_DATE
UNION ALL
SELECT 'performance_windows ⭐', COUNT(*) FROM performance_windows WHERE as_of_date = CURRENT_DATE
UNION ALL
SELECT 'fintra_snapshots', COUNT(*) FROM fintra_snapshots WHERE snapshot_date = CURRENT_DATE
UNION ALL
SELECT 'sector_benchmarks', COUNT(*) FROM sector_benchmarks WHERE snapshot_date = CURRENT_DATE
UNION ALL
SELECT 'fintra_market_state', COUNT(*) FROM fintra_market_state WHERE updated_at::date = CURRENT_DATE
ORDER BY tabla;
```

---

### Verificar Scatter Chart Funciona

Después de ejecutar master-all, verificar que `relative_vs_sector_1y` tiene datos:

```sql
SELECT
  ticker,
  relative_vs_sector_1y,
  fgos_score,
  sector
FROM fintra_snapshots
WHERE snapshot_date = '2026-02-02'
  AND relative_vs_sector_1y IS NOT NULL
ORDER BY relative_vs_sector_1y DESC
LIMIT 10;
```

**Esperado:** Debe retornar filas con valores dispersos (no todos 0 o null)

---

## PARTE 4: SOLUCIÓN DE PROBLEMAS

### Problema 1: performance_windows Vacío

**Síntoma:** Scatter chart muestra todos puntos en x=0

**Causa:** `performance-windows-aggregator` no se ejecutó

**Solución:**

```bash
# Opción A: Ejecutar cron manualmente
curl "https://fintra.com/api/cron/performance-windows-aggregator"

# Opción B: Ejecutar backfill
npx tsx scripts/backfill/backfill-performance-windows.ts
```

---

### Problema 2: sector_performance Vacío

**Síntoma:** `performance-windows-aggregator` falla con "No sector_performance data found"

**Causa:** `sector-performance-aggregator` no se ejecutó

**Solución:**

```bash
curl "https://fintra.com/api/cron/sector-performance-aggregator"
```

---

### Problema 3: master-all Timeout (Vercel 5min limit)

**Síntoma:** master-all retorna 500 después de 5 minutos

**Causa:** Vercel hobby plan limita a 5 minutos

**Solución:**

1. **Upgrade a Vercel Pro** (300 min limit)
2. **Usar crons individuales** (ejecutar de a uno)
3. **Usar limit param para testing:** `?limit=1000`

---

### Problema 4: Datos Incompletos en Snapshots

**Síntoma:** Snapshots con muchos campos null

**Causa:** Crons previos no completaron correctamente

**Verificar orden:**

```bash
# Estos DEBEN ejecutarse ANTES de fmp-bulk:
✓ sync-universe
✓ prices-daily-bulk
✓ financials-bulk
✓ performance-bulk
✓ sector-performance-aggregator
✓ performance-windows-aggregator

# LUEGO ejecutar fmp-bulk
✓ fmp-bulk
```

---

## PARTE 5: CALENDARIO DE EJECUCIÓN RECOMENDADO

### Diario (Automatizado) - 22 CRONS TOTALES

**Hora:** 02:00 AM UTC (después del cierre de mercados globales)

**Vercel Cron Configuration (Recomendado):**

```json
{
  "crons": [
    {
      "path": "/api/cron/master-all",
      "schedule": "0 2 * * *",
      "comment": "Orquestador principal - 10 crons"
    },
    {
      "path": "/api/cron/industry-performance-aggregator",
      "schedule": "0 5 * * *",
      "comment": "Agregación a nivel industria"
    },
    {
      "path": "/api/cron/industry-performance-windows-aggregator",
      "schedule": "15 5 * * *"
    },
    {
      "path": "/api/cron/sector-performance-windows-aggregator",
      "schedule": "30 5 * * *"
    },
    {
      "path": "/api/cron/industry-benchmarks-aggregator",
      "schedule": "45 5 * * *"
    },
    {
      "path": "/api/cron/sector-pe-aggregator",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/industry-pe-aggregator",
      "schedule": "15 6 * * *"
    },
    {
      "path": "/api/cron/fmp-peers-bulk",
      "schedule": "30 6 * * *",
      "comment": "Datos complementarios"
    },
    {
      "path": "/api/cron/dividends-bulk-v2",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/company-profile-bulk",
      "schedule": "30 7 * * *"
    },
    {
      "path": "/api/cron/compute-ranks",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/sec-10k-ingest",
      "schedule": "0 9 * * 1",
      "comment": "SEC Filings - solo lunes"
    },
    {
      "path": "/api/cron/sec-8k-ingest",
      "schedule": "30 9 * * 1"
    }
  ]
}
```

**Timing Escalonado:**

- **02:00 AM:** master-all inicia (10 crons, ~3-4 horas)
- **05:00 AM:** Agregadores de industria (6 crons, ~1 hora)
- **06:30 AM:** Datos complementarios (4 crons, ~1 hora)
- **09:00 AM:** SEC filings (2 crons, solo lunes)

**Total:** 22 crons diarios (20 diarios + 2 semanales)

---

### Semanal (Opcional)

**Domingo 03:00 AM UTC:**

- Ejecutar backfills de validación
- Verificar integridad de datos
- Regenerar benchmarks históricos si hay correcciones

---

### Mensual (Opcional)

**Primer domingo del mes:**

- Ejecutar backfills completos de históricos
- Actualizar industria classifications
- Verificar outliers en valuations

---

## PARTE 6: LOGS Y MONITORING

### Logs Críticos a Monitorear

En cada ejecución de master-all, verificar estos logs:

```
✅ [MasterCronAll] 1. Sync Universe complete
✅ [MasterCronAll] 2. Prices Daily complete
✅ [MasterCronAll] 3. Financials Bulk complete
✅ [MasterCronAll] 4. Performance Bulk complete
✅ [MasterCronAll] 5. Sector Performance Aggregator complete  ← NUEVO
✅ [MasterCronAll] 5.5. Performance Windows Aggregator complete  ← NUEVO
✅ [MasterCronAll] 6. FMP Bulk (Snapshots) complete
✅ [MasterCronAll] 7. Valuation Bulk complete
✅ [MasterCronAll] 8. Sector Benchmarks complete
✅ [MasterCronAll] 9. Market State Bulk complete
```

**Si falta algún paso:** Investigar logs de Vercel/Supabase

---

### Métricas Clave

Monitorear estas métricas diarias (22 crons totales):

| Métrica                       | Valor Esperado | Alerta Si |
| ----------------------------- | -------------- | --------- |
| Tickers Activos (universe)    | ~45,000        | < 40,000  |
| Snapshots Generados           | ~45,000        | < 40,000  |
| Performance Windows (todas)   | ~270,000       | < 200,000 |
| Sector Performance            | ~45,000        | < 40,000  |
| Industry Performance          | ~45,000        | < 40,000  |
| Sector Benchmarks             | ~20            | < 10      |
| Industry Benchmarks           | ~150           | < 100     |
| Company Peers                 | ~45,000        | < 40,000  |
| Dividends Records             | ~10,000        | < 5,000   |
| Global Ranks                  | ~45,000        | < 40,000  |
| Duration (todos los crons)    | 5-6 horas      | > 8 horas |
| Snapshots con FGOS            | > 80%          | < 70%     |
| Snapshots con relative_return | > 90%          | < 80%     |

---

## PARTE 7: RESUMEN EJECUTIVO

### ✅ EJECUTAR DIARIAMENTE (22 CRONS TOTALES)

**Opción A: Automatizado con Vercel Crons** (Recomendado)

Configurar 13 crons en vercel.json (ver Parte 5)

---

**Opción B: Manual (Solo para testing)**

```bash
# PASO 1: Master Orchestrator (10 crons automáticos)
curl "https://fintra.com/api/cron/master-all"
# Esperar ~3-4 horas

# PASO 2: Agregadores de Industria (6 crons)
curl "https://fintra.com/api/cron/industry-performance-aggregator"
curl "https://fintra.com/api/cron/industry-performance-windows-aggregator"
curl "https://fintra.com/api/cron/sector-performance-windows-aggregator"
curl "https://fintra.com/api/cron/industry-benchmarks-aggregator"
curl "https://fintra.com/api/cron/sector-pe-aggregator"
curl "https://fintra.com/api/cron/industry-pe-aggregator"

# PASO 3: Datos Complementarios (4 crons)
curl "https://fintra.com/api/cron/fmp-peers-bulk"
curl "https://fintra.com/api/cron/dividends-bulk-v2"
curl "https://fintra.com/api/cron/company-profile-bulk"
curl "https://fintra.com/api/cron/compute-ranks"

# PASO 4: SEC Filings (2 crons - Opcional, solo lunes)
curl "https://fintra.com/api/cron/sec-10k-ingest"
curl "https://fintra.com/api/cron/sec-8k-ingest"
```

---

**Desglose del Master-All (10 crons):**

1. sync-universe
2. prices-daily-bulk
3. financials-bulk
4. performance-bulk
5. sector-performance-aggregator ⭐ NUEVO
6. performance-windows-aggregator ⭐ NUEVO
7. fmp-bulk (snapshots)
8. valuation-bulk
9. sector-benchmarks
10. market-state-bulk

**Duración Total:** 5-6 horas para los 22 crons completos

---

### ✅ EJECUTADO UNA VEZ (BACKFILLS)

- [x] **backfill-performance-windows.ts** (2026-02-02) - 131,926 filas
- [ ] backfill-sector-performance.ts (opcional - históricos)
- [ ] backfill-industry-performance.ts (opcional - históricos)
- [ ] backfill-sector-pe.ts (opcional - históricos)
- [ ] backfill-industry-pe-historical.ts (opcional - históricos)
- [ ] backfill-ticker-full.ts (caso por caso)
- [ ] backfill-valuation-history.ts (opcional - históricos)

---

### ⚠️ CRÍTICO: CAMBIOS RECIENTES

**Fecha:** 2026-02-02

**Modificación:** Agregados 2 crons a master-all:

1. `sector-performance-aggregator` (paso 5)
2. `performance-windows-aggregator` (paso 5.5)

**Impacto:**

- ✅ `performance_windows` ahora se popula automáticamente
- ✅ Scatter chart funcionará correctamente
- ✅ Relative performance data disponible

**Verificar:** Después de la próxima ejecución de master-all, confirmar que `performance_windows` tiene filas para la fecha actual.

---

**Mantenido por:** Fintra Engineering Team  
**Última Actualización:** 2026-02-02  
**Próxima Revisión:** Después de primera ejecución exitosa de master-all con nuevos agregadores

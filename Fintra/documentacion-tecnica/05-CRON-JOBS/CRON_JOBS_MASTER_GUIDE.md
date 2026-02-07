# 🔄 FINTRA CRON JOBS - GUÍA MAESTRA

**Última actualización:** 7 de febrero de 2026  
**Propósito:** Documentación completa de la ejecución de cron jobs en Fintra  
**Consolidado de:** CRON_EXECUTION_ORDER.md, CRON_EXECUTION_ORDER_CORRECTED.md, EJECUCION_CRON_BACKFILL.md

---

## 📋 ÍNDICE

1. [Introducción](#introducción)
2. [Arquitectura y Dependencias](#arquitectura-y-dependencias)
3. [Orden de Ejecución Completo](#orden-de-ejecución-completo)
4. [Ejecución Diaria](#ejecución-diaria)
5. [Backfills (Una vez)](#backfills-una-vez)
6. [Scripts y Automatización](#scripts-y-automatización)
7. [Monitoreo y Verificación](#monitoreo-y-verificación)
8. [Troubleshooting](#troubleshooting)

---

## 📖 INTRODUCCIÓN

### ¿Qué son los Cron Jobs?

Los cron jobs de Fintra son procesos programados que:

- **Ingestan datos** desde FMP API (precios, estados financieros, perfiles)
- **Calculan métricas** (performance, benchmarks, agregadores)
- **Generan snapshots** (fintra_snapshots con FGOS, IFS, Valuation)
- **Actualizan rankings** (posiciones competitivas, P/E sectorial)

### Frecuencia de Ejecución

| Tipo                    | Frecuencia          | Duración  | Criticidad     |
| ----------------------- | ------------------- | --------- | -------------- |
| **Master Orchestrator** | Diaria (automática) | 3-4 horas | ⭐⭐⭐ CRÍTICO |
| **Complementarios**     | Diaria (separados)  | 1-2 horas | ⭐⭐ Alta      |
| **Backfills**           | Una vez (inicial)   | Variable  | ⭐ Media       |

**Total diario:** ~22 crons, 5-6 horas de procesamiento

---

## 🏗️ ARQUITECTURA Y DEPENDENCIAS

### Modelo de Capas (5 niveles)

```
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 1: INGESTA BASE (Raw Data)                           │
│ • FMP Bulk (profiles, financials, performance, valuation)  │
│ • Dividends Bulk                                            │
│ • Company Profile Bulk                                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 2: CLASIFICACIÓN Y AGREGACIÓN                        │
│ • Industry Classification Sync                             │
│ • Sector Benchmarks                                         │
│ • TTM Valuation Cron                                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 3: PERFORMANCE Y RANKINGS                            │
│ • Industry Performance Aggregator                          │
│ • Industry Performance Windows                             │
│ • Industry Benchmarks Aggregator                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 4: SNAPSHOTS Y SCORES (CORE)                         │
│ • FMP Peers Bulk                                            │
│ • Bulk Update (CRÍTICO - genera fintra_snapshots)          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 5: RANKINGS Y CACHE                                  │
│ • Compute Ranks                                             │
│ • Market State Bulk (cache UI)                             │
└─────────────────────────────────────────────────────────────┘
```

### Dependencias Críticas

**REGLA DE ORO:** Un job NO puede ejecutarse hasta que sus dependencias estén completas.

| Job                              | Depende de                                                              | Tabla Output            |
| -------------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| **industry-classification-sync** | company_profiles                                                        | industry_classification |
| **sector-benchmarks**            | datos_financieros                                                       | sector_benchmarks       |
| **ttm-valuation-cron**           | datos_financieros + prices_daily                                        | datos_valuacion_ttm     |
| **industry-performance**         | datos_performance + asset_industry_map                                  | industry_performance    |
| **bulk-update (snapshots)**      | ✅ datos_financieros<br>✅ sector_benchmarks<br>✅ industry_performance | **fintra_snapshots**    |
| **compute-ranks**                | fintra_snapshots                                                        | market_state            |

---

## 📊 ORDEN DE EJECUCIÓN COMPLETO

### Secuencia Validada (17 Jobs)

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 1: UNIVERSO Y CLASIFICACIÓN (Fundamentos)             │
└─────────────────────────────────────────────────────────────┘
```

#### 1. **Sync Universe** ⭐ PRIMERO

```bash
curl http://localhost:3000/api/cron/sync-universe
```

**Output:** Lista de tickers activos a procesar  
**Duración:** ~2-5 min  
**Por qué primero:** Define qué empresas procesar

---

#### 2. **Industry Classification Sync**

```bash
curl http://localhost:3000/api/cron/industry-classification-sync
```

**Depende de:** Sync Universe  
**Output:**

- `industry_classification`
- `asset_industry_map`
  **Duración:** ~5-10 min

---

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 2: DATOS RAW (FMP API)                                │
└─────────────────────────────────────────────────────────────┘
```

#### 3. **Prices Daily Bulk**

```bash
curl http://localhost:3000/api/cron/prices-daily-bulk
```

**Output:** Precios actualizados (tabla de precios)  
**Duración:** ~10-15 min  
**Importante para:** Performance metrics

---

#### 4. **Financials Bulk**

```bash
curl http://localhost:3000/api/cron/financials-bulk
```

**Output:** `datos_financieros` (ratios, métricas financieras)  
**Duración:** ~20-30 min  
**Crítico:** Base para FGOS

---

#### 5. **Company Profile Bulk**

```bash
curl http://localhost:3000/api/cron/company-profile-bulk
```

**Output:** `company_profiles` (metadata de empresas)  
**Duración:** ~10-15 min

---

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 3: AGREGADORES DE PERFORMANCE                         │
└─────────────────────────────────────────────────────────────┘
```

#### 6. **Industry Performance Aggregator (1D)**

```bash
curl http://localhost:3000/api/cron/industry-performance-aggregator
```

**Depende de:**

- Prices Daily Bulk
- Industry Classification

**Output:** `industry_performance` (1 día)  
**Duración:** ~10-20 min

---

#### 7. **Sector Performance Aggregator (1D)**

```bash
curl http://localhost:3000/api/cron/sector-performance-aggregator
```

**Depende de:**

- Prices Daily Bulk
- Industry Classification

**Output:** `sector_performance` (1 día)  
**Duración:** ~5-10 min

---

#### 8. **Sector Performance Windows**

```bash
curl http://localhost:3000/api/cron/sector-performance-windows-aggregator
```

**Depende de:** Sector Performance Aggregator  
**Output:** Windows (1M, 3M, 6M, 1Y, 3Y, 5Y)  
**Duración:** ~5-10 min

---

#### 9. **Industry Performance Windows**

```bash
curl http://localhost:3000/api/cron/industry-performance-windows-aggregator
```

**Depende de:** Industry Performance Aggregator  
**Output:** Windows por industria  
**Duración:** ~10-15 min

---

#### 10. **Sector P/E Aggregator**

```bash
curl http://localhost:3000/api/cron/sector-pe-aggregator
```

**Depende de:** datos_financieros  
**Output:** `sector_pe`  
**Duración:** ~5-10 min

---

#### 11. **Industry P/E Aggregator**

```bash
curl http://localhost:3000/api/cron/industry-pe-aggregator
```

**Depende de:** datos_financieros  
**Output:** `industry_pe`  
**Duración:** ~5-10 min

---

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 4: BENCHMARKS (Crítico para FGOS)                     │
└─────────────────────────────────────────────────────────────┘
```

#### 12. **Sector Benchmarks** ⭐⭐ CRÍTICO

```bash
curl http://localhost:3000/api/cron/sector-benchmarks
# O alternativamente:
curl http://localhost:3000/api/cron/master-benchmark
```

**Depende de:** datos_financieros  
**Output:**

- `sector_benchmarks` (percentiles p10, p25, p50, p75, p90)
- `sector_stats`
- `industry_stats`

**Duración:** ~10-15 min  
**Por qué crítico:** Sin esto, FGOS no puede calcular percentiles

---

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 5: MÉTRICAS INDIVIDUALES                              │
└─────────────────────────────────────────────────────────────┘
```

#### 13. **Performance Bulk**

```bash
curl http://localhost:3000/api/cron/performance-bulk
```

**Depende de:** Prices Daily Bulk  
**Output:** Performance metrics por ticker  
**Duración:** ~15-20 min

---

#### 14. **Market State Bulk**

```bash
curl http://localhost:3000/api/cron/market-state-bulk
```

**Output:** Cache para UI (estado de mercado)  
**Duración:** ~5-10 min

---

#### 15. **Dividends Bulk V2**

```bash
curl http://localhost:3000/api/cron/dividends-bulk-v2
```

**Output:** Tabla de dividendos  
**Duración:** ~10-15 min

---

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 6: SNAPSHOTS FINALES (CORE - FGOS)                    │
└─────────────────────────────────────────────────────────────┘
```

#### 16. **FMP Bulk Snapshots (buildSnapshots)** ⭐⭐⭐ CRÍTICO

```bash
curl http://localhost:3000/api/cron/fmp-bulk
# O alternativamente:
curl http://localhost:3000/api/cron/bulk-update
```

**Depende de TODO lo anterior:**

- ✅ Financials Bulk
- ✅ Sector Benchmarks
- ✅ Performance metrics
- ✅ Industry classification

**Output:**

- `fintra_snapshots` ← **TABLA PRINCIPAL**
  - fgos_score
  - fgos_components (growth, profitability, efficiency, solvency)
  - valuation_score
  - ifs_score
  - moat_score
  - sentiment_score
  - etc.

**Duración:** ~60-120 min (el más largo)

---

#### 17. **Healthcheck Snapshots**

```bash
curl http://localhost:3000/api/cron/healthcheck-fmp-bulk
```

**Output:** Validación de integridad de snapshots  
**Duración:** ~2-5 min

---

### Tiempos Estimados por Fase

| Fase      | Jobs        | Tiempo         | Criticidad |
| --------- | ----------- | -------------- | ---------- |
| Fase 1    | 1-2         | 15-20 min      | ⭐⭐⭐     |
| Fase 2    | 3-5         | 40-60 min      | ⭐⭐⭐     |
| Fase 3    | 6-11        | 50-70 min      | ⭐⭐       |
| Fase 4    | 12          | 10-15 min      | ⭐⭐⭐     |
| Fase 5    | 13-15       | 30-40 min      | ⭐⭐       |
| Fase 6    | 16-17       | 65-125 min     | ⭐⭐⭐     |
| **TOTAL** | **17 jobs** | **~3-5 horas** |            |

---

## 🚀 EJECUCIÓN DIARIA

### Opción A: Master Orchestrator (RECOMENDADO)

El **master-all** ejecuta automáticamente 10 crons en orden:

```bash
curl "http://localhost:3000/api/cron/master-all"
```

**Jobs incluidos (secuencia interna):**

1. sync-universe
2. prices-daily-bulk
3. financials-bulk
4. performance-bulk
5. sector-performance-aggregator ⭐ NUEVO (2026-02-02)
6. performance-windows-aggregator ⭐ NUEVO (2026-02-02)
7. fmp-bulk (snapshots)
8. valuation-bulk
9. sector-benchmarks
10. market-state-bulk

**Duración:** 3-4 horas (45,000 tickers)

**Modo testing (100 tickers):**

```bash
curl "http://localhost:3000/api/cron/master-all?limit=100"
```

---

### Paso 2: Crons Complementarios (NO incluidos en master-all)

Estos ~12 crons adicionales deben ejecutarse por separado:

```bash
# 11. Industry Performance Aggregation
curl "http://localhost:3000/api/cron/industry-performance-aggregator"

# 12. Industry Performance Windows
curl "http://localhost:3000/api/cron/industry-performance-windows-aggregator"

# 13. Sector Performance Windows
curl "http://localhost:3000/api/cron/sector-performance-windows-aggregator"

# 14. Industry Benchmarks
curl "http://localhost:3000/api/cron/industry-benchmarks-aggregator"

# 15. Sector P/E Aggregator
curl "http://localhost:3000/api/cron/sector-pe-aggregator"

# 16. Industry P/E Aggregator
curl "http://localhost:3000/api/cron/industry-pe-aggregator"

# 17. Company Peers Bulk
curl "http://localhost:3000/api/cron/fmp-peers-bulk"

# 18. Dividends Bulk
curl "http://localhost:3000/api/cron/dividends-bulk-v2"

# 19. Company Profile Bulk (detallado)
curl "http://localhost:3000/api/cron/company-profile-bulk"

# 20. Compute Ranks (rankings globales)
curl "http://localhost:3000/api/cron/compute-ranks"

# 21-22. SEC Filings (OPCIONAL - solo lunes)
curl "http://localhost:3000/api/cron/sec-10k-ingest"
curl "http://localhost:3000/api/cron/sec-8k-ingest"
```

**Total:** ~22 crons diarios (10 en master-all + 12 complementarios)  
**Duración Total:** 4-5 horas

---

### Opción B: Single Ticker Update (DEBUGGING)

Para actualizar UN ticker específico:

```bash
curl "http://localhost:3000/api/cron/master-ticker?ticker=AAPL"
```

Ejecuta las mismas fases pero filtrado para 1 ticker.

---

### Logs Críticos a Monitorear

En cada ejecución de master-all, verificar estos logs:

```
✅ [MasterCronAll] 1. Sync Universe complete
✅ [MasterCronAll] 2. Prices Daily complete
✅ [MasterCronAll] 3. Financials Bulk complete
✅ [MasterCronAll] 4. Performance Bulk complete
✅ [MasterCronAll] 5. Sector Performance Aggregator complete ← NUEVO (2026-02-02)
✅ [MasterCronAll] 5.5. Performance Windows Aggregator complete ← NUEVO (2026-02-02)
✅ [MasterCronAll] 6. FMP Bulk (Snapshots) complete
✅ [MasterCronAll] 7. Valuation Bulk complete
✅ [MasterCronAll] 8. Sector Benchmarks complete
✅ [MasterCronAll] 9. Market State Bulk complete
```

---

## 🔨 BACKFILLS (UNA VEZ)

Los backfills se ejecutan **UNA SOLA VEZ** para poblar datos históricos.

### ✅ Backfills Ejecutados

#### 1. Performance Windows ⭐ CRÍTICO

```bash
npx tsx scripts/backfill/backfill-performance-windows.ts
```

**Estado:** ✅ COMPLETADO (2026-02-02)  
**Filas Insertadas:** 131,926  
**Tickers:** 21,988  
**Ventanas:** 6 (1M, 3M, 6M, 1Y, 3Y, 5Y)  
**Duración:** ~5-10 minutos

**Resultado:**

- `performance_windows` poblado correctamente
- Scatter chart ahora mostrará dispersión (no todos en x=0)
- Alpha calculations disponibles

---

### ⏳ Backfills Pendientes (OPCIONALES)

Ejecutar solo si se necesitan datos históricos:

#### 2. Sector Performance Historical

```bash
npx tsx scripts/backfill/backfill-sector-performance.ts
```

**Propósito:** Poblar histórico de `sector_performance`  
**Duración:** ~10-20 minutos

---

#### 3. Industry Performance Historical

```bash
npx tsx scripts/backfill/backfill-industry-performance.ts
```

**Propósito:** Poblar histórico de `industry_performance`  
**Duración:** ~15-30 minutos

---

#### 4. Sector P/E Historical

```bash
npx tsx scripts/backfill/backfill-sector-pe.ts
```

**Tabla Destino:** `sector_pe`  
**Duración:** ~5-10 minutos

---

#### 5. Industry P/E Historical

```bash
npx tsx scripts/backfill/backfill-industry-pe-historical.ts
```

**Tabla Destino:** `industry_pe`  
**Duración:** ~10-15 minutos

---

#### 6. TTM Valuation Historical

```bash
npx tsx scripts/backfill/backfill-ttm-valuation.ts
```

**Propósito:** Poblar histórico TTM con `computeTTMv2`  
**Tabla Destino:** `datos_valuacion_ttm`  
**Duración:** ~30-60 minutos

---

#### 7. Ticker Price History (Single Ticker)

```bash
npx tsx scripts/backfill/backfill-ticker-full.ts --ticker=AAPL
```

**Tabla Destino:** `datos_eod`  
**Duración:** ~1-2 minutos por ticker

---

## 🛠️ SCRIPTS Y AUTOMATIZACIÓN

### Linux/Mac (Bash Script)

Crea `run-daily-update.sh`:

```bash
#!/bin/bash
# run-daily-update.sh

BASE_URL="http://localhost:3000"
LOG_FILE="logs/cron-$(date +%Y%m%d-%H%M%S).log"

echo "🚀 FINTRA - Actualización Diaria" | tee -a $LOG_FILE
echo "Fecha: $(date)" | tee -a $LOG_FILE

# Función para ejecutar con logging
run_job() {
  local name=$1
  local endpoint=$2
  local max_duration=${3:-600}

  echo "⏳ Ejecutando: $name" | tee -a $LOG_FILE
  START=$(date +%s)

  timeout $max_duration curl -s "$BASE_URL$endpoint" > /tmp/response.json
  EXIT_CODE=$?

  END=$(date +%s)
  DURATION=$((END - START))

  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ $name completado en ${DURATION}s" | tee -a $LOG_FILE
  else
    echo "❌ $name falló (exit code: $EXIT_CODE)" | tee -a $LOG_FILE
    return 1
  fi
}

# FASE 1: Universo
run_job "Sync Universe" "/api/cron/sync-universe" 600
run_job "Industry Classification" "/api/cron/industry-classification-sync" 900

# FASE 2: Datos Raw
run_job "Prices Daily" "/api/cron/prices-daily-bulk" 1200
run_job "Financials Bulk" "/api/cron/financials-bulk" 1800
run_job "Company Profile" "/api/cron/company-profile-bulk" 900

# FASE 3: Performance
run_job "Industry Performance Aggregator" "/api/cron/industry-performance-aggregator" 1200
run_job "Sector Performance Aggregator" "/api/cron/sector-performance-aggregator" 900
run_job "Sector Perf Windows" "/api/cron/sector-performance-windows-aggregator" 1200
run_job "Industry Perf Windows" "/api/cron/industry-performance-windows-aggregator" 1200

# FASE 4: Benchmarks
run_job "Sector Benchmarks" "/api/cron/sector-benchmarks" 900

# FASE 5: Métricas
run_job "Performance Bulk" "/api/cron/performance-bulk" 1200
run_job "Market State" "/api/cron/market-state-bulk" 600
run_job "Dividends V2" "/api/cron/dividends-bulk-v2" 900

# FASE 6: Snapshots (CRÍTICO)
run_job "FMP Bulk Snapshots" "/api/cron/fmp-bulk" 7200

# FASE 7: Validación
run_job "Healthcheck" "/api/cron/healthcheck-fmp-bulk" 300

echo "✅ Actualización completada" | tee -a $LOG_FILE
```

**Hacer ejecutable:**

```bash
chmod +x run-daily-update.sh
```

---

### Windows (PowerShell Script)

Ver documentación en: [RUN-CRONS-README.md](./RUN-CRONS-README.md)

Scripts disponibles:

- `run-all-crons-direct.ps1` - Modo directo (19 jobs, sin servidor HTTP)
- `run-all-crons.ps1` - Modo HTTP (requiere servidor en localhost:3000)

---

### Programación Automática

#### Linux/Mac (crontab)

```bash
# Editar crontab
crontab -e

# Agregar línea (ejecutar diariamente a las 2 AM)
0 2 * * * cd /path/to/fintra && bash run-daily-update.sh
```

#### Windows (Task Scheduler)

```powershell
# Crear tarea programada
schtasks /create /tn "Fintra Daily Update" /tr "D:\FintraDeploy\Fintra\run-all-crons-direct.ps1" /sc daily /st 02:00
```

---

## 📊 MONITOREO Y VERIFICACIÓN

### Verificación Post-Ejecución

Después de ejecutar todos los crons diarios, verificar que las tablas se poblaron:

```sql
-- GRUPO 1: INGESTA BASE
SELECT COUNT(*) FROM fintra_universe WHERE is_active = true;
-- Esperado: ~45,000 tickers

SELECT COUNT(*) FROM datos_eod WHERE price_date = CURRENT_DATE;
-- Esperado: ~45,000 filas

SELECT COUNT(*) FROM datos_financieros WHERE updated_at::date = CURRENT_DATE;
-- Esperado: ~45,000+ filas

-- GRUPO 2: PERFORMANCE
SELECT COUNT(*) FROM datos_performance WHERE performance_date = CURRENT_DATE;
-- Esperado: ~270,000 filas (45K tickers × 6 ventanas)

SELECT COUNT(*) FROM performance_windows WHERE as_of_date = CURRENT_DATE;
-- Esperado: ~130,000 filas

-- GRUPO 3: AGREGADORES
SELECT COUNT(*) FROM sector_performance WHERE performance_date = CURRENT_DATE;
-- Esperado: ~66 filas (11 sectores × 6 ventanas)

SELECT COUNT(*) FROM industry_performance WHERE performance_date = CURRENT_DATE;
-- Esperado: ~400-600 filas

-- GRUPO 4: SNAPSHOTS (CRÍTICO)
SELECT COUNT(*) FROM fintra_snapshots WHERE snapshot_date = CURRENT_DATE;
-- Esperado: ~45,000 filas

-- GRUPO 5: BENCHMARKS
SELECT COUNT(*) FROM sector_benchmarks WHERE snapshot_date = CURRENT_DATE;
-- Esperado: ~110 filas (11 sectores × ~10 métricas)

SELECT COUNT(*) FROM industry_benchmarks WHERE snapshot_date = CURRENT_DATE;
-- Esperado: ~500-1000 filas

-- Verificar FGOS calculado
SELECT COUNT(*) FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND fgos_status = 'computed';
-- Esperado: > 80% de snapshots con FGOS computed

-- Verificar relative return
SELECT COUNT(*) FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND relative_return IS NOT NULL;
-- Esperado: > 90% de snapshots con relative_return
```

---

### Métricas Clave de Monitoreo

| Métrica                       | Valor Esperado | Alerta Si |
| ----------------------------- | -------------- | --------- |
| Tickers Activos (universe)    | ~45,000        | < 40,000  |
| Snapshots Generados           | ~45,000        | < 40,000  |
| Performance Windows (todas)   | ~270,000       | < 200,000 |
| Sector Performance            | ~45,000        | < 40,000  |
| Industry Performance          | ~45,000        | < 40,000  |
| Sector Benchmarks             | ~20            | < 10      |
| Industry Benchmarks           | ~150           | < 100     |
| Duration (todos los crons)    | 5-6 horas      | > 8 horas |
| Snapshots con FGOS            | > 80%          | < 70%     |
| Snapshots con relative_return | > 90%          | < 80%     |

---

### Dashboard de Salud

Queries útiles para dashboard:

```sql
-- Última ejecución exitosa
SELECT MAX(snapshot_date) as last_snapshot
FROM fintra_snapshots;

-- Cobertura FGOS
SELECT
  fgos_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
GROUP BY fgos_status;

-- Top sectores por snapshots generados
SELECT
  sector,
  COUNT(*) as snapshots_count
FROM fintra_snapshots fs
JOIN company_profiles cp ON fs.ticker = cp.ticker
WHERE fs.snapshot_date = CURRENT_DATE
GROUP BY sector
ORDER BY snapshots_count DESC;

-- Tickers sin FGOS (investigar)
SELECT ticker, fgos_status, profile_structural
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND fgos_status = 'pending'
LIMIT 20;
```

---

## 🐛 TROUBLESHOOTING

### Problema: master-all timeout

**Síntoma:** master-all no completa en tiempo esperado

**Soluciones:**

1. Ejecutar crons individuales en orden
2. Verificar FMP API rate limits
3. Revisar logs de Vercel/Supabase

---

### Problema: Snapshots con FGOS pending

**Síntoma:** > 30% de snapshots con `fgos_status: 'pending'`

**Causas comunes:**

- Sector benchmarks no calculados (job 12 falló)
- datos_financieros incompletos (job 4 falló)
- Sector no clasificado (job 2 falló)

**Solución:**

```bash
# Re-ejecutar benchmarks
curl http://localhost:3000/api/cron/sector-benchmarks

# Re-ejecutar snapshots
curl http://localhost:3000/api/cron/fmp-bulk
```

---

### Problema: Performance windows vacías

**Síntoma:** `performance_windows` sin filas para fecha actual

**Causa:** performance-windows-aggregator no ejecutado (NO incluido en master-all pre-2026-02-02)

**Solución:**

```bash
# Ejecutar manualmente
curl http://localhost:3000/api/cron/performance-windows-aggregator

# O ejecutar backfill
npx tsx scripts/backfill/backfill-performance-windows.ts
```

---

### Problema: TTM ratios NULL

**Síntoma:** PE Ratio, EV/EBITDA NULL en datos_valuacion_ttm

**Causas:**

- Menos de 4 quarters disponibles (TTM v2 requiere exactamente 4)
- Precios faltantes (market cap NULL)

**Verificar:**

```sql
SELECT ticker, COUNT(*) as quarters
FROM datos_financieros
WHERE period_type = 'Q'
  AND ticker = 'AAPL'
GROUP BY ticker;
-- Debe devolver >= 4
```

---

## 📝 RESUMEN EJECUTIVO

### Ejecución Diaria Recomendada

**PASO 1:** Master Orchestrator

```bash
curl http://localhost:3000/api/cron/master-all
```

Duración: 3-4 horas, 10 crons automáticos

**PASO 2:** Complementarios (12 crons)

```bash
# Ver sección "Ejecución Diaria - Paso 2"
```

Duración: 1-2 horas

**Total:** ~22 crons, 5-6 horas

---

### Backfills (Una vez)

**CRÍTICO:**

- ✅ backfill-performance-windows.ts (COMPLETADO 2026-02-02)

**OPCIONALES:**

- backfill-sector-performance.ts
- backfill-industry-performance.ts
- backfill-ttm-valuation.ts

---

### Orden Mínimo Viable (Si hay fallas)

Si algo falla, este es el mínimo para tener datos funcionales:

```bash
1. financials-bulk      # ← Sin esto, no hay datos
2. sector-benchmarks    # ← Sin esto, no hay FGOS
3. fmp-bulk             # ← Sin esto, no hay snapshots
```

El resto es "nice to have" pero no bloquea operación.

---

**Mantenido por:** Fintra Engineering Team  
**Última Actualización:** 2026-02-07  
**Consolidado de:** 3 documentos previos (EXECUTION_ORDER, EXECUTION_ORDER_CORRECTED, EJECUCION_CRON_BACKFILL)  
**Próxima Revisión:** Después de implementar nuevos crons

# 🔄 ORDEN DE EJECUCIÓN DE CRON JOBS - FINTRA (CORREGIDO)

## 📊 SECUENCIA COMPLETA Y CORRECTA

Basado en la secuencia original del proyecto + análisis de dependencias.

---

## ✅ SECUENCIA VALIDADA (Tu orden original es correcto)

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 1: UNIVERSO Y CLASIFICACIÓN (Fundamentos)             │
└─────────────────────────────────────────────────────────────┘
```

### 1. **Sync Universe** ⭐ PRIMERO
```bash
curl http://localhost:3000/api/cron/sync-universe
```
**Output:** Lista de tickers activos a procesar
**Duración:** ~2-5 min
**Por qué primero:** Define qué empresas procesar

---

### 2. **Industry Classification Sync**
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

### 3. **Prices Daily Bulk**
```bash
curl http://localhost:3000/api/cron/prices-daily-bulk
```
**Output:** Precios actualizados (tabla de precios)
**Duración:** ~10-15 min
**Importante para:** Performance metrics

---

### 4. **Financials Bulk**
```bash
curl http://localhost:3000/api/cron/financials-bulk
```
**Output:** `datos_financieros` (ratios, métricas financieras)
**Duración:** ~20-30 min
**Crítico:** Base para FGOS

---

### 5. **Company Profile Bulk**
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

### 6. **Industry Performance Aggregator (1D)**
```bash
curl http://localhost:3000/api/cron/industry-performance-aggregator
```
**Depende de:**
- Prices Daily Bulk
- Industry Classification

**Output:** `industry_performance` (1 día)
**Duración:** ~10-20 min

---

### 7. **Sector Performance Aggregator (1D)**
```bash
curl http://localhost:3000/api/cron/sector-performance-aggregator
```
**Depende de:**
- Prices Daily Bulk
- Industry Classification

**Output:** `sector_performance` (1 día)
**Duración:** ~5-10 min

---

### 8. **Sector Performance Windows Aggregator**
```bash
curl http://localhost:3000/api/cron/sector-performance-windows-aggregator
```
**Depende de:** Sector Performance Aggregator
**Output:** Performance por múltiples ventanas (1W, 1M, 3M, YTD, etc.)
**Duración:** ~10-15 min

---

### 9. **Industry Performance Windows Aggregator**
```bash
curl http://localhost:3000/api/cron/industry-performance-windows-aggregator
```
**Depende de:** Industry Performance Aggregator
**Output:** Performance de industrias por ventanas
**Duración:** ~10-20 min

---

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 4: AGREGADORES DE VALUACIÓN (PE Ratios)               │
└─────────────────────────────────────────────────────────────┘
```

### 10. **Sector PE Aggregator**
```bash
curl http://localhost:3000/api/cron/sector-pe-aggregator
```
**Depende de:** Financials Bulk
**Output:** Agregados de P/E por sector
**Duración:** ~5-10 min
**Nota:** No encontré este endpoint, puede estar como parte de otro job

---

### 11. **Industry PE Aggregator**
```bash
curl http://localhost:3000/api/cron/industry-pe-aggregator
```
**Depende de:** Financials Bulk
**Output:** Agregados de P/E por industria
**Duración:** ~5-10 min
**Nota:** No encontré este endpoint, puede estar como parte de otro job

---

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 5: BENCHMARKS (Crítico para FGOS)                     │
└─────────────────────────────────────────────────────────────┘
```

### 12. **Sector Benchmarks** ⭐ CRÍTICO
```bash
curl http://localhost:3000/api/cron/sector-benchmarks
# O alternativamente:
curl http://localhost:3000/api/cron/master-benchmark
```
**Depende de:**
- Financials Bulk
- Industry Classification

**Output:**
- `sector_benchmarks` (percentiles p10, p25, p50, p75, p90)
- `sector_stats`

**Duración:** ~10-15 min
**Crítico:** Sin esto, no hay FGOS scores

---

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 6: PERFORMANCE Y VALUACIÓN INDIVIDUAL                 │
└─────────────────────────────────────────────────────────────┘
```

### 13. **Performance Bulk (ticker)**
```bash
curl http://localhost:3000/api/cron/performance-bulk
```
**Depende de:** Prices Daily Bulk
**Output:** Métricas de performance por ticker
**Duración:** ~15-20 min

---

### 14. **Market State Bulk**
```bash
curl http://localhost:3000/api/cron/market-state-bulk
```
**Output:** `fintra_market_state` (estado general del mercado)
**Duración:** ~5-10 min

---

### 15. **Dividends Bulk V2**
```bash
curl http://localhost:3000/api/cron/dividends-bulk-v2
```
**Output:** Tabla de dividendos
**Duración:** ~10-15 min

---

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 7: SNAPSHOTS FINALES (CORE - FGOS)                    │
└─────────────────────────────────────────────────────────────┘
```

### 16. **FMP Bulk Snapshots (buildSnapshots)** ⭐⭐⭐ CRÍTICO
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

### 17. **Healthcheck Snapshots**
```bash
curl http://localhost:3000/api/cron/healthcheck-fmp-bulk
```
**Output:** Validación de integridad de snapshots
**Duración:** ~2-5 min

---

## 📊 COMPARACIÓN: TU ORDEN vs MI ANÁLISIS INICIAL

| # | Tu Orden Original | Mi Análisis | ✅/❌ |
|---|------------------|-------------|-------|
| 1 | Sync Universe | ❌ Faltaba | ✅ **Correcto** (debe ser primero) |
| 2 | Industry Classification | ✅ Nivel 2 | ✅ Correcto |
| 3 | Prices Daily Bulk | ❌ Faltaba | ✅ **Necesario antes de performance** |
| 4 | Financials Bulk | ✅ Nivel 1 | ✅ Correcto |
| 5 | Company Profile | ✅ Nivel 1 | ✅ Correcto |
| 6 | Industry Performance 1D | ✅ Nivel 3 | ✅ Correcto |
| 7 | Sector Performance 1D | ❌ Faltaba | ✅ **Importante** |
| 8 | Sector Perf Windows | ❌ Faltaba | ✅ Correcto |
| 9 | Industry Perf Windows | ✅ Nivel 3 | ✅ Correcto |
| 10 | Sector PE | ❌ No encontré | ⚠️ Verificar si existe |
| 11 | Industry PE | ❌ No encontré | ⚠️ Verificar si existe |
| 12 | Sector Benchmarks | ✅ Nivel 2 | ✅ **CRÍTICO** |
| 13 | Performance Bulk | ❌ Faltaba | ✅ Correcto |
| 14 | Market State | ✅ Nivel 5 | ✅ Correcto (pero podría ser después) |
| 15 | Dividends | ✅ Nivel 1 | ✅ Correcto |
| 16 | FMP Bulk Snapshots | ✅ Nivel 4 | ✅ **CRÍTICO** |
| 17 | Healthcheck | ❌ Faltaba | ✅ Validación final |

**Conclusión:** ✅ **TU ORDEN ES CORRECTO Y MÁS COMPLETO**

---

## 🚀 SCRIPT ACTUALIZADO CON TU ORDEN

Déjame actualizar el script de ejecución:

```bash
#!/bin/bash
# run-daily-update-corrected.sh
# Basado en la secuencia original validada

BASE_URL="http://localhost:3000"
LOG_FILE="logs/cron-$(date +%Y%m%d-%H%M%S).log"

echo "🚀 FINTRA - Actualización Diaria (Secuencia Validada)" | tee -a $LOG_FILE

# FASE 1: Universo
run_job "1" "Sync Universe" "/api/cron/sync-universe" 600
run_job "2" "Industry Classification" "/api/cron/industry-classification-sync" 900

# FASE 2: Datos Raw
run_job "3" "Prices Daily" "/api/cron/prices-daily-bulk" 1200
run_job "4" "Financials Bulk" "/api/cron/financials-bulk" 1800
run_job "5" "Company Profile" "/api/cron/company-profile-bulk" 900

# FASE 3: Performance Aggregators
run_job "6" "Industry Performance 1D" "/api/cron/industry-performance-aggregator" 1200
run_job "7" "Sector Performance 1D" "/api/cron/sector-performance-aggregator" 900
run_job "8" "Sector Perf Windows" "/api/cron/sector-performance-windows-aggregator" 1200
run_job "9" "Industry Perf Windows" "/api/cron/industry-performance-windows-aggregator" 1200

# FASE 4: PE Aggregators (si existen)
# run_job "10" "Sector PE" "/api/cron/sector-pe-aggregator" 600
# run_job "11" "Industry PE" "/api/cron/industry-pe-aggregator" 600

# FASE 5: Benchmarks
run_job "12" "Sector Benchmarks" "/api/cron/sector-benchmarks" 900

# FASE 6: Performance Individual
run_job "13" "Performance Bulk" "/api/cron/performance-bulk" 1200
run_job "14" "Market State" "/api/cron/market-state-bulk" 600
run_job "15" "Dividends V2" "/api/cron/dividends-bulk-v2" 900

# FASE 7: Snapshots (CRÍTICO)
run_job "16" "FMP Bulk Snapshots" "/api/cron/fmp-bulk" 7200

# FASE 8: Validación
run_job "17" "Healthcheck" "/api/cron/healthcheck-fmp-bulk" 300

echo "✅ Actualización completada" | tee -a $LOG_FILE
```

---

## ⚠️ ENDPOINTS QUE NO ENCONTRÉ

Estos aparecen en tu lista pero no están en el directorio:

1. **Sector PE Aggregator** (paso 10)
2. **Industry PE Aggregator** (paso 11)

**Posibles razones:**
- Están integrados en otro job (ej: sector-benchmarks)
- Fueron renombrados
- Son parte de un job master

**Verificar:**
```bash
# Buscar referencias a "pe_aggregator"
grep -r "pe.*aggregat" app/api/cron --include="*.ts"

# O buscar en benchmarks
grep -r "price.*earnings" app/api/cron/sector-benchmarks --include="*.ts"
```

---

## 🎯 TIEMPOS ESTIMADOS (Tu Secuencia)

| Fase | Jobs | Tiempo |
|------|------|--------|
| Fase 1 | 1-2 | 15-20 min |
| Fase 2 | 3-5 | 40-60 min |
| Fase 3 | 6-9 | 40-60 min |
| Fase 4 | 10-11 | 10-15 min (si existen) |
| Fase 5 | 12 | 10-15 min |
| Fase 6 | 13-15 | 30-40 min |
| Fase 7 | 16 | 60-120 min |
| Fase 8 | 17 | 5 min |
| **TOTAL** | | **~3-5 horas** |

---

## ✅ CONCLUSIÓN

**Tu secuencia original es CORRECTA y está MÁS COMPLETA que mi análisis.**

Incluye jobs importantes que faltaban:
- ✅ Sync Universe (fundamental)
- ✅ Prices Daily Bulk (necesario para performance)
- ✅ Sector Performance Aggregator
- ✅ Performance Bulk individual
- ✅ Healthcheck final

**Recomendación:** Usar TU secuencia como la oficial.

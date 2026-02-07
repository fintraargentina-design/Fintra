# 🔄 ORDEN DE EJECUCIÓN DE CRON JOBS - FINTRA

## 📊 FLUJO DE DATOS Y DEPENDENCIAS

### NIVEL 1: Datos Base (Raw Data) ⬇️
Estos cron jobs obtienen datos directamente de FMP API y no dependen de nada más.

```
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 1: INGESTA DE DATOS (Ejecutar PRIMERO)               │
└─────────────────────────────────────────────────────────────┘
```

#### 1.1 **FMP Bulk** (Crítico - Ejecutar primero)
```bash
curl http://localhost:3000/api/cron/fmp-bulk
```
**Output:**
- `company_profiles` (tabla)
- `datos_financieros` (ratios, metrics)
- `datos_performance` (performance data)
- `datos_valuacion` (valuation data)

**Frecuencia:** 1 vez al día (mañana temprano)

---

#### 1.2 **Dividends Bulk**
```bash
curl http://localhost:3000/api/cron/dividends-bulk-v2
```
**Output:** `dividends` tabla

**Frecuencia:** 1 vez al día

---

#### 1.3 **Company Profile Bulk** (Opcional - redundante con fmp-bulk)
```bash
curl http://localhost:3000/api/cron/company-profile-bulk
```
**Output:** Actualiza perfiles de empresas

**Frecuencia:** 1 vez por semana

---

### NIVEL 2: Clasificación y Agregación ⬇️

```
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 2: CLASIFICACIÓN (Ejecutar DESPUÉS de Nivel 1)       │
└─────────────────────────────────────────────────────────────┘
```

#### 2.1 **Industry Classification Sync**
```bash
curl http://localhost:3000/api/cron/industry-classification-sync
```
**Depende de:** `company_profiles`
**Output:**
- `industry_classification`
- `asset_industry_map`

**Frecuencia:** 1 vez al día (después de fmp-bulk)

---

#### 2.2 **Sector Benchmarks** (Crítico)
```bash
curl http://localhost:3000/api/cron/master-benchmark
```
**Depende de:** `datos_financieros`
**Output:**
- `sector_benchmarks`
- `sector_stats`
- `industry_stats`

**Frecuencia:** 1 vez al día (después de datos financieros)

---

#### 2.3 **TTM Valuation Cron** (🆕 Crítico)
```bash
curl http://localhost:3000/api/cron/ttm-valuation-cron
```
**Depende de:** 
- `datos_financieros` (quarterly data)
- `prices_daily` (price data)

**Output:** `datos_valuacion_ttm` (Historical TTM valuation ratios)

**Qué hace:**
- Detecta nuevos quarters cerrados
- Calcula TTM (sum últimos 4 quarters) usando `computeTTMv2`
- Calcula ratios: PE, EV/EBITDA, P/S, P/FCF
- Inserta en `datos_valuacion_ttm`

**Frecuencia:** 1 vez al día (después de fmp-bulk)

**Nota:** Para backfill histórico, usar `scripts/backfill/backfill-ttm-valuation.ts`

---

### NIVEL 3: Performance y Rankings ⬇️

```
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 3: PERFORMANCE (Ejecutar DESPUÉS de Nivel 2)         │
└─────────────────────────────────────────────────────────────┘
```

#### 3.1 **Industry Performance Aggregator**
```bash
curl http://localhost:3000/api/cron/industry-performance-aggregator
```
**Depende de:**
- `datos_performance`
- `asset_industry_map`

**Output:** `industry_performance`

**Frecuencia:** 1 vez al día

---

#### 3.2 **Industry Performance Windows Aggregator**
```bash
curl http://localhost:3000/api/cron/industry-performance-windows-aggregator
```
**Depende de:**
- `industry_performance`

**Output:** `industry_performance` (agregado por ventanas)

**Frecuencia:** 1 vez al día (después de 3.1)

---

#### 3.3 **Industry Benchmarks Aggregator**
```bash
curl http://localhost:3000/api/cron/industry-benchmarks-aggregator
```
**Depende de:**
- `datos_financieros`
- `asset_industry_map`

**Output:** `industry_benchmarks`

**Frecuencia:** 1 vez al día

---

### NIVEL 4: Snapshots y Scores (CORE) ⬇️

```
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 4: MOTOR FGOS (Ejecutar DESPUÉS de Nivel 3)          │
└─────────────────────────────────────────────────────────────┘
```

#### 4.1 **FMP Peers Bulk** (Opcional)
```bash
curl http://localhost:3000/api/cron/fmp-peers-bulk
```
**Depende de:** `company_profiles`
**Output:** `company_peers`

**Frecuencia:** 1 vez por semana

---

#### 4.2 **Financials Bulk** (Redundante - ya cubierto por fmp-bulk)
```bash
curl http://localhost:3000/api/cron/financials-bulk
```
**Depende de:** Nada
**Output:** `datos_financieros`

**Frecuencia:** Solo si fmp-bulk falla

---

#### 4.3 **Bulk Update** (CRÍTICO - Genera snapshots)
```bash
curl http://localhost:3000/api/cron/bulk-update
```
**Depende de:**
- `datos_financieros` ✅
- `sector_benchmarks` ✅
- `industry_performance` ✅

**Output:**
- `fintra_snapshots` ← **TABLA PRINCIPAL**
  - fgos_score
  - fgos_components
  - valuation_score
  - ifs_score
  - etc.

**Frecuencia:** 1 vez al día (después de TODOS los anteriores)

---

### NIVEL 5: Rankings y Estado de Mercado ⬇️

```
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 5: RANKINGS (Ejecutar DESPUÉS de Snapshots)          │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1 **Compute Ranks**
```bash
curl http://localhost:3000/api/cron/compute-ranks
```
**Depende de:** `fintra_snapshots`
**Output:**
- `fintra_snapshots` (actualiza campos de rank)
  - fgos_sector_rank
  - valuation_sector_rank

**Frecuencia:** 1 vez al día (después de bulk-update)

---

#### 5.2 **Market State Bulk**
```bash
curl http://localhost:3000/api/cron/market-state-bulk
```
**Depende de:** `fintra_snapshots`
**Output:** `fintra_market_state`

**Frecuencia:** 1 vez al día (después de snapshots)

---

### NIVEL 6: Maestros y Orquestadores ⬇️

```
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 6: MASTER JOBS (Ejecutan todo automáticamente)       │
└─────────────────────────────────────────────────────────────┘
```

#### 6.1 **Master All** (Ejecuta todo en orden)
```bash
curl http://localhost:3000/api/cron/master-all
```
**Depende de:** Nada (es el orquestador)
**Output:** Ejecuta todos los jobs en el orden correcto

**Frecuencia:** 1 vez al día (reemplaza ejecutar todo manualmente)

---

#### 6.2 **Master Ticker** (Por ticker individual)
```bash
curl http://localhost:3000/api/cron/master-ticker?ticker=AAPL
```
**Depende de:** Benchmarks ya existentes
**Output:** Snapshot actualizado para 1 ticker

**Frecuencia:** On-demand

---

## 🎯 ORDEN SIMPLIFICADO PARA EJECUCIÓN LOCAL

### Opción A: Ejecución Manual Completa

```bash
# 1. NIVEL 1: Datos Base (30-60 min)
curl http://localhost:3000/api/cron/fmp-bulk

# 2. NIVEL 2: Clasificación y Benchmarks (5-10 min)
curl http://localhost:3000/api/cron/industry-classification-sync
curl http://localhost:3000/api/cron/master-benchmark

# 3. NIVEL 3: Performance (10-15 min)
curl http://localhost:3000/api/cron/industry-performance-aggregator
curl http://localhost:3000/api/cron/industry-performance-windows-aggregator
curl http://localhost:3000/api/cron/industry-benchmarks-aggregator

# 4. NIVEL 4: Snapshots (60-120 min)
curl http://localhost:3000/api/cron/bulk-update

# 5. NIVEL 5: Rankings (5-10 min)
curl http://localhost:3000/api/cron/compute-ranks
curl http://localhost:3000/api/cron/market-state-bulk

# TOTAL: ~2-4 horas
```

---

### Opción B: Usar Master Job (RECOMENDADO)

```bash
# Ejecuta TODO en orden automáticamente
curl http://localhost:3000/api/cron/master-all

# TOTAL: 2-4 horas (automático)
```

---

## 🔄 SCRIPT BASH PARA EJECUCIÓN LOCAL

Crea este script para ejecutar todo localmente:

```bash
#!/bin/bash
# run-daily-update.sh

BASE_URL="http://localhost:3000"
LOG_FILE="cron-$(date +%Y%m%d).log"

echo "🚀 Iniciando actualización diaria de Fintra" | tee -a $LOG_FILE
echo "Fecha: $(date)" | tee -a $LOG_FILE

# Función para ejecutar con logging
run_job() {
  local name=$1
  local endpoint=$2
  local max_duration=${3:-600}  # Default 10 min

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
    cat /tmp/response.json | tee -a $LOG_FILE
    return 1
  fi
}

# NIVEL 1: Datos Base
run_job "FMP Bulk" "/api/cron/fmp-bulk" 3600 || exit 1
sleep 10

# NIVEL 2: Clasificación
run_job "Industry Classification" "/api/cron/industry-classification-sync" 600
run_job "Sector Benchmarks" "/api/cron/master-benchmark" 600
sleep 10

# NIVEL 3: Performance
run_job "Industry Performance" "/api/cron/industry-performance-aggregator" 900
run_job "Industry Windows" "/api/cron/industry-performance-windows-aggregator" 600
run_job "Industry Benchmarks" "/api/cron/industry-benchmarks-aggregator" 600
sleep 10

# NIVEL 4: Snapshots
run_job "Bulk Update (Snapshots)" "/api/cron/bulk-update" 7200 || exit 1
sleep 10

# NIVEL 5: Rankings
run_job "Compute Ranks" "/api/cron/compute-ranks" 600
run_job "Market State" "/api/cron/market-state-bulk" 300

echo "✅ Actualización completada" | tee -a $LOG_FILE
echo "Ver log completo en: $LOG_FILE"
```

---

## 📅 SCHEDULE RECOMENDADO (Local)

Si vas a correr localmente, usa `cron` o Windows Task Scheduler:

### Linux/Mac (crontab)
```bash
# Editar crontab
crontab -e

# Agregar línea (ejecutar diariamente a las 2 AM)
0 2 * * * cd /path/to/fintra && bash run-daily-update.sh
```

### Windows (Task Scheduler)
```powershell
# Crear tarea programada
schtasks /create /tn "Fintra Daily Update" /tr "C:\FintraDeploy\Fintra\run-daily-update.bat" /sc daily /st 02:00
```

---

## 🐛 JOBS DE DEBUG (Opcional)

Estos son para debugging, no necesarios en ejecución normal:

```bash
# Verificar salud del bulk
curl http://localhost:3000/api/cron/healthcheck-fmp-bulk

# Ver muestra de datos financieros
curl http://localhost:3000/api/cron/fmp-debug/sample-financial

# Verificar salud general
curl http://localhost:3000/api/cron/fmp-debug/bulk-health
```

---

## ⚠️ IMPORTANTE PARA EJECUCIÓN LOCAL

### 1. **Quitar Autenticación para Local**

Si no usas Vercel Cron, la autenticación con `CRON_SECRET` puede ser opcional localmente.

**Opción A:** Configurar CRON_SECRET en `.env.local`
```bash
CRON_SECRET=local_dev_secret
```

**Opción B:** Deshabilitar auth en desarrollo
```typescript
// En cronAuth.ts
if (process.env.NODE_ENV === 'development') {
  return { authorized: true }; // Skip auth en dev
}
```

---

### 2. **Tiempos de Ejecución**

| Job | Tiempo Estimado | Crítico |
|-----|----------------|---------|
| fmp-bulk | 30-60 min | ✅ SÍ |
| bulk-update | 60-120 min | ✅ SÍ |
| industry-performance | 10-20 min | 🟡 Medio |
| compute-ranks | 5-10 min | 🟡 Medio |
| Otros | 1-5 min | ⚪ Opcional |

**Total:** ~2-4 horas para actualización completa

---

### 3. **Orden de Prioridad si hay Fallas**

Si algo falla, este es el orden mínimo para tener datos funcionales:

```bash
# MÍNIMO VIABLE:
1. fmp-bulk          # ← Sin esto, no hay datos
2. master-benchmark  # ← Sin esto, no hay scores FGOS
3. bulk-update       # ← Sin esto, no hay snapshots

# El resto es "nice to have" pero no crítico
```

---

## 🎯 RESUMEN EJECUTIVO

**Para ejecución LOCAL:**

1. **Iniciar dev server:**
   ```bash
   npm run dev
   ```

2. **Ejecutar actualización diaria:**
   ```bash
   bash run-daily-update.sh
   ```

3. **Monitorear progreso:**
   ```bash
   tail -f cron-$(date +%Y%m%d).log
   ```

**Frecuencia recomendada:** 1 vez al día (2-4 AM)

**Dependencias críticas:**
- Base de datos accesible (Supabase)
- FMP API key válida
- Node.js server corriendo

---

¿Quieres que cree el script bash completo para ejecutar todo localmente?

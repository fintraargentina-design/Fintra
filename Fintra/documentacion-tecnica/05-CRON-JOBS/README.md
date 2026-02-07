# 05-CRON-JOBS - Documentación de Cron Jobs

**Última actualización:** 7 de febrero de 2026  
**Consolidación:** 4 documentos → 2 documentos activos + archive

---

## 📋 Índice de Documentos

### ⭐ Documento Maestro Principal

**[CRON_JOBS_MASTER_GUIDE.md](./CRON_JOBS_MASTER_GUIDE.md)** - Guía completa de ejecución de cron jobs en Fintra.

**Contenido completo (consolidado de 3 docs previos):**

1. **Introducción** - Overview del sistema de cron jobs
2. **Arquitectura y Dependencias** - Modelo de 5 capas, grafos de dependencias
3. **Orden de Ejecución Completo** - Secuencia validada de 17-22 jobs con timing
4. **Ejecución Diaria** - Master orchestrator + complementarios
5. **Backfills** - Scripts de poblado inicial (una vez)
6. **Scripts y Automatización** - Bash/PowerShell, crontab, Task Scheduler
7. **Monitoreo y Verificación** - Queries SQL, métricas, dashboard
8. **Troubleshooting** - Solución a problemas comunes

**📌 Este es el documento de referencia principal para operación de cron jobs.**

---

## 📚 Documentos Complementarios

### [RUN-CRONS-README.md](./RUN-CRONS-README.md)

**Tema:** Documentación de scripts ejecutables (.bat/.ps1)

**Audiencia:** DevOps, operadores que ejecutan scripts en Windows

**Contenido clave:**

- **Modo Directo** (run-all-crons-direct.ps1) - 19 jobs, sin servidor HTTP
- **Modo HTTP** (run-all-crons.ps1) - Requiere localhost:3000
- Secuencia de ejecución por fases
- Ejemplos de logs de ejecución
- Comparación de modos (directo vs HTTP)

**Cuándo consultar:**

- Ejecutando scripts desde carpeta raíz del proyecto
- Configurando automatización en Windows
- Debugging de ejecución de scripts

---

## 🔄 Flujo de Navegación Recomendado

### Para Operadores/DevOps:

1. **[CRON_JOBS_MASTER_GUIDE.md](./CRON_JOBS_MASTER_GUIDE.md)** → Entender arquitectura y orden de ejecución
2. **[RUN-CRONS-README.md](./RUN-CRONS-README.md)** → Ejecutar scripts en Windows
3. Consultar sección "Monitoreo y Verificación" para validar resultados

### Para Desarrolladores:

1. **[CRON_JOBS_MASTER_GUIDE.md](./CRON_JOBS_MASTER_GUIDE.md)** → Sección "Arquitectura y Dependencias"
2. Consultar sección "Troubleshooting" para debugging
3. Ver [/archive/](./archive/) para contexto histórico si es necesario

### Para Debugging:

- **Snapshots sin FGOS** → CRON_JOBS_MASTER_GUIDE.md, sección "Troubleshooting"
- **Performance windows vacías** → Sección "Problema: Performance windows vacías"
- **TTM ratios NULL** → Sección "Problema: TTM ratios NULL"
- **Master-all timeout** → Sección "Problema: master-all timeout"

---

## 📊 Estado de la Documentación

### Documentos Activos

| Documento                        | Estado      | Última Actualización | Prioridad |
| -------------------------------- | ----------- | -------------------- | --------- |
| **CRON_JOBS_MASTER_GUIDE.md** ⭐ | ✅ Completo | 2026-02-07           | 🔴 Alta   |
| **RUN-CRONS-README.md**          | ✅ Completo | 2026-02-02           | 🟡 Media  |

### Documentación Archivada

Documentos obsoletos/redundantes disponibles en:

- **[archive/](./archive/)** - Versiones previas consolidadas:
  - `CRON_EXECUTION_ORDER_CORRECTED.md` (obsoleto - 31 ene)
  - `CRON_EXECUTION_ORDER.md` (merge en MASTER - 4 feb)
  - `EJECUCION_CRON_BACKFILL.md` (merge en MASTER - 2 feb)

**Nota:** La documentación archivada se preserva para contexto histórico y no debe usarse para operación activa.

---

## 🎯 Cambios Recientes (2026-02-02)

### Modificaciones Críticas en Master-All

El orchestrator `master-all` ahora incluye 2 nuevos crons:

1. **sector-performance-aggregator** (paso 5)
2. **performance-windows-aggregator** (paso 5.5)

**Impacto:**

- ✅ `performance_windows` se popula automáticamente
- ✅ Scatter chart funcional (dispersión correcta)
- ✅ Relative performance data disponible

**Verificar después de ejecución:**

```sql
SELECT COUNT(*) FROM performance_windows
WHERE as_of_date = CURRENT_DATE;
-- Esperado: ~130,000 filas
```

---

## 📝 Resumen de Arquitectura

### 5 Niveles de Dependencias

```
NIVEL 1: Ingesta Base
  ↓ (FMP Bulk, Dividends, Company Profiles)
NIVEL 2: Clasificación
  ↓ (Industry Classification, Sector Benchmarks, TTM Valuation)
NIVEL 3: Performance
  ↓ (Industry/Sector Performance, Windows, Benchmarks)
NIVEL 4: Snapshots (CORE)
  ↓ (bulk-update genera fintra_snapshots con FGOS)
NIVEL 5: Rankings y Cache
  ↓ (Compute Ranks, Market State)
```

### Jobs por Criticidad

| Criticidad     | Jobs                                                        | Total |
| -------------- | ----------------------------------------------------------- | ----- |
| ⭐⭐⭐ CRÍTICO | sync-universe, financials-bulk, sector-benchmarks, fmp-bulk | 4     |
| ⭐⭐ Alta      | prices-daily, performance-bulk, industry-performance        | 3     |
| ⭐ Media       | Resto de agregadores, dividends, peers                      | 15+   |

---

## ⚙️ Ejecución Rápida

### Opción A: Master Orchestrator (RECOMENDADO)

```bash
curl http://localhost:3000/api/cron/master-all
```

**Total:** 10 crons automáticos, 3-4 horas  
**Incluye:** sync-universe, prices, financials, performance, sector-perf, windows, snapshots, valuation, benchmarks, market-state

---

### Opción B: Scripts Windows (Modo Directo)

```powershell
.\run-all-crons-direct.ps1
```

**Total:** 19 jobs completos, sin servidor HTTP  
**Incluye:** FGOS recompute, IFS memory, healthcheck

---

### Opción C: Single Ticker (DEBUGGING)

```bash
curl "http://localhost:3000/api/cron/master-ticker?ticker=AAPL"
```

**Uso:** Testing de pipeline completo en 1 ticker

---

## 🔍 Verificación Post-Ejecución

**Query Rápida de Salud:**

```sql
-- Última ejecución
SELECT MAX(snapshot_date) FROM fintra_snapshots;

-- Cobertura FGOS
SELECT
  fgos_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as pct
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
GROUP BY fgos_status;
```

**Esperado:**

- `computed`: > 80%
- `pending`: < 20%

---

## 📦 Consolidación Completada

**Fecha:** 7 de febrero de 2026

**Cambios:**

- ✅ Consolidación de 4 documentos → 2 documentos activos
- ✅ Eliminación de redundancias (3 docs del mismo tema)
- ✅ Resolución de confusión "CORRECTED" (era versión más vieja)
- ✅ Organización de históricos en `/archive/`
- ✅ Documento maestro único: CRON_JOBS_MASTER_GUIDE.md

**Beneficios:**

- Fuente única de verdad (Single Source of Truth)
- Reducción de 50% en documentos activos
- Eliminación de contenido duplicado (75% solapamiento)
- Estructura más clara y mantenible

---

**Última revisión:** 7 de febrero de 2026  
**Jobs documentados:** 22 crons diarios + 7 backfills  
**Cobertura:** Arquitectura completa, scripts, monitoreo, troubleshooting

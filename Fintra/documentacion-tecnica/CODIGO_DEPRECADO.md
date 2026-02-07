# Código Deprecado y No Utilizado - Fintra

**Fecha de auditoría:** 6 de febrero, 2026  
**Última actualización:** 6 de febrero, 2026

Este documento identifica código, archivos y funcionalidades que no están siendo utilizados activamente en el sistema Fintra y son candidatos para limpieza o eliminación.

---

## 📋 Resumen Ejecutivo

| Categoría                | Cantidad      | Prioridad de Limpieza |
| ------------------------ | ------------- | --------------------- |
| Scripts de Testing/Debug | 20+ archivos  | 🟢 Baja               |
| Archivos Backup          | 5 archivos    | 🟢 Baja               |
| Crons Deprecados         | 3 crons       | 🔴 Alta               |
| Archivos Temporales      | 8+ archivos   | 🟡 Media              |
| Funciones No Usadas      | 15+ funciones | 🟡 Media              |

---

## 🔴 PRIORIDAD ALTA - Eliminar AHORA

### 1. Cron Job: `fmp-batch` (❌ DEPRECADO - CRÍTICO)

**Ubicación:** `app/api/cron/fmp-batch/`

**Estado:** DEPRECADO y REDUNDANTE

**Problemas Críticos:**

- **OOM Risk:** Carga 6 endpoints masivos completamente en memoria via `loadFmpBulkOnce()`:
  - `profile-bulk` (~15 MB)
  - `income-statement-bulk` (~150 MB)
  - `balance-sheet-statement-bulk` (~120 MB)
  - `cash-flow-statement-bulk` (~100 MB)
  - `ratios-ttm-bulk` (~50 MB)
  - `key-metrics-ttm-bulk` (~50 MB)
  - **Total estimado en RAM: 500 MB - 1 GB**

- **Ineficiencia Algorítmica:** Usa `.find()` sobre arrays gigantes para cada ticker (O(N×M))

- **Redundancia Funcional:** Su propósito es cubierto completamente por `financials-bulk` que:
  - Usa streaming (memoria constante ~350MB)
  - Implementa gap detection inteligente
  - Procesa solo años mutables por defecto
  - Es 10-20x más rápido

**Función Problemática:**

```typescript
// lib/fmp/loadFmpBulkOnce.ts
export async function loadFmpBulkOnce() {
  if (cache) return cache;

  cache = {
    profiles: await fetchJson(`${BASE}/profile-bulk`), // ~15 MB
    income: await fetchJson(`${BASE}/income-statement-bulk`), // ~150 MB
    balance: await fetchJson(`${BASE}/balance-sheet-statement-bulk`), // ~120 MB
    cashflow: await fetchJson(`${BASE}/cash-flow-statement-bulk`), // ~100 MB
    ratios: await fetchJson(`${BASE}/ratios-ttm-bulk`), // ~50 MB
    metrics: await fetchJson(`${BASE}/key-metrics-ttm-bulk`), // ~50 MB
  };

  return cache; // ⚠️ Permanece en memoria durante toda la ejecución
}
```

**Acción Recomendada:**

- ❌ **ELIMINAR COMPLETAMENTE** `app/api/cron/fmp-batch/`
- ❌ **ELIMINAR** `lib/fmp/loadFmpBulkOnce.ts`
- ❌ **ELIMINAR** `lib/fmp/processTickerFromBulk.ts`
- ✅ Migrar cualquier funcionalidad única a `financials-bulk`

**Impacto:** NINGUNO - Ya está cubierto por `financials-bulk`

---

### 2. Archivo: `lib/snapshots/buildSnapshots.ts.unused`

**Ubicación:** `lib/snapshots/buildSnapshots.ts.unused`

**Estado:** Renombrado con extensión `.unused` - claramente deprecado

**Motivo:** Lógica de snapshots ahora manejada por:

- `fmp-bulk/core.ts` (función `buildSnapshots()`)
- `buildSnapshotsFromLocalData.ts` (construcción desde datos locales)

**Acción Recomendada:**

- ❌ **ELIMINAR** archivo completo

---

### 3. Archivos Temporales en Raíz del Proyecto

Múltiples archivos de testing/debugging que deberían estar en `scripts/` o eliminados:

```
check-cash-aapl.ts          # Script de debug único (verificación de columna cash)
check-sentiment.ts          # Script de debug único
check-ttm.ts                # Script de debug único (verificación API TTM)
temp-audit-financial.js     # Auditoría temporal con credenciales hardcodeadas ⚠️
test-papa-parse.js          # Test unitario de Papa Parse
find-aapl.js                # Debug de parsing CSV
debug-db-schema.ts          # Debug de schema (una vez)
```

**Problemas de Seguridad:**

- `temp-audit-financial.js` contiene **SERVICE_ROLE_KEY hardcoded** en línea 5
- Este archivo debe ser eliminado INMEDIATAMENTE o movido a `.env`

**Acción Recomendada:**

- ❌ **ELIMINAR** todos estos archivos de la raíz
- ⚠️ **ROTAR** el service role key expuesto en `temp-audit-financial.js`
- ✅ Si algún script es útil, moverlo a `scripts/debug/` sin credenciales

---

## 🟡 PRIORIDAD MEDIA - Revisar y Limpiar

### 4. Cron Job: `update-mvp` (Parcialmente Usado)

**Ubicación:** `app/api/cron/update-mvp/core.ts`

**Estado:** Funcional pero no incluido en master-cron

**Propósito:** Actualizar snapshots para top 110 MVP tickers

**Análisis:**

- No está en `run-master-cron.ts`
- No está en `run-all-crons-direct.ps1`
- Contiene lista hardcodeada de 110 tickers MVP
- Lógica válida pero posiblemente reemplazada por flujo general

**Acción Recomendada:**

- ⚠️ Verificar si se usa manualmente
- Si NO se usa: eliminar o documentar propósito
- Si se usa: agregar al master-cron con flag `--mvp`

---

### 5. Archivos Backup

```
backup-schema-2026-02-03T07-18-51.sql    # Backup manual de schema
datos_dividendos_backup.json             # Backup de dividendos (obsoleto?)
deprecated-columns-audit.json            # Resultado de auditoría (vacío)
hooks/useFilterOptions.ts.backup         # Backup de hook
```

**Acción Recomendada:**

- ✅ Mover `.sql` a `docs/migrations/backups/`
- ❌ Eliminar `.backup` (ya existe el original funcional)
- ❌ Eliminar `deprecated-columns-audit.json` (vacío)
- ⚠️ Verificar si `datos_dividendos_backup.json` es necesario

---

### 6. Scripts de Auditoría (Usado Una Vez)

**Ubicación:** `scripts/audit/`

Estos scripts son útiles pero solo se ejecutan manualmente para diagnósticos:

```
check-snapshots-count.ts
check-snapshot-structure.ts
check-sector-perf.ts
check-peers-manual.ts
check-fmp-keys.ts
check-financial-sample.ts
check-financial-history.ts
check-financial-coverage.ts
check-fgos-stats.ts
check-fgos-components.ts
check-fgos-breakdown.ts
check-empty-columns.ts
check-db.ts
check-data.ts
```

**Acción Recomendada:**

- ✅ **MANTENER** - Son herramientas de diagnóstico valiosas
- ✅ Documentar en `documentacion-tecnica/09-AUDITORIAS/`
- ✅ Crear un script wrapper `scripts/audit/run-all-checks.ts` para ejecutarlos todos

---

### 7. Crons No Incluidos en Master Cron

Los siguientes crons existen pero NO están en el pipeline diario:

```
app/api/cron/sec-10k-ingest/          # Ingestión de reportes 10-K
app/api/cron/sec-8k-ingest/           # Ingestión de reportes 8-K
app/api/cron/valuation-bulk/          # Procesamiento de valuaciones (¿reemplazado?)
app/api/cron/performance-windows-aggregator/  # Agregador de ventanas de performance
app/api/cron/industry-benchmarks-aggregator/  # Agregador de benchmarks por industria
app/api/cron/backfill/                # Scripts de backfill (uso único)
app/api/cron/bulk-update/             # ¿Deprecado?
app/api/cron/compute-ranks/           # ¿Deprecado?
app/api/cron/fmp-debug/               # Debug temporal
app/api/cron/master-all/              # ¿Deprecado? (reemplazado por run-master-cron.ts)
app/api/cron/master-benchmark/        # ¿Deprecado?
app/api/cron/master-ticker/           # ¿Deprecado?
app/api/cron/shared/                  # Helpers (OK)
app/api/cron/validation/              # Scripts de validación (OK)
```

**Acción Recomendada:**

- ⚠️ **AUDITAR** cada carpeta para determinar:
  - Si es funcional y se usa manualmente
  - Si fue reemplazado por otra implementación
  - Si debe agregarse al master-cron
  - Si debe eliminarse
- ✅ Documentar en `CRON_EXECUTION_ORDER.md` cuáles son manually triggered

---

### 8. Archivos de Log y Output Temporal

```
audit-log.txt
fintra-audit-log.txt
aapl-2023-test.log
fix-solvency-execution.log
test-output.log
```

**Acción Recomendada:**

- ❌ Eliminar todos (añadir `*.log` a `.gitignore`)
- ✅ Verificar que `logs/` directory capture todos los logs futuros

---

### 9. Scripts SQL One-Time

**Ubicación:** `scripts/`

```
analyze-solvency-impact-v2.sql
analyze-solvency-impact.sql
check-column-names.sql
check-migration-status.sql
simple-solvency-check-fixed.sql
simple-solvency-check.sql
reprocess-snapshots.sql
```

**Acción Recomendada:**

- ✅ Mover a `scripts/manual/` o `scripts/maintenance/`
- ✅ Agregar comentario en cada archivo indicando cuándo se usó y por qué

---

## 🟢 PRIORIDAD BAJA - Revisar Cuando Haya Tiempo

### 10. Funciones Exportadas Pero No Utilizadas

Estas funciones están definidas pero no tienen referencias en el código:

#### En `lib/fmp/loadFmpBulkOnce.ts`:

- `loadFmpBulkOnce()` - Solo usada por `fmp-batch` (deprecado)

#### En `lib/fmp/processTickerFromBulk.ts`:

- `processTickerFromBulk()` - Solo usada por `fmp-batch` (deprecado)

**Acción Recomendada:**

- ❌ Eliminar junto con `fmp-batch`

---

### 11. Archivos de Configuración Duplicados

```
package-lock.json  # Existe junto con pnpm-lock.yaml
```

**Análisis:**

- El proyecto usa `pnpm` (evidenciado por `pnpm-lock.yaml`)
- `package-lock.json` es de `npm` y puede causar conflictos

**Acción Recomendada:**

- ❌ Eliminar `package-lock.json`
- ✅ Añadir a `.gitignore`: `package-lock.json`

---

### 12. Scripts Batch Legacy

**Ubicación:** `scripts/`

```
run-daily-update.bat
run-daily-update.sh
run-daily-update-validated.sh
```

**Análisis:**

- Reemplazados por `Ejecutables/Jobs-Diarios/run-all-crons-direct.ps1`
- Posiblemente legacy de versiones anteriores

**Acción Recomendada:**

- ⚠️ Verificar si alguno se usa en producción
- Si NO: eliminar
- Si SÍ: documentar y mover a `Ejecutables/`

---

### 13. Archivos de PowerShell Duplicados

```
run-all-crons-direct.ps1  (raíz)
run-all-crons.ps1         (raíz)
Ejecutables/Jobs-Diarios/run-all-crons-direct.ps1  (copia)
```

**Acción Recomendada:**

- ✅ Mantener SOLO la versión en `Ejecutables/Jobs-Diarios/`
- ❌ Eliminar versiones de la raíz

---

### 14. Código Comentado Extenso

**Ubicación:** `app/api/cron/financials-bulk/core.ts`

Hay secciones extensas de código comentado relacionadas con TTM parsing:

```typescript
// Lines 472-475
// TEMP: Skip TTM downloads/parsing due to timeout issues
// TODO: Investigate TTM parsing performance issue
// tasks.push(fetchFile("key-metrics-ttm-bulk", null, null));
// tasks.push(fetchFile("ratios-ttm-bulk", null, null));

// Lines 655-668 (15 líneas comentadas)
// TTM parsing logic commented out
```

**Motivo Comentado:** Timeout issues durante parsing de TTM bulk files

**Acción Recomendada:**

- ✅ **MANTENER COMENTADO** por ahora (es técnico debt conocido)
- ✅ Crear issue en GitHub o task en backlog para investigar
- ✅ Agregar fecha estimada de revisión en comentario
- ⚠️ Si no se reactiva en 6 meses: eliminar código

---

## 📊 Estadísticas de Limpieza

### Espacio de Disco Potencialmente Recuperable

| Tipo                       | Cantidad     | Espacio Estimado |
| -------------------------- | ------------ | ---------------- |
| Scripts Deprecados         | ~25 archivos | ~500 KB          |
| Logs Temporales            | ~5 archivos  | ~2 MB            |
| Backups                    | ~3 archivos  | ~5 MB            |
| Cron Deprecado (fmp-batch) | ~5 archivos  | ~50 KB           |
| Total                      | ~38 archivos | **~7.5 MB**      |

### Impacto en Mantenibilidad

- **Reducción de superficie de código:** ~2,000 líneas
- **Reducción de falsos positivos en búsquedas:** Significativa
- **Claridad de estructura:** Alta

---

## ✅ Plan de Acción Sugerido

### Fase 1 - Inmediata (Esta Semana)

1. ❌ Eliminar `fmp-batch` y sus dependencias
2. ⚠️ **ROTAR** service role key expuesto
3. ❌ Eliminar archivos temporales de raíz
4. ❌ Eliminar `buildSnapshots.ts.unused`

### Fase 2 - Corto Plazo (Este Mes)

1. 📁 Reorganizar scripts de auditoría
2. 📁 Mover backups a carpeta dedicada
3. 📄 Documentar crons no incluidos en master
4. ❌ Eliminar logs temporales

### Fase 3 - Medio Plazo (Este Trimestre)

1. 🔍 Auditar crons no usados (sec-10k, sec-8k, etc.)
2. 📝 Decidir sobre `update-mvp`
3. 🧹 Limpieza final de scripts legacy

---

## 🔗 Referencias

- Ver también: `MEJORAS_PENDIENTES.md` para optimizaciones adicionales
- Ver: `CRON_OPTIMIZATION_LOG.md` para estado actual de crons
- Ver: `documentacion-tecnica/03-DATA-PIPELINE/` para arquitectura de pipelines

---

**Última Revisión:** 6 de febrero, 2026  
**Próxima Revisión Programada:** 6 de marzo, 2026

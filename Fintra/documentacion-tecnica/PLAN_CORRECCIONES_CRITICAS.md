# Plan de Correcciones Críticas - Fintra

**Fecha:** 2026-02-07  
**Contexto:** Post-Fase 2 (Optimizaciones FMP Bulk completadas)

---

## Resumen Ejecutivo

**Objetivo:** Resolver 5 issues críticas identificadas que afectan confiabilidad y robustez del pipeline.

**Prioridad Global:** 🔴 **ALTA** - Estas correcciones previenen errores silenciosos y mejoran debuggeabilidad.

**Tiempo Estimado Total:** 6 horas (2 issues P0 + 2 issues P1)

**⚠️ ACTUALIZACIÓN:** Plan corregido tras auditoría de código en `app/api/cron/` (búsqueda original fue en directorio incorrecto)

---

## Issues Identificadas

### 🟢 Issue 1: Falta Error Handling en bulk-update

**Estado Actual:** ✅ **VALIDADO** - Confirmado en code review

**Evidencia:**

```typescript
// app/api/cron/bulk-update/core.ts:135
for (const profile of batchToProcess) {
  const fgos = await calculateFGOSFromData(...); // ❌ Sin try/catch
  // Si 1 ticker falla → aborta TODO el batch
}
```

**Impacto:**

- 🔴 **CRÍTICO** - 1 ticker con error aborta procesamiento de 53,364 tickers
- Cron job diario falla completamente si hay 1 ticker corrupto
- No hay trazabilidad de qué ticker causó el error

**Prioridad:** 🔴 **P0 - CRÍTICA**

**Solución:**

```typescript
// ✅ CORRECCIÓN
for (const profile of batchToProcess) {
  try {
    const fgos = await calculateFGOSFromData(...);
    // ...process snapshot
  } catch (error: any) {
    console.error(`[${sym}] FGOS CALCULATION FAILED:`, error.message);
    errors.push({ ticker: sym, error: error.message });
    // Continue with next ticker - DO NOT throw
  }
}
```

**Archivos Afectados:**

- `app/api/cron/bulk-update/core.ts` (línea 135)
- `app/api/cron/fmp-bulk/buildSnapshots.ts` (línea 528)
- `app/api/cron/backfill/backfillSnapshots.ts` (línea 94)

**Tiempo Estimado:** 1 hora

---

### 🟡 Issue 2: Fallback Silencioso a Benchmarks 'General'

**Estado Actual:** ✅ **VALIDADO** - Confirmado en `lib/engine/benchmarks.ts:69`

**Evidencia:**

```typescript
// lib/engine/benchmarks.ts:69
if (allowFallback && cleanSector !== "General") {
  const general = await getBenchmarksForSector("General", snapshotDate, true);
  // ⚠️ No logging explícito del fallback
  if (general) {
    CACHE[cacheKey] = general;
    return general; // ❌ Snapshot NO indica que usó fallback
  }
}
```

**Impacto:**

- 🟡 **MEDIO** - Sectores raros (ej: "Conglomerates", "Shell Companies") comparados contra universo incorrecto
- FGOS score puede estar sesgado vs sector real
- No hay visibilidad de cuántos tickers usan fallback

**Prioridad:** 🟡 **P1 - ALTA**

**Solución:**

```typescript
// ✅ CORRECCIÓN
if (allowFallback && cleanSector !== 'General') {
  console.warn(`⚠️ BENCHMARK FALLBACK: Sector '${cleanSector}' → 'General' (date: ${snapshotDate})`);
  const general = await getBenchmarksForSector('General', snapshotDate, true);
  if (general) {
    CACHE[cacheKey] = general;
    CACHE_TIMESTAMP[cacheKey] = now;
    return general;
  }
}

// EN buildSnapshots.ts (cuando se llame):
const benchmarks = await getBenchmarksForSector(sector, snapshotDate);
const usedFallback = benchmarks && sector !== 'General'; // Flag para snapshot

// Agregar a fintra_snapshots JSONB:
fgos: {
  ...fgosResult,
  benchmark_fallback: usedFallback, // 🆕 Nuevo campo
}
```

**Archivos Afectados:**

- `lib/engine/benchmarks.ts` (línea 69)
- `app/api/cron/fmp-bulk/buildSnapshots.ts` (agregar flag)

**Tiempo Estimado:** 1.5 horas

---

### � Issue 3: CSV Parsing con Comillas (transformHeader Bug)

**Estado Actual:** ✅ **VALIDADO** - Confirmado en auditoría de código

**Evidencia:**

```typescript
// app/api/cron/financials-bulk/core.ts:309
transformHeader: (header: string) => {
  return header.replace(/^"|"$/g, ""); // ❌ BUG: Solo remueve comillas al inicio O final
};
```

**Debug Code Permanente:**

```typescript
// app/api/cron/financials-bulk/deriveFinancialMetrics.ts:79-88
console.log(
  "[DEBUG deriveFinancialMetrics] Check quoted key:",
  balance['"cashAndCashEquivalents"'],
); // Indica problema de parsing
```

**Impacto:**

- 🔴 **CRÍTICO** - Headers con comillas en ambos extremos no se limpian correctamente
- Ejemplo: `"cashAndCashEquivalents"` se mantiene con comillas
- Causa lookups fallidos en objetos (debe buscar keys con comillas explícitas)
- Debug code indica problema conocido pero nunca resuelto

**Prioridad:** 🔴 **P0 - CRÍTICA**

**Solución:**

```typescript
// ✅ CORRECCIÓN
transformHeader: (header: string) => {
  return header.replace(/"/g, ""); // Remueve TODAS las comillas
};

// REMOVER debug code en deriveFinancialMetrics.ts:79-88
```

**Archivos Afectados:**

- `app/api/cron/financials-bulk/core.ts` (línea 309)
- `app/api/cron/financials-bulk/deriveFinancialMetrics.ts` (líneas 79-88, remover debug)

**Tiempo Estimado:** 30 minutos

---

### 🟢 Issue 4: Zero Unit Tests en Lógica Financiera

**Estado Actual:** ❌ **REFUTADO** - Hay tests extensivos

**Evidencia:**

```
Archivos de tests encontrados (12 files):
✅ __tests__/ttm-lookback-bias.test.ts → TTM calculations
✅ lib/engine/fintra-brain.test.ts → calculateFGOSFromData
✅ lib/engine/moat.test.ts → Moat logic
✅ lib/engine/ifs.test.ts → IFS engine
✅ lib/engine/dividend-quality.test.ts
✅ lib/engine/competitive-advantage.test.ts
... (12 total)
```

**Tests Críticos Existentes:**

```typescript
// __tests__/ttm-lookback-bias.test.ts:81
const safeResult = deriveFinancialMetrics({
  income: ttmIncome,
  balance: ttmBalance,
  cashflow: ttmCashflow,
  ...
});
// ✅ Test asegura que TTM NO use datos futuros (look-ahead bias)
```

**Impacto:** ✅ **NINGUNO** - Cobertura de tests es adecuada

**Prioridad:** ⚠️ **P3 - BAJA** - Solo agregar tests si se detectan regresiones específicas

**Acción:** Mantener tests existentes actualizados. No requiere acción inmediata.

**Tiempo Estimado:** 0 horas (no prioritario)

---

### � Issue 5: TTM Bulk Downloads DESHABILITADO

**Estado Actual:** ✅ **VALIDADO** - Confirmado en auditoría de código

**Evidencia:**

```typescript
// app/api/cron/financials-bulk/core.ts:472-475
// TEMP: Skip TTM downloads/parsing due to timeout issues
// tasks.push(fetchFile("key-metrics-ttm-bulk", null, null)); // Comentado
// tasks.push(fetchFile("ratios-ttm-bulk", null, null)); // Comentado
```

**Impacto:**

- 🟡 **MEDIO** - TTM bulk downloads deshabilitados por timeout issues nunca resueltos
- Comentario `// TEMP:` indica problema temporal que se volvió permanente
- Alternative approach: TTM se construye en runtime (más lento pero funcional)
- Sin bulk TTM, cada cálculo requiere fetch individualizado

**Prioridad:** 🟡 **P1 - ALTA**

**Solución:**

```typescript
// ✅ CORRECCIÓN - Opción 1: Descomentar con streaming parser
tasks.push(fetchFile("key-metrics-ttm-bulk", null, null));
tasks.push(fetchFile("ratios-ttm-bulk", null, null));

// Implementar streaming parser para archivos grandes:
import { parse } from 'csv-parse'; // npm: csv-parse
const parser = fs.createReadStream(filePath).pipe(parse({ ... }));
parser.on('data', (row) => processRow(row)); // Process incrementalmente
2 horas

**Tareas:**

1. ✅ **Issue 1:** Error Handling en bulk-update (1 hora)
   - Wrap `calculateFGOSFromData` en try/catch
   - Agregar logging de errores por ticker
   - Continuar procesamiento a pesar de errores
   - **Archivos:** `bulk-update/core.ts`, `fmp-bulk/buildSnapshots.ts`, `backfill/backfillSnapshots.ts`

2. ✅ **Issue 3:** CSV transformHeader Fix (30 minutos)
   - Cambiar regex de `/^"|"$/g` a `/"/g` en `financials-bulk/core.ts:309`
   - Remover debug code de `deriveFinancialMetrics.ts:79-88`
   - **Archivos:** `financials-bulk/core.ts`, `deriveFinancialMetrics.ts`

**Criterio de Aceptación:**

- [ ] Script `16-fmp-bulk-snapshots.ts` completa 53,364 tickers incluso si 100 fallan
- [ ] Logs indican: `[TICKER] FGOS CALCULATION FAILED: <error>`
- [ ] Array `errors` acumula fallos sin abortar loop
- [ ] Headers CSV sin comillas residuales (test: `console.log(Object.keys(balance))`)
- [ ] No debug code buscando keys con comillas

### Fase 1: Correcciones Críticas (P0) - 🔴 URGENTE

**Duración:** 1 hora

**Tareas:**

1. ✅ **Issue 1:** Error Handling en bulk-update
   - Wrap `calculateFGOSFromData` en try/catch
   - Agregar logging de errores por ticker
   - Continuar procesamiento a pesar de errores
   - **Archivos:** `bulk-update/core.ts`, `fmp-bulk/buildSnapshots.ts`, `backfill/backfillSnapshots.ts`

**Criterio de Aceptación:**

- [ ] Script `16-fmp-bulk-snapshots.ts` completa 53,364 tickers incluso si 100 fallan
- [ ] Logs ind4 horas

**Tareas:**

1. ✅ **Issue 2:** Logging de Benchmark Fallback (1.5 horas)
   - Agregar `console.warn` en `benchmarks.ts`
   - Incluir flag `benchmark_fallback` en snapshot JSONB
   - Dashboard query: `SELECT COUNT(*) FROM fintra_snapshots WHERE fgos->>'benchmark_fallback' = 'true'`

2. ✅ **Issue 5:** Re-habilitar TTM Bulk Downloads (2.5 horas)
   - Descomentar líneas 472-475 en `financials-bulk/core.ts`
   - Implementar streaming parser O aumentar timeout a 5 minutos
   - Testing con subset de tickers para validar estabilidad

**Criterio de Aceptación:**

- [ ] Logs muestran: `⚠️ BENCHMARK FALLBACK: Sector 'Shell Companies' → 'General'`
- [ ] Snapshot incluye `fgos.benchmark_fallback: true`
- [ ] Query de conteo muestra cuántos tickers usan fallback
- [ ] TTM bulk downloads completados sin timeouts
- [ ] Logs indican: `✓ TTM key-metrics-ttm-bulk downloaded (X MB)`
   - CorregiMonitoreo Post-Implementación - 🟢 BAJO

**Duración:** 1 hora (observación)

**Tareas:**

1. ✅ **Monitoreo de Pipeline con Correcciones**
   - Ejecutar full run de 53,364 tickers con Issue 1 + 3 corregidas
   - Observar logs de errors por ticker (esperado: <1%)
   - Validar que headers CSV no tengan comillas residuales
   - Verificar conteo de benchmark fallbacks

**Criterio de Aceptación:**

- [ ] Full run completa sin abortar (99.9% uptime)
- [ ] Logs claros de tickers fallidos (con razón)
- [ ] Dashboard muestra métricas de calidad
1. ⚠️ **Issue 5:** Auditar TTM Pipeline
   - Verificar construcción de TTM desde quarters
   - Identificar si hay timeout issues
   - Evaluar necesidad de streaming parser

**Criterio de Aceptación:**

- [ ] Documentación clara de cómo se construyen los TTM
- [ ] Timeouts identificados (si existen)
- [ ] Plan de streaming parser (si se requiere)

---| Prioridad | Validado | Acción Recomendada                 |
| ------------------------- | ----------- | --------- | -------- | ---------------------------------- |
| **1. Error Handling**     | ✅ Real     | 🔴 P0     | ✅ Sí    | **IMPLEMENTAR YA (Fase 1)**        |
| **2. Benchmark Fallback** | ✅ Real     | 🟡 P1     | ✅ Sí    | **IMPLEMENTAR en Fase 2**          |
| **3. CSV Parsing**        | ✅ Real     | 🔴 P0     | ✅ Sí    | **IMPLEMENTAR YA (Fase 1)**        |
| **4. Unit Tests**         | ❌ Refutado | ⚠️ P3     | ✅ Sí    | **NO PRIORITARIO** (tests existen) |
| **5. TTM Bulk Downloads** | ✅ Real     | 🟡 P1     | ✅ Sí    | **IMPLEMENTAR en Fase 2**         |
| **2. Benchmark Fallback** | ✅ Real          | 🟡 P1     | ✅ Sí    | **IMPLEMENTAR en Fase 2**          |
| **3. CSV Parsing**        | ⚠️ No confirmado | 🟡 P1     | ❌ No    | **AUDITAR primero**                |
| **4. Unit Tests**         | ❌ Refutado      | ⚠️ P3     | ✅ Sí    | **NO PRIORITARIO** (tests existen) |
| **5. TTM Parsing**        | ⚠️ No confirmado | 🟡 P2     | ❌ No    | **AUDITAR en Fase 3**              |

--- - 2 horas)

1. **Error Handling en bulk-update (Issue 1)** - Previene fallos catastróficos del pipeline
2. **CSV transformHeader Fix (Issue 3)** - Corrige parsing de headers con comillas

### ✅ Implementar en Fase 2 (Fase 2 - 4 horas)

3. **Benchmark Fallback Logging (Issue 2)** - Mejora debuggeabilidad y validación de FGOS
4. **TTM Bulk Downloads (Issue 5)** - Re-habilita bulk downloads con fix de timeout

### ✅ Monitorear (Fase 3 - 1 hora)

5. **Observar full run con correcciones** - Validar estabilidad y métricas de calidad

### ❌ No Prioritario

6. **Unit Tests (Issue 4 - Refutado)g** - Verificar si hay timeout issues reales

### ❌ No Prioritario

4. **Unit Tests** - Cobertura actual es adecuada (12 archivos de tests)

---

## Métricas de Éxito

**Post-Implementación:**

- [ ] 0 aborts del pipeline por errores de tickers individuales
- [ ] Logs explícitos de benchmark fallbacks
- [ ] Dashboard con conteo de tickers usando fallback
- [ ] Documentación actualizada de construcción TTM

**KPIs:**

- Uptime del cron job diario: 95% → 99.9%
- Tickers procesados con errores: <1%
- Tickers con benchmark fallback: <5%

---

## Próximos Pasos

### Inmediatos (Hoy)

1. ✅ Implementar try/catch en bulk-update (Issue 1)
2. ✅ Testear con subset de 100 tickers
3. ✅ Deploy y monitorear logs

### Corto Plazo (Esta Semana)

4. ✅ Implementar benchmark fallback logging (Issue 2)
5. ⚠️ Auditar CSV parsing (Issue 3)
6. ⚠️ Auditar TTM pipeline (Issue 5)

### Medio Plazo (Próxima Semana)

7. Dashboard de métricas de calidad de datos
8. Alertas automáticas si >1% de tickers fallan
9. Documentación de arquitectura actualizada

---

## Notas Adicionales

**Filosofía Fintra:**

> "Fintra no inventa datos. Fintra calcula con lo que existe, marca lo que falta y explica por qué."

**Aplicado a Correcciones:**

- Error handling: Marca ticker como fallido, NO inventa resultado
- Benchmark fallback: Explica usando flag, NO oculta sustitución
- Tests: Validan que NO se inventen métricas (ej: TTM con datos futuros)

**Compatibilidad:**

- Todas las correcciones respetan principios del `.github/copilot-instructions.md`
- No rompen arquitectura Dual Head (Web + Desktop)
- Mantienen idempotencia de crons

---

**Autor:** GitHub Copilot
**Revisión Requerida:** @usuario (aprobar prioridades)
**Próxima Actualización:** Post-Fase 1 (tras implementar error handling)
```

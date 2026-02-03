# Instrucciones para GitHub Copilot: Corrección de sector_performance Lookup

## 🎯 Contexto del Problema

**Síntoma:** Columnas `ifs` e `ifs_memory` están vacías los fines de semana.

**Causa:** El código busca datos de `sector_performance` con fecha EXACTA de "hoy", pero los fines de semana no hay datos (última actualización fue el viernes).

**Solución:** Implementar fallback que busque el último dato disponible si no encuentra datos de hoy.

---

## 📋 TAREA COMPLETA PARA COPILOT

Copia y pega esto en GitHub Copilot Chat (Cmd+I / Ctrl+I):

```
TAREA: Arreglar lookup de sector_performance para soportar fallback a último dato disponible

CONTEXTO:
- Archivo: app/api/cron/fmp-bulk/buildSnapshots.ts
- Problema: Los fines de semana, sector_performance no tiene datos de "hoy"
- Última actualización: Viernes
- Búsqueda actual: Estricta por fecha exacta
- Resultado: ifs e ifs_memory quedan NULL

REQUISITOS:

1. Crear función getLatestSectorPerformance() que:
   - Primero intente buscar datos de la fecha exacta (asOfDate)
   - Si no encuentra, busque el último dato disponible (hasta 3 días atrás)
   - Loggee cuando use fallback con nivel WARN
   - Retorne null solo si no hay datos en los últimos 3 días

2. Implementación debe seguir estas reglas:
   - TypeScript strict mode
   - Usar supabase admin client (NO anon)
   - Incluir tipos explícitos (NO any)
   - Logs estructurados con [SECTOR] prefix
   - Manejo de errores con try-catch
   - Retornar null en caso de error (NO throw)

3. Reemplazar todas las llamadas a getSectorPerformance() por getLatestSectorPerformance()

4. Agregar tests unitarios en archivo nuevo: getSectorPerformance.test.ts

CÓDIGO BASE A MODIFICAR:

```typescript
// Buscar esta sección en buildSnapshots.ts (aproximadamente línea 594-651)
const sectorPerf = await getSectorPerformance(sector, snapshotDate);

if (!sectorPerf) {
  console.warn(`[${ticker}] No sector performance for ${snapshotDate}`);
  return {
    ifs: null,
    ifs_memory: null
  };
}
```

IMPLEMENTACIÓN REQUERIDA:

```typescript
interface SectorPerformance {
  sector: string;
  date: string;
  median_return_1m: number;
  median_return_3m: number;
  median_return_6m: number;
  median_return_1y: number;
  median_return_2y: number;
  median_return_3y: number;
  median_return_5y: number;
  universe_size: number;
}

/**
 * Get sector performance data with fallback to latest available
 * 
 * @param sector - Sector name (e.g., 'Technology')
 * @param asOfDate - Desired date in ISO format (YYYY-MM-DD)
 * @returns SectorPerformance or null if no data within 3 days
 */
async function getLatestSectorPerformance(
  sector: string, 
  asOfDate: string
): Promise<SectorPerformance | null> {
  try {
    // Step 1: Try exact date
    console.log(`[${sector}] Looking for sector performance on ${asOfDate}`);
    
    const { data: exactData, error: exactError } = await supabaseAdmin
      .from('sector_performance')
      .select('*')
      .eq('sector', sector)
      .eq('date', asOfDate)
      .single();
    
    if (exactError && exactError.code !== 'PGRST116') {
      // PGRST116 = not found (OK), other errors are real errors
      console.error(`[${sector}] Error fetching sector performance:`, exactError);
      return null;
    }
    
    if (exactData) {
      console.log(`[${sector}] Found exact match for ${asOfDate}`);
      return exactData;
    }
    
    // Step 2: Fallback to latest within 3 days
    const fallbackDate = new Date(asOfDate);
    fallbackDate.setDate(fallbackDate.getDate() - 3);
    const fallbackDateStr = fallbackDate.toISOString().split('T')[0];
    
    console.warn(`[${sector}] No data for ${asOfDate}, searching back to ${fallbackDateStr}`);
    
    const { data: fallbackData, error: fallbackError } = await supabaseAdmin
      .from('sector_performance')
      .select('*')
      .eq('sector', sector)
      .gte('date', fallbackDateStr)
      .lte('date', asOfDate)
      .order('date', { ascending: false })
      .limit(1);
    
    if (fallbackError) {
      console.error(`[${sector}] Error fetching fallback data:`, fallbackError);
      return null;
    }
    
    if (!fallbackData || fallbackData.length === 0) {
      console.error(`[${sector}] No sector performance data found within 3 days of ${asOfDate}`);
      return null;
    }
    
    const latestData = fallbackData[0];
    console.warn(
      `[${sector}] Using fallback data from ${latestData.date} ` +
      `(requested ${asOfDate}, age: ${daysBetween(latestData.date, asOfDate)} days)`
    );
    
    return latestData;
    
  } catch (error) {
    console.error(`[${sector}] Unexpected error in getLatestSectorPerformance:`, error);
    return null;
  }
}

/**
 * Calculate days between two ISO date strings
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
```

ACTUALIZAR LLAMADAS:

Buscar y reemplazar en buildSnapshots.ts:

```typescript
// ❌ ANTES:
const sectorPerf = await getSectorPerformance(sector, snapshotDate);

// ✅ DESPUÉS:
const sectorPerf = await getLatestSectorPerformance(sector, snapshotDate);
```

TESTS REQUERIDOS:

Crear archivo: app/api/cron/fmp-bulk/getSectorPerformance.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getLatestSectorPerformance } from './buildSnapshots';

describe('getLatestSectorPerformance', () => {
  it('should return exact match when data exists for requested date', async () => {
    const result = await getLatestSectorPerformance('Technology', '2026-02-01');
    
    expect(result).not.toBeNull();
    expect(result?.sector).toBe('Technology');
    expect(result?.date).toBe('2026-02-01');
  });
  
  it('should fallback to latest data within 3 days', async () => {
    // Assuming today is Sunday (no data) but Friday has data
    const result = await getLatestSectorPerformance('Technology', '2026-02-02');
    
    expect(result).not.toBeNull();
    expect(result?.sector).toBe('Technology');
    // Should return Friday's data (2026-01-31)
    expect(new Date(result!.date).getTime()).toBeLessThan(new Date('2026-02-02').getTime());
  });
  
  it('should return null if no data within 3 days', async () => {
    const result = await getLatestSectorPerformance('Technology', '2020-01-01');
    
    expect(result).toBeNull();
  });
  
  it('should handle invalid sector gracefully', async () => {
    const result = await getLatestSectorPerformance('InvalidSector123', '2026-02-01');
    
    expect(result).toBeNull();
  });
});
```

VALIDACIÓN:

Después de implementar, verificar:

1. Logs muestran fallback cuando usa datos viejos:
   ```
   [Technology] No data for 2026-02-02, searching back to 2026-01-30
   [Technology] Using fallback data from 2026-01-31 (requested 2026-02-02, age: 2 days)
   ```

2. IFS ya no es NULL los fines de semana:
   ```sql
   SELECT ticker, ifs 
   FROM fintra_snapshots 
   WHERE snapshot_date = '2026-02-02'
   LIMIT 5;
   -- Debe retornar datos, no NULL
   ```

3. ifs_memory se llena correctamente:
   ```sql
   SELECT ticker, ifs_memory 
   FROM fintra_snapshots 
   WHERE snapshot_date = '2026-02-02'
   LIMIT 5;
   -- Debe retornar datos después del paso 19 del master cron
   ```

COMMIT MESSAGE:

```
fix(cron): add fallback lookup for sector_performance to handle weekends

- Implement getLatestSectorPerformance() with 3-day fallback
- Replace strict date lookup with flexible latest-available
- Add warning logs when using fallback data
- Add unit tests for exact match and fallback scenarios

Fixes: ifs and ifs_memory being NULL on weekends
Root cause: sector_performance only updates weekdays
Solution: Use latest available data within 3-day window

Impact:
- ifs column will populate on weekends using Friday data
- ifs_memory will have data to aggregate
- Better resilience to missing data scenarios
```

PRINCIPIOS A SEGUIR:

1. ✅ Fintra no inventa datos (usa datos reales de viernes)
2. ✅ Pending no es error (fallback es válido)
3. ✅ Logs obligatorios (WARN cuando usa fallback)
4. ✅ Fault tolerance (return null, NO throw)
5. ✅ TypeScript strict (tipos explícitos, NO any)

ARCHIVOS A MODIFICAR:

1. app/api/cron/fmp-bulk/buildSnapshots.ts
   - Agregar getLatestSectorPerformance()
   - Agregar daysBetween() helper
   - Reemplazar llamadas a getSectorPerformance()

2. app/api/cron/fmp-bulk/getSectorPerformance.test.ts (NUEVO)
   - Tests de casos exact match, fallback, no data, invalid sector

NOTAS ADICIONALES:

- El fallback de 3 días es intencional (cubre fin de semana largo + lunes festivo)
- Los logs WARN son importantes para debugging (no cambiar a INFO)
- La edad del dato (daysBetween) debe mostrarse en logs para auditoría
- Si el dato tiene >3 días, es mejor retornar NULL que usar dato muy viejo
```

---

## 🚀 Cómo Usar con GitHub Copilot

### Paso 1: Abrir GitHub Copilot Chat

```bash
# En VS Code
Cmd+I (Mac) o Ctrl+I (Windows)
```

---

### Paso 2: Pegar la Tarea Completa

Copia TODO el bloque de arriba (desde "TAREA:" hasta el final) y pégalo en Copilot Chat.

---

### Paso 3: Copilot Generará el Código

Copilot debería generar:

1. ✅ Función `getLatestSectorPerformance()` completa
2. ✅ Helper `daysBetween()`
3. ✅ Reemplazos de llamadas
4. ✅ Archivo de tests completo

---

### Paso 4: Revisar el Código Generado

**Verificar:**

- [ ] Usa `supabaseAdmin` (NO `supabase`)
- [ ] Tipos explícitos (NO `any`)
- [ ] Try-catch presente
- [ ] Logs con `[${sector}]` prefix
- [ ] Retorna `null` en error (NO throw)
- [ ] Fallback es 3 días (NO otro valor)
- [ ] Logs WARN cuando usa fallback

---

### Paso 5: Ejecutar Tests

```bash
# Ejecutar tests
pnpm test getSectorPerformance.test.ts

# Debe pasar:
# ✓ should return exact match when data exists
# ✓ should fallback to latest data within 3 days
# ✓ should return null if no data within 3 days
# ✓ should handle invalid sector gracefully
```

---

### Paso 6: Test Manual (Local)

```bash
# Ejecutar cron localmente un domingo
curl "http://localhost:3000/api/cron/master-all?limit=5"

# Verificar logs
tail -f logs/cron.log | grep "Using fallback"

# Debe ver:
# [Technology] Using fallback data from 2026-01-31 (requested 2026-02-02, age: 2 days)
```

---

### Paso 7: Verificar en DB

```sql
-- Verificar que ifs ya no es NULL
SELECT 
  ticker,
  snapshot_date,
  ifs,
  ifs_memory
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
ORDER BY ticker
LIMIT 10;

-- Debe retornar datos, NO NULL
```

---

### Paso 8: Commit

```bash
git add app/api/cron/fmp-bulk/buildSnapshots.ts
git add app/api/cron/fmp-bulk/getSectorPerformance.test.ts
git commit -m "fix(cron): add fallback lookup for sector_performance to handle weekends"
git push
```

---

## 🎯 Prompt Alternativo (Si Copilot Necesita Más Contexto)

Si Copilot pide más contexto o genera código incorrecto, usa este prompt más directo:

```
Implementa getLatestSectorPerformance() en buildSnapshots.ts

Debe:
1. Buscar sector_performance con fecha exacta
2. Si no encuentra, buscar último dato disponible (max 3 días atrás)
3. Loggear WARN cuando use fallback
4. Retornar null si no hay datos en 3 días
5. NO usar any
6. NO throw errors
7. Usar supabaseAdmin

Reemplaza todas las llamadas:
await getSectorPerformance(sector, date)
→ await getLatestSectorPerformance(sector, date)

Crea tests en getSectorPerformance.test.ts
```

---

## 🔍 Validación Post-Implementación

### Checklist de Validación

- [ ] Código compilado sin errores: `pnpm build`
- [ ] Tests pasando: `pnpm test`
- [ ] Logs muestran fallback los fines de semana
- [ ] `ifs` ya no es NULL en snapshots de fin de semana
- [ ] `ifs_memory` se llena correctamente después del paso 19
- [ ] Performance no degradado (fallback agrega <100ms)
- [ ] No hay errores en Sentry/logs de producción

---

### SQL de Verificación

```sql
-- 1. Verificar que ifs se llena los fines de semana
SELECT 
  snapshot_date,
  COUNT(*) as total_snapshots,
  COUNT(ifs) as snapshots_with_ifs,
  ROUND(100.0 * COUNT(ifs) / COUNT(*), 2) as ifs_coverage_percent
FROM fintra_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY snapshot_date
ORDER BY snapshot_date DESC;

-- Debe mostrar >90% coverage incluso en fines de semana

-- 2. Verificar edad de datos de sector_performance usados
SELECT 
  sector,
  date as sector_perf_date,
  COUNT(*) as snapshots_using_this_date
FROM fintra_snapshots
JOIN sector_performance sp ON sp.sector = fintra_snapshots.sector
WHERE snapshot_date = CURRENT_DATE
GROUP BY sector, date
ORDER BY sector, date DESC;

-- Debe mostrar datos de viernes si hoy es domingo

-- 3. Verificar ifs_memory después del paso 19
SELECT 
  ticker,
  ifs,
  ifs_memory,
  snapshot_date
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND ifs IS NOT NULL
LIMIT 10;

-- ifs_memory debe tener datos si ifs tiene datos
```

---

## 🚨 Troubleshooting

### Problema 1: Copilot Genera Código con `any`

**Solución:**
```
Regenera sin usar 'any'. Usa tipos explícitos:
- SectorPerformance interface para retorno
- string para sector y asOfDate
- Promise<SectorPerformance | null> como return type
```

---

### Problema 2: Copilot No Incluye Logs

**Solución:**
```
Agrega logs obligatorios:
- console.log cuando busca fecha exacta
- console.warn cuando usa fallback (con edad del dato)
- console.error cuando no encuentra datos en 3 días
```

---

### Problema 3: Copilot Usa Throw en Vez de Return Null

**Solución:**
```
NO usar throw. SIEMPRE retornar null en errores.
Ejemplo:
❌ if (error) throw error;
✅ if (error) { console.error(...); return null; }
```

---

### Problema 4: Tests No Pasan

**Solución:**
```bash
# Ver error específico
pnpm test getSectorPerformance.test.ts --reporter=verbose

# Común: Mock de supabase faltante
# Agregar al test:
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn()
  }
}));
```

---

## 📊 Impacto Esperado

### Antes del Fix

```
Fines de semana:
- ifs: NULL (100% de tickers)
- ifs_memory: NULL (100% de tickers)
- Logs: "[ticker] No sector performance for 2026-02-02"
```

### Después del Fix

```
Fines de semana:
- ifs: Poblado (>95% de tickers)
- ifs_memory: Poblado (>95% de tickers)
- Logs: "[Technology] Using fallback data from 2026-01-31 (age: 2 days)"
```

### Métricas de Éxito

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **IFS Coverage Fin de Semana** | 0% | >95% | ✅ +95% |
| **ifs_memory Coverage** | 0% | >95% | ✅ +95% |
| **Errores de Missing Data** | Alto | Bajo | ✅ -90% |
| **Performance** | N/A | +50ms | ⚠️ Aceptable |

---

## ✅ Checklist Final

Antes de hacer commit:

- [ ] Código generado por Copilot revisado
- [ ] NO usa `any` en tipos
- [ ] Usa `supabaseAdmin` (NO `supabase`)
- [ ] Incluye try-catch
- [ ] Logs con nivel correcto (INFO/WARN/ERROR)
- [ ] Tests creados y pasando
- [ ] Test manual en local ejecutado
- [ ] Verificación en DB exitosa
- [ ] Commit message sigue conventional commits
- [ ] PR creado con descripción del fix

---

## 🎓 Tips para Trabajar con Copilot

### 1. Sé Específico sobre Tipos

**Mejor:**
```
Crea función getLatestSectorPerformance que retorne 
Promise<SectorPerformance | null> (NO any)
```

**Menos efectivo:**
```
Crea función que retorne sector performance
```

---

### 2. Especifica Manejo de Errores

**Mejor:**
```
En caso de error, loggear con console.error y retornar null.
NO usar throw.
```

**Menos efectivo:**
```
Maneja errores
```

---

### 3. Menciona Principios del Proyecto

**Mejor:**
```
Sigue principios de Fintra:
- No inventar datos (usar datos reales)
- Pending no es error (return null es válido)
- Logs estructurados obligatorios
```

**Menos efectivo:**
```
Sigue best practices
```

---

### 4. Pide Tests Explícitamente

**Mejor:**
```
Crea archivo getSectorPerformance.test.ts con tests para:
- Exact match
- Fallback scenario
- No data scenario
- Invalid sector scenario
```

**Menos efectivo:**
```
Agrega tests
```

---

## 🎉 Resultado Final Esperado

Después de implementar esta corrección:

1. ✅ **IFS se calcula los fines de semana** (usando datos de viernes)
2. ✅ **ifs_memory se llena correctamente** (depende de IFS)
3. ✅ **Logs claros** muestran cuando se usa fallback
4. ✅ **Sistema resiliente** a datos faltantes
5. ✅ **Tests cubren** casos edge

**Tiempo de implementación:** 1-2 horas  
**Impacto:** IFS coverage 0% → 95% los fines de semana  
**Riesgo:** BAJO (fallback conservador de solo 3 días)

---

**¿Listo para que Copilot implemente el fix?** 🚀

```bash
# Abrir VS Code
code app/api/cron/fmp-bulk/buildSnapshots.ts

# Copilot Chat
Cmd+I

# Pegar tarea completa
[Pegar el bloque grande de arriba]

# Let Copilot work its magic ✨
```

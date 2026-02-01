# 🔍 HALLAZGOS DE LA AUDITORÍA - Fintra

**Fecha:** 2026-01-31
**Database:** lvqfmrsvtyoemxfbnwzv.supabase.co
**Snapshots Analizados:** 53,364

---

## 🚨 **HALLAZGO CRÍTICO #1: 100% de Snapshots sin Solvency**

### Descripción
**TODOS los snapshots tienen `fgos_components.solvency = NULL`**

###Estadísticas
```
Total snapshots: 53,364
Con fgos_components: 53,364 (100%)
Solvency calculada: 0 (0%)
Solvency NULL: 53,364 (100%)
Efficiency NULL: 53,364 (100%)
```

### Impacto
- **CRÍTICO**: Ningún snapshot tiene score de solvencia
- El componente de Solvency no se está calculando
- El FGOS Score está incompleto (falta 1 de 4 componentes)

---

## 🔍 **CAUSA RAÍZ IDENTIFICADA**

### Problema #1: Interest Coverage NULL en `datos_financieros`

**Verificación:**
```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE interest_coverage IS NOT NULL) as con_interest_coverage
FROM datos_financieros;
```

**Resultado:**
```
Total: 1,210,992
Con interest_coverage: 0 (0%)
```

**Conclusión:** La columna `interest_coverage` existe pero está completamente VACÍA.

---

### Problema #2: Debt to Equity Parcialmente Disponible

**Verificación:**
```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE debt_to_equity IS NOT NULL) as con_debt_to_equity,
  COUNT(*) FILTER (WHERE period_type = 'TTM') as ttm_registros
FROM datos_financieros;
```

**Resultado:**
```
Total: 1,210,992
Con debt_to_equity: 1,052,915 (86.9%)
Registros TTM: 83,428
```

**Conclusión:** D/E existe en 87% de registros, lo cual es bueno.

---

## 📊 **ESTRUCTURA DE DATOS VALIDADA**

### ✅ Mapeo Correcto en `buildSnapshotsFromLocalData.ts`

```typescript
// Línea 27-28
ratios: {
  debtEquityRatioTTM: fin?.debt_to_equity ? Number(fin.debt_to_equity) : null,
  interestCoverageTTM: fin?.interest_coverage ? Number(fin.interest_coverage) : null,
}
```

**El código de mapeo está CORRECTO**, el problema es que los datos de origen están vacíos.

---

### ✅ Cálculo de Solvency en `fgos-recompute.ts`

```typescript
// Línea ~114-117
const solvencyResult = calculateComponent([
  { value: ratios?.debtEquityRatioTTM, benchmark: (benchmarks as any).debt_to_equity },
  { value: ratios?.interestCoverageTTM, benchmark: (benchmarks as any).interest_coverage }
]);
```

**El código de cálculo está CORRECTO** (después del fix del bug de inversión).

---

## 🔎 **VERIFICACIÓN DE DATOS DE EJEMPLO**

### AAPL (Apple)
```
Ticker: AAPL
Period Type: TTM
debt_to_equity: 2.09 ✅
interest_coverage: NULL ❌
```

### Otros Tickers
```
000001.SZ (Ping An Bank): D/E = EXISTS, Interest Coverage = NULL
000002.SZ: D/E = EXISTS, Interest Coverage = NULL
MSFT: D/E = EXISTS, Interest Coverage = NULL
GOOGL: D/E = EXISTS, Interest Coverage = NULL
```

**Patrón:** D/E existe, pero Interest Coverage es NULL en TODOS los casos.

---

## 🛠️ **DISTRIBUCIÓN DE DATOS**

### `datos_financieros`
```
Total registros: 1,210,992
Registros TTM: 83,428 (6.9%)
Con debt_to_equity: 1,052,915 (86.9%)
Con interest_coverage: 0 (0%)
Con return_on_equity_ttm: 0 (0%)  [columna no existe]
```

### `fintra_snapshots`
```
Total snapshots: 53,364
Snapshots con FGOS: 50,741 (95.1%)
Por fecha:
  - 2026-01-30: ~26,682
  - 2026-01-31: ~26,682

Distribución FGOS Category:
  - High: 384 (0.7%)
  - Medium: 433 (0.8%)
  - Low: 179 (0.3%)
  - Pending: 4 (0.0%)
```

**⚠️ Problema Secundario:** La distribución de categorías FGOS es extremadamente desequilibrada:
- Esperado: High ~25%, Medium ~50%, Low ~25%
- Actual: High ~0.7%, Medium ~0.8%, Low ~0.3%

Esto indica que la mayoría de snapshots NO tienen categoría asignada.

---

## 🔴 **IMPACTO DEL BUG DE SOLVENCY (CORREGIDO EN CÓDIGO)**

### Bug Original
```typescript
// ANTES (INCORRECTO):
const solvencyResult = calculateComponent([
  { value: 100 - (ratios?.debtEquityRatioTTM ?? 0), ... }  // ❌ INVERSIÓN
]);

// DESPUÉS (CORRECTO):
const solvencyResult = calculateComponent([
  { value: ratios?.debtEquityRatioTTM, ... }  // ✅ DIRECTO
]);
```

### Estado Actual
- **Bug de inversión:** ✅ CORREGIDO en código
- **Snapshots afectados:** 0 (porque solvency siempre es NULL)
- **Acción requerida:** No hay nada que reprocesar hasta que se arregle el problema de datos

---

## 🎯 **PROBLEMAS PENDIENTES DE RESOLVER**

### 1. **Interest Coverage Faltante** 🔴 CRÍTICO

**Problema:** La columna `interest_coverage` está vacía en `datos_financieros`.

**Posibles Causas:**
- La API de FMP no devuelve este dato
- El proceso de normalización no está guardando este campo
- La columna no se está poblando correctamente

**Dónde investigar:**
- `app/api/cron/fmp-bulk/normalizeFinancials.ts`
- `app/api/cron/financials-bulk/deriveFinancialMetrics.ts`
- Respuesta raw de FMP API

**Acción:**
1. Verificar si FMP API devuelve `interestCoverageTTM` en el payload
2. Si NO: Calcular manualmente como `EBIT / InterestExpense`
3. Si SÍ: Verificar por qué no se está guardando

---

### 2. **Distribución FGOS Anormal** 🟡 IMPORTANTE

**Problema:** Solo 0.7% High, 0.8% Medium, 0.3% Low

**Esperado:** High ~25%, Medium ~50%, Low ~25%

**Posible Causa:**
- La mayoría de snapshots no tienen `fgos_category` asignada
- Verificar query: `SELECT COUNT(*) FROM fintra_snapshots WHERE fgos_category IS NULL`

---

### 3. **Efficiency También NULL** 🟡 IMPORTANTE

**Hallazgo:** `fgos_components.efficiency` también es NULL en 100% de snapshots.

**Verificar:** ¿Qué métricas necesita `efficiency` para calcularse?

---

## 📋 **PRÓXIMOS PASOS RECOMENDADOS**

### Inmediato (Hoy)

1. **Investigar Interest Coverage**
   ```bash
   # Verificar payload de FMP
   curl "https://financialmodelingprep.com/api/v3/ratios-ttm/AAPL?apikey=XXX"

   # Buscar en código donde se procesa
   grep -r "interestCoverage" app/api/cron/
   ```

2. **Verificar Efficiency**
   ```bash
   # Ver qué métricas necesita
   grep -r "efficiency" lib/engine/fgos-recompute.ts
   ```

3. **Analizar FGOS Category NULL**
   ```sql
   SELECT
     fgos_category,
     COUNT(*)
   FROM fintra_snapshots
   GROUP BY fgos_category;
   ```

---

### Corto Plazo (Esta Semana)

4. **Implementar cálculo de Interest Coverage**
   - Si FMP no lo provee, calcularlo como `EBIT / InterestExpense`
   - Actualizar `normalizeFinancials.ts`

5. **Backfill de datos faltantes**
   - Ejecutar endpoint para recalcular snapshots
   - Validar que solvency se calcula correctamente

6. **Validar FGOS Category**
   - Verificar lógica de asignación
   - Corregir si hay bug

---

### Mediano Plazo (Próximas 2 Semanas)

7. **Auditoría de otras métricas faltantes**
   - ¿Qué otros campos están vacíos?
   - ¿Qué otros componentes de FGOS están incompletos?

8. **Documentar dependencias de datos**
   - Crear mapeo completo de FMP API → DB → Engine
   - Validar que todas las métricas críticas fluyan correctamente

---

## 📊 **RESUMEN EJECUTIVO**

| Componente | Estado | Impacto |
|------------|--------|---------|
| Bug de Solvency Inversión | ✅ CORREGIDO | Bajo (no afecta porque solvency=NULL) |
| Interest Coverage Faltante | 🔴 CRÍTICO | Alto (0% calculado) |
| Efficiency NULL | 🟡 IMPORTANTE | Medio (componente faltante) |
| FGOS Category Desequilibrada | 🟡 IMPORTANTE | Medio (clasificación incorrecta) |
| Debt to Equity | ✅ OK | Ninguno (87% poblado) |
| Mapeo de Datos | ✅ OK | Ninguno (código correcto) |

---

## 🎯 **CONCLUSIÓN**

**El bug de inversión de Solvency que identificamos está CORREGIDO**, pero es un problema "teórico" porque:

1. ✅ El código ahora es correcto
2. ❌ PERO Interest Coverage está 100% vacío
3. ❌ ENTONCES Solvency siempre retorna NULL
4. ❌ RESULTADO: 0 snapshots afectados por el bug, pero 100% sin solvency

**El problema REAL es la falta de datos de `interest_coverage` en `datos_financieros`.**

### Próximo paso crítico:
👉 **Investigar por qué `interest_coverage` está vacío y cómo poblarlo**

---

**Generado por:** Claude Sonnet 4.5
**Fecha:** 2026-01-31
**Archivo:** HALLAZGOS_AUDITORIA.md

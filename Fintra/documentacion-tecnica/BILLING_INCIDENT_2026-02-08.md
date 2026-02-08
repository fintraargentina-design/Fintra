# Incident Report - Supabase Billing Spike (08 Feb 2026)

## Resumen Ejecutivo

**Fecha:** 08 Feb 2026  
**Impacto:** 133.8GB egress spike (overage 4.91GB sobre 250GB incluidos)  
**Causa Root:** Múltiples re-ejecuciones de snapshots bulk con queries no optimizadas  
**Status:** IDENTIFICADO - Pendiente mitigación

---

## Timeline de Eventos

```
08 Feb 2026 - 00:00h: Spike comienza según gráfico Supabase
08 Feb 2026 - ~10:00h: Re-ejecuciones múltiples de 16-fmp-bulk-snapshots.ts
08 Feb 2026 - ~14:00h: Backfill sector-performance ejecutado
08 Feb 2026 - ~15:00h: Auditorías masivas prices_daily (3 iteraciones)
08 Feb 2026 - ~16:00h: Usuario detecta spike en billing dashboard
```

---

## Causa Root Identificada

### Query Sin LIMIT en fetchIndustryPerformanceMap

**Archivo:** `app/api/cron/fmp-bulk/fetchGrowthData.ts` (líneas 228-236)

```typescript
// ❌ PROBLEMA: Lee TODA la tabla sin limit
const { data, error } = await supabase
  .from("industry_performance")
  .select("industry, window_code, return_percent, performance_date")
  .lte("performance_date", today)
  .order("performance_date", { ascending: false });
// NO LIMIT → ~300 industries × 7 windows × 365 días = 766,500 rows
```

**Estimación de datos por ejecución:**

- industry_performance: ~70-100MB (sin limit)
- fintra_universe: ~10MB (88k tickers)
- datos_financieros: ~5-10GB (batch queries)
- datos_valuacion: ~2-3GB (batch queries)
- **Total por ejecución: ~20-30GB**

### Re-ejecuciones Registradas

**Terminal history muestra 6-7 ejecuciones:**

1. ✅ FULL RUN (completado)
2. ✅ MODO INCREMENTAL 43k tickers (completado)
3. ✅ MODO INCREMENTAL 7k tickers (completado)
4. ❌ REINTENTANDO LÓGICA MEJORADA (exit 1 - leyó datos pero falló)
5. ❌ EJECUCIÓN COMPLETA (exit 1 - leyó datos pero falló)
6. ❌ REINTENTANDO UPSERTS OPTIMIZADOS (exit 1 - leyó datos pero falló)
7. ✅ Backfill sector-performance (completado)
8. ✅ Auditorías prices_daily × 3 (completadas)

**Cálculo egress:**

- 6 ejecuciones × 20GB promedio = ~120GB
- 3 auditorías × 5GB promedio = ~15GB
- **Total estimado: ~135GB** ✅ Coincide con spike real (133.8GB)

---

## Queries Problemáticas Adicionales

### 1. fetchIndustryPerformanceMap (CRÍTICO)

```typescript
// ANTES (línea 228):
.select("industry, window_code, return_percent, performance_date")
.lte("performance_date", today)
.order("performance_date", { ascending: false });
// Sin limit → Lee toda la historia

// DEBERÍA SER:
.select("industry, window_code, return_percent, performance_date")
.eq("performance_date", today) // Solo fecha actual
.order("performance_date", { ascending: false });
// O mejor: usar window reciente
```

### 2. fetchFinancialHistory (ALTO IMPACTO)

```typescript
// ANTES (línea 14):
.select("ticker, period_end_date, period_label, revenue, net_income, ...")
.in("ticker", tickers)
.in("period_type", ["FY", "Q", "TTM"])
.order("period_end_date", { ascending: false });
// Sin limit → Lee todos los períodos históricos

// DEBERÍA TENER:
.limit(20) // Por ej: 5 años × 4 Q = 20 períodos max
```

### 3. fetchValuationHistory (ALTO IMPACTO)

```typescript
// ANTES (línea 48):
.select("ticker, valuation_date, pe_ratio, ...")
.in("ticker", tickers)
.order("valuation_date", { ascending: false });
// Sin limit → Lee todos los días históricos

// DEBERÍA TENER:
.limit(10) // Solo últimos 10 datos por ticker
```

### 4. Auditorías prices_daily (MODERADO)

```typescript
// Scripts creados: check-prices-table.ts, audit-prices-daily-coverage.ts
// Problema: Múltiples iteraciones con count queries no optimizados
.select('*', { count: 'exact', head: true });
// Aunque usa head: true, múltiples ejecuciones suman
```

---

## Impacto Financiero

```
Supabase Pro Plan:
├─ Egress incluido: 250 GB
├─ Used in period: 254.91 GB
├─ Overage: 4.91 GB
└─ Spike día 08 Feb: 133.8 GB (53% del período en 1 día)

Costo overage (estimado):
└─ Supabase pricing: ~$0.09/GB overage
└─ 4.91 GB × $0.09 = ~$0.44 adicional
```

**Nota:** Aunque el costo directo es bajo, el consumo de 133GB en 1 día es insostenible para operación diaria.

---

## Mitigaciones Inmediatas

### CRÍTICO - Aplicar ANTES de próxima ejecución

#### 1. Limitar fetchIndustryPerformanceMap

```typescript
// app/api/cron/fmp-bulk/fetchGrowthData.ts (línea 228)
export async function fetchIndustryPerformanceMap(
  supabase: SupabaseClient,
): Promise<Map<string, Map<string, any>>> {
  const today = new Date().toISOString().slice(0, 10);

  console.log("[PREFETCH] Loading industry_performance...");

  const { data, error } = await supabase
    .from("industry_performance")
    .select("industry, window_code, return_percent, performance_date")
    .eq("performance_date", today) // ✅ FIX: Solo fecha actual
    .order("industry", { ascending: true });

  // Reduce de 766k rows → ~2,100 rows (300 industries × 7 windows)
  // Egress: 100MB → 0.2MB (500x reducción)
```

#### 2. Limitar fetchFinancialHistory

```typescript
// app/api/cron/fmp-bulk/fetchGrowthData.ts (línea 14)
const { data, error } = await supabase
  .from("datos_financieros")
  .select("...")
  .in("ticker", tickers)
  .in("period_type", ["FY", "Q", "TTM"])
  .order("period_end_date", { ascending: false })
  .limit(5000); // ✅ FIX: Limitar a 5k rows max por batch
```

#### 3. Limitar fetchValuationHistory

```typescript
// app/api/cron/fmp-bulk/fetchGrowthData.ts (línea 48)
const { data, error } = await supabase
  .from("datos_valuacion")
  .select("...")
  .in("ticker", tickers)
  .order("valuation_date", { ascending: false })
  .limit(1000); // ✅ FIX: Limitar a últimos 1k registros
```

---

## Validación de Fixes

### Test de Egress ANTES vs DESPUÉS

**Ejecutar:**

```bash
npx tsx scripts/test/estimate-egress.ts
```

**Esperado:**

```
ANTES del fix:
├─ industry_performance: ~100MB (766k rows)
├─ datos_financieros: ~5GB (sin limit)
├─ datos_valuacion: ~2GB (sin limit)
└─ Total: ~20-30GB por ejecución

DESPUÉS del fix:
├─ industry_performance: ~0.2MB (2,100 rows)
├─ datos_financieros: ~500MB (limitado)
├─ datos_valuacion: ~100MB (limitado)
└─ Total: ~2-3GB por ejecución (10x reducción)
```

### Verificación Post-Fix

1. Ejecutar snapshots bulk con 10 tickers test:

   ```bash
   npx tsx scripts/pipeline/16-fmp-bulk-snapshots.ts AAPL 10
   ```

2. Monitorear Supabase egress durante ejecución

3. Confirmar egress < 500MB para 10 tickers

4. Proyección para 53k tickers: ~2.5GB (aceptable)

---

## Best Practices Documentadas

### 1. SIEMPRE usar LIMIT en bulk queries

```typescript
// ❌ PROHIBIDO
.select('*')
.order('date', { ascending: false });

// ✅ CORRECTO
.select('field1, field2')
.order('date', { ascending: false })
.limit(1000);
```

### 2. Filtrar por fecha actual cuando sea posible

```typescript
// ❌ PROBLEMA: Lee toda la historia
.lte("performance_date", today)

// ✅ MEJOR: Solo fecha actual
.eq("performance_date", today)
```

### 3. Usar head: true para counts

```typescript
// ✅ CORRECTO
const { count } = await supabase
  .from("table")
  .select("*", { count: "exact", head: true }); // No retorna data
```

### 4. Auditorías en horario off-peak

```typescript
// Ejecutar auditorías masivas solo cuando sea necesario
// Preferir queries incrementales vs full scans
```

### 5. Logging de egress estimado

```typescript
console.log(`[EGRESS] Estimated query size: ~${rows.length * 100} bytes`);
```

---

## Plan de Acción

### Inmediato (Hoy)

- [x] Identificar causa root (fetchIndustryPerformanceMap sin limit)
- [ ] Aplicar Fix #1: Limitar industry_performance query
- [ ] Aplicar Fix #2: Limitar financial history query
- [ ] Aplicar Fix #3: Limitar valuation history query
- [ ] Test con 10 tickers

### Corto Plazo (Esta Semana)

- [ ] Documentar egress estimation en README
- [ ] Agregar logging de egress en cron jobs
- [ ] Crear script de monitoreo billing (alertas)
- [ ] Revisar TODOS los scripts bulk por queries sin limit

### Mediano Plazo (Próximas 2 Semanas)

- [ ] Implementar caching Redis para datos de referencia (universe, sectors)
- [ ] Optimizar pipeline para evitar re-lecturas
- [ ] Considerar materialized views para datos agregados
- [ ] Setup Supabase monitoring dashboard

---

## Lecciones Aprendidas

1. **Queries sin LIMIT son bombas de egress** - Siempre asumir datos masivos
2. **Re-ejecuciones fallidas multiplican el problema** - Implementar lock mechanisms
3. **Auditorías masivas tienen costo real** - Preferir queries incrementales
4. **Billing monitoring es crítico** - Setup alertas automáticas
5. **Test con subsets antes de full runs** - Validar egress en desarrollo

---

## Referencias

- Supabase Egress Pricing: https://supabase.com/docs/guides/platform/org-based-billing
- Query Optimization: https://supabase.com/docs/guides/database/query-performance
- PostgREST Limits: https://postgrest.org/en/stable/api.html#limits-and-pagination

---

**Status:** Incident identificado, fixes pendientes de aplicación  
**Owner:** Dev Team  
**Review Date:** 09 Feb 2026

# Supabase Egress Best Practices

> **CRÍTICO:** El egress (data transfer out) es el mayor costo variable en Supabase. Una query sin optimizar puede generar GBs de egress sin advertencia.

---

## Principios Fundamentales

### 1. SIEMPRE Usar LIMIT en Queries Bulk

```typescript
// ❌ PROHIBIDO - Sin limit
const { data } = await supabase
  .from("large_table")
  .select("*")
  .order("date", { ascending: false });

// ✅ CORRECTO - Con limit explícito
const { data } = await supabase
  .from("large_table")
  .select("field1, field2, field3")
  .order("date", { ascending: false })
  .limit(1000); // Máximo esperado
```

**Razón:** Supabase NO limita automáticamente. Una tabla con 1M rows retornará 1M rows si no especificas limit.

---

### 2. Filtrar por Fecha Actual en Tablas Temporales

```typescript
// ❌ PROBLEMA - Lee toda la historia
const { data } = await supabase
  .from("performance_windows")
  .select("*")
  .lte("as_of_date", today);
// Retorna: 53k tickers × 7 windows × 365 días = 135M rows

// ✅ MEJOR - Solo fecha actual
const { data } = await supabase
  .from("performance_windows")
  .select("ticker, window_code, return_value")
  .eq("as_of_date", today);
// Retorna: 53k × 7 = 371k rows (365× reducción)
```

**Razón:** Tablas con historial temporal crecen exponencialmente. Siempre filtrar por fecha cuando sea posible.

---

### 3. Select Solo Campos Necesarios

```typescript
// ❌ PROBLEMA
const { data } = await supabase
  .from("datos_financieros")
  .select("*")
  .in("ticker", tickers);
// Retorna: ~40 campos × N rows

// ✅ MEJOR
const { data } = await supabase
  .from("datos_financieros")
  .select("ticker, period_end_date, revenue, net_income, roic")
  .in("ticker", tickers)
  .limit(5000);
// Retorna: 5 campos × MAX 5k rows
```

**Razón:** Cada campo adicional multiplica el egress. `select('*')` puede triplicar el tamaño vs select específico.

---

### 4. Usar `head: true` para Counts

```typescript
// ❌ PROBLEMA - Retorna data
const { data } = await supabase.from("huge_table").select("*");
const count = data.length;

// ✅ CORRECTO - Solo count, sin data
const { count } = await supabase
  .from("huge_table")
  .select("*", { count: "exact", head: true });
// head: true → NO retorna rows, solo count metadata
```

**Razón:** `head: true` usa HTTP HEAD request. No transfiere data, solo metadata.

---

### 5. Paginar Queries Grandes Explícitamente

```typescript
// ❌ PROBLEMA - Asume paginación automática
const { data } = await supabase
  .from("fintra_universe")
  .select("ticker, sector");
// PostgREST trunca silenciosamente a 1000 rows

// ✅ CORRECTO - Paginación explícita
const PAGE_SIZE = 1000;
const allRows = [];
let page = 0;
let hasMore = true;

while (hasMore) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data } = await supabase
    .from("fintra_universe")
    .select("ticker, sector")
    .range(from, to)
    .order("ticker", { ascending: true });

  allRows.push(...data);
  hasMore = data.length === PAGE_SIZE;
  page++;
}
```

**Razón:** PostgREST tiene límite server-side (~1000 rows). Si necesitas más, DEBES paginar explícitamente.

---

## Patrones de Queries Optimizadas

### Pattern 1: Bulk Fetch con Límite Explícito

```typescript
export async function fetchRecentData(
  supabase: SupabaseClient,
  tickers: string[],
  maxRecordsPerTicker: number = 20,
) {
  if (!tickers.length) return new Map();

  const TOTAL_LIMIT = tickers.length * maxRecordsPerTicker;

  const { data, error } = await supabase
    .from("datos_financieros")
    .select("ticker, period_end_date, revenue, net_income")
    .in("ticker", tickers)
    .order("period_end_date", { ascending: false })
    .limit(TOTAL_LIMIT); // Explícito

  return groupByTicker(data);
}
```

### Pattern 2: Date-Filtered Aggregates

```typescript
export async function fetchTodayPerformance(
  supabase: SupabaseClient,
  asOfDate: string,
) {
  const { data } = await supabase
    .from("performance_windows")
    .select("ticker, window_code, return_value")
    .eq("as_of_date", asOfDate) // Filtro crítico
    .order("ticker", { ascending: true });

  return data; // ~371k rows (vs 135M sin filtro)
}
```

### Pattern 3: Cached Reference Data

```typescript
// Cache en memoria para datos de referencia
let cachedUniverse: Map<string, any> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

export async function getUniverseMap(supabase: SupabaseClient) {
  const now = Date.now();

  if (cachedUniverse && now - cacheTimestamp < CACHE_TTL_MS) {
    console.log("[CACHE HIT] Using cached universe");
    return cachedUniverse;
  }

  // Fetch con paginación
  cachedUniverse = await fetchUniverseMapPaginated(supabase);
  cacheTimestamp = now;

  return cachedUniverse;
}
```

---

## Estimación de Egress

### Formula Base

```
Egress (MB) = Row Count × Avg Row Size (bytes) / (1024 × 1024)
```

### Tamaños Típicos por Tabla

| Tabla                  | Campos Típicos                 | Avg Row Size | Rows Típicas | Egress sin LIMIT |
| ---------------------- | ------------------------------ | ------------ | ------------ | ---------------- |
| `fintra_universe`      | ticker, sector, industry       | ~150 bytes   | 88,000       | ~13 MB           |
| `datos_financieros`    | 15 campos numéricos            | ~500 bytes   | 5M           | ~2.4 GB          |
| `datos_valuacion`      | ticker, date, 4 ratios         | ~200 bytes   | 20M          | ~3.8 GB          |
| `performance_windows`  | ticker, window, return, date   | ~150 bytes   | 135M         | ~19 GB           |
| `industry_performance` | industry, window, return, date | ~150 bytes   | 766k         | ~110 MB          |
| `sector_performance`   | sector, window, return, date   | ~150 bytes   | 100k         | ~14 MB           |

### Cálculo por Ejecución de Snapshots Bulk

```
Snapshots Bulk (53k tickers):
├─ industry_performance (sin filtro): ~110 MB
├─ fintra_universe (completo): ~13 MB
├─ datos_financieros (530 batches × 100 tickers): ~5 GB
├─ datos_valuacion (530 batches × 100 tickers): ~2 GB
└─ TOTAL: ~7-8 GB

Con múltiples re-ejecuciones:
└─ 6 ejecuciones × 7 GB = ~42 GB
```

---

## Triggers de Alerta

### 🚨 Alerta Crítica (>10 GB/ejecución)

- Query sin LIMIT en tabla >1M rows
- Query con `.lte()` en tabla temporal sin LIMIT
- Select `*` en bulk queries

### ⚠️ Alerta Media (5-10 GB/ejecución)

- Fetch histórico sin LIMIT explícito
- Múltiples batches sin optimizar fields

### ℹ️ Aceptable (<5 GB/ejecución)

- Queries con LIMIT apropiado
- Filtros por fecha actual
- Select campos específicos

---

## Checklist Pre-Deployment

Antes de ejecutar cualquier cron/script bulk, verificar:

- [ ] ✅ Todas las queries tienen LIMIT explícito
- [ ] ✅ Tablas temporales usan `.eq('date', today)` (no `.lte()`)
- [ ] ✅ Select solo campos necesarios (no `*`)
- [ ] ✅ Counts usan `{ head: true }`
- [ ] ✅ Paginación explícita para >1k rows esperados
- [ ] ✅ Test con 10 tickers ANTES de full run
- [ ] ✅ Estimación de egress documentada
- [ ] ✅ Logs incluyen row counts

---

## Tools de Monitoreo

### Script: Estimate Egress Impact

```bash
npx tsx scripts/test/estimate-egress-impact.ts
```

Output esperado:

```
📊 EGRESS PER FULL EXECUTION (53k tickers)
✅ DESPUÉS (con fixes):
   - industry_performance: 0.32 MB
   - fintra_universe: 13.00 MB
   - datos_financieros: 1.20 GB
   - datos_valuacion: 0.50 GB
   📦 TOTAL: 1.71 GB
```

### Script: Validate Fixes

```bash
npx tsx scripts/test/validate-egress-fixes.ts
```

Valida que fixes estén aplicados antes de full run.

---

## Incident Response

### Si detectas spike de egress:

1. **DETENER** ejecuciones inmediatamente
2. Revisar logs de queries ejecutadas hoy
3. Identificar query(s) sin LIMIT
4. Aplicar fixes según patterns de este doc
5. Test con subset (10 tickers)
6. Validar egress <500MB para test
7. Reanudar operación

### Documentar Incident

Usar template: `documentacion-tecnica/BILLING_INCIDENT_YYYY-MM-DD.md`

---

## Referencias

- Supabase Pricing: https://supabase.com/pricing
- PostgREST Limits: https://postgrest.org/en/stable/api.html#limits-and-pagination
- Incident 2026-02-08: `BILLING_INCIDENT_2026-02-08.md`

---

**Última actualización:** 08 Feb 2026  
**Owner:** Dev Team  
**Review:** Mensual

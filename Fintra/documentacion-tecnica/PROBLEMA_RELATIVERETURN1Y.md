# Problema: relativeReturn1Y siempre NULL en scatter chart

## 🔍 Diagnóstico

### Síntoma

Todos los puntos del scatter chart aparecen en `x=0` (performance relativa), haciendo que se apilen verticalmente.

### Causa Raíz

El campo `relativeReturn1Y` está **siempre NULL** porque:

1. **El código intenta leer de una tabla que NO EXISTE**

**En:** `lib/snapshots/buildSnapshotsFromLocalData.ts` (línea 98-104)

```typescript
const { data: perfData } = await supabaseAdmin
  .from("performance_windows") // ❌ TABLA NO EXISTE
  .select("window_code, asset_return, benchmark_return")
  .eq("ticker", ticker)
  .lte("as_of_date", date)
  .order("as_of_date", { ascending: false })
  .in("window_code", windows);
```

2. **La tabla correcta se llama `datos_performance`**

**Migración:** `20260121000000_refactor_performance_lite.sql`

```sql
INSERT INTO datos_performance (
  ticker, performance_date, window_code,
  return_percent, absolute_return, ...
)
```

3. **Hay confusión entre nombres**

- `datos_performance` = Tabla REAL que contiene los retornos calculados
- `performance_windows` = Concepto mencionado en deprecaciones pero NUNCA creado como tabla/view

---

## 📊 Estructura Real de Datos

### Tabla: `datos_performance`

```sql
CREATE TABLE datos_performance (
  ticker TEXT,
  performance_date DATE,
  window_code TEXT,       -- '1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y'
  return_percent NUMERIC, -- Return absoluto del ticker
  absolute_return NUMERIC,
  volatility NUMERIC,     -- NULL en versión lite
  max_drawdown NUMERIC,   -- NULL en versión lite
  source TEXT,
  data_freshness INT,
  PRIMARY KEY (ticker, performance_date, window_code)
);
```

### Problema Adicional: Falta benchmark_return

**Actual:** Solo almacena `return_percent` (retorno absoluto del ticker)
**Requerido:** Necesita `benchmark_return` (retorno del sector) para calcular performance relativa

**Cálculo necesario:**

```typescript
relative_vs_sector_1y = asset_return - benchmark_return;
```

Pero `datos_performance` solo tiene `return_percent` (asset), NO tiene `benchmark_return`.

---

## 🔧 Solución Propuesta

### Opción 1: Migrar a estructura completa (RECOMENDADO)

**Crear tabla/view `performance_windows` con estructura completa:**

```sql
CREATE TABLE performance_windows (
  ticker TEXT,
  as_of_date DATE,
  window_code TEXT,

  -- Retornos absolutos
  asset_return NUMERIC,      -- Return del ticker
  benchmark_return NUMERIC,  -- Return del sector/benchmark
  market_return NUMERIC,     -- Return del mercado general

  -- Retornos relativos (precalculados)
  relative_vs_sector NUMERIC,  -- asset - benchmark
  relative_vs_market NUMERIC,  -- asset - market

  -- Metadatos
  sector TEXT,
  benchmark_ticker TEXT,

  PRIMARY KEY (ticker, as_of_date, window_code)
);

CREATE INDEX idx_perf_windows_ticker_date ON performance_windows(ticker, as_of_date DESC);
CREATE INDEX idx_perf_windows_lookup ON performance_windows(ticker, window_code, as_of_date DESC);
```

**Poblar desde:**

1. `datos_performance` → `asset_return`
2. `sector_performance` (si existe) o calcular en tiempo real
3. Precalcular `relative_vs_sector` = `asset_return - benchmark_return`

### Opción 2: Usar tabla existente y calcular on-the-fly (TEMPORAL)

**Modificar `buildSnapshotsFromLocalData.ts`:**

```typescript
// 1. Fetch asset returns
const { data: assetPerf } = await supabaseAdmin
  .from("datos_performance")
  .select("window_code, return_percent")
  .eq("ticker", ticker)
  .eq("performance_date", date)
  .in("window_code", windows);

// 2. Fetch sector benchmark returns
const { data: sectorPerf } = await supabaseAdmin
  .from("sector_performance") // O calcular dinámicamente
  .select("window_code, return_percent")
  .eq("sector", sector)
  .eq("performance_date", date)
  .in("window_code", windows);

// 3. Compute relative performance
const perfMap = new Map<string, number>();
assetPerf?.forEach((asset) => {
  const benchmark = sectorPerf?.find(
    (s) => s.window_code === asset.window_code,
  );
  if (asset.return_percent != null && benchmark?.return_percent != null) {
    perfMap.set(
      asset.window_code,
      asset.return_percent - benchmark.return_percent,
    );
  }
});
```

---

## ✅ Cambios Inmediatos

### 1. Corregir nombre de tabla en snapshot builder

**Archivo:** `lib/snapshots/buildSnapshotsFromLocalData.ts`

```typescript
// ❌ INCORRECTO (línea 98)
const { data: perfData } = await supabaseAdmin.from("performance_windows"); // NO EXISTE

// ✅ CORRECTO
const { data: perfData } = await supabaseAdmin
  .from("datos_performance")
  .select("window_code, return_percent") // Solo tenemos return, no benchmark
  .eq("ticker", ticker)
  .eq("performance_date", date) // Cambiar de as_of_date a performance_date
  .in("window_code", windows);
```

### 2. Ajustar cálculo (temporal hasta tener benchmarks)

```typescript
// Temporal: usar return absoluto como proxy
// (NO es performance relativa, pero desapila el gráfico)
const perfMap = new Map<string, number>();
if (perfData) {
  perfData.forEach((row: any) => {
    if (!perfMap.has(row.window_code) && row.return_percent != null) {
      perfMap.set(row.window_code, row.return_percent); // Usar absoluto temporalmente
    }
  });
}
```

⚠️ **NOTA:** Esto mostrará retornos absolutos, no relativos al sector.
Es una solución temporal para desapilar el gráfico.

### 3. Plan completo (después de validar lo anterior)

1. ✅ Crear migración para tabla `performance_windows` completa
2. ✅ Poblar con datos históricos (join datos_performance + sector benchmarks)
3. ✅ Actualizar snapshot builder para usar nueva tabla
4. ✅ Agregar índices optimizados
5. ✅ Backfill snapshots con relative performance correcto

---

## 📝 Referencias

**Archivos involucrados:**

- `lib/snapshots/buildSnapshotsFromLocalData.ts` (línea 98-116)
- `supabase/migrations/20260121000000_refactor_performance_lite.sql`
- `supabase/migrations/20260202_deprecate_legacy_columns.sql`

**Tablas relacionadas:**

- `datos_performance` (existe, contiene returns absolutos)
- `performance_windows` (NO existe, código intenta leerla)
- `sector_performance` (verificar si existe)
- `fintra_snapshots.relative_vs_sector_1y` (columna que debe popularse)

---

## 🎯 Próximos Pasos

1. **INMEDIATO:** Cambiar `from('performance_windows')` → `from('datos_performance')`
2. **VALIDAR:** Ver si `datos_performance` tiene datos poblados
3. **DECIDIR:** ¿Crear `performance_windows` completa o calcular on-the-fly?
4. **IMPLEMENTAR:** Solución elegida + migración de datos
5. **BACKFILL:** Re-generar snapshots con datos correctos

---

**Fecha:** 2 de febrero de 2026
**Prioridad:** ALTA (scatter chart inutilizable)

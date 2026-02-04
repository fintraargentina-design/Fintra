# 🛠️ Lista de Scripts de Backfill

Utiliza estos scripts para poblar datos históricos. Se recomienda ejecutarlos en este orden para asegurar dependencias (aunque la mayoría son independientes).

---

## 🔴 CRÍTICOS (Ejecutar primero)

### 1. TTM Valuation (Historical Ratios) 🆕
**Script:** `scripts/backfill/backfill-ttm-valuation.ts`  
**Descripción:** Popula `datos_valuacion_ttm` con ratios históricos (PE, EV/EBITDA, P/S, P/FCF) calculados desde quarterly data.

**Características:**
- Usa motor canónico `computeTTMv2` (single source of truth)
- Procesa en batches automáticos de 100 tickers
- Idempotente: salta tickers ya procesados
- Fault-tolerant: error en 1 ticker no detiene el proceso
- Safety limit: 150ms delay entre tickers

**Uso:**
```bash
# Procesar todos los tickers automáticamente (batches de 100)
npx tsx scripts/backfill/backfill-ttm-valuation.ts

# Procesar solo 1 ticker (testing)
npx tsx scripts/backfill/backfill-ttm-valuation.ts --limit=1

# Procesar ticker específico
npx tsx scripts/backfill/backfill-ttm-valuation.ts AAPL
```

**Output:**
- Tabla: `datos_valuacion_ttm`
- ~40 registros por ticker (depende de data disponible)
- Campos: pe_ratio, ev_ebitda, price_to_sales, price_to_fcf, market_cap, enterprise_value

**Tiempo estimado:**
- 100 tickers: ~15-20 minutos
- 10,000 tickers: ~25-30 horas (ejecutar múltiples veces)

**Data gaps conocidos:**
- EPS/PE: Solo disponible si `weighted_shares_out` existe (~52% cobertura)
- EV/EBITDA: Solo disponible si `cash_and_equivalents` existe (~0% cobertura actualmente)
- Solución: Ver PENDIENTES.md para backfills de cash y shares

---

## 2. Precios Históricos
**Script:** `scripts/backfill-ticker-full.ts`
**Descripción:** Descarga el historial completo de precios (5+ años) para un ticker específico.
**Uso:** `npx tsx scripts/backfill-ticker-full.ts --ticker=AAPL`

## 2. Performance de Sectores
**Script:** `scripts/backfill-sector-performance.ts`
**Descripción:** Backfill de performance sectorial (ventanas históricas) para todos los sectores.
**Uso:** `npx tsx scripts/backfill-sector-performance.ts`

## 3. PE de Sectores
**Script:** `scripts/backfill-sector-pe.ts`
**Descripción:** Histórico de Price-Earnings ratio por sector.
**Uso:** `npx tsx scripts/backfill-sector-pe.ts`

## 4. Performance de Industrias (Full History)
**Script:** `scripts/backfill-industry-performance-historical.ts`
**Descripción:** Backfill completo de performance de industrias mes a mes.
**Uso:** `npx tsx scripts/backfill-industry-performance-historical.ts`

## 5. PE de Industrias
**Script:** `scripts/backfill-industry-pe-historical.ts`
**Descripción:** Histórico de PE por industria.
**Uso:** `npx tsx scripts/backfill-industry-pe-historical.ts`

## 6. Estadísticas Sectoriales
**Script:** `scripts/run-sector-stats-backfill.ts`
**Descripción:** Puntos de datos agregados por sector.
**Uso:** `npx tsx scripts/run-sector-stats-backfill.ts`

---
**Nota:** Asegúrate de tener las variables de entorno configuradas en `.env.local` antes de ejecutar.

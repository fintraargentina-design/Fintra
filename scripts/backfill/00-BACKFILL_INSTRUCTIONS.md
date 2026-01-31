# 🛠️ Lista de Scripts de Backfill

Utiliza estos scripts para poblar datos históricos. Se recomienda ejecutarlos en este orden para asegurar dependencias (aunque la mayoría son independientes).

## 1. Precios Históricos
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

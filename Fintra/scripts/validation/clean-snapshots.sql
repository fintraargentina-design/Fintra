-- ═══════════════════════════════════════════════════════════════
-- CLEAN SNAPSHOTS - Borrar snapshots para forzar recálculo
-- ═══════════════════════════════════════════════════════════════
-- IMPORTANTE: Lee las opciones abajo antes de ejecutar
-- ═══════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────┐
-- │ OPCIÓN 1: Borrar solo snapshots de HOY (RECOMENDADO)       │
-- │ Usa esto si quieres forzar que se recalculen los de hoy    │
-- └─────────────────────────────────────────────────────────────┘

-- PRIMERO: Ver cuántos hay
SELECT COUNT(*) as snapshots_hoy
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE;

-- LUEGO: Borrar (descomenta para ejecutar)
/*
DELETE FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE;
*/

-- ┌─────────────────────────────────────────────────────────────┐
-- │ OPCIÓN 2: Borrar solo snapshots con Solvency NULL          │
-- │ Más conservador - solo borra lo incompleto                 │
-- └─────────────────────────────────────────────────────────────┘

-- PRIMERO: Ver cuántos hay
SELECT COUNT(*) as snapshots_sin_solvency
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NULL;

-- LUEGO: Borrar (descomenta para ejecutar)
/*
DELETE FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NULL;
*/

-- ┌─────────────────────────────────────────────────────────────┐
-- │ OPCIÓN 3: Borrar snapshots de últimos 7 días               │
-- │ Útil si quieres recalcular toda la semana                  │
-- └─────────────────────────────────────────────────────────────┘

-- PRIMERO: Ver cuántos hay
SELECT
  snapshot_date,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE (fgos_components->>'solvency') IS NULL) as sin_solvency
FROM fintra_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY snapshot_date
ORDER BY snapshot_date DESC;

-- LUEGO: Borrar (descomenta para ejecutar)
/*
DELETE FROM fintra_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days';
*/

-- ┌─────────────────────────────────────────────────────────────┐
-- │ VERIFICACIÓN POST-BORRADO                                   │
-- └─────────────────────────────────────────────────────────────┘

-- Verificar que se borraron
SELECT COUNT(*) as snapshots_restantes
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE;

-- Resultado esperado: 0

-- ═══════════════════════════════════════════════════════════════
-- DESPUÉS DE BORRAR
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta el cron job para reconstruir:
--
-- cd D:\FintraDeploy\Fintra
-- npx tsx scripts/pipeline/run-master-cron.ts
--
-- O solo FMP Bulk:
-- npx tsx -e "import('./app/api/cron/fmp-bulk/core.ts').then(m => m.runFmpBulk())"
-- ═══════════════════════════════════════════════════════════════

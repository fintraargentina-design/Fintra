-- ═══════════════════════════════════════════════════════════════
-- QUICK CHECK - Verificación Rápida de Base de Datos
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta este script en Supabase SQL Editor para verificar
-- que todo esté correctamente poblado y calculado
--
-- USO: Copia y pega en Supabase > SQL Editor > Run
-- ═══════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 1. HEALTH CHECK RÁPIDO                                      │
-- └─────────────────────────────────────────────────────────────┘
SELECT * FROM quick_health_check();

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 2. INTEREST COVERAGE STATS                                  │
-- └─────────────────────────────────────────────────────────────┘
SELECT * FROM get_financials_coverage_stats();

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 3. SOLVENCY/EFFICIENCY STATS                                │
-- └─────────────────────────────────────────────────────────────┘
SELECT * FROM get_solvency_stats('2024-01-01');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 4. BUG CHECK                                                │
-- └─────────────────────────────────────────────────────────────┘
SELECT * FROM check_solvency_inversion_bug('2024-01-01');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 5. DISTRIBUCIÓN DETALLADA DE SOLVENCY                       │
-- └─────────────────────────────────────────────────────────────┘
SELECT
  CASE
    WHEN (fgos_components->>'solvency')::FLOAT >= 70 THEN 'High (70-100)'
    WHEN (fgos_components->>'solvency')::FLOAT >= 40 THEN 'Medium (40-69)'
    ELSE 'Low (0-39)'
  END as solvency_band,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage,
  ROUND(AVG((fgos_components->>'solvency')::FLOAT), 2) as avg_solvency,
  ROUND(MIN((fgos_components->>'solvency')::FLOAT), 2) as min_solvency,
  ROUND(MAX((fgos_components->>'solvency')::FLOAT), 2) as max_solvency
FROM fintra_snapshots
WHERE (fgos_components->>'solvency')::FLOAT IS NOT NULL
  AND snapshot_date >= '2024-01-01'
GROUP BY 1
ORDER BY 1;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 6. EJEMPLOS DE DATOS POBLADOS                               │
-- └─────────────────────────────────────────────────────────────┘
SELECT
  ticker,
  period_type,
  ROUND(operating_income::NUMERIC, 0) as operating_income,
  ROUND(interest_expense::NUMERIC, 0) as interest_expense,
  ROUND(interest_coverage::NUMERIC, 2) as interest_coverage,
  ROUND(ebitda::NUMERIC, 0) as ebitda
FROM datos_financieros
WHERE period_type = 'TTM'
  AND interest_coverage IS NOT NULL
ORDER BY ticker
LIMIT 20;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 7. SNAPSHOTS DE HOY CON FGOS COMPLETO                       │
-- └─────────────────────────────────────────────────────────────┘
SELECT
  ticker,
  fgos_score,
  fgos_category,
  ROUND((fgos_components->>'growth')::FLOAT, 2) as growth,
  ROUND((fgos_components->>'profitability')::FLOAT, 2) as profitability,
  ROUND((fgos_components->>'solvency')::FLOAT, 2) as solvency,
  ROUND((fgos_components->>'efficiency')::FLOAT, 2) as efficiency
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND (fgos_components->>'solvency')::FLOAT IS NOT NULL
ORDER BY fgos_score DESC
LIMIT 20;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 8. VERIFICAR QUE NO HAY INVERSIÓN DE SOLVENCY              │
-- └─────────────────────────────────────────────────────────────┘
-- Esta query debe retornar 0 filas si el bug está corregido
SELECT
  fs.ticker,
  fs.snapshot_date,
  ROUND((fs.fgos_components->>'solvency')::FLOAT, 2) as solvency,
  ROUND(df.debt_to_equity::NUMERIC, 2) as debt_to_equity,
  '❌ PROBLEMA: D/E alto con Solvency alto' as warning
FROM fintra_snapshots fs
JOIN datos_financieros df
  ON df.ticker = fs.ticker
  AND df.period_type = 'TTM'
WHERE fs.snapshot_date >= '2024-01-01'
  AND (fs.fgos_components->>'solvency')::FLOAT > 90
  AND df.debt_to_equity > 2.0
LIMIT 10;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 9. RESUMEN POR DÍA (Últimos 7 días)                        │
-- └─────────────────────────────────────────────────────────────┘
SELECT
  snapshot_date,
  COUNT(*) as total_snapshots,
  COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::FLOAT IS NOT NULL) as with_solvency,
  ROUND(AVG((fgos_components->>'solvency')::FLOAT), 2) as avg_solvency,
  ROUND(AVG(fgos_score), 2) as avg_fgos_score,
  COUNT(*) FILTER (WHERE fgos_category = 'High') as high_count,
  COUNT(*) FILTER (WHERE fgos_category = 'Medium') as medium_count,
  COUNT(*) FILTER (WHERE fgos_category = 'Low') as low_count
FROM fintra_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY snapshot_date
ORDER BY snapshot_date DESC;

-- ═══════════════════════════════════════════════════════════════
-- INTERPRETACIÓN DE RESULTADOS
-- ═══════════════════════════════════════════════════════════════
--
-- ✅ TODO BIEN SI:
-- - Health Check: Todos PASS
-- - Interest Coverage: > 80% poblado, promedio 5-15
-- - Solvency: > 80% poblado, promedio 45-65
-- - Distribución: ~25% High, ~50% Medium, ~25% Low
-- - Bug Check: 0 casos
-- - Snapshots de hoy: > 1000 registros
--
-- ⚠️  REVISAR SI:
-- - Interest Coverage: 50-80% poblado
-- - Solvency: 50-80% poblado
-- - Distribución desbalanceada (>60% en una categoría)
-- - Bug Check: 1-10 casos
--
-- ❌ PROBLEMA SI:
-- - Interest Coverage: < 50% poblado
-- - Solvency: < 50% poblado
-- - Bug Check: > 10 casos
-- - Snapshots de hoy: 0 registros
--
-- ═══════════════════════════════════════════════════════════════

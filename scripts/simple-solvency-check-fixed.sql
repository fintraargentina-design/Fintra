-- Análisis simple de impacto del bug de Solvency (CORREGIDO)
-- Solo usa fintra_snapshots

-- 1. Resumen general
SELECT
  'Total snapshots desde 2024' as metrica,
  COUNT(*)::text as valor
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'

UNION ALL

SELECT
  'Snapshots con score de solvency',
  COUNT(*)::text
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NOT NULL

UNION ALL

SELECT
  'Snapshots con solvency > 70',
  COUNT(*)::text
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency')::float > 70

UNION ALL

SELECT
  'Snapshots con solvency > 90 (muy sospechoso)',
  COUNT(*)::text
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency')::float > 90;

-- 2. Top 20 tickers con solvency score más alto
SELECT
  ticker,
  DATE_TRUNC('month', snapshot_date) as mes,
  COUNT(*) as total_snapshots,
  COUNT(CASE WHEN (fgos_components->>'solvency')::float > 90 THEN 1 END) as solvency_muy_alto,
  COUNT(CASE WHEN (fgos_components->>'solvency')::float BETWEEN 70 AND 90 THEN 1 END) as solvency_alto,
  COUNT(CASE WHEN (fgos_components->>'solvency')::float < 50 THEN 1 END) as solvency_bajo
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NOT NULL
GROUP BY ticker, DATE_TRUNC('month', snapshot_date)
ORDER BY solvency_muy_alto DESC, ticker
LIMIT 20;

-- 3. Distribución general de scores
SELECT
  CASE
    WHEN (fgos_components->>'solvency')::float >= 90 THEN '90-100'
    WHEN (fgos_components->>'solvency')::float >= 70 THEN '70-89'
    WHEN (fgos_components->>'solvency')::float >= 50 THEN '50-69'
    WHEN (fgos_components->>'solvency')::float >= 25 THEN '25-49'
    ELSE '0-24'
  END as rango,
  COUNT(*) as cantidad
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NOT NULL
GROUP BY
  CASE
    WHEN (fgos_components->>'solvency')::float >= 90 THEN '90-100'
    WHEN (fgos_components->>'solvency')::float >= 70 THEN '70-89'
    WHEN (fgos_components->>'solvency')::float >= 50 THEN '50-69'
    WHEN (fgos_components->>'solvency')::float >= 25 THEN '25-49'
    ELSE '0-24'
  END
ORDER BY rango DESC;

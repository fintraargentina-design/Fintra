-- Análisis simple de impacto del bug de Solvency
-- Solo usa fintra_snapshots (no requiere datos_financieros)

-- 1. Resumen general de snapshots con datos de solvency
SELECT
  'Total snapshots desde 2024' as metrica,
  COUNT(*) as valor
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'

UNION ALL

SELECT
  'Snapshots con score de solvency',
  COUNT(*)
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NOT NULL

UNION ALL

SELECT
  'Snapshots con solvency > 70 (posiblemente afectados)',
  COUNT(*)
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency')::float > 70;

-- 2. Distribución de scores de solvency
SELECT
  FLOOR((fgos_components->>'solvency')::float / 10) * 10 as rango_inicio,
  FLOOR((fgos_components->>'solvency')::float / 10) * 10 + 10 as rango_fin,
  COUNT(*) as cantidad,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NOT NULL
GROUP BY FLOOR((fgos_components->>'solvency')::float / 10)
ORDER BY rango_inicio DESC;

-- 3. Top 20 tickers con solvency score más alto
SELECT
  ticker,
  MAX(snapshot_date) as ultima_fecha,
  ROUND(AVG((fgos_components->>'solvency')::float), 2) as avg_solvency,
  MAX((fgos_components->>'solvency')::float) as max_solvency,
  COUNT(*) as num_snapshots
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NOT NULL
GROUP BY ticker
ORDER BY avg_solvency DESC
LIMIT 20;

-- 4. Tendencia temporal (por mes)
SELECT
  DATE_TRUNC('month', snapshot_date) as mes,
  COUNT(*) as total_snapshots,
  COUNT(CASE WHEN (fgos_components->>'solvency')::float > 90 THEN 1 END) as solvency_muy_alto,
  COUNT(CASE WHEN (fgos_components->>'solvency')::float BETWEEN 70 AND 90 THEN 1 END) as solvency_alto,
  COUNT(CASE WHEN (fgos_components->>'solvency')::float < 50 THEN 1 END) as solvency_bajo,
  ROUND(AVG((fgos_components->>'solvency')::float), 2) as avg_solvency
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NOT NULL
GROUP BY DATE_TRUNC('month', snapshot_date)
ORDER BY mes DESC;

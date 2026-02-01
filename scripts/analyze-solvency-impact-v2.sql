-- ANÁLISIS DE IMPACTO: Bug de Solvency (Versión Compatible)
-- Identifica cuántos snapshots fueron afectados y su severidad
-- Compatible con diferentes nombres de columna

-- PASO 1: Verificar estructura de datos
SELECT
  COUNT(*) as total_snapshots,
  COUNT(DISTINCT ticker) as total_tickers,
  MIN(snapshot_date) as fecha_mas_antigua,
  MAX(snapshot_date) as fecha_mas_reciente
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01';

-- PASO 2: Verificar snapshots con componente de solvency
SELECT
  COUNT(*) as snapshots_con_solvency,
  COUNT(DISTINCT ticker) as tickers_con_solvency,
  ROUND(AVG((fgos_components->>'solvency')::float), 2) as avg_solvency_score,
  MIN((fgos_components->>'solvency')::float) as min_solvency,
  MAX((fgos_components->>'solvency')::float) as max_solvency
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NOT NULL;

-- PASO 3: Top 20 empresas con solvency score más alto
-- (Posibles candidatos afectados por el bug si tienen deuda alta)
SELECT
  ticker,
  snapshot_date,
  (fgos_components->>'solvency')::float as solvency_score,
  fgos_score,
  fgos_category
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NOT NULL
ORDER BY (fgos_components->>'solvency')::float DESC
LIMIT 20;

-- PASO 4: Distribución de scores de solvency
SELECT
  CASE
    WHEN (fgos_components->>'solvency')::float >= 90 THEN '90-100 (Excelente)'
    WHEN (fgos_components->>'solvency')::float >= 75 THEN '75-89 (Bueno)'
    WHEN (fgos_components->>'solvency')::float >= 50 THEN '50-74 (Medio)'
    WHEN (fgos_components->>'solvency')::float >= 25 THEN '25-49 (Bajo)'
    ELSE '0-24 (Muy bajo)'
  END as rango_solvency,
  COUNT(*) as num_snapshots,
  COUNT(DISTINCT ticker) as num_tickers
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01'
  AND (fgos_components->>'solvency') IS NOT NULL
GROUP BY
  CASE
    WHEN (fgos_components->>'solvency')::float >= 90 THEN '90-100 (Excelente)'
    WHEN (fgos_components->>'solvency')::float >= 75 THEN '75-89 (Bueno)'
    WHEN (fgos_components->>'solvency')::float >= 50 THEN '50-74 (Medio)'
    WHEN (fgos_components->>'solvency')::float >= 25 THEN '25-49 (Bajo)'
    ELSE '0-24 (Muy bajo)'
  END
ORDER BY
  MIN((fgos_components->>'solvency')::float) DESC;

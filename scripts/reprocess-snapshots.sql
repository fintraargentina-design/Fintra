-- Script para identificar y marcar snapshots afectados por el bug de Solvency
-- Ejecutar ANTES de reprocesar

-- 1. Identificar snapshots con Solvency score sospechosamente alto
-- (Empresas con D/E > 2.0 pero solvency score > 90)
SELECT
  fs.ticker,
  fs.snapshot_date,
  fs.fgos_score,
  (fs.fgos_components->>'solvency')::float as solvency_score,
  df.debt_equity_ratio as actual_de_ratio,
  CASE
    WHEN df.debt_equity_ratio > 2.0 AND (fs.fgos_components->>'solvency')::float > 90
    THEN '🔴 AFECTADO POR BUG'
    WHEN df.debt_equity_ratio > 1.5 AND (fs.fgos_components->>'solvency')::float > 85
    THEN '🟠 POSIBLEMENTE AFECTADO'
    ELSE '✅ OK'
  END as status
FROM fintra_snapshots fs
JOIN datos_financieros df ON df.ticker = fs.ticker
  AND df.period_type = 'FY'
  AND df.period_label = (
    SELECT MAX(period_label)
    FROM datos_financieros
    WHERE ticker = fs.ticker AND period_type = 'FY'
  )
WHERE fs.snapshot_date >= '2024-01-01'
  AND (fs.fgos_components->>'solvency') IS NOT NULL
ORDER BY
  CASE
    WHEN df.debt_equity_ratio > 2.0 AND (fs.fgos_components->>'solvency')::float > 90 THEN 1
    WHEN df.debt_equity_ratio > 1.5 AND (fs.fgos_components->>'solvency')::float > 85 THEN 2
    ELSE 3
  END,
  fs.snapshot_date DESC
LIMIT 100;

-- 2. Contar total de snapshots afectados
SELECT
  COUNT(*) as total_afectados,
  MIN(snapshot_date) as primera_fecha,
  MAX(snapshot_date) as ultima_fecha
FROM fintra_snapshots fs
JOIN datos_financieros df ON df.ticker = fs.ticker
WHERE fs.snapshot_date >= '2024-01-01'
  AND df.debt_equity_ratio > 1.5
  AND (fs.fgos_components->>'solvency')::float > 80;

-- 3. OPCIONAL: Marcar snapshots para reprocesar
-- Descomenta si quieres agregar un flag
/*
ALTER TABLE fintra_snapshots ADD COLUMN IF NOT EXISTS needs_reprocess BOOLEAN DEFAULT FALSE;

UPDATE fintra_snapshots fs
SET needs_reprocess = TRUE
WHERE EXISTS (
  SELECT 1 FROM datos_financieros df
  WHERE df.ticker = fs.ticker
    AND df.debt_equity_ratio > 1.5
    AND (fs.fgos_components->>'solvency')::float > 80
);
*/

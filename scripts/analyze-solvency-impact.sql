-- ANÁLISIS DE IMPACTO: Bug de Solvency
-- Identifica cuántos snapshots fueron afectados y su severidad

-- PASO 1: Resumen ejecutivo
WITH affected AS (
  SELECT
    fs.ticker,
    fs.snapshot_date,
    (fs.fgos_components->>'solvency')::float as solvency_score,
    df.debt_equity_ratio as actual_de_ratio,
    fs.fgos_score as current_fgos_score,
    CASE
      WHEN df.debt_equity_ratio > 3.0 THEN 'CRÍTICO'
      WHEN df.debt_equity_ratio > 2.0 THEN 'ALTO'
      WHEN df.debt_equity_ratio > 1.5 THEN 'MEDIO'
      ELSE 'BAJO'
    END as risk_level
  FROM fintra_snapshots fs
  JOIN LATERAL (
    SELECT debt_equity_ratio
    FROM datos_financieros
    WHERE ticker = fs.ticker
      AND period_type = 'FY'
    ORDER BY period_end_date DESC
    LIMIT 1
  ) df ON TRUE
  WHERE fs.snapshot_date >= '2024-01-01'
    AND (fs.fgos_components->>'solvency') IS NOT NULL
    AND df.debt_equity_ratio > 1.5
    AND (fs.fgos_components->>'solvency')::float > 70
)
SELECT
  risk_level,
  COUNT(*) as num_snapshots,
  COUNT(DISTINCT ticker) as num_tickers,
  ROUND(AVG(solvency_score), 2) as avg_solvency_score,
  ROUND(AVG(actual_de_ratio), 2) as avg_debt_ratio,
  ROUND(AVG(current_fgos_score), 2) as avg_fgos_score
FROM affected
GROUP BY risk_level
ORDER BY
  CASE risk_level
    WHEN 'CRÍTICO' THEN 1
    WHEN 'ALTO' THEN 2
    WHEN 'MEDIO' THEN 3
    ELSE 4
  END;

-- PASO 2: Top 20 casos más severos
SELECT
  fs.ticker,
  fs.snapshot_date,
  df.debt_equity_ratio as de_ratio,
  (fs.fgos_components->>'solvency')::float as bug_solvency_score,
  fs.fgos_score as bug_fgos_score,
  -- Estimación del score correcto (invertido)
  ROUND(100 - (fs.fgos_components->>'solvency')::float, 2) as estimated_correct_solvency,
  CASE
    WHEN df.debt_equity_ratio > 3.0 THEN '🔴 CRÍTICO'
    WHEN df.debt_equity_ratio > 2.0 THEN '🟠 ALTO'
    ELSE '🟡 MEDIO'
  END as severity
FROM fintra_snapshots fs
JOIN LATERAL (
  SELECT debt_equity_ratio
  FROM datos_financieros
  WHERE ticker = fs.ticker
    AND period_type = 'FY'
  ORDER BY period_end_date DESC
  LIMIT 1
) df ON TRUE
WHERE fs.snapshot_date >= '2024-01-01'
  AND df.debt_equity_ratio > 1.5
  AND (fs.fgos_components->>'solvency')::float > 70
ORDER BY df.debt_equity_ratio DESC, fs.snapshot_date DESC
LIMIT 20;

-- PASO 3: Rango de fechas afectadas
SELECT
  MIN(snapshot_date) as primera_fecha_afectada,
  MAX(snapshot_date) as ultima_fecha_afectada,
  COUNT(DISTINCT snapshot_date) as num_fechas_unicas,
  COUNT(*) as total_snapshots_afectados,
  COUNT(DISTINCT ticker) as total_tickers_afectados
FROM fintra_snapshots fs
WHERE EXISTS (
  SELECT 1 FROM datos_financieros df
  WHERE df.ticker = fs.ticker
    AND df.debt_equity_ratio > 1.5
    AND (fs.fgos_components->>'solvency')::float > 70
);

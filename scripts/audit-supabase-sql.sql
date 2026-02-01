-- ═══════════════════════════════════════════════════════════
-- AUDITORÍA DE TABLAS SUPABASE - FINTRA
-- Database: lvqfmrsvtyoemxfbnwzv.supabase.co
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- NIVEL 1: DATOS BASE
-- ═══════════════════════════════════════════════════════════

-- 1.1 Company Profiles
SELECT
  '📊 company_profiles' as tabla,
  COUNT(*) as total_registros,
  COUNT(DISTINCT sector) as sectores_unicos,
  COUNT(DISTINCT exchange) as exchanges_unicos,
  COUNT(*) FILTER (WHERE sector IS NOT NULL) as con_sector,
  ROUND(100.0 * COUNT(*) FILTER (WHERE sector IS NOT NULL) / COUNT(*), 2) as pct_con_sector
FROM company_profiles;

-- 1.2 Datos Financieros
SELECT
  '💰 datos_financieros' as tabla,
  COUNT(*) as total_registros,
  COUNT(DISTINCT symbol) as tickers_unicos,
  MAX(date) as fecha_mas_reciente,
  MIN(date) as fecha_mas_antigua,
  COUNT(*) FILTER (WHERE return_on_equity_ttm IS NOT NULL) as con_roe,
  COUNT(*) FILTER (WHERE debt_to_equity_ttm IS NOT NULL) as con_debt_equity,
  ROUND(100.0 * COUNT(*) FILTER (WHERE debt_to_equity_ttm IS NOT NULL) / COUNT(*), 2) as pct_con_de
FROM datos_financieros;

-- 1.3 Datos Performance
SELECT
  '📈 datos_performance' as tabla,
  COUNT(*) as total_registros,
  COUNT(DISTINCT symbol) as tickers_unicos,
  MAX(date) as fecha_mas_reciente,
  MIN(date) as fecha_mas_antigua
FROM datos_performance;

-- ═══════════════════════════════════════════════════════════
-- NIVEL 2: CLASIFICACIÓN Y BENCHMARKS
-- ═══════════════════════════════════════════════════════════

-- 2.1 Sector Benchmarks
SELECT
  '🎯 sector_benchmarks' as tabla,
  COUNT(*) as total_registros,
  COUNT(DISTINCT sector) as sectores_unicos,
  MAX(updated_at) as ultima_actualizacion,
  COUNT(*) FILTER (WHERE confidence = 'high') as alta_confianza,
  COUNT(*) FILTER (WHERE confidence = 'medium') as media_confianza,
  COUNT(*) FILTER (WHERE confidence = 'low') as baja_confianza
FROM sector_benchmarks;

-- 2.2 Distribución de benchmarks por sector
SELECT
  sector,
  COUNT(*) as metricas_disponibles,
  COUNT(*) FILTER (WHERE confidence = 'high') as alta_confianza
FROM sector_benchmarks
GROUP BY sector
ORDER BY metricas_disponibles DESC;

-- 2.3 Industry Classification
SELECT
  '🏭 industry_classification' as tabla,
  COUNT(*) as total_clasificaciones,
  COUNT(DISTINCT industry_name) as industrias_unicas,
  COUNT(DISTINCT sector_name) as sectores_unicos
FROM industry_classification;

-- ═══════════════════════════════════════════════════════════
-- NIVEL 4: SNAPSHOTS (CRÍTICO)
-- ═══════════════════════════════════════════════════════════

-- 4.1 Fintra Snapshots - Resumen General
SELECT
  '⭐ fintra_snapshots' as tabla,
  COUNT(*) as total_snapshots,
  COUNT(DISTINCT ticker) as tickers_unicos,
  MAX(snapshot_date) as snapshot_mas_reciente,
  MIN(snapshot_date) as snapshot_mas_antiguo,
  COUNT(*) FILTER (WHERE fgos_score IS NOT NULL) as con_fgos_score,
  ROUND(100.0 * COUNT(*) FILTER (WHERE fgos_score IS NOT NULL) / COUNT(*), 2) as pct_con_fgos
FROM fintra_snapshots;

-- 4.2 Snapshots de Hoy
SELECT
  CURRENT_DATE as fecha,
  COUNT(*) as snapshots_hoy,
  COUNT(*) FILTER (WHERE fgos_score IS NOT NULL) as con_fgos,
  COUNT(*) FILTER (WHERE fgos_category = 'High') as high,
  COUNT(*) FILTER (WHERE fgos_category = 'Medium') as medium,
  COUNT(*) FILTER (WHERE fgos_category = 'Low') as low,
  COUNT(*) FILTER (WHERE fgos_category = 'Pending') as pending
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE;

-- 4.3 Distribución de Categorías FGOS
SELECT
  fgos_category,
  COUNT(*) as cantidad,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as porcentaje,
  ROUND(AVG(fgos_score), 2) as score_promedio
FROM fintra_snapshots
WHERE fgos_category IS NOT NULL
GROUP BY fgos_category
ORDER BY
  CASE fgos_category
    WHEN 'High' THEN 1
    WHEN 'Medium' THEN 2
    WHEN 'Low' THEN 3
    WHEN 'Pending' THEN 4
  END;

-- 4.4 Distribución de Status
SELECT
  fgos_status,
  COUNT(*) as cantidad,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as porcentaje
FROM fintra_snapshots
WHERE fgos_status IS NOT NULL
GROUP BY fgos_status
ORDER BY cantidad DESC;

-- ═══════════════════════════════════════════════════════════
-- 🔴 ANÁLISIS CRÍTICO: SOLVENCY BUG
-- ═══════════════════════════════════════════════════════════

-- 5.1 Análisis de Solvency Scores (Detectar afectados por bug)
SELECT
  '🔍 Análisis de Solvency' as analisis,
  COUNT(*) as total_con_solvency,
  COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric > 90) as muy_alto_90_plus,
  COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric BETWEEN 70 AND 90) as alto_70_90,
  COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric BETWEEN 50 AND 70) as medio_50_70,
  COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric < 50) as bajo_menos_50,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric > 90) / COUNT(*), 2) as pct_afectados_criticos
FROM fintra_snapshots
WHERE fgos_components ? 'solvency'
  AND fgos_components->>'solvency' IS NOT NULL;

-- 5.2 Top 20 Tickers con Solvency > 90 (Altamente sospechosos)
SELECT
  ticker,
  snapshot_date,
  (fgos_components->>'solvency')::numeric as solvency_score,
  fgos_score,
  fgos_category,
  sector
FROM fintra_snapshots
WHERE fgos_components ? 'solvency'
  AND (fgos_components->>'solvency')::numeric > 90
ORDER BY (fgos_components->>'solvency')::numeric DESC
LIMIT 20;

-- 5.3 Snapshots afectados por rango de fechas
SELECT
  snapshot_date,
  COUNT(*) as total_snapshots,
  COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric > 90) as solvency_gt_90,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric > 90) / COUNT(*), 2) as pct_afectados
FROM fintra_snapshots
WHERE fgos_components ? 'solvency'
  AND snapshot_date >= '2024-01-01'
GROUP BY snapshot_date
HAVING COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric > 90) > 0
ORDER BY snapshot_date DESC
LIMIT 30;

-- ═══════════════════════════════════════════════════════════
-- VALIDACIÓN DE INTEGRIDAD (DEPENDENCIAS)
-- ═══════════════════════════════════════════════════════════

-- 6.1 Snapshots sin company_profile
SELECT
  'Snapshots sin company_profile' as validacion,
  COUNT(DISTINCT fs.ticker) as tickers_huerfanos
FROM fintra_snapshots fs
LEFT JOIN company_profiles cp ON fs.ticker = cp.symbol
WHERE cp.symbol IS NULL;

-- 6.2 Snapshots sin datos_financieros
SELECT
  'Snapshots sin datos_financieros' as validacion,
  COUNT(DISTINCT fs.ticker) as tickers_sin_financials
FROM fintra_snapshots fs
LEFT JOIN datos_financieros df ON fs.ticker = df.symbol
WHERE df.symbol IS NULL
  AND fs.snapshot_date >= CURRENT_DATE - INTERVAL '30 days';

-- 6.3 Company_profiles sin sector
SELECT
  'Company profiles sin sector' as validacion,
  COUNT(*) as cantidad,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM company_profiles), 2) as porcentaje
FROM company_profiles
WHERE sector IS NULL OR sector = '';

-- ═══════════════════════════════════════════════════════════
-- ANÁLISIS DE COBERTURA TEMPORAL
-- ═══════════════════════════════════════════════════════════

-- 7.1 Snapshots por mes (últimos 6 meses)
SELECT
  TO_CHAR(snapshot_date, 'YYYY-MM') as mes,
  COUNT(*) as total_snapshots,
  COUNT(DISTINCT ticker) as tickers_unicos,
  COUNT(*) FILTER (WHERE fgos_score IS NOT NULL) as con_fgos,
  ROUND(AVG(fgos_score), 2) as fgos_promedio
FROM fintra_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY TO_CHAR(snapshot_date, 'YYYY-MM')
ORDER BY mes DESC;

-- 7.2 Últimas 10 fechas de snapshot
SELECT
  snapshot_date,
  COUNT(*) as snapshots,
  COUNT(DISTINCT ticker) as tickers,
  COUNT(*) FILTER (WHERE fgos_category = 'High') as high,
  COUNT(*) FILTER (WHERE fgos_category = 'Medium') as medium,
  COUNT(*) FILTER (WHERE fgos_category = 'Low') as low
FROM fintra_snapshots
GROUP BY snapshot_date
ORDER BY snapshot_date DESC
LIMIT 10;

-- ═══════════════════════════════════════════════════════════
-- ESTADÍSTICAS DE SCORES
-- ═══════════════════════════════════════════════════════════

-- 8.1 Distribución de FGOS Scores
SELECT
  CASE
    WHEN fgos_score >= 80 THEN '80-100 (Excelente)'
    WHEN fgos_score >= 60 THEN '60-79 (Bueno)'
    WHEN fgos_score >= 40 THEN '40-59 (Medio)'
    WHEN fgos_score >= 20 THEN '20-39 (Bajo)'
    ELSE '0-19 (Muy Bajo)'
  END as rango_fgos,
  COUNT(*) as cantidad,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as porcentaje
FROM fintra_snapshots
WHERE fgos_score IS NOT NULL
GROUP BY
  CASE
    WHEN fgos_score >= 80 THEN '80-100 (Excelente)'
    WHEN fgos_score >= 60 THEN '60-79 (Bueno)'
    WHEN fgos_score >= 40 THEN '40-59 (Medio)'
    WHEN fgos_score >= 20 THEN '20-39 (Bajo)'
    ELSE '0-19 (Muy Bajo)'
  END
ORDER BY rango_fgos DESC;

-- 8.2 Top 10 Sectores por FGOS promedio
SELECT
  sector,
  COUNT(*) as snapshots,
  ROUND(AVG(fgos_score), 2) as fgos_promedio,
  ROUND(AVG((fgos_components->>'growth')::numeric), 2) as growth_promedio,
  ROUND(AVG((fgos_components->>'profitability')::numeric), 2) as profitability_promedio,
  ROUND(AVG((fgos_components->>'solvency')::numeric), 2) as solvency_promedio
FROM fintra_snapshots
WHERE fgos_score IS NOT NULL
  AND sector IS NOT NULL
  AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY sector
HAVING COUNT(*) >= 10
ORDER BY fgos_promedio DESC
LIMIT 10;

-- ═══════════════════════════════════════════════════════════
-- RESUMEN EJECUTIVO
-- ═══════════════════════════════════════════════════════════

SELECT
  '═══════════════════════════════════════════' as separador,
  'RESUMEN EJECUTIVO' as titulo,
  '═══════════════════════════════════════════' as separador2
UNION ALL
SELECT
  'Total Companies' as metrica,
  (SELECT COUNT(*)::text FROM company_profiles),
  ''
UNION ALL
SELECT
  'Total Snapshots',
  (SELECT COUNT(*)::text FROM fintra_snapshots),
  ''
UNION ALL
SELECT
  'Snapshots con FGOS',
  (SELECT COUNT(*)::text FROM fintra_snapshots WHERE fgos_score IS NOT NULL),
  (SELECT CONCAT(ROUND(100.0 * COUNT(*) FILTER (WHERE fgos_score IS NOT NULL) / COUNT(*), 1), '%') FROM fintra_snapshots)
UNION ALL
SELECT
  'Último snapshot',
  (SELECT MAX(snapshot_date)::text FROM fintra_snapshots),
  ''
UNION ALL
SELECT
  '🔴 Afectados por bug Solvency >90',
  (SELECT COUNT(*)::text FROM fintra_snapshots WHERE (fgos_components->>'solvency')::numeric > 90),
  (SELECT CONCAT(ROUND(100.0 * COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric > 90) / COUNT(*), 1), '%')
   FROM fintra_snapshots WHERE fgos_components ? 'solvency')
UNION ALL
SELECT
  '🟡 Afectados moderados 70-90',
  (SELECT COUNT(*)::text FROM fintra_snapshots WHERE (fgos_components->>'solvency')::numeric BETWEEN 70 AND 90),
  (SELECT CONCAT(ROUND(100.0 * COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric BETWEEN 70 AND 90) / COUNT(*), 1), '%')
   FROM fintra_snapshots WHERE fgos_components ? 'solvency');

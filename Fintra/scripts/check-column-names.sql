-- Verificar nombres de columnas en datos_financieros
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'datos_financieros'
  AND column_name LIKE '%debt%'
ORDER BY column_name;

-- Ver una muestra de datos
SELECT ticker, period_label, period_type,
       -- Probar diferentes posibles nombres
       COALESCE(
         debt_equity_ratio,
         debt_to_equity_ratio,
         debtequityratio
       ) as debt_ratio
FROM datos_financieros
WHERE period_type = 'FY'
LIMIT 5;

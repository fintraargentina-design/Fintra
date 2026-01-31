-- Verificar si las funciones de advisory lock ya existen

SELECT
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE
    WHEN p.proname IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('pg_try_advisory_lock', 'pg_advisory_unlock')
ORDER BY p.proname;

-- Si retorna 0 filas, necesitas ejecutar la migración
-- Si retorna 2 filas, la migración ya está aplicada

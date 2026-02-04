# 🔍 CÓMO VALIDAR QUE LA BASE DE DATOS ESTÁ BIEN CARGADA

**Última actualización:** 1 de Febrero de 2026

---

## 📋 RESUMEN RÁPIDO

Hay **3 formas** de validar que la base de datos está correctamente poblada:

1. **Script automatizado** (más completo) - 5 minutos
2. **Queries SQL en Supabase** (manual) - 2 minutos
3. **Funciones de validación** (más rápido) - 30 segundos

---

## ✅ MÉTODO 1: Script Automatizado (Recomendado)

### Ejecutar el script de validación completa:

```bash
cd D:\FintraDeploy\Fintra
npx tsx scripts/validation/validate-solvency-fix.ts
```

### Qué verifica este script:

1. ✅ **Interest Coverage** está poblado (> 80%)
2. ✅ **Solvency** está calculado (> 80%)
3. ✅ **Efficiency** está calculado (> 80%)
4. ✅ **Distribución normal** de Solvency (25% High, 50% Medium, 25% Low)
5. ✅ **Bug de inversión** corregido (D/E alto ≠ Solvency alto)
6. ✅ **FGOS scores** razonables (promedio 45-65)
7. ✅ **Categorías** asignadas (> 95%)

### Resultado esperado:

```
╔═══════════════════════════════════════════════════════════════╗
║                  ✅ TODAS LAS VALIDACIONES PASARON            ║
╚═══════════════════════════════════════════════════════════════╝

✅ La base de datos está correctamente poblada y calculada
✅ interest_coverage tiene valores razonables
✅ Solvency y Efficiency están calculados correctamente
✅ FGOS scores son razonables
✅ No se detectaron datos anormales

🎉 El sistema está listo para producción
```

### Si algo falla:

El script te dirá **exactamente** qué está mal:

- ❌ FALLO: Descripción del problema
- ⚠️ WARNING: Advertencia pero no crítico
- ✅ PASS: Todo bien

---

## ✅ MÉTODO 2: Queries SQL en Supabase

### Paso 1: Aplicar migración de funciones de validación

Primero, ejecuta la migración para crear las funciones:

```bash
# En Supabase Dashboard > SQL Editor, ejecuta:
# Contenido de: supabase/migrations/20260201000000_add_validation_functions.sql
```

O aplica automáticamente:

```bash
cd D:\FintraDeploy\Fintra
supabase db push
```

### Paso 2: Ejecutar Quick Check

En **Supabase > SQL Editor**, copia y pega el contenido de:

```
scripts/validation/quick-check.sql
```

Luego presiona **Run**.

### Qué verás:

#### 1. Health Check (30 segundos)

```sql
SELECT * FROM quick_health_check();
```

| check_name | status | value | passed |
|------------|--------|-------|--------|
| Interest Coverage | PASS | 85.3% | true |
| Solvency Populated | PASS | 92.1% | true |
| Solvency Bug Check | PASS | 0 cases | true |
| Today Snapshots | PASS | 8234 | true |

**✅ TODO BIEN:** Todos los checks dicen "PASS"

**⚠️ REVISAR:** Algún check dice "WARNING"

**❌ PROBLEMA:** Algún check dice "FAIL"

#### 2. Interest Coverage Stats

```sql
SELECT * FROM get_financials_coverage_stats();
```

**Valores esperados:**
- `pct_interest_coverage`: > 80%
- `avg_interest_coverage`: 5-15
- `median_interest_coverage`: 3-10

#### 3. Solvency Stats

```sql
SELECT * FROM get_solvency_stats('2024-01-01');
```

**Valores esperados:**
- `pct_solvency`: > 80%
- `avg_solvency`: 45-65
- `high_count` / `medium_count` / `low_count`: ~25% / ~50% / ~25%

#### 4. Bug Check

```sql
SELECT * FROM check_solvency_inversion_bug('2024-01-01');
```

**Valores esperados:**
- `count`: **0** (cero problemas)
- Si count > 0: Bug de inversión aún presente ❌

---

## ✅ MÉTODO 3: Queries Manuales Simples

Si no quieres usar los scripts, aquí están las queries críticas:

### Query 1: ¿Está poblado interest_coverage?

```sql
SELECT
  COUNT(*) as total,
  COUNT(interest_coverage) as poblado,
  ROUND(COUNT(interest_coverage) * 100.0 / COUNT(*), 2) as porcentaje
FROM datos_financieros
WHERE period_type = 'TTM';
```

**✅ Esperado:** `porcentaje` > 80%

### Query 2: ¿Está calculado Solvency?

```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::FLOAT IS NOT NULL) as con_solvency,
  ROUND(COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::FLOAT IS NOT NULL) * 100.0 / COUNT(*), 2) as porcentaje
FROM fintra_snapshots
WHERE snapshot_date >= '2024-01-01';
```

**✅ Esperado:** `porcentaje` > 80%

### Query 3: ¿Distribución normal de Solvency?

```sql
SELECT
  CASE
    WHEN (fgos_components->>'solvency')::FLOAT >= 70 THEN 'High'
    WHEN (fgos_components->>'solvency')::FLOAT >= 40 THEN 'Medium'
    ELSE 'Low'
  END as banda,
  COUNT(*) as cantidad,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM fintra_snapshots
WHERE (fgos_components->>'solvency')::FLOAT IS NOT NULL
  AND snapshot_date >= '2024-01-01'
GROUP BY 1
ORDER BY 1;
```

**✅ Esperado:**
- High: ~20-30%
- Medium: ~45-55%
- Low: ~20-30%

### Query 4: ¿Bug de inversión corregido?

```sql
SELECT COUNT(*) as problemas
FROM fintra_snapshots fs
JOIN datos_financieros df
  ON df.ticker = fs.ticker
  AND df.period_type = 'TTM'
WHERE fs.snapshot_date >= '2024-01-01'
  AND (fs.fgos_components->>'solvency')::FLOAT > 90
  AND df.debt_to_equity > 2.0;
```

**✅ Esperado:** `problemas` = **0**

### Query 5: ¿Hay snapshots de hoy?

```sql
SELECT COUNT(*) as snapshots_hoy
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE;
```

**✅ Esperado:** `snapshots_hoy` > 1000

---

## 🎯 CÓMO SABER SI TODO ESTÁ BIEN

### ✅ SEÑALES DE QUE TODO ESTÁ CORRECTO:

1. **Interest Coverage**
   - ✅ > 80% de registros TTM tienen `interest_coverage`
   - ✅ Promedio entre 5-15
   - ✅ Sin valores absurdos (< -100 o > 100)

2. **Solvency**
   - ✅ > 80% de snapshots tienen Solvency calculado
   - ✅ Promedio entre 45-65
   - ✅ Distribución razonable (~25% High, ~50% Medium, ~25% Low)

3. **Efficiency**
   - ✅ > 80% de snapshots tienen Efficiency calculado
   - ✅ Promedio entre 45-65

4. **FGOS Categories**
   - ✅ > 95% de snapshots tienen categoría asignada
   - ✅ Distribución similar a Solvency

5. **Bug de Inversión**
   - ✅ 0 casos de D/E alto + Solvency alto
   - ✅ Empresas endeudadas tienen Solvency bajo (correcto)

### ⚠️ SEÑALES DE ADVERTENCIA:

1. **Interest Coverage**
   - ⚠️ 50-80% poblado → Aceptable pero no óptimo
   - ⚠️ Promedio < 5 o > 20 → Revisar cálculos

2. **Solvency**
   - ⚠️ 50-80% poblado → Revisar por qué faltan datos
   - ⚠️ Distribución desbalanceada (>60% en una categoría)

3. **Bug Check**
   - ⚠️ 1-10 casos → Revisar esos casos específicos

### ❌ SEÑALES DE PROBLEMA:

1. **Interest Coverage**
   - ❌ < 50% poblado → financials-bulk no se ejecutó correctamente
   - ❌ Promedio absurdo (< -50 o > 50) → Error en cálculo

2. **Solvency**
   - ❌ < 50% poblado → fmp-bulk no recalculó snapshots
   - ❌ Promedio < 30 o > 70 → Distribución anormal

3. **Bug Check**
   - ❌ > 10 casos → Bug de inversión aún presente

4. **Snapshots**
   - ❌ 0 snapshots hoy → Cron jobs no corrieron

---

## 🔄 QUÉ HACER SI ALGO ESTÁ MAL

### Problema: Interest Coverage < 50%

**Solución:**

```bash
cd D:\FintraDeploy\Fintra
npx tsx scripts/pipeline/run-fix-solvency.ts
```

Espera 10-15 minutos y valida de nuevo.

### Problema: Solvency < 50%

**Solución:**

```bash
cd D:\FintraDeploy\Fintra
npx tsx scripts/pipeline/run-master-cron.ts
```

Espera 2-4 horas (solo necesitas llegar al Paso 16: FMP Bulk).

### Problema: Bug de inversión detectado

**Solución:**

1. Verifica que tienes la última versión de `lib/engine/fgos-recompute.ts`
2. Ejecuta:

```bash
npx tsx scripts/pipeline/run-master-cron.ts
```

3. Espera a que llegue al Paso 18 (Recompute FGOS)

### Problema: Distribución anormal

**Posibles causas:**
- Datos de FMP incompletos (normal para algunos sectores)
- Benchmarks sectoriales desactualizados
- Universo de stocks sesgado (muchos de un sector)

**Solución:**
- Si es por sectores específicos: Normal, no hacer nada
- Si es generalizado: Verificar benchmarks sectoriales

---

## 📊 DASHBOARD RECOMENDADO

Crea una vista en Supabase con esta query para monitorear diariamente:

```sql
CREATE OR REPLACE VIEW public.daily_health_dashboard AS
SELECT
  CURRENT_DATE as check_date,
  (SELECT COUNT(*) FROM fintra_snapshots WHERE snapshot_date = CURRENT_DATE) as snapshots_today,
  (SELECT COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::FLOAT IS NOT NULL)
   FROM fintra_snapshots WHERE snapshot_date = CURRENT_DATE) as with_solvency,
  (SELECT ROUND(AVG((fgos_components->>'solvency')::FLOAT), 2)
   FROM fintra_snapshots WHERE snapshot_date = CURRENT_DATE) as avg_solvency,
  (SELECT COUNT(interest_coverage)
   FROM datos_financieros WHERE period_type = 'TTM') as ttm_with_coverage,
  (SELECT COUNT(*)
   FROM fintra_snapshots fs
   JOIN datos_financieros df ON df.ticker = fs.ticker AND df.period_type = 'TTM'
   WHERE fs.snapshot_date >= CURRENT_DATE - 7
     AND (fs.fgos_components->>'solvency')::FLOAT > 90
     AND df.debt_to_equity > 2.0) as bug_cases;
```

Luego consulta diariamente:

```sql
SELECT * FROM daily_health_dashboard;
```

**✅ TODO BIEN SI:**
- `snapshots_today` > 1000
- `with_solvency` > 80% de `snapshots_today`
- `avg_solvency` entre 45-65
- `ttm_with_coverage` > 6000
- `bug_cases` = 0

---

## 📞 CONTACTO / SOPORTE

Si después de ejecutar las validaciones sigues teniendo dudas:

1. **Ejecuta el script completo:**
   ```bash
   npx tsx scripts/validation/validate-solvency-fix.ts > validation-report.txt
   ```

2. **Revisa el reporte** en `validation-report.txt`

3. **Comparte el reporte** para análisis

---

## 🎉 RESUMEN

### Para verificar rápidamente (30 segundos):

```sql
SELECT * FROM quick_health_check();
```

### Para verificar completamente (5 minutos):

```bash
npx tsx scripts/validation/validate-solvency-fix.ts
```

### Para verificar manualmente (2 minutos):

Ejecuta las 5 queries manuales listadas arriba.

**Si todos los checks pasan → Sistema listo para producción ✅**

---

*Última actualización: 2026-02-01 - Fintra Engineering*

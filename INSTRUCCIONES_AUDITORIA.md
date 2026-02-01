# 🔍 Instrucciones para Ejecutar Auditoría de Supabase

## 📋 Contexto

He creado scripts completos para auditar el estado de todas las tablas de Fintra en Supabase, incluyendo:

- ✅ Conteo de registros por tabla
- ✅ Distribución de scores FGOS
- ✅ **Análisis de snapshots afectados por el bug de Solvency**
- ✅ Validación de integridad referencial
- ✅ Estadísticas por sector

---

## 🎯 OPCIÓN RECOMENDADA: SQL Directo desde Supabase Dashboard

Esta es la forma más rápida y no requiere configuración local.

### Paso 1: Acceder a Supabase SQL Editor

1. Ir a: **https://lvqfmrsvtyoemxfbnwzv.supabase.co**
2. Hacer login
3. En el menú lateral, ir a: **SQL Editor**

### Paso 2: Ejecutar las Queries

1. Abrir el archivo: `scripts/audit-supabase-sql.sql` (en tu proyecto local)
2. Copiar todo el contenido
3. Pegarlo en el SQL Editor de Supabase
4. Click en **Run** (o presionar `Ctrl+Enter`)

### Paso 3: Analizar Resultados

Las queries están organizadas por niveles:

#### 📊 **NIVEL 1: Datos Base**
```sql
-- Verás resultados de:
- company_profiles: Total de empresas, exchanges, sectores
- datos_financieros: Cobertura de ratios
- datos_performance: Datos históricos
```

#### 🎯 **NIVEL 2: Clasificación y Benchmarks**
```sql
- sector_benchmarks: Benchmarks por sector
- industry_classification: Industrias únicas
```

#### ⭐ **NIVEL 4: Snapshots (CRÍTICO)**
```sql
- fintra_snapshots: Resumen general
- Distribución FGOS (High, Medium, Low, Pending)
- 🔴 ANÁLISIS DE SOLVENCY BUG (LO MÁS IMPORTANTE)
```

#### 🔗 **Validación de Integridad**
```sql
- Snapshots huérfanos
- Snapshots sin datos financieros
```

---

## 🔴 ANÁLISIS CRÍTICO: Solvency Bug

La query más importante es esta:

```sql
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
```

**Interpretación de resultados:**

| Rango | Significado | Estado |
|-------|-------------|--------|
| >90 | **Definitivamente afectados** por el bug | 🔴 CRÍTICO |
| 70-90 | Posiblemente afectados | 🟡 REVISAR |
| <70 | Probablemente correctos | ✅ OK |

**Ejemplo de resultado esperado (ANTES de la corrección):**

```
| total_con_solvency | muy_alto_90_plus | alto_70_90 | pct_afectados_criticos |
|--------------------|------------------|------------|------------------------|
| 13,028             | 3,207 (24.6%)    | 5,821      | 24.6%                  |
```

Esto confirma que ~25% de los snapshots están afectados críticamente.

---

## 📊 Otras Queries Importantes

### Ver Top 20 Tickers Afectados

```sql
-- 5.2 Top 20 Tickers con Solvency > 90
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
```

Esto te mostrará exactamente cuáles empresas tienen el score de solvency más inflado.

---

### Ver Snapshots de Hoy

```sql
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
```

---

## 🛠️ OPCIÓN ALTERNATIVA: Script TypeScript (Más Detallado)

Si prefieres un output más visual y estructurado:

### Requisitos:
- Node.js instalado
- Service Role Key de Supabase

### Pasos:

```bash
# 1. Configurar la service key
export SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# 2. Ejecutar el script
npx tsx scripts/audit-supabase-tables.ts
```

**Output esperado:**

```
╔═══════════════════════════════════════════════════════════╗
║  🔍 AUDITORÍA DE TABLAS SUPABASE - FINTRA                ║
╚═══════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════
  NIVEL 1: DATOS BASE
═══════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│ 📊 TABLA: company_profiles                             │
└─────────────────────────────────────────────────────────┘
   Total de empresas: 15,234

   📍 Distribución por Exchange:
      NASDAQ: 5,432
      NYSE: 4,321

   ✅ Con sector: 14,567 (95.6%)

...

🔍 ANÁLISIS DE SOLVENCY (Bug detectado):
   Total con solvency: 13,028
   🔴 >90 (altamente afectados): 3,207 (24.6%)
   🟡 70-90 (moderadamente afectados): 5,821 (44.7%)
   ✅ <70 (probablemente OK): 4,000 (30.7%)
```

---

## 📝 Siguientes Pasos Después de la Auditoría

Una vez que ejecutes la auditoría y confirmes cuántos snapshots están afectados:

### 1. **Reprocesar Snapshots Afectados**

```bash
# Ejecutar endpoint de reprocessing
curl -X POST http://localhost:3000/api/admin/reprocess-snapshots \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "minSolvency": 70,
    "dryRun": false,
    "batchSize": 100
  }'
```

### 2. **Re-ejecutar Auditoría para Confirmar**

```sql
-- Ejecutar nuevamente la query de Solvency
-- Deberías ver ~0% en el rango >90
```

### 3. **Validar Distribución FGOS**

```sql
-- Verificar que las categorías High/Medium/Low son razonables
SELECT
  fgos_category,
  COUNT(*) as cantidad,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as porcentaje
FROM fintra_snapshots
WHERE fgos_category IS NOT NULL
GROUP BY fgos_category;
```

**Distribución esperada:**
- High: 20-30%
- Medium: 40-50%
- Low: 20-30%
- Pending: 5-10%

---

## 🎯 Resumen Ejecutivo

**Lo que necesitas hacer AHORA:**

1. ✅ **Abrir Supabase SQL Editor**
2. ✅ **Copiar/pegar `scripts/audit-supabase-sql.sql`**
3. ✅ **Ejecutar y revisar resultados**
4. ✅ **Enfocarte en la query de Solvency Analysis (5.1)**
5. ✅ **Reportar cuántos snapshots tienen solvency >90**

---

## 📞 Soporte

Si encuentras algún error:

1. Verificar que estás logueado en Supabase
2. Verificar que tienes permisos de lectura en las tablas
3. Si una query específica falla, ejecutarla individualmente
4. Revisar el log de errores en el SQL Editor

---

## 📚 Archivos Relevantes

- `scripts/audit-supabase-sql.sql` - Queries SQL completas
- `scripts/audit-supabase-tables.ts` - Script TypeScript visual
- `scripts/AUDIT_README.md` - Documentación detallada
- `CRON_EXECUTION_ORDER_CORRECTED.md` - Orden de ejecución de jobs
- `app/api/admin/reprocess-snapshots/route.ts` - Endpoint de reprocesamiento

---

¿Listo para ejecutar la auditoría? 🚀

Abre Supabase SQL Editor y copia/pega el contenido de `scripts/audit-supabase-sql.sql`.

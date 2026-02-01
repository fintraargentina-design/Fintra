# 🔍 Auditoría de Tablas Supabase - Fintra

## 📋 Descripción

Scripts para auditar el estado completo de la base de datos de Fintra, incluyendo:

- Conteo de registros por tabla
- Validación de integridad referencial
- Distribución de scores FGOS
- **Detección de snapshots afectados por el bug de Solvency**
- Análisis de cobertura temporal
- Estadísticas por sector

---

## 🎯 Opciones de Ejecución

### Opción 1: Script TypeScript (Completo y Visual)

**Requerimientos:**
- Node.js instalado
- Variable `SUPABASE_SERVICE_ROLE_KEY` configurada

**Ejecutar:**

```bash
# Configurar la service key
export SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# Ejecutar el script
npx tsx scripts/audit-supabase-tables.ts
```

**Ventajas:**
- ✅ Output formateado con colores y emojis
- ✅ Análisis detallado de solvency (detecta bug)
- ✅ Logging estructurado
- ✅ Fácil de extender

---

### Opción 2: SQL Directo (Rápido)

**Ejecutar desde Supabase Dashboard:**

1. Ir a: https://lvqfmrsvtyoemxfbnwzv.supabase.co
2. Navegar a: **SQL Editor**
3. Copiar y pegar el contenido de `scripts/audit-supabase-sql.sql`
4. Ejecutar las queries una por una o todas juntas

**Ventajas:**
- ✅ No requiere configuración local
- ✅ Ejecuta directamente en la base de datos
- ✅ Ideal para análisis rápidos

---

## 📊 Análisis Clave que Proporciona

### 1. **NIVEL 1: Datos Base**
- `company_profiles`: Total de empresas, exchanges, sectores
- `datos_financieros`: Cobertura de ratios (ROE, D/E, etc.)
- `datos_performance`: Datos de rendimiento histórico

### 2. **NIVEL 2: Clasificación y Benchmarks**
- `sector_benchmarks`: Benchmarks por sector, niveles de confianza
- `industry_classification`: Industrias y sectores únicos

### 3. **NIVEL 4: Snapshots (CRÍTICO)**
- `fintra_snapshots`: Total de snapshots, distribución FGOS
- **🔴 Análisis de Solvency Bug**: Detecta snapshots afectados
- Distribución de categorías (High, Medium, Low, Pending)
- Cobertura temporal (snapshots por mes)

### 4. **Validación de Integridad**
- Snapshots huérfanos (sin company_profile)
- Snapshots sin datos_financieros
- Company profiles sin sector

---

## 🔴 Detección del Bug de Solvency

El script analiza específicamente la distribución de scores de Solvency:

```
🔍 ANÁLISIS DE SOLVENCY (Bug detectado):
   Total con solvency: 13,028
   🔴 >90 (altamente afectados): 3,207 (24.6%)
   🟡 70-90 (moderadamente afectados): 5,821 (44.7%)
   ✅ <70 (probablemente OK): 4,000 (30.7%)
```

**Interpretación:**
- **>90**: Definitivamente afectados por el bug (inversión de D/E)
- **70-90**: Posiblemente afectados, requiere validación
- **<70**: Probablemente correctos

---

## 📈 Output Esperado

### TypeScript Script:

```
╔═══════════════════════════════════════════════════════════╗
║  🔍 AUDITORÍA DE TABLAS SUPABASE - FINTRA                ║
║  Database: lvqfmrsvtyoemxfbnwzv.supabase.co              ║
╚═══════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════
  NIVEL 1: DATOS BASE (RAW DATA)
═══════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│ 📊 TABLA: company_profiles                             │
└─────────────────────────────────────────────────────────┘
   Total de empresas: 15,234

   📍 Distribución por Exchange:
      NASDAQ: 5,432
      NYSE: 4,321
      AMEX: 2,123

   ✅ Con sector: 14,567 (95.6%)

...
```

### SQL Script:

Devuelve tablas con resultados de cada query:

| tabla | total_registros | tickers_unicos | fecha_mas_reciente |
|-------|----------------|----------------|--------------------|
| 📊 company_profiles | 15,234 | - | - |
| 💰 datos_financieros | 45,678 | 13,456 | 2024-01-30 |
| ⭐ fintra_snapshots | 123,456 | 12,345 | 2024-01-31 |

---

## 🛠️ Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY no encontrada"

**Solución:**

```bash
# En Linux/Mac
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# En Windows (PowerShell)
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# O crear .env.local
echo "SUPABASE_SERVICE_ROLE_KEY=tu_key_aqui" >> .env.local
```

---

### Error: "Permission denied"

**Solución:**
El service role key debe tener permisos de lectura en todas las tablas.

Verificar en Supabase Dashboard:
1. Settings → API
2. Copiar el **service_role** key (NO el anon key)

---

### Timeout en queries grandes

Si las queries SQL tardan mucho:

```sql
-- Agregar LIMIT a queries pesadas
SELECT * FROM fintra_snapshots
WHERE fgos_components ? 'solvency'
LIMIT 10000;  -- Agregar esto
```

---

## 📝 Extender la Auditoría

### Agregar nueva tabla al script TypeScript:

```typescript
async function auditNuevaTabla() {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│ 📊 TABLA: nueva_tabla                                  │');
  console.log('└─────────────────────────────────────────────────────────┘');

  const { count } = await supabase
    .from('nueva_tabla')
    .select('*', { count: 'exact', head: true });

  console.log(`   Total: ${count}`);
}

// Agregar a main()
await auditNuevaTabla();
```

---

## 🎯 Uso Recomendado

**Frecuencia:**
- **Diario**: Después de ejecutar cron jobs
- **Post-corrección**: Después de reprocesar snapshots
- **Debugging**: Cuando haya discrepancias en FGOS scores

**Workflow:**

```bash
# 1. Ejecutar cron jobs
bash scripts/run-daily-update-validated.sh

# 2. Esperar a que termine (2-4 horas)

# 3. Ejecutar auditoría
npx tsx scripts/audit-supabase-tables.ts

# 4. Verificar métricas:
#    - Total snapshots del día
#    - % con FGOS score
#    - Distribución de categorías
#    - Snapshots afectados por bug
```

---

## 📊 Métricas Esperadas (Post-Corrección)

Después de reprocesar los snapshots afectados, deberías ver:

```
✅ Solvency Score Distribution:
   >90 (altamente afectados): 0 (0%)        ← Debe ser ~0%
   70-90 (moderadamente afectados): ~15%    ← Normal
   <70: ~85%                                 ← Mayoría
```

**Antes de la corrección:**
- ~25% con solvency >90 (ANORMAL)

**Después de la corrección:**
- <5% con solvency >90 (NORMAL)

---

## 🔗 Referencias

- **Documentación Supabase**: https://supabase.com/docs
- **Orden de Cron Jobs**: `CRON_EXECUTION_ORDER_CORRECTED.md`
- **Reprocessing Endpoint**: `/api/admin/reprocess-snapshots`
- **Bug Report**: `AUDIT.md` (sección "Bug #1: Cálculo Invertido de Solvency")

---

## 💡 Tips

1. **Guardar outputs**: Redirige la salida a un archivo para comparar
   ```bash
   npx tsx scripts/audit-supabase-tables.ts > audit-$(date +%Y%m%d).log
   ```

2. **Comparar antes/después**: Ejecuta antes y después de reprocesar
   ```bash
   diff audit-before.log audit-after.log
   ```

3. **Automatizar**: Agregar al final del script de cron jobs
   ```bash
   # En run-daily-update-validated.sh
   echo "Ejecutando auditoría post-actualización..."
   npx tsx scripts/audit-supabase-tables.ts >> $LOG_FILE
   ```

---

¿Necesitas ayuda adicional? Revisa los logs de ejecución o contacta al equipo de desarrollo.

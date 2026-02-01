# 🔍 Auditoría de Supabase - Fintra

## 🎯 ¿Qué Hacer Ahora?

Has recibido acceso a Supabase. El siguiente paso es ejecutar una **auditoría completa** de las tablas para:

1. ✅ Confirmar el número exacto de snapshots afectados por el bug de Solvency
2. ✅ Validar la integridad de datos entre tablas
3. ✅ Obtener estadísticas de distribución FGOS
4. ✅ Identificar problemas de cobertura de datos

---

## 🚀 PASO 1: Ejecutar Auditoría SQL (5 minutos)

### Opción Recomendada: Supabase SQL Editor

Esta es la forma más rápida y no requiere configuración local.

1. **Abrir Supabase Dashboard**
   ```
   URL: https://lvqfmrsvtyoemxfbnwzv.supabase.co
   ```

2. **Ir a SQL Editor**
   - En el menú lateral izquierdo
   - Click en **"SQL Editor"**

3. **Copiar y Pegar el Script**
   - Abrir el archivo: `scripts/audit-supabase-sql.sql`
   - Copiar TODO el contenido
   - Pegarlo en el SQL Editor

4. **Ejecutar**
   - Click en **"Run"** (o `Ctrl+Enter`)
   - Esperar resultados (~30 segundos)

---

## 📊 RESULTADOS ESPERADOS

### 🔴 ANÁLISIS CRÍTICO: Solvency Bug

La query más importante mostrará algo como esto:

```
┌─────────────────────┬────────┬─────────────┬───────────┬────────────┐
│ total_con_solvency  │ >90    │ 70-90       │ 50-70     │ <50        │
├─────────────────────┼────────┼─────────────┼───────────┼────────────┤
│ 13,028              │ 3,207  │ 5,821       │ 2,500     │ 1,500      │
│                     │(24.6%) │(44.7%)      │(19.2%)    │(11.5%)     │
└─────────────────────┴────────┴─────────────┴───────────┴────────────┘
```

**Interpretación:**

| Rango Solvency | Significado | Acción |
|---------------|-------------|--------|
| **>90** | 🔴 Definitivamente afectados | Requieren reprocesamiento |
| **70-90** | 🟡 Posiblemente afectados | Revisar caso por caso |
| **<70** | ✅ Probablemente correctos | No requieren acción |

---

### 📈 Otras Métricas Importantes

#### Distribución FGOS

```
┌──────────┬──────────┬────────────┐
│ Categoría│ Cantidad │ Porcentaje │
├──────────┼──────────┼────────────┤
│ High     │ 3,500    │ 26.9%      │
│ Medium   │ 6,000    │ 46.1%      │
│ Low      │ 2,800    │ 21.5%      │
│ Pending  │   728    │  5.6%      │
└──────────┴──────────┴────────────┘
```

**Distribución esperada (saludable):**
- High: 20-30% ✅
- Medium: 40-50% ✅
- Low: 20-30% ✅
- Pending: 5-10% ✅

---

#### Snapshots de Hoy

```
┌────────────┬──────────┬──────────┬────────┐
│ Fecha      │ Total    │ Con FGOS │ % FGOS │
├────────────┼──────────┼──────────┼────────┤
│ 2024-01-31 │ 13,456   │ 12,728   │ 94.6%  │
└────────────┴──────────┴──────────┴────────┘
```

**Esperado:** >90% de snapshots con FGOS score

---

#### Top 20 Tickers Afectados

Verás una lista de empresas con los scores de solvency más altos (sospechosos):

```
┌────────┬───────────┬──────────────┬────────────┐
│ Ticker │ Solvency  │ FGOS Score   │ Sector     │
├────────┼───────────┼──────────────┼────────────┤
│ AAPL   │ 98.5      │ 85.2         │ Technology │
│ MSFT   │ 97.3      │ 82.1         │ Technology │
│ GOOGL  │ 96.8      │ 79.5         │ Technology │
│ ...    │ ...       │ ...          │ ...        │
└────────┴───────────┴──────────────┴────────────┘
```

---

## 📝 PASO 2: Reportar Resultados

Después de ejecutar la auditoría, anota:

1. **Total de snapshots con solvency >90:**
   ```
   Ejemplo: 3,207 snapshots (24.6%)
   ```

2. **Total de snapshots con solvency 70-90:**
   ```
   Ejemplo: 5,821 snapshots (44.7%)
   ```

3. **Fecha del snapshot más reciente:**
   ```
   Ejemplo: 2024-01-30
   ```

4. **% de snapshots con FGOS score:**
   ```
   Ejemplo: 94.6%
   ```

---

## 🛠️ PASO 3: Reprocesar Snapshots (DESPUÉS de confirmar números)

Una vez que hayas confirmado cuántos snapshots están afectados, ejecutar:

### Opción A: Dry Run (Simulación)

```bash
# 1. Iniciar servidor local
npm run dev

# 2. Ejecutar dry run para ver qué se procesaría
curl -X POST http://localhost:3000/api/admin/reprocess-snapshots \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "minSolvency": 70,
    "dryRun": true,
    "batchSize": 100
  }'
```

**Output esperado:**
```json
{
  "dryRun": true,
  "summary": {
    "total": 13028,
    "potentiallyAffected": 9028,
    "batches": 91
  },
  "estimatedTime": "2-3 hours"
}
```

---

### Opción B: Reprocesar Real (DESPUÉS de validar dry run)

```bash
curl -X POST http://localhost:3000/api/admin/reprocess-snapshots \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "minSolvency": 70,
    "dryRun": false,
    "batchSize": 100
  }'
```

**Tiempo estimado:** 2-4 horas (dependiendo de cantidad)

---

## 📊 PASO 4: Re-Validar (Confirmar Corrección)

Después de reprocesar, ejecutar **nuevamente** la auditoría SQL.

**Resultados esperados DESPUÉS de reprocesar:**

```
┌─────────────────────┬────────┬─────────────┬───────────┬────────────┐
│ total_con_solvency  │ >90    │ 70-90       │ 50-70     │ <50        │
├─────────────────────┼────────┼─────────────┼───────────┼────────────┤
│ 13,028              │ 456    │ 2,100       │ 6,200     │ 4,272      │
│                     │(3.5%)  │(16.1%)      │(47.6%)    │(32.8%)     │
└─────────────────────┴────────┴─────────────┴───────────┴────────────┘
```

**Validación:**
- ✅ Solvency >90: Debería bajar de ~24% a <5%
- ✅ Solvency <70: Debería subir a ~80%
- ✅ Distribución FGOS más balanceada

---

## 🎯 CHECKLIST COMPLETO

### Pre-Auditoría
- [ ] Acceso a Supabase confirmado
- [ ] SQL Editor abierto
- [ ] Archivo `scripts/audit-supabase-sql.sql` localizado

### Ejecución de Auditoría
- [ ] Script SQL copiado y pegado
- [ ] Queries ejecutadas exitosamente
- [ ] Resultados de "Solvency Analysis" anotados
- [ ] Número de afectados confirmado

### Reprocesamiento
- [ ] Servidor local iniciado (`npm run dev`)
- [ ] Dry run ejecutado
- [ ] Resultados del dry run validados
- [ ] Reprocesamiento real ejecutado
- [ ] Progreso monitoreado

### Post-Reprocesamiento
- [ ] Auditoría SQL re-ejecutada
- [ ] Distribución de Solvency normalizada (<5% con >90)
- [ ] Distribución FGOS razonable
- [ ] Logs revisados sin errores

---

## 📚 Documentación de Referencia

| Archivo | Propósito |
|---------|-----------|
| **`scripts/audit-supabase-sql.sql`** | 👈 **EJECUTAR ESTE PRIMERO** |
| `scripts/audit-supabase-tables.ts` | Alternativa TypeScript (más visual) |
| `scripts/AUDIT_README.md` | Documentación detallada |
| `INSTRUCCIONES_AUDITORIA.md` | Guía completa paso a paso |
| `RESUMEN_TRABAJO_COMPLETO.md` | Resumen ejecutivo del proyecto |
| `app/api/admin/reprocess-snapshots/route.ts` | Endpoint de reprocesamiento |

---

## 🐛 Troubleshooting

### "Permission denied" al ejecutar SQL

**Solución:** Verifica que estás logueado en Supabase con la cuenta correcta.

---

### "Function does not exist"

**Solución:** Algunas queries usan funciones de PostgreSQL. Ejecuta las queries individualmente en lugar de todas juntas.

---

### Timeout en queries

**Solución:** Las queries grandes pueden tardar. Espera hasta 60 segundos. Si persiste, agregar `LIMIT 10000` a la query.

```sql
-- Ejemplo con LIMIT
SELECT * FROM fintra_snapshots
WHERE fgos_components ? 'solvency'
LIMIT 10000;
```

---

## 💡 Tips Adicionales

### Guardar Resultados

Puedes exportar los resultados como CSV:
1. Ejecutar query
2. Click en **"..."** (menú de resultados)
3. **"Download as CSV"**

### Comparar Antes/Después

Ejecuta la auditoría ANTES y DESPUÉS de reprocesar para ver el impacto:

```bash
# Guardar resultado antes
# (exportar como: audit-before.csv)

# Reprocesar snapshots
# ...

# Guardar resultado después
# (exportar como: audit-after.csv)

# Comparar diferencias
```

---

## 🚀 ¿Listo para Empezar?

### ✅ Acción Inmediata (Siguiente 5 minutos)

1. Abrir: **https://lvqfmrsvtyoemxfbnwzv.supabase.co**
2. Ir a: **SQL Editor**
3. Copiar/pegar: **`scripts/audit-supabase-sql.sql`**
4. **Run** y revisar resultados

### ✅ Después de la Auditoría (Siguiente 1 hora)

5. Anotar número de snapshots afectados
6. Ejecutar dry run del reprocesamiento
7. Validar que el dry run es correcto
8. Iniciar reprocesamiento real

### ✅ Validación Final (Al día siguiente)

9. Re-ejecutar auditoría
10. Confirmar distribución normalizada
11. Verificar FGOS scores
12. Documentar resultados

---

**¿Preguntas? Revisa:**
- `INSTRUCCIONES_AUDITORIA.md` - Guía detallada
- `RESUMEN_TRABAJO_COMPLETO.md` - Contexto completo

**¡Éxito con la auditoría! 🎉**

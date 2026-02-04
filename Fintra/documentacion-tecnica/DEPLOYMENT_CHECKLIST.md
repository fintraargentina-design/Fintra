# 🚀 DEPLOYMENT CHECKLIST - Correcciones Fintra

**Fecha:** 31 de Enero de 2026
**Versión:** Post-Auditoría v1.0

---

## ✅ COMPLETADO

### Código
- [x] Correcciones críticas implementadas (7 soluciones)
- [x] Merge a proyecto principal (D:\FintraDeploy\Fintra)
- [x] Error de sintaxis corregido (fmp-bulk/core.ts)
- [x] Tipos TypeScript agregados (PeriodType, ValueItem, etc.)
- [x] CRON_SECRET generado: `65c5f7f237b4fd5ad17a94e92233371c10cdf64f2da665fa0c0fd48b2e611d40`
- [x] CRON_SECRET agregado a `.env.local`

### Scripts Creados
- [x] `scripts/simple-solvency-check.sql` - Análisis de impacto
- [x] `scripts/check-migration-status.sql` - Verificar advisory locks
- [x] `scripts/apply-auth-middleware.js` - Aplicar auth a todos los cron jobs
- [x] `app/api/admin/reprocess-snapshots/route.ts` - Endpoint de reprocesamiento

---

## 📋 TAREAS PENDIENTES (En Orden)

### FASE 1: Configuración de Infraestructura (15 min)

#### ☐ **1.1 Supabase: Ejecutar Análisis de Datos**
```sql
-- En Supabase SQL Editor: https://supabase.com/dashboard

-- Ejecutar este query:
\i scripts/simple-solvency-check.sql
```

**Resultado esperado:** Estadísticas de snapshots afectados

---

#### ☐ **1.2 Supabase: Verificar y Aplicar Migración**
```sql
-- Primero verificar:
\i scripts/check-migration-status.sql

-- Si retorna 0 filas, ejecutar:
\i supabase/migrations/20260131120000_add_advisory_lock_functions.sql
```

**Resultado esperado:** 2 funciones creadas (pg_try_advisory_lock, pg_advisory_unlock)

---

#### ☐ **1.3 Vercel: Agregar CRON_SECRET**
```
1. Ir a: https://vercel.com/[tu-cuenta]/fintra/settings/environment-variables

2. Click "Add New"

3. Configurar:
   Name: CRON_SECRET
   Value: 65c5f7f237b4fd5ad17a94e92233371c10cdf64f2da665fa0c0fd48b2e611d40
   Environments:
     ☑ Production
     ☑ Preview
     ☑ Development

4. Click "Save"
```

---

#### ☐ **1.4 Vercel: Agregar ADMIN_SECRET (Opcional)**
```
Name: ADMIN_SECRET
Value: [generar otro token aleatorio]
Environments: ☑ Production

Usado para el endpoint /api/admin/reprocess-snapshots
```

Para generar:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### FASE 2: Aplicar Middleware a Cron Jobs (10 min)

#### ☐ **2.1 Ejecutar Script de Aplicación Automática**
```bash
cd D:\FintraDeploy\Fintra
node scripts/apply-auth-middleware.js
```

**Resultado esperado:**
```
📊 Resumen:
   Total: 32
   Actualizados: ~30
   Omitidos: ~2 (fmp-bulk ya tiene)
```

---

#### ☐ **2.2 Revisar Cambios**
```bash
git diff app/api/cron
```

Verificar que:
- Todos tienen `import { withCronAuth }`
- Handlers están wrapped: `export const GET = withCronAuth(async (req) => { ... })`

---

#### ☐ **2.3 Commit de Cambios**
```bash
git add app/api/cron
git commit -m "feat: Aplicar middleware de autenticación a todos los cron jobs

- Agregado withCronAuth a 30+ endpoints
- Protección consistente con CRON_SECRET
- Migrado de function a const handlers

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### FASE 3: Testing Local (15 min)

#### ☐ **3.1 Instalar Dependencias**
```bash
npm install
```

---

#### ☐ **3.2 Levantar Dev Server**
```bash
npm run dev
```

---

#### ☐ **3.3 Test Endpoint con Auth**
```bash
# En otra terminal:

# Test SIN auth (debe fallar con 401)
curl http://localhost:3000/api/cron/fmp-bulk

# Test CON auth (debe funcionar)
curl http://localhost:3000/api/cron/fmp-bulk \
  -H "Authorization: Bearer 65c5f7f237b4fd5ad17a94e92233371c10cdf64f2da665fa0c0fd48b2e611d40"
```

**Resultado esperado:**
- Sin auth: `{"error": "Unauthorized"}`
- Con auth: `{"skipped": true}` o resultado normal

---

#### ☐ **3.4 Test de Reprocesamiento (Dry Run)**
```bash
curl -X POST http://localhost:3000/api/admin/reprocess-snapshots \
  -H "Authorization: Bearer 65c5f7f237b4fd5ad17a94e92233371c10cdf64f2da665fa0c0fd48b2e611d40" \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "dryRun": true}'
```

**Resultado esperado:** JSON con summary de snapshots a reprocesar

---

### FASE 4: Deployment (20 min)

#### ☐ **4.1 Push a Repositorio**
```bash
git push origin master
```

---

#### ☐ **4.2 Monitorear Deploy en Vercel**
```
1. Ir a: https://vercel.com/[tu-cuenta]/fintra

2. Ver el deployment en progreso

3. Esperar "Ready" (~5-10 min)
```

---

#### ☐ **4.3 Verificar Variables de Entorno en Producción**
```
En Vercel Dashboard → Settings → Environment Variables:
✓ CRON_SECRET configurado
✓ FMP_API_KEY configurado
✓ Database URL configurado
```

---

#### ☐ **4.4 Test en Producción**
```bash
# Reemplazar con tu URL de producción
PROD_URL="https://fintra.vercel.app"

# Test auth
curl $PROD_URL/api/cron/fmp-bulk \
  -H "Authorization: Bearer 65c5f7f237b4fd5ad17a94e92233371c10cdf64f2da665fa0c0fd48b2e611d40"
```

---

### FASE 5: Reprocesamiento de Datos (Variable)

#### ☐ **5.1 Ejecutar Reprocesamiento en Dry Run**
```bash
curl -X POST https://fintra.vercel.app/api/admin/reprocess-snapshots \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2026-01-31",
    "dryRun": true
  }'
```

**Resultado:** Ver cuántos snapshots serán reprocesados

---

#### ☐ **5.2 Ejecutar Reprocesamiento Real**
```bash
# SOLO SI DRY RUN MOSTRÓ RESULTADOS RAZONABLES

curl -X POST https://fintra.vercel.app/api/admin/reprocess-snapshots \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2026-01-31",
    "dryRun": false,
    "batchSize": 50
  }'
```

**Tiempo estimado:**
- 100 snapshots: ~2-3 min
- 1,000 snapshots: ~15-20 min
- 10,000 snapshots: ~2-3 horas

---

### FASE 6: Validación Post-Deployment

#### ☐ **6.1 Verificar Logs en Vercel**
```
1. Ir a Vercel Dashboard → Logs
2. Filtrar por /api/cron/
3. Verificar que:
   ✓ API keys están enmascaradas (apikey=***)
   ✓ No hay errores 401 inesperados
   ✓ Locks están funcionando (mensajes "Lock acquired/released")
```

---

#### ☐ **6.2 Validar Datos Corregidos en Supabase**
```sql
-- Verificar que no hay más snapshots con bug de Solvency
-- (Debe retornar 0 filas después del reprocesamiento)

SELECT COUNT(*) as snapshots_aun_afectados
FROM fintra_snapshots fs
WHERE fs.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
  AND (fs.fgos_components->>'solvency')::float > 95
  AND EXISTS (
    SELECT 1 FROM datos_financieros df
    WHERE df.ticker = fs.ticker
      -- Buscar empresas con deuda alta que aún tengan solvency score alto
      -- (ajustar según tu estructura de datos)
  );
```

---

#### ☐ **6.3 Monitorear Performance**
```
En Vercel Dashboard → Analytics:
✓ Response times normales (<2s)
✓ No hay picos de errores
✓ Cron jobs ejecutándose según schedule
```

---

## 🎯 CRITERIOS DE ÉXITO

### Configuración
- [x] CRON_SECRET en Vercel
- [x] Advisory locks instalados en Supabase
- [x] Todos los cron jobs protegidos

### Funcionalidad
- [ ] Endpoint /api/cron/fmp-bulk requiere autenticación
- [ ] Locks previenen ejecuciones duplicadas
- [ ] Reprocesamiento de snapshots funciona

### Datos
- [ ] Snapshots reprocesados sin errores
- [ ] Solvency scores corregidos
- [ ] No hay duplicados en snapshots

### Seguridad
- [ ] API keys no aparecen en logs
- [ ] 401 para requests sin auth
- [ ] Solo Vercel Cron puede ejecutar jobs

---

## 📞 TROUBLESHOOTING

### Error: "Unauthorized" en cron jobs
```
Causa: CRON_SECRET no configurado en Vercel
Solución: Verificar en Settings → Environment Variables
```

### Error: "Lock functions not found"
```
Causa: Migración SQL no aplicada
Solución: Ejecutar supabase/migrations/20260131120000_add_advisory_lock_functions.sql
```

### Error: "Snapshots duplicados"
```
Causa: Locks no funcionando
Solución:
1. Verificar que las funciones pg_try_advisory_lock existen
2. Revisar logs para ver si lock se está adquiriendo
```

### Build falla con errores TypeScript
```
Causa: Errores pre-existentes no relacionados con fixes
Solución: Ejecutar `npm run build` y revisar errores específicos
```

---

## 📊 MÉTRICAS A MONITOREAR

### Post-Deployment (Primera semana)
- Número de snapshots reprocesados: ____
- Errores en cron jobs: ____ (objetivo: 0)
- Tiempo promedio de ejecución: ____ (objetivo: <300s)
- Snapshots duplicados: ____ (objetivo: 0)

### Post-Reprocesamiento
- Snapshots con solvency > 95: ____ (debería bajar significativamente)
- FGOS scores promedio antes: ____
- FGOS scores promedio después: ____
- Diferencia: ____ (esperado: ligera disminución para empresas endeudadas)

---

## ✅ SIGN-OFF

- [ ] Infraestructura configurada
- [ ] Tests pasados en local
- [ ] Deploy exitoso en producción
- [ ] Reprocesamiento completado
- [ ] Validación de datos OK
- [ ] Monitoreo configurado

**Completado por:** _______________
**Fecha:** _______________
**Notas:** _______________

# 🏠 CONFIGURACIÓN PARA EJECUCIÓN LOCAL

## 🎯 RESUMEN RÁPIDO

Para correr Fintra **localmente** sin Vercel:

```bash
# 1. Iniciar servidor de desarrollo
npm run dev

# 2. Ejecutar actualización diaria completa (en otra terminal)
bash scripts/run-daily-update.sh

# O en Windows:
scripts\run-daily-update.bat
```

---

## ⚙️ CONFIGURACIÓN INICIAL

### 1. Variables de Entorno (.env.local)

```bash
# API Keys
FMP_API_KEY=tu_api_key_aqui

# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Auth (Opcional para local)
CRON_SECRET=local_dev_secret  # Solo si quieres auth en local
ADMIN_SECRET=local_admin_secret

# Environment
NODE_ENV=development
```

---

### 2. Deshabilitar Auth para Local (Opcional)

Si NO quieres autenticación en local, modifica `lib/middleware/cronAuth.ts`:

```typescript
export function validateCronAuth(request: NextRequest | Request): CronAuthResult {
  // Skip auth en desarrollo
  if (process.env.NODE_ENV === 'development') {
    return { authorized: true };
  }

  // ... resto del código
}
```

---

## 📋 ORDEN DE EJECUCIÓN

Ver archivo completo: `CRON_EXECUTION_ORDER.md`

### Resumen:

```
NIVEL 1: Datos Base (30-60 min)
  ├─ fmp-bulk ⭐ CRÍTICO
  └─ dividends-bulk-v2

NIVEL 2: Clasificación (5-10 min)
  ├─ industry-classification-sync
  └─ master-benchmark ⭐ CRÍTICO

NIVEL 3: Performance (10-20 min)
  ├─ industry-performance-aggregator
  ├─ industry-performance-windows-aggregator
  └─ industry-benchmarks-aggregator

NIVEL 4: Snapshots (60-120 min)
  └─ bulk-update ⭐ CRÍTICO

NIVEL 5: Rankings (5-10 min)
  ├─ compute-ranks
  └─ market-state-bulk

TOTAL: ~2-4 horas
```

---

## 🚀 EJECUCIÓN

### Opción A: Script Automatizado (RECOMENDADO)

```bash
# Linux/Mac
bash scripts/run-daily-update.sh

# Windows
scripts\run-daily-update.bat
```

**Características:**
- ✅ Ejecuta todo en el orden correcto
- ✅ Genera log detallado
- ✅ Manejo de errores
- ✅ Aborta si jobs críticos fallan

**Output:** `logs/cron-YYYYMMDD-HHMMSS.log`

---

### Opción B: Ejecución Manual

```bash
# En una terminal: servidor
npm run dev

# En otra terminal: jobs (en orden)
curl http://localhost:3000/api/cron/fmp-bulk
curl http://localhost:3000/api/cron/master-benchmark
curl http://localhost:3000/api/cron/bulk-update
curl http://localhost:3000/api/cron/compute-ranks
```

---

### Opción C: Master Job (Todo en uno)

```bash
# Ejecuta TODO automáticamente
curl http://localhost:3000/api/cron/master-all
```

⚠️ **NOTA:** Verifica primero que este endpoint orqueste correctamente el orden

---

## 📅 PROGRAMACIÓN AUTOMÁTICA

### Linux/Mac con cron

```bash
# Editar crontab
crontab -e

# Agregar línea (ejecutar diariamente a las 2 AM)
0 2 * * * cd /path/to/fintra && npm run dev > /dev/null 2>&1 &
5 2 * * * cd /path/to/fintra && bash scripts/run-daily-update.sh
```

---

### Windows con Task Scheduler

```powershell
# Crear tarea para iniciar servidor
schtasks /create /tn "Fintra Server" /tr "C:\FintraDeploy\Fintra\start-server.bat" /sc daily /st 01:55

# Crear tarea para actualización
schtasks /create /tn "Fintra Update" /tr "C:\FintraDeploy\Fintra\scripts\run-daily-update.bat" /sc daily /st 02:00
```

Archivo `start-server.bat`:
```bat
@echo off
cd C:\FintraDeploy\Fintra
start /min npm run dev
```

---

## 🐛 TROUBLESHOOTING

### Problema: "Servidor no está corriendo"

**Solución:**
```bash
# Verificar que dev server está activo
curl http://localhost:3000

# Si no responde, iniciar:
npm run dev
```

---

### Problema: "FMP API rate limit"

**Solución:**
- Reducir `batchSize` en fmp-bulk
- Agregar delays entre requests
- Actualizar a FMP Pro plan

---

### Problema: "Timeout en bulk-update"

**Solución:**
```bash
# Aumentar timeout en el script
# En run-daily-update.sh línea de bulk-update:
run_job "4.1" "Bulk Update" "/api/cron/bulk-update" 10800  # 3 horas
```

---

### Problema: Jobs fallan silenciosamente

**Solución:**
```bash
# Ver logs de Next.js
npm run dev

# Ver logs del script
tail -f logs/cron-*.log

# Ejecutar job individual con verbose
curl -v http://localhost:3000/api/cron/fmp-bulk
```

---

## 📊 MONITOREO

### Ver progreso en tiempo real

```bash
# Terminal 1: Servidor con logs
npm run dev

# Terminal 2: Script de actualización
bash scripts/run-daily-update.sh

# Terminal 3: Monitorear log
tail -f logs/cron-*.log
```

---

### Verificar datos en Supabase

```sql
-- Ver último snapshot generado
SELECT MAX(snapshot_date) FROM fintra_snapshots;

-- Contar snapshots del día
SELECT COUNT(*) FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE;

-- Ver estado de FGOS
SELECT
  fgos_category,
  COUNT(*) as cantidad
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
GROUP BY fgos_category;
```

---

## 🔄 ACTUALIZACIÓN INCREMENTAL

Si solo quieres actualizar un ticker específico:

```bash
# Actualizar solo AAPL
curl "http://localhost:3000/api/cron/master-ticker?ticker=AAPL"

# Actualizar lista de tickers
for ticker in AAPL MSFT GOOGL; do
  curl "http://localhost:3000/api/cron/master-ticker?ticker=$ticker"
  sleep 2
done
```

---

## 💾 BACKUP ANTES DE ACTUALIZACIÓN

```bash
# Backup de snapshots
pg_dump -h tu-db.supabase.co -U postgres -t fintra_snapshots > backup_$(date +%Y%m%d).sql

# O desde Supabase Dashboard:
# Database → Backups → Create Backup
```

---

## 🎯 CHECKLIST PRE-EJECUCIÓN

- [ ] Servidor dev corriendo (`npm run dev`)
- [ ] `.env.local` configurado con FMP_API_KEY
- [ ] Conexión a Supabase funcionando
- [ ] Espacio suficiente en disco (~5GB libres)
- [ ] RAM disponible (~4GB libres para bulk-update)

---

## 📈 MÉTRICAS ESPERADAS

Después de una ejecución exitosa deberías tener:

```sql
-- Snapshots generados hoy
SELECT COUNT(*) FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE;
-- Esperado: ~13,000-15,000

-- Con FGOS score válido
SELECT COUNT(*) FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND fgos_score IS NOT NULL;
-- Esperado: ~10,000-12,000 (75-85%)

-- Por categoría FGOS
SELECT fgos_category, COUNT(*)
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
GROUP BY fgos_category;
-- Distribución esperada:
-- High: 20-30%
-- Medium: 40-50%
-- Low: 20-30%
-- Pending: 5-10%
```

---

## 🚨 JOBS CRÍTICOS QUE NO PUEDEN FALLAR

1. **fmp-bulk** - Sin esto, no hay datos nuevos
2. **master-benchmark** - Sin esto, no hay scores FGOS
3. **bulk-update** - Sin esto, no hay snapshots

**Si alguno de estos falla, DETENER y revisar antes de continuar.**

---

## 📞 SOPORTE

Si tienes problemas:
1. Revisar `logs/cron-*.log`
2. Revisar console de `npm run dev`
3. Ejecutar job individual con `-v` para verbose
4. Verificar base de datos en Supabase Dashboard

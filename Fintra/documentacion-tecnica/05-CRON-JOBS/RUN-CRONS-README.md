# 🚀 FINTRA - Cron Jobs Execution Scripts

## 📋 Archivos Disponibles

### 🎯 Modo Directo (Recomendado - 19 Jobs Completos)

- **`run-all-crons-direct.bat`** - Script Windows Batch
- **`run-all-crons-direct.ps1`** - Script PowerShell
- ✅ **NO requiere servidor corriendo**
- ✅ **Más rápido** (~30% menos overhead)
- ✅ **Menos recursos** (no HTTP, solo TypeScript directo)
- ✅ **Completo** (incluye FGOS recompute e IFS memory)

### 🌐 Modo HTTP (Legacy - Estructura diferente)

- **`run-all-crons.bat`** - Script Windows Batch
- **`run-all-crons.ps1`** - Script PowerShell
- ⚠️ **Requiere servidor en localhost:3000**
- ⚠️ **Estructura diferente** (algunos endpoints consolidados)

---

## 🎯 Uso Rápido

### Modo Directo (Recomendado)

**Windows (PowerShell):**

```powershell
.\run-all-crons-direct.ps1
```

**Windows (Batch):**

```cmd
run-all-crons-direct.bat
```

### Modo HTTP (Servidor debe estar corriendo)

**Windows (PowerShell):**

```powershell
.\run-all-crons.ps1
```

**Windows (Batch):**

```cmd
run-all-crons.bat
```

---

## 📊 Secuencia de Ejecución (Modo Directo - 19 Jobs)

### **FASE 1: Universo y Clasificación**

1. ✅ **Sync Universe** - Sincroniza el universo de tickers
2. ✅ **Industry Classification** - Clasifica industrias

### **FASE 2: Datos Raw (FMP API)**

3. ✅ **Prices Daily Bulk** - Precios diarios masivos
4. ✅ **Financials Bulk** - Estados financieros masivos
5. ✅ **Company Profile Bulk** - Perfiles de empresas masivos

### **FASE 3: Performance Aggregators**

6. ✅ **Industry Performance 1D** - Rendimiento diario por industria
7. ✅ **Sector Performance 1D** - Rendimiento diario por sector
8. ✅ **Sector Perf Windows** - Ventanas de rendimiento por sector
9. ✅ **Industry Perf Windows** - Ventanas de rendimiento por industria
10. ✅ **Sector PE Aggregator** - Agregador P/E por sector
11. ✅ **Industry PE Aggregator** - Agregador P/E por industria

### **FASE 4: Benchmarks (Crítico para FGOS)**

12. ⭐ **Sector Benchmarks** - Benchmarks sectoriales (crítico)

### **FASE 5: Métricas Individuales**

13. ✅ **Performance Bulk** - Rendimiento individual masivo
14. ✅ **Market State Bulk** - Estado de mercado masivo
15. ✅ **Dividends Bulk V2** - Dividendos masivos V2

### **FASE 6: Snapshots Finales (CORE)**

16. ⭐⭐⭐ **FMP Bulk Snapshots** - Snapshots masivos (EL MÁS IMPORTANTE)
17. ✅ **Healthcheck Snapshots** - Validación de snapshots

### **FASE 7: Cálculos Finales (CRÍTICO)**

18. ⭐⭐ **Recompute FGOS All** - Recalcula FGOS para todos los tickers
19. ⭐⭐ **IFS Memory Aggregator** - Agrega memoria IFS

**⏱️ Duración Total Estimada:** 6-8 horas

---

## ⚙️ Configuración

### PowerShell - Parámetros Opcionales

```powershell
# Cambiar URL base
.\run-all-crons.ps1 -BaseUrl "http://production-server:3000"

# Cambiar directorio de logs
.\run-all-crons.ps1 -LogDir "D:\Logs\Fintra"

# Cambiar timeout por defecto
.\run-all-crons.ps1 -DefaultTimeout 1200
```

### Batch - Variables de Entorno

Edita las variables al inicio del archivo `.bat`:

```batch
set BASE_URL=http://localhost:3000
set LOG_DIR=logs
set TIMEOUT_DEFAULT=600
```

---

## 📝 Logs

Todos los scripts generan logs automáticamente:

- **Ubicación:** `logs/cron-YYYYMMDD-HHMMSS.log`
- **Formato:** Timestamp + Status + Respuesta del servidor
- **Ejemplo:** `logs/cron-20260202-143022.log`

### Ejemplo de Log

```
[2026-02-02 14:30:22] =========================================
[2026-02-02 14:30:22] [1] Starting: Sync Universe
[2026-02-02 14:30:22] [1] URL: http://localhost:3000/api/cron/sync-universe
[2026-02-02 14:30:22] [1] Timeout: 600s
[2026-02-02 14:30:22] =========================================
[2026-02-02 14:40:15] [1] ✅ SUCCESS: Sync Universe (Duration: 593.2s)
[2026-02-02 14:40:15] [1] Response: 200 OK
```

---

## 🔍 Troubleshooting

### Error: "curl not found" (Windows)

Instala curl o usa PowerShell en su lugar:

```powershell
.\run-all-crons.ps1
```

### Error: "Cannot execute script" (PowerShell)

Habilita la ejecución de scripts:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Error: "Connection refused"

Verifica que el servidor Next.js esté corriendo:

```cmd
pnpm dev
```

o

```cmd
pnpm start
```

### Timeout en Cron Job

Si un cron job tarda más de lo esperado, ajusta el timeout:

**PowerShell:**

```powershell
.\run-all-crons.ps1 -DefaultTimeout 1800
```

**Batch:** Edita la variable `TIMEOUT_DEFAULT` en el archivo

---

## 📌 Notas Importantes

### ⚠️ Prerequisitos

### Para Modo Directo (run-all-crons-direct.\*):

1. **Node.js y pnpm:** Instalados y configurados
2. **Variables de entorno:** `.env.local` debe estar configurado con:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FMP_API_KEY`
3. **Dependencias instaladas:** `pnpm install` ejecutado

### Para Modo HTTP (run-all-crons.\*):

1. **Servidor corriendo:** El servidor Next.js debe estar activo (`pnpm dev` o `pnpm start`)
2. **Puerto 3000:** Por defecto usa `localhost:3000`
3. **Variables de entorno:** `.env.local` configurado (igual que arriba)

### ⏰ Recomendaciones de Ejecución

- **Producción:** Ejecutar diariamente a las 2:00 AM (después del cierre de mercados)
- **Desarrollo:** Ejecutar bajo demanda según sea necesario
- **Primer uso:** Ejecutar TODOS los jobs en secuencia completa

### 🔒 Seguridad

- **NUNCA** ejecutar en producción sin revisar los logs
- **Backup:** Hacer backup de la base de datos antes de ejecutar
- **Monitoring:** Monitorear el uso de API de FMP (límites de rate)

---

## 🎛️ Ejecución Selectiva

Si solo quieres ejecutar ciertos jobs, puedes editar el script y comentar las líneas que no necesites:

**PowerShell:**

```powershell
# $jobs += Run-CronJob 3 "Prices Daily Bulk" "/api/cron/prices-daily-bulk" 1200
```

**Batch:**

```batch
REM call :run_job 3 "Prices Daily Bulk" "/api/cron/prices-daily-bulk" 1200
```

---

## 📊 Monitoreo de Progreso

Mientras se ejecutan los scripts, puedes:

1. **Ver logs en tiempo real:**

   ```cmd
   tail -f logs/cron-<timestamp>.log
   ```

2. **Verificar estado del servidor:**
   Revisa la terminal donde corre `pnpm dev`

3. **Consultar Supabase:**
   Verifica las tablas para ver datos actualizados

---

## 🆘 Soporte

Si encuentras problemas:

1. Revisa el archivo de log generado
2. Verifica los logs del servidor Next.js
3. Consulta `CRON_EXECUTION_ORDER_CORRECTED.md` para detalles de cada job
4. Revisa la documentación de cada endpoint en `/app/api/cron/`

---

## 📚 Referencias

- **Orden de ejecución completo:** Ver `CRON_EXECUTION_ORDER_CORRECTED.md`
- **Setup local:** Ver `LOCAL_SETUP.md`
- **Documentación de crons:** Ver `/app/api/cron/*/README.md`

---

## 📜 Changelog

### v1.0 (2026-02-02)

- ✅ Creación de scripts .bat y .ps1
- ✅ Secuencia de 18 jobs validada
- ✅ Logs automáticos con timestamps
- ✅ Manejo de errores robusto
- ✅ Soporte para timeouts configurables

---

**Fintra Team** 🚀

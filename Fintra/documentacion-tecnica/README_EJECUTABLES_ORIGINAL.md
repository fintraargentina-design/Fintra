# 📁 Ejecutables - Scripts Organizados por Frecuencia

Esta carpeta contiene todos los scripts ejecutables de Fintra organizados por frecuencia de ejecución.

---

## 📂 Estructura de Carpetas

```
Ejecutables/
├── Jobs Diarios/                      # Scripts que se ejecutan diariamente
│   ├── run-all-crons-complete.bat    # ⭐ 23 crons completos (RECOMENDADO)
│   ├── master-cron.bat                # Master orchestrator (10 crons)
│   └── run-all-crons-direct.bat      # Crons directos individuales
│
├── Jobs cada 15 dias/                 # Scripts quincenales
│   └── (por agregar)
│
├── Jobs Backfill se corren una vez/   # Scripts de backfill/inicialización
│   ├── run-all-crons.bat             # Backfill inicial completo
│   ├── cleanup-final.bat             # Limpieza final
│   └── cleanup.bat                    # Limpieza básica
│
├── logs/                              # Logs generados
└── README.md                          # Este archivo
```

---

## 📅 Jobs Diarios

### ⭐ `run-all-crons-complete.bat` (RECOMENDADO)

**Propósito:** Ejecución diaria completa de 23 crons

**Incluye:**

- Master Orchestrator (10 crons automáticos)
- Agregadores de Industria (6 crons)
- Datos Complementarios (5 crons) → **INCLUYE TTM Valuation Incremental ✅**
- SEC Filings (2 crons opcionales)

**Uso:**

```cmd
cd "Ejecutables\Jobs Diarios"
run-all-crons-complete.bat
```

**Logs generados:**

- `logs\cron-complete-YYYYMMDD-HHMMSS.log` - Log principal
- `logs\cron-complete-YYYYMMDD-HHMMSS.error.log` - Solo errores
- `logs\cron-complete-YYYYMMDD-HHMMSS.summary.log` - Resumen ejecutivo

**Duración estimada:** 2-4 horas

---

### `master-cron.bat`

**Propósito:** Master orchestrator que ejecuta 10 crons esenciales

**Incluye:**

1. FMP Bulk
2. Dividends Bulk V2
3. Industry Classification
4. Sector Benchmarks
5. Industry Performance
6. Industry Windows
7. Sector Windows
8. Industry Benchmarks
9. Bulk Update (Snapshots)
10. Market State

**Uso:**

```cmd
cd "Ejecutables\Jobs Diarios"
master-cron.bat
```

---

### `run-all-crons-direct.bat`

**Propósito:** Ejecutar crons individuales sin master orchestrator

**Uso:**

```cmd
cd "Ejecutables\Jobs Diarios"
run-all-crons-direct.bat
```

---

## 📆 Jobs cada 15 días

**Carpeta:** `Jobs cada 15 dias/`

Esta carpeta está lista para scripts que deben ejecutarse quincenalmente:

- Limpieza de datos antiguos
- Revalidación de clasificaciones
- Auditorías periódicas
- Compactación de índices

_(Por agregar según necesidades)_

---

## 🔧 Jobs Backfill (Se corren una vez)

### `run-all-crons.bat`

**Propósito:** Backfill inicial completo para poblar todas las tablas desde cero

**Cuándo usar:**

- Primera instalación de Fintra
- Recuperación después de pérdida de datos
- Migración de base de datos

**Uso:**

```cmd
cd "Ejecutables\Jobs Backfill se corren una vez"
run-all-crons.bat
```

⚠️ **ADVERTENCIA:** Este script puede tardar varias horas y hace llamadas masivas a APIs.

---

### `cleanup-final.bat` / `cleanup.bat`

**Propósito:** Limpiar datos inconsistentes o duplicados

**Uso:**

```cmd
cd "Ejecutables\Jobs Backfill se corren una vez"
cleanup-final.bat
```

---

## 🎯 ¿Qué script usar?

| Escenario                           | Script Recomendado                                 | Carpeta                      |
| ----------------------------------- | -------------------------------------------------- | ---------------------------- |
| **Actualización diaria automática** | `run-all-crons-complete.bat`                       | Jobs Diarios                 |
| **Actualización diaria ligera**     | `master-cron.bat`                                  | Jobs Diarios                 |
| **Primera vez / Instalación nueva** | `run-all-crons.bat`                                | Jobs Backfill                |
| **Recuperación de datos**           | `run-all-crons.bat` → `run-all-crons-complete.bat` | Jobs Backfill → Jobs Diarios |
| **Limpieza de inconsistencias**     | `cleanup-final.bat`                                | Jobs Backfill                |

---

## 🔄 TTM Valuation Incremental

✅ **AGREGADO** al cron diario completo (`run-all-crons-complete.bat`)

**Características:**

- Detecta nuevos quarters cerrados
- Crea exactamente UNA nueva fila TTM por ticker
- Usa el engine canónico `lib/engine/ttm.ts`
- Delay de 150ms entre tickers (seguro para RAM y Supabase)
- Idempotente (no duplica datos)

**Script individual:**

```cmd
pnpm tsx scripts/pipeline/incremental-ttm-valuation.ts
```

---

## 📊 Logs

Todos los scripts generan logs en la carpeta `logs/`:

```
logs/
├── cron-complete-YYYYMMDD-HHMMSS.log          # Completos
├── cron-complete-YYYYMMDD-HHMMSS.error.log    # Solo errores
├── cron-complete-YYYYMMDD-HHMMSS.summary.log  # Resumen
└── ...
```

---

## ⚙️ Configuración de Servidor

Los scripts diarios están configurados para:

- **Base URL:** `http://localhost:3000` (local)
- **Base URL VPS:** `https://fintra.com` (producción)

Editar en el script si es necesario:

```bat
set API_BASE=http://localhost:3000/api/cron
```

---

## 📝 Notas Técnicas

1. **Ejecución secuencial:** Todos los scripts ejecutan jobs secuencialmente (NO paralelo)
2. **Manejo de errores:** Jobs críticos abortan ejecución, complementarios continúan
3. **Timeouts:** Cada job tiene timeout configurado (ver código)
4. **Idempotencia:** Los crons están diseñados para ser re-ejecutables sin duplicar datos
5. **RAM Safety:** El backfill TTM tiene límite de 100 tickers por run + delay de 150ms

---

## 🚀 Recomendación para Producción

**Setup automático diario (VPS cron):**

```cron
# Ejecutar a las 2 AM todos los días
0 2 * * * cd /path/to/fintra/Ejecutables/Jobs\ Diarios && ./run-all-crons-complete.bat
```

---

**Instrucciones para mover archivos manualmente:**

Los archivos .bat deben moverse a sus carpetas correspondientes:

```powershell
# Desde PowerShell en D:\FintraDeploy\Fintra\Ejecutables

# Jobs Diarios
Move-Item "run-all-crons-complete.bat" "Jobs Diarios\"
Move-Item "master-cron.bat" "Jobs Diarios\"
Move-Item "run-all-crons-direct.bat" "Jobs Diarios\"

# Jobs Backfill
Move-Item "run-all-crons.bat" "Jobs Backfill se corren una vez\"
Move-Item "cleanup-final.bat" "Jobs Backfill se corren una vez\"
Move-Item "cleanup.bat" "Jobs Backfill se corren una vez\"
```

---

**Última actualización:** 2026-02-03  
**Versión:** 3.0 - Reorganización en subcarpetas

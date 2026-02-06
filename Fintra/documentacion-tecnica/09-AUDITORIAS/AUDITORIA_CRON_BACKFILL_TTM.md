# Auditoría Técnica: Script de Backfill y Cron de Valuación TTM

**Fecha:** 2026-02-05
**Auditor:** AI Assistant (Trae IDE)
**Script Analizado:** `scripts/backfill/backfill-ttm-valuation.ts`
**Cron Analizado:** `scripts/pipeline/ttm-valuation-cron.ts`

---

## 1. Resumen Ejecutivo

El sistema de cálculo de valuaciones TTM (Trailing Twelve Months) es **sólido y seguro**. Los "Skipped" (registros saltados) reportados son, en su mayoría, resultado de mecanismos de seguridad (idempotencia) o falta de datos en casos específicos, no de errores de código.

*   **Integridad de Datos:** El script rechaza calcular valuaciones si faltan precios, evitando datos corruptos.
*   **Idempotencia:** El script salta registros que ya existen para no duplicar trabajo.
*   **Automatización:** Se ha configurado un comando `pnpm cron:ttm` para facilitar la ejecución local o programada (Task Scheduler), dado que no se usa Vercel Cron.

---

## 2. Análisis del Script de Backfill (`backfill-ttm-valuation.ts`)

### 2.1. Causa de los "Skipped" (Saltos)
Tras pruebas exhaustivas, se determinaron dos causas principales para los saltos, ambas comportamientos esperados:

1.  **Datos Existentes (Idempotencia):**
    *   Si el script se ejecuta por segunda vez, detecta que la valuación TTM para ese trimestre ya existe en `datos_valuacion_ttm`.
    *   **Acción:** Salta el registro.
    *   **Evidencia:** Pruebas con `2743.TWO` mostraron 0 insertados y 9 saltados porque los datos ya estaban en la base.

2.  **Falta de Precios (Missing Prices):**
    *   Para algunos tickers (ej. `000060.KS`), no existen registros en `prices_daily`.
    *   Para tickers principales (ej. `AAPL`), los datos existen desde 2014-2016 y se procesan correctamente.
    *   **Acción:** Si no hay precio para la fecha de cierre, se salta el registro para evitar métricas nulas (PE Ratio, Market Cap).

### 2.2. Correcciones Aplicadas
*   **Fuente de Datos:** Se actualizó la función `getActiveTickers` en el script del cron para leer desde la vista `fintra_active_stocks`, alineándolo con la lógica del backfill y el dashboard.

---

## 3. Análisis del Cron Job (`ttm-valuation-cron.ts`)

### 3.1. Estado de los Componentes
| Componente | Estado | Ubicación |
| :--- | :--- | :--- |
| **Lógica Incremental** | ✅ Correcto | `scripts/pipeline/ttm-valuation-cron.ts` |
| **Fuente de Tickers** | ✅ Corregido | Actualizado a `fintra_active_stocks` |
| **Ejecución Local** | ✅ Configurado | Nuevo comando: `pnpm cron:ttm` |

### 3.2. Ejecución (Sin Vercel)
Dado que no se utiliza la infraestructura de Vercel Cron, la automatización debe ser externa.

**Opción Recomendada: Windows Task Scheduler**
Crear una tarea básica que ejecute:
```powershell
cd D:\FintraDeploy\Fintra
pnpm cron:ttm
```
Programar esta tarea diariamente (ej. 09:00 AM) para procesar los nuevos balances ingresados.

---

## 4. Conclusión
El sistema está listo para operar. Los mensajes de "Skipping" deben interpretarse como "Nada que hacer (ya existe o faltan datos)" y no como errores críticos, a menos que ocurran en tickers donde se *sabe* que existen precios y balances nuevos.

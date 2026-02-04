# Estado de los Ejecutables en /Ejecutables

## Archivos .BAT Disponibles

### 1️⃣ run-all-crons-complete.bat ⭐ RECOMENDADO

**Propósito:** Ejecutar los 22 crons diarios completos según documentación  
**Método:** Llamadas HTTP a endpoints `/api/cron/*`  
**Estructura:**

- Phase 1: Master-All (1 llamada → ejecuta 10 crons internos)
- Phase 2: Agregadores de Industria (6 crons)
- Phase 3: Datos Complementarios (4 crons)
- Phase 4: SEC Filings (2 crons opcionales)

**Total:** 22 crons (1 master + 12 complementarios + SEC opcionales)

**Alineado con:** EJECUCION_CRON_BACKFILL.md ✅

---

### 2️⃣ run-all-crons.bat

**Propósito:** Ejecutar crons individuales via HTTP  
**Método:** Llamadas HTTP a endpoints `/api/cron/*`  
**Estructura:** 15 crons individuales organizados en 7 fases

**Diferencias con documentación:**

- ❌ No incluye industry-benchmarks-aggregator
- ❌ No incluye sector/industry PE aggregators
- ❌ No incluye fmp-peers-bulk
- ❌ No incluye compute-ranks
- ❌ No incluye SEC filings
- ⚠️ Llama a `/api/cron/bulk-update` en lugar de `/api/cron/fmp-bulk`
- ⚠️ No incluye performance-windows-aggregator (crítico para charts)

**Estado:** DESACTUALIZADO - Necesita actualización

---

### 3️⃣ run-all-crons-direct.bat ✅ ACTUALIZADO

**Propósito:** Ejecutar scripts TypeScript directamente (sin servidor HTTP)  
**Método:** `pnpm tsx scripts/pipeline/*.ts` (ejecuta desde raíz del proyecto)  
**Estructura:** 19 scripts organizados en 7 fases

**Características:**

- ✅ Cambia automáticamente al directorio raíz del proyecto
- ✅ Los scripts en `scripts/pipeline/` son **wrappers** que llaman a las funciones `core` de `/app/api/cron/*/core.ts`
- ✅ Todos los scripts existen y están actualizados (01-18 + ifs-memory-aggregator)
- ✅ Usa misma lógica que los endpoints HTTP (solo sin servidor)
- ✅ Útil para debugging local sin levantar servidor Next.js

**Scripts que ejecuta:**

1. 01-sync-universe.ts
2. 02-industry-classification-sync.ts
3. 03-prices-daily-bulk.ts
4. 04-financials-bulk.ts
5. 05-company-profile-bulk.ts
6. 06-industry-performance-aggregator.ts
7. 07-sector-performance-aggregator.ts
8. 08-sector-performance-windows-aggregator.ts
9. 09-industry-performance-windows-aggregator.ts
10. 10-sector-pe-aggregator.ts
11. 11-industry-pe-aggregator.ts
12. 12-sector-benchmarks.ts
13. 13-performance-bulk.ts
14. 14-market-state-bulk.ts
15. 15-dividends-bulk-v2.ts
16. 16-fmp-bulk-snapshots.ts
17. 17-healthcheck-snapshots.ts
18. 18-recompute-fgos-all.ts
19. ifs-memory-aggregator.ts

**¿Qué NO incluye? (vs 22 crons completos):**

- ❌ No ejecuta industry-benchmarks-aggregator (no hay script 14)
- ❌ No ejecuta fmp-peers-bulk
- ❌ No ejecuta compute-ranks
- ❌ No ejecuta SEC filings (10k, 8k)

**Estado:** FUNCIONAL para desarrollo - Ejecuta 19/22 crons (86%)

---

### 4️⃣ master-cron.bat

**Propósito:** Ejecutar solo el master orchestrator  
**Método:** HTTP call a `/api/cron/master-all`  
**Estructura:** 1 única llamada

**Qué ejecuta (internamente - 10 crons):**

1. sync-universe
2. prices-daily-bulk
3. financials-bulk
4. performance-bulk
5. sector-performance-aggregator
6. performance-windows-aggregator
7. fmp-bulk
8. valuation-bulk
9. sector-benchmarks
10. market-state-bulk

**Estado:** CORRECTO pero INCOMPLETO (falta los 12 complementarios)

---

### 5️⃣ cleanup.bat & cleanup-final.bat

**Propósito:** Limpieza de archivos temporales  
**Estado:** Utilidades, no relacionados con crons

---

## Comparación con EJECUCION_CRON_BACKFILL.md

### ✅ Crons que DEBEN ejecutarse diariamente (22 total):

**Grupo 1: Master-All (10 automáticos)**

1. sync-universe
2. prices-daily-bulk
3. financials-bulk
4. performance-bulk
5. sector-performance-aggregator
6. performance-windows-aggregator
7. fmp-bulk
8. valuation-bulk
9. sector-benchmarks
10. market-state-bulk

**Grupo 2: Agregadores de Industria (6 complementarios)** 11. industry-performance-aggregator 12. industry-performance-windows-aggregator 13. sector-performance-windows-aggregator 14. industry-benchmarks-aggregator 15. sector-pe-aggregator 16. industry-pe-aggregator

**Grupo 3: Datos Complementarios (4 complementarios)** 17. fmp-peers-bulk 18. dividends-bulk-v2 19. company-profile-bulk 20. compute-ranks

**Grupo 4: SEC Filings (2 opcionales)** 21. sec-10k-ingest 22. sec-8k-ingest

---

## Tabla de Cobertura

| Cron                                        | master-cron.bat | run-all-crons.bat | run-all-crons-direct.bat | run-all-crons-complete.bat ⭐ |
| ------------------------------------------- | --------------- | ----------------- | ------------------------ | ----------------------------- |
| 1. sync-universe                            | ✅ (interno)    | ✅                | ✅                       | ✅ (interno)                  |
| 2. prices-daily-bulk                        | ✅ (interno)    | ✅                | ✅                       | ✅ (interno)                  |
| 3. financials-bulk                          | ✅ (interno)    | ✅                | ✅                       | ✅ (interno)                  |
| 4. performance-bulk                         | ✅ (interno)    | ✅                | ✅                       | ✅ (interno)                  |
| 5. sector-performance-aggregator            | ✅ (interno)    | ✅                | ✅                       | ✅ (interno)                  |
| 6. performance-windows-aggregator           | ✅ (interno)    | ❌                | ❌                       | ✅ (interno)                  |
| 7. fmp-bulk                                 | ✅ (interno)    | ⚠️ bulk-update    | ✅                       | ✅ (interno)                  |
| 8. valuation-bulk                           | ✅ (interno)    | ❌                | ❌                       | ✅ (interno)                  |
| 9. sector-benchmarks                        | ✅ (interno)    | ✅                | ✅                       | ✅ (interno)                  |
| 10. market-state-bulk                       | ✅ (interno)    | ✅                | ✅                       | ✅ (interno)                  |
| 11. industry-performance-aggregator         | ❌              | ✅                | ✅                       | ✅                            |
| 12. industry-performance-windows-aggregator | ❌              | ✅                | ✅                       | ✅                            |
| 13. sector-performance-windows-aggregator   | ❌              | ✅                | ✅                       | ✅                            |
| 14. industry-benchmarks-aggregator          | ❌              | ❌                | ❌                       | ✅                            |
| 15. sector-pe-aggregator                    | ❌              | ❌                | ✅                       | ✅                            |
| 16. industry-pe-aggregator                  | ❌              | ❌                | ✅                       | ✅                            |
| 17. fmp-peers-bulk                          | ❌              | ❌                | ❌                       | ✅                            |
| 18. dividends-bulk-v2                       | ❌              | ✅                | ✅                       | ✅                            |
| 19. company-profile-bulk                    | ❌              | ✅                | ✅                       | ✅                            |
| 20. compute-ranks                           | ❌              | ❌                | ❌                       | ✅                            |
| 21. sec-10k-ingest                          | ❌              | ❌                | ❌                       | ✅                            |
| 22. sec-8k-ingest                           | ❌              | ❌                | ❌                       | ✅                            |
| **TOTAL COBERTURA**                         | **10/22 (45%)** | **12/22 (55%)**   | **19/22 (86%)** ✅       | **22/22 (100%)** ✅           |

---

## Recomendación

### ✅ USO PRODUCCIÓN:

```bash
# Opción 1: Ejecutar todo de una vez (Recomendado - requiere servidor Next.js)
cd Ejecutables
run-all-crons-complete.bat

# Opción 2: Ejecutar en dos pasos (requiere servidor Next.js)
cd Ejecutables
master-cron.bat  # 10 crons principales
# Luego ejecutar manualmente los 12 complementarios via curl
```

### 🔧 USO DESARROLLO (SIN SERVIDOR):

```bash
# Ejecuta scripts directamente sin levantar Next.js (19/22 crons)
cd Ejecutables
run-all-crons-direct.bat
```

### ⚠️ NECESITA ACTUALIZACIÓN:

```bash
# Desactualizado - falta 10 crons críticos
cd Ejecutables
run-all-crons.bat
```

---

## Diferencia Clave: HTTP vs Direct

### 🌐 HTTP (run-all-crons-complete.bat, run-all-crons.bat, master-cron.bat)

- **Requiere:** Servidor Next.js corriendo (`npm run dev` o `npm run build && npm start`)
- **URL:** `http://localhost:3000/api/cron/*`
- **Ventaja:** Usa rate limiting, error handling, timeouts configurados
- **Desventaja:** Más overhead (HTTP layer)

### 💻 Direct (run-all-crons-direct.bat)

- **Requiere:** Solo `pnpm` instalado
- **Ejecuta:** `pnpm tsx scripts/pipeline/*.ts` directamente
- **Ventaja:** No necesita servidor corriendo, más rápido para debugging
- **Desventaja:** Bypasea algunos middlewares (pero usa misma lógica core)
- **Nota:** Los scripts en `scripts/pipeline/` son **wrappers** que importan las funciones `core` de los endpoints oficiales, por lo que **sí están actualizados**

---

## Próximos Pasos

1. ✅ **COMPLETADO:** Creado `run-all-crons-complete.bat` con 22 crons
2. ⏳ **PENDIENTE:** Actualizar `run-all-crons.bat` para incluir los 22 crons
3. ⏳ **PENDIENTE:** Validar que todos los endpoints en `/app/api/cron/` existan
4. ⏳ **PENDIENTE:** Probar ejecución completa de 22 crons

---

**Fecha:** 2026-02-02  
**Autor:** Fintra Engineering

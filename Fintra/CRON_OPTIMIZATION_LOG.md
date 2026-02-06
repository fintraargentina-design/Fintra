# Registro de Optimización de Cron Jobs y Pipelines

Este documento detalla el análisis, estado y propuestas de mejora para cada Cron Job del sistema Fintra, revisados paso a paso.

## 1. financials-bulk (`app/api/cron/financials-bulk/core.ts`)

**Estado Actual:** ⭐ **Excelente (Nivel 1)**
**Ruta del Script:** `scripts/pipeline/04-financials-bulk.ts`

### ✅ Puntos Fuertes Implementados
*   **Smart Gap Detection:** Realiza una sola consulta para detectar periodos existentes en lugar de una por ticker (1 vs 195 queries).
*   **Filtro de Años Mutables:** Solo procesa años recientes (ej. 2025-2027) en ejecuciones diarias, evitando re-procesar historia inmutable.
*   **Parallel I/O:** Utiliza `Promise.all` para upserts paralelos a Supabase (bloques de 5,000 filas).
*   **Streaming Parsing:** Usa `Papa.parse` con streams para evitar cargar CSVs gigantes en memoria (consumo constante ~350MB).
*   **Smart Cache:** Descarga archivos solo si son nuevos o la cache expiró.

### 🐛 Correcciones Realizadas
*   **Fix Default Batch Size:** Se corrigió el valor por defecto de `batchSize` de 50 a 2000 en `core.ts` para maximizar el rendimiento en VPS.

### 🚀 Propuestas de Mejora / Pendientes
*   *Ninguna crítica pendiente.* El pipeline está totalmente optimizado para el entorno actual.

---

## 2. company-profile-bulk (`app/api/cron/company-profile-bulk/core.ts`)

**Estado Actual:** ⭐ **Optimizado (Nivel 2)**
**Ruta del Script:** `scripts/pipeline/05-company-profile-bulk.ts`

### ✅ Análisis Inicial
*   Ya contaba con filtrado por **Active Universe** (excelente para evitar basura).
*   Ya usaba **Smart Cache** (60 min) para la descarga del CSV.

### 🛠️ Optimizaciones Implementadas
*   **Parallel Upserts:** Se reemplazó la inserción secuencial por lotes paralelos (`Concurrency: 5`, `Batch: 500`). Esto aprovecha mejor el ancho de banda y I/O de la VPS sin saturar CPU.
*   **Logic Fix (Crítico):** Se eliminó la directiva `ignoreDuplicates: true` en el upsert.
    *   *Antes:* Si el perfil ya existía, **NO** se actualizaba (cambios en CEO, descripción o empleados eran ignorados).
    *   *Ahora:* Se realiza un upsert real (INSERT o UPDATE), garantizando datos frescos.

### 🚀 Resultado
*   Probado con éxito (`limit=10`).
*   Mantiene bajo consumo de memoria y asegura consistencia de datos.

---

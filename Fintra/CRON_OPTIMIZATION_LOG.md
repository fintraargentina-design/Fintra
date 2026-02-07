
## run-performance-windows-aggregator.ts
**Estado:** ✅ **Integrado en Pipeline**
**Nuevo Nombre:** `13b-performance-windows-aggregator.ts`
**Core:** `app/api/cron/performance-windows-aggregator/core.ts`

### 🔍 Análisis y Cambios
*   **Función:** Calcula el **Alpha** (Rendimiento Relativo) de cada stock comparado con su Sector y su Industria para ventanas de 1M, 3M, 6M, etc.
*   **Dependencias:** Requiere que existan datos en:
    *   `datos_performance` (Stocks, generado en Paso 13).
    *   `sector_performance` (Benchmarks, generado en Paso 7).
    *   `industry_performance` (Benchmarks, generado en Paso 6).
*   **Acción:** Se integró en la posición **13b** del Master Cron, garantizando que se ejecute *después* de que todos sus inputs estén calculados para el día actual.
*   **Optimización:** El código base ya implementaba patrones eficientes (Bulk Reads/Writes, Mapas en memoria para benchmarks), por lo que no requirió refactorización interna, solo correcta orquestación.

# Informe Técnico: Refactorización de Datos de Industria para SnapshotTab

**Fecha:** 2026-02-04  
**Asunto:** Separación de Capas de Datos de Industria, Política de Gaps y Precisión en SnapshotTab

## 1. Contexto y Problema

El componente `SnapshotTab` visualiza el rendimiento relativo ("Alpha") de una acción frente a su Sector e Industria. Se detectaron inconsistencias arquitectónicas en la fuente de datos subyacente que comprometían la integridad y mantenibilidad de estos cálculos:

1.  **Violación de Capas (Layer Violation):** La tabla `industry_performance` almacenaba tanto datos crudos diarios (`1D`) como datos derivados/agregados (`1M`, `1Y`, etc.), dificultando la gestión del ciclo de vida de los datos.
2.  **Política de Gaps Implícita:** El cálculo de ventanas históricas no tenía una política definida para días sin trading, asumiendo continuidad sin control explícito.
3.  **Riesgo de Truncamiento:** Consultas masivas a Supabase estaban cerca de los límites de filas, riesgo mitigado ahora con la separación.

## 2. Solución Implementada (Opción A: Separación Estricta)

Se ha reestructurado el flujo de datos para cumplir con el principio de **Single Writer** y separación estricta de responsabilidades.

### 2.1. Nueva Arquitectura de Datos

*   **Tabla `industry_performance_daily` (NUEVA):**
    *   **Propósito:** Almacén exclusivo de retornos diarios crudos.
    *   **Fuente:** API externa (FMP).
    *   **Política:** Inmutable (append-only/upsert para correcciones), sin lógica de negocio.

*   **Tabla `industry_performance` (EXISTENTE - LIMPIEZA):**
    *   **Propósito:** Almacén exclusivo de ventanas de rendimiento calculadas (`1M`, `3M`, `6M`, `1Y`, `2Y`, `3Y`, `5Y`).
    *   **Fuente:** Derivada estrictamente de `industry_performance_daily`.
    *   **Cambio:** Se eliminaron todos los registros con `window_code = '1D'` para forzar el uso de la nueva tabla.

### 2.2. Política de Gaps (Declarativa)

Se implementó una política explícita en la función de agregación SQL:

> **Política:** Los retornos se componen utilizando interés compuesto logarítmico **SOLO** sobre los días de trading disponibles en la tabla diaria.
> *   Si un día no existe en la base de datos (gap), se asume implícitamente un retorno de 0% (no contribuye al drift).
> *   **NO** se realiza interpolación ni relleno de datos (fill-forward).
> *   Esto asegura que el rendimiento refleje estrictamente los datos observados.

### 2.3. Componentes Modificados

#### Base de Datos (SQL)
*   **Migración:** `2026-02-04120000_separate_industry_daily_data.sql`
    *   Crea tabla diaria.
    *   Migra datos existentes.
    *   Limpia tabla de ventanas.
    *   Actualiza función `calculate_industry_windows_from_returns` para leer de la nueva fuente.

#### Scripts de Backend (TypeScript)
1.  **`scripts/backfill/backfill-industry-performance.ts`**:
    *   Ahora escribe directamente en `industry_performance_daily`.
    *   Eliminada la dependencia de `window_code` para la ingesta diaria.

2.  **`scripts/backfill/calculate-industry-windows.ts`**:
    *   Actualizado para detectar la fecha más reciente desde `industry_performance_daily`.
    *   Ejecuta la agregación que escribe en `industry_performance` con la marca de fuente `derived_from_industry_daily_returns`.

#### Frontend (SnapshotTab)
*   **Análisis:** Se verificó `components/tabs/SnapshotTab.tsx` y el hook `useAlphaPerformance`.
*   **Conclusión:** El frontend **NO requirió cambios**. Consume de `performance_windows`, que es una vista materializada (o tabla derivada final) que se alimenta correctamente de los datos recalculados aguas arriba. El gráfico refleja automáticamente la mayor precisión de los datos.

## 3. Verificación y Resultados

1.  **Integridad de Datos:**
    *   `industry_performance_daily`: Contiene ~215,000 registros diarios históricos.
    *   `industry_performance`: Contiene 0 registros de tipo `1D` (limpieza exitosa).
    *   `performance_windows`: Se verificó la existencia de cálculos de Alpha para MSFT con fecha `2026-02-02`.

2.  **Flujo de Datos Confirmado:**
    `FMP API` -> `industry_performance_daily` (Raw) -> `SQL Aggregation` -> `industry_performance` (Windows) -> `Performance Aggregator` -> `performance_windows` -> `SnapshotTab (UI)`

3.  **Estado Final:**
    El sistema es ahora más robusto, auditable y cumple con los estándares de arquitectura financiera de Fintra.

## 4. Alineación de SectorScatterChart (Actualización)

Se ha estandarizado el gráfico de dispersión "Calidad vs Alpha" para cumplir con la fuente de verdad canónica.

1.  **Fuente de Verdad:**
    *   Se eliminó el uso de campos legacy (`relativeReturn1Y`) calculados en el frontend o derivados de fuentes mixtas.
    *   Ahora se consume estrictamente `alpha` desde la tabla `performance_windows` con `window_code = '1Y'`.

2.  **Expansión de Datos:**
    *   Se extendió `EnrichedStockData` para incluir `alphaVsIndustry1Y` y `alphaVsSector1Y`.
    *   Se modificó `lib/actions/sector-analysis.ts` para realizar un "join" en memoria con `performance_windows` y poblar estos valores de forma eficiente (batch query).

3.  **Interfaz de Usuario:**
    *   Se añadió un control (Toggle) en el gráfico para alternar la vista entre "Alpha vs Industry" y "Alpha vs Sector".
    *   Esto permite al analista visualizar el posicionamiento competitivo con mayor granularidad sin recargar la página.

4.  **Validación:**
    *   Se asegura que solo se muestren puntos con datos de Alpha y FGOS válidos.
    *   Se mantiene la coherencia visual con la paleta de colores de IFS.

## 5. Resolución de Incidencias Post-Despliegue

### 5.1. Visibilidad de TablaIFS
Se reportó que el componente `TablaIFS` no era visible en `SectorAnalysisPanel` tras los cambios recientes.

*   **Causa Raíz:** Error de referencia (`ReferenceError: windowsByTicker is not defined`) en la Server Action `fetchSectorStocks`. Al intentar optimizar la consulta de ventanas de rendimiento, se omitió la inicialización del mapa de datos, provocando que la función fallara silenciosamente (retornando array vacío por el bloque `try/catch`).
*   **Solución:** Se implementó correctamente la carga paralela (`Promise.all`) de `fintra_snapshots` y `performance_windows` en `lib/actions/sector-analysis.ts`, asegurando que el mapa `windowsByTicker` esté disponible antes de su uso.
*   **Resultado:** Los datos fluyen correctamente hacia `TablaIFS` y `SectorScatterChart`, restaurando la visualización y asegurando que los valores de Alpha sean consistentes entre la tabla y el gráfico.

# Auditoría Técnica Maestra: Fintra

**Versión:** 1.0 (Consolidada)
**Fecha:** 24 de Enero de 2026
**Alcance:** Arquitectura, Flujo de Datos y Contrato de Dominio.

---

## 1. Qué es Fintra

Fintra es una **plataforma de análisis financiero institucional** diseñada para resolver el problema de la asimetría de información y la inconsistencia en la evaluación de activos bursátiles.

### 1.1 Naturaleza del Sistema
*   **Tipo:** Motor de Análisis Fundamental Automatizado.
*   **Core:** Procesamiento batch de estados financieros masivos (Bulk Data).
*   **Salida:** Puntuaciones estandarizadas (Scores) y Snapshots inmutables.

### 1.2 Qué Problemas Resuelve
1.  **Fragmentación:** Unifica datos financieros dispersos en un modelo coherente.
2.  **Subjetividad:** Reemplaza opiniones con algoritmos deterministas (FGOS, IFS).
3.  **Ruido:** Filtra el universo de inversión separando "señal" (calidad) de "ruido" (volatilidad).

### 1.3 Qué NO es Fintra
*   **NO es un Trading Bot:** No ejecuta órdenes de compra/venta.
*   **NO es un Generador de Señales:** No predice precios futuros (Forecasting).
*   **NO es un Asesor Financiero:** No emite recomendaciones personalizadas.
*   **NO es "Real-Time":** Su valor reside en el análisis estructural (cierres diarios/trimestrales), no en el tick-by-tick.

---

## 2. Principios No Negociables

Estas reglas son la base de la integridad del sistema y no admiten excepciones.

### 2.1 Determinismo
*   **Regla:** `Input A + Lógica B = Resultado C` (Siempre).
*   **Implementación:** Todo cálculo financiero reside en funciones puras dentro de `lib/engine`.
*   **Efecto:** Si se re-procesa un año fiscal pasado, el resultado debe ser idéntico al original (salvo correcciones de datos origen).

### 2.2 Snapshots Inmutables
*   **Regla:** El análisis es una fotografía en el tiempo.
*   **Implementación:** Tabla `fintra_snapshots`.
*   **Efecto:** Un cambio en el precio de hoy no altera el FGOS calculado ayer. El historial se preserva intacto para auditoría.

### 2.3 Separación de Capas
*   **Regla:** Quien ingesta no calcula; quien calcula no muestra.
*   **Implementación:**
    *   `app/api/cron`: Solo ingestión (Write).
    *   `lib/engine`: Solo lógica de negocio (Pure Logic).
    *   `components`: Solo visualización (Read-Only).

### 2.4 No Inferencia / No Forecasting
*   **Regla:** Ante ausencia de datos, el sistema se detiene o marca `pending`.
*   **Prohibido:** Rellenar huecos con promedios, proyectar trimestres futuros o adivinar sectores.
*   **Referencia:** `pendingnoeserror.md`.

---

## 3. Arquitectura por Capas

El sistema se organiza en 4 capas estrictas con responsabilidades únicas.

### Capa 1: Ingestión (Raw Data)
*   **Responsabilidad:** Traer datos del mundo exterior (FMP) al sistema.
*   **Ubicación:** `app/api/cron/` y scripts en `scripts/`.
*   **Componentes Clave:**
    *   `sync-universe`: Mantiene el maestro de tickers.
    *   `financials-bulk`: Descarga masiva de Balances, Income y Cashflow.
    *   `prices-daily-bulk`: Series de precios ajustados.
*   **Persistencia:** Tablas Grupo A (Maestros) y Grupo B (Series Temporales).

### Capa 2: Dominio (Definitions)
*   **Responsabilidad:** Definir el lenguaje común del sistema.
*   **Ubicación:** `lib/engine/types.ts`.
*   **Elementos:** Interfaces de `Snapshot`, `FgosResult`, `IFSResult`.
*   **Estado:** Estas definiciones son el contrato entre el Engine y la UI.

### Capa 3: Engine (Business Logic)
*   **Responsabilidad:** Transformar datos crudos en métricas de valor.
*   **Ubicación:** `lib/engine/`.
*   **Módulos:**
    *   `fintra-brain.ts`: Orquestador de cálculo (FGOS).
    *   `ifs.ts`: Industry Fit Score (Posicionamiento relativo).
    *   `benchmarks.ts`: Cálculo de medianas sectoriales.
*   **Persistencia:** Tabla `fintra_snapshots` (Grupo C).

### Capa 4: Consumo (Presentation)
*   **Responsabilidad:** Servir datos procesados al usuario final.
*   **Ubicación:** `lib/repository/fintra-db.ts` (Acceso) y `components/` (UI).
*   **Regla de Oro:** La UI nunca recalcula métricas financieras. Solo formatea y muestra.

---

## 4. Flujo de Datos End-to-End

### Paso 1: Ingestión (Nocturna)
1.  **FMP API** entrega archivos CSV masivos.
2.  **Cron Jobs** (`app/api/cron/*-bulk`) procesan y limpian datos básicos.
3.  **Destino:** Tablas `datos_financieros`, `datos_valuacion`, `fintra_universe`.

### Paso 2: Procesamiento (Batch)
1.  **Trigger:** Finalización de ingestión o ejecución programada.
2.  **Engine:** Lee `datos_financieros` + `datos_valuacion`.
3.  **Cálculo:** Genera FGOS, IFS y Valoración Relativa.
4.  **Destino:** `UPSERT` en `fintra_snapshots`.

### Paso 3: Agregación (Sectorial)
1.  **Aggregators:** Leen los nuevos snapshots.
2.  **Cálculo:** Actualizan medianas sectoriales y rankings.
3.  **Destino:** `sector_benchmarks`, `industry_performance`.

### Paso 4: Visualización (On-Demand)
1.  **Usuario:** Consulta un ticker en la Web.
2.  **Repository:** `getLatestSnapshot(ticker)` lee la tabla de snapshots.
3.  **UI:** Renderiza semáforos, gráficos y tablas sin lógica matemática compleja.

---

## 5. Contrato de Dominio

Definiciones congeladas de los conceptos nucleares.

### 5.1 Ticker
Identificador único de un activo negociable (ej. AAPL).
*   **Restricción:** Solo Equity/ETF. Se excluyen Warrants y Bonos.
*   **Fuente:** `fintra_universe`.

### 5.2 Snapshot
La unidad atómica de análisis de Fintra.
*   **Composición:** Fecha + Ticker + FGOS + IFS + Valoración.
*   **Propiedad:** Inmutable una vez escrito (salvo corrección de errores).

### 5.3 FGOS (Financial Grade Operating Score)
Medida absoluta de calidad fundamental (0-100).
*   **Componentes:** Calidad de Beneficios, Eficiencia, Solvencia.
*   **Semáforo:** >80 (Excelencia), 60-80 (Calidad), <60 (Riesgo).

### 5.4 IFS (Industry Fit Score)
Medida relativa de posición competitiva.
*   **Estados:** `Leader` (Top decil), `Follower` (Promedio), `Laggard` (Cola inferior).
*   **Base:** Comparación estricta contra pares de la misma Industria (no Sector).

### 5.5 Valuation Verdict
Estado de la valoración relativa histórica.
*   **Lógica:** Comparación de múltiplos actuales vs historia propia (5Y).
*   **Estados:** `Undervalued`, `Fair`, `Overvalued`.
*   **Nota:** No es una señal de compra, es una medida de desviación estadística.

---

## 6. Límites Explícitos del Sistema

Para garantizar la integridad, Fintra declara explícitamente lo que NO hace.

### 6.1 Límites Funcionales
*   El sistema no "rellena" trimestres faltantes. Si FMP no reporta Q3, el año fiscal queda incompleto o `pending`.
*   El sistema no normaliza monedas automáticamente. Compara ratios (adimensionales) para evitar ruido cambiario.

### 6.2 Garantías (SLA)
*   **Integridad:** Los datos mostrados coinciden matemáticamente con los estados financieros ingestados.
*   **Latencia:** Los datos fundamentales tienen latencia de T+1 (Cierre de mercado). No es un sistema de HFT (High Frequency Trading).

### 6.3 Prevención de Errores Comunes
*   **Cheap != Value:** Un `Valuation Verdict: Undervalued` con `FGOS: <40` se marca visualmente como "Trampa de Valor", no como oportunidad.
*   **Growth != Quality:** Una empresa con alto crecimiento de ventas pero flujo de caja negativo recibe penalización en FGOS, evitando el hype de "crecimiento a cualquier costo".

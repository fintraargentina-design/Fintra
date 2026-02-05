# 📊 INFORME DE CONCEPTOS FUNDAMENTALES - FINTRA

**Fecha de Extracción:** 2026-02-05  
**Propósito:** Contexto para análisis externo  
**Fuente:** Documentación técnica oficial de Fintra

---

## 🎯 RESUMEN EJECUTIVO

Este documento extrae y sintetiza 3 conceptos fundamentales del sistema de análisis financiero Fintra:

1. **Valoración Relativa** (Relative Valuation)
2. **Competitive Position** (IFS/IQS)
3. **Calidad Fundamental** (Quality Brakes, FGOS, Sentiment, Moat)

**Principio Arquitectónico Central:**

> "Fintra no inventa datos. Fintra calcula con lo que existe, marca lo que falta y explica por qué."

---

## 1️⃣ VALORACIÓN RELATIVA (Relative Valuation)

### ¿Qué es?

Sistema de análisis de precio relativo que compara múltiplos de valoración de una empresa **contra su sector** usando distribución de percentiles.

### Ubicación en la Arquitectura

```
Layer 2 (TTM Pre-calculated)
    ↓
datos_valuacion_ttm (TTM PE, EV/EBITDA, etc.)
    ↓
Sector Benchmarks (sector_benchmarks table)
    ↓
Valuation Engine (lib/engine/fintra-brain.ts)
    ↓
fintra_snapshots.valuation_relative
```

### Estructura de Datos

```typescript
valuation_relative: {
  status: "computed" | "pending",
  verdict?: "Very Cheap" | "Cheap" | "Fair" | "Expensive" | "Very Expensive",
  percentile?: number,  // 0-100 (posición dentro del sector)
  confidence?: "Low" | "Medium" | "High"
}
```

### Metodología

1. **TTM Construction:** Suma últimos 4 quarters (NUNCA promedios)
   - Revenue TTM = Q1 + Q2 + Q3 + Q4
   - Earnings TTM = Q1 + Q2 + Q3 + Q4
2. **Ratio Calculation:**
   - PE Ratio = Market Cap / TTM Net Income
   - EV/EBITDA = Enterprise Value / TTM EBITDA
   - PB Ratio = Market Cap / Book Value

3. **Sector Percentile:**
   - Compara ratio del ticker vs distribución sectorial
   - Percentil 0 = más barato del sector
   - Percentil 100 = más caro del sector

4. **Verdict Assignment:**
   - **Very Cheap:** Percentil 0-20
   - **Cheap:** Percentil 20-40
   - **Fair:** Percentil 40-60
   - **Expensive:** Percentil 60-80
   - **Very Expensive:** Percentil 80-100

### Reglas de Calidad

**✅ Correcto:**

```json
{
  "status": "computed",
  "verdict": "Cheap",
  "percentile": 25,
  "confidence": "High"
}
```

**❌ Incorrecto (no se hace nunca):**

```json
{
  "status": "computed",
  "verdict": "Fair", // ← NUNCA se infiere
  "percentile": null // ← Si no hay percentil, status debe ser "pending"
}
```

### Limitaciones Conocidas

- Requiere mínimo 4 quarters consecutivos para TTM válido
- `status: 'pending'` cuando:
  - Faltan datos de precio (market cap)
  - Faltan estados financieros (< 4 quarters)
  - Sector no clasificado
  - Benchmark sectorial incompleto (< 20 empresas)

### Casos de Uso

**Ejemplo 1: Valoración Fair con datos completos**

```json
{
  "ticker": "AAPL",
  "valuation_relative": {
    "status": "computed",
    "verdict": "Fair",
    "percentile": 52,
    "confidence": "High"
  }
}
```

**Interpretación:** Apple está en percentil 52 de su sector → Valoración neutra.

**Ejemplo 2: Datos insuficientes**

```json
{
  "ticker": "NEWIPO",
  "valuation_relative": {
    "status": "pending",
    "reason": "Insufficient financial history (< 4 quarters)"
  }
}
```

---

## 2️⃣ COMPETITIVE POSITION (IFS/IQS)

### IFS (Industry Financial Standing)

#### Definición

Sistema de clasificación que evalúa la **posición competitiva relativa** de una empresa dentro de su industria usando **momentum windows** (ventanas de tiempo).

#### Estructura de Datos

```typescript
ifs: {
  position: "leader" | "follower" | "laggard",
  pressure?: number,      // 0-3 (bloques que confirman posición)
  confidence?: number,    // 0-100
  interpretation?: string,
  confidence_label?: "High" | "Medium" | "Low"
}
```

#### Metodología: Block Voting System

**3 bloques temporales con pesos diferenciados:**

| Bloque    | Ventanas   | Votos   |
| --------- | ---------- | ------- |
| **SHORT** | 1M, 3M     | 2 votos |
| **MID**   | 6M, 1Y, 2Y | 3 votos |
| **LONG**  | 3Y, 5Y     | 2 votos |

**Total:** 7 votos

**Clasificación:**

- **Leader:** Gana 2 de 3 bloques (mayoría)
- **Laggard:** Pierde 2 de 3 bloques (mayoría)
- **Follower:** 1-1-1 o sin mayoría clara

**Pressure (Presión Competitiva):**

- **0:** Sin soporte (clasificación débil)
- **1:** 1/3 bloques confirman
- **2:** 2/3 bloques confirman
- **3:** 3/3 bloques confirman (clasificación fuerte)

#### Ejemplo Real

```json
{
  "ticker": "AAPL",
  "ifs": {
    "position": "laggard",
    "pressure": 2,
    "confidence": 85,
    "interpretation": "Laggard with 2/3 blocks supporting (High confidence)"
  }
}
```

**Interpretación:** Apple clasificada como laggard en su sector, con 2 de 3 bloques temporales confirmando esta posición. Alta confianza (85%).

#### IFS Memory (Memoria Temporal)

Sistema retrospectivo de 5 años que rastrea evolución de la posición competitiva.

```typescript
ifs_memory: {
  window_years: 5,           // Ventana máxima
  observed_years: number,    // Años realmente disponibles (1-5)
  distribution: {
    leader: number,          // Cuántos snapshots como leader
    follower: number,
    laggard: number
  },
  timeline: string[],        // Evolución cronológica
  current_streak: {
    position: string,
    years: number            // Años consecutivos en esta posición
  }
}
```

**Ejemplo:**

```json
{
  "window_years": 5,
  "observed_years": 3,
  "distribution": {
    "leader": 1,
    "follower": 1,
    "laggard": 1
  },
  "timeline": ["laggard", "follower", "leader"],
  "current_streak": {
    "position": "leader",
    "years": 1
  }
}
```

**Interpretación:** Empresa con 3 años de historia, transición de laggard → follower → leader. Actualmente en racha de 1 año como leader.

---

### IQS (Industry Quality Score - también llamado IFS_FY)

#### Diferencia con IFS

| Aspecto        | IFS                          | IQS                                 |
| -------------- | ---------------------------- | ----------------------------------- |
| **Naturaleza** | Momentum (live windows)      | Structural (annual)                 |
| **Ventanas**   | 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y   | FY 2021, FY 2022, FY 2023           |
| **Referencia** | Competidores del sector      | Competidores de industria           |
| **Pregunta**   | "¿Quién está ganando ahora?" | "¿Quién es estructuralmente mejor?" |
| **Temporal**   | Modelo de memoria 5 años     | Percentil por FY                    |

#### Metodología IQS

**1. Métricas Anuales (FY):**

- ROIC (30%)
- Operating Margin (25%)
- Revenue Growth (20%)
- Leverage (15%)
- FCF Yield (10%)

**2. Percentile Scoring:**
Compara cada métrica vs distribución de industria (no sector).

**3. Output:**

```typescript
iqs: {
  fy_2023: number,  // Percentil 0-100
  fy_2022: number,
  fy_2021: number,
  confidence: number
}
```

---

## 3️⃣ CALIDAD FUNDAMENTAL

Concepto compuesto por 4 subsistemas independientes:

### A. QUALITY BRAKES (Frenos de Calidad)

#### Definición

Señales automáticas de **riesgo financiero estructural** que activan alertas cuando se detecta:

1. **Estrés financiero agudo** (Altman Z-Score)
2. **Deterioro fundamental o baja calidad de datos** (Piotroski F-Score)

#### Estructura

```typescript
quality_brakes: {
  applied: boolean,         // ¿Se activó algún freno?
  reasons: string[],        // Lista de motivos
  altman_z?: number,       // Z-Score calculado
  piotroski?: number       // F-Score calculado
}
```

#### FRENO 1: Altman Z-Score < 1.8

**¿Qué es?**
Modelo predictivo de quiebra (Edward Altman, 1968) que combina 5 ratios financieros:

**Fórmula:**

```
Z = 1.2×(WC/TA) + 1.4×(RE/TA) + 3.3×(EBIT/TA) + 0.6×(MVE/TL) + 1.0×(Sales/TA)
```

Donde:

- **WC/TA:** Working Capital / Total Assets (liquidez)
- **RE/TA:** Retained Earnings / Total Assets (rentabilidad acumulada)
- **EBIT/TA:** Earnings Before Interest & Tax / Total Assets (eficiencia operativa)
- **MVE/TL:** Market Value Equity / Total Liabilities (solvencia)
- **Sales/TA:** Sales / Total Assets (rotación de activos)

**Interpretación:**

| Z-Score        | Zona            | Significado                                         |
| -------------- | --------------- | --------------------------------------------------- |
| **< 1.8**      | 🔴 **Distress** | Alto riesgo de quiebra (72% probabilidad en 2 años) |
| **1.8 - 2.99** | 🟡 **Grey**     | Zona gris - monitoreo requerido                     |
| **≥ 3.0**      | 🟢 **Safe**     | Zona segura - bajo riesgo financiero                |

**Cuándo se activa:**

```typescript
if (altmanZ !== null && altmanZ < 1.8) {
  reasons.push("Altman Z < 1.8 (distress zone)");
}
```

**Miradas sugeridas si se activa:**

1. **Liquidez inmediata:** Revisar current ratio, vencimientos de deuda corto plazo
2. **Estructura de capital:** Debt-to-Equity, cobertura de intereses
3. **Operaciones:** ¿Márgenes comprimidos? ¿FCF positivo últimos 12 meses?
4. **Contexto sectorial:** ¿Problema específico o del sector completo?

#### FRENO 2: Piotroski F-Score ≤ 3

**¿Qué es?**
Sistema de scoring financiero (Joseph Piotroski, 2000) que evalúa salud fundamental en **9 dimensiones binarias** (0 o 1).

**Las 9 Dimensiones:**

**A. PROFITABILIDAD (4 puntos)**

1. ROA Positivo: ¿Net Income > 0?
2. OCF Positivo: ¿Operating Cash Flow > 0?
3. ROA Creciente: ¿ROA este año > ROA año anterior?
4. Quality of Earnings: ¿OCF > Net Income? (accruals bajos)

**B. LEVERAGE, LIQUIDEZ Y FUENTE DE FONDOS (3 puntos)** 5. Deuda Decreciente: ¿Long-term Debt bajó vs año anterior? 6. Liquidez Creciente: ¿Current Ratio mejoró? 7. No Dilución: ¿Shares outstanding NO aumentaron?

**C. EFICIENCIA OPERATIVA (2 puntos)** 8. Margen Creciente: ¿Gross Margin mejoró? 9. Asset Turnover Creciente: ¿Sales/Assets mejoró?

**Interpretación:**

| F-Score | Categoría       | Significado                               |
| ------- | --------------- | ----------------------------------------- |
| **0-3** | 🔴 **Débil**    | Deterioro fundamental o datos incompletos |
| **4-6** | 🟡 **Promedio** | Fundamentales mixtos                      |
| **7-9** | 🟢 **Fuerte**   | Salud fundamental sólida                  |

**Cuándo se activa:**

```typescript
if (piotroski !== null && piotroski <= 3) {
  reasons.push("Piotroski F-Score ≤ 3 (weak fundamentals or data quality)");
}
```

**Miradas sugeridas si se activa:**

1. **Calidad de datos:** ¿Todos los campos poblados? ¿Gaps en historical data?
2. **Tendencia operativa:** ¿ROA cayendo? ¿OCF negativo recurrente?
3. **Estructura de balance:** ¿Deuda aumentó? ¿Liquidez deteriorada?
4. **Márgenes y eficiencia:** ¿Gross margin comprimido? ¿Asset turnover cayó?

**Ejemplo: Freno activado**

```json
{
  "quality_brakes": {
    "applied": true,
    "reasons": ["Altman Z < 1.8 (distress zone)"],
    "altman_z": 1.45,
    "piotroski": 6
  }
}
```

**Interpretación:** Empresa con fundamentales operativos aceptables (F-Score 6) pero estructura de capital estresada (Z-Score 1.45). **Foco:** Revisar vencimientos de deuda y capacidad de refinanciamiento.

---

### B. FGOS (Financial Growth & Operations Score)

#### Definición

Score absoluto (0-100) que mide la **calidad operativa y financiera** de una empresa comparando sus métricas contra benchmarks sectoriales.

#### Estructura

```typescript
fgos_status: "computed" | "pending",
fgos_score: number | null,        // 0-100
fgos_confidence: number | null,   // 0-100 (OBLIGATORIO si computed)
fgos_category: "High" | "Medium" | "Low" | null
```

#### Dimensiones Evaluadas

**1. PROFITABILITY (30%)**

- ROIC (Return on Invested Capital)
- ROE (Return on Equity)
- ROA (Return on Assets)

**2. EFFICIENCY (25%)**

- Operating Margin
- ROA
- Asset Turnover

**3. SOLVENCY (20%)**

- Debt/Equity
- Current Ratio
- Interest Coverage Ratio

**4. GROWTH (25%)**

- Revenue growth
- Income growth

#### Metodología

```
1. Calcular métricas del ticker
     ↓
2. Comparar vs sector_benchmarks (percentiles)
     ↓
3. Ponderar dimensiones (30%, 25%, 20%, 25%)
     ↓
4. Calcular FGOS Score (0-100)
     ↓
5. Aplicar Quality Brakes (si Altman Z < 1.8 o Piotroski ≤ 3)
     ↓
6. Asignar Confidence (basado en calidad de datos)
```

#### Confidence Interpretation

- **80-100:** High confidence (datos completos, sector validado)
- **60-79:** Medium confidence (algunos datos faltantes)
- **<60:** Low confidence (datos limitados o sector pequeño)

#### Reglas Críticas

**✅ Correcto:**

```json
{
  "fgos_status": "computed",
  "fgos_score": 85,
  "fgos_confidence": 92,
  "fgos_category": "High"
}
```

**✅ También correcto (datos insuficientes):**

```json
{
  "fgos_status": "pending",
  "fgos_score": null,
  "fgos_confidence": null,
  "reason": "Sector missing"
}
```

**❌ NUNCA hacer:**

```json
{
  "fgos_status": "computed",
  "fgos_score": 75,
  "fgos_confidence": null // ← ERROR: confidence es OBLIGATORIO si computed
}
```

---

### C. SENTIMENT (Sentimiento de Mercado)

#### Definición

Análisis del sentimiento emocional agregado del mercado hacia el activo, basado en **desviación relativa del precio** vs sector.

#### Metodología

**1. Cálculo de Relative Deviation:**

```typescript
// Para cada ticker en el sector
const returns = tickers.map((t) => t.return_1y);

// Usar MEDIANA (no media - robustez contra outliers)
const medianReturn = calculateMedian(returns);

// Desviación relativa
const relativeDeviation = tickerReturn - medianReturn;
```

**2. Clasificación:**

- **Positivo (Optimismo):** Desviación > +X%
- **Neutro:** Desviación entre -X% y +X%
- **Negativo (Pesimismo):** Desviación < -X%

**Nota:** Fix implementado Feb 2026 - cambio de mean a median para robustez contra outliers.

#### Casos de Uso

**Contrarian:** ¿Pesimismo ante fundamentales estables?
**Momentum:** ¿Optimismo fuerte ignorando riesgos?
**Validación:** ¿Sentimiento alineado con fundamentales?

---

### D. MOAT (Ventaja Competitiva)

#### Definición

Análisis de la **calidad del crecimiento** mediante la relación entre expansión de ingresos y márgenes.

#### Clasificaciones

**1. High Quality Growth:**

- Revenue ↑ + Margin ↑
- Interpretación: Poder de precios, ventaja competitiva persistente

**2. Inefficient Growth:**

- Revenue ↑ + Margin ↓
- Interpretación: Crecimiento con deterioro de rentabilidad

**3. Neutral:**

- Otros casos (crecimiento orgánico estándar)

#### Coherence Check

Feature adicional que valida consistencia entre:

- Crecimiento de Capital Invertido
- Evolución del ROIC

**Value Creation:** Capital ↑ + ROIC ↑/Estable
**Value Destruction:** Capital ↑ + ROIC ↓
**Stagnation:** Capital estable

---

## 📊 INTEGRACIÓN: Flujo Completo de Datos

```
┌─────────────────────────────────────────────┐
│     LAYER 1: RAW DATA INGESTION             │
│  FMP API → company_profiles, datos_financieros │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│     LAYER 2: TRANSFORMATION & AGGREGATION   │
│  TTM Calculator → datos_valuacion_ttm       │
│  Performance Windows → performance_windows  │
│  Sector Benchmarks → sector_benchmarks      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│     LAYER 3: SCORING & ENGINES              │
│  FGOS Engine → Calcula Quality Score        │
│  IFS Engine → Calcula Industry Position     │
│  IQS Engine → Calcula Structural Quality    │
│  Moat & Sentiment → Competitive Analysis    │
│  Valuation → Relative Positioning           │
│  Quality Brakes → Risk Alerts               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│     fintra_snapshots (FINAL OUTPUT)         │
│  - fgos_status, fgos_score, fgos_confidence │
│  - ifs, ifs_memory                          │
│  - quality_brakes                           │
│  - valuation_relative                       │
│  - moat, sentiment                          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│     CONSUMPTION LAYER                       │
│  Web Client (Next.js) / Desktop (C#/.NET)   │
│  Read-only desde snapshots                  │
└─────────────────────────────────────────────┘
```

---

## 🔐 PRINCIPIOS DE DISEÑO (CRÍTICOS)

### 1. Fintra Nunca Inventa Datos

**Regla:**

- Si dato falta → `NULL` o `status: 'pending'`
- NUNCA usar defaults (ej. `sector = "Unknown"`)
- NUNCA inferir sector desde nombre de empresa

**Ejemplo correcto:**

```json
{
  "fgos_status": "pending",
  "fgos_score": null,
  "reason": "Sector missing"
}
```

### 2. Pending No Es Un Error

**Regla:**

- Datos faltantes son ESPERADOS, no errores
- `status: 'pending'` es un estado válido
- NUNCA abortar snapshot si un engine falla

### 3. Fault Tolerance en Cron Jobs

**Regla:**

- Error en 1 ticker NO debe detener el loop
- Error en 1 chunk NO debe abortar el cron
- Siempre log: START, OK, FAILED

**Patrón correcto:**

```typescript
for (const ticker of tickers) {
  try {
    await processSnapshot(ticker);
    console.log(`[${ticker}] SNAPSHOT OK`);
  } catch (error) {
    console.error(`[${ticker}] SNAPSHOT FAILED:`, error);
    // Continue with next ticker - NO throw
  }
}
```

### 4. Temporal Consistency

**Regla:**

- NUNCA mezclar fechas de mercado con fechas de periodo financiero
- NUNCA usar datos futuros para cálculos pasados (look-ahead bias)
- Siempre usar `as_of_date` para point-in-time calculations

---

## 📚 REFERENCIAS ACADÉMICAS

- **Altman Z-Score:** Altman, E. (1968). "Financial Ratios, Discriminant Analysis and the Prediction of Corporate Bankruptcy"
- **Piotroski F-Score:** Piotroski, J. (2000). "Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers"

---

## 🎯 CASOS DE USO PRÁCTICOS

### Caso 1: Empresa Saludable

```json
{
  "ticker": "MSFT",
  "fgos_status": "computed",
  "fgos_score": 88,
  "fgos_confidence": 95,
  "ifs": {
    "position": "leader",
    "pressure": 3,
    "confidence": 92
  },
  "quality_brakes": {
    "applied": false,
    "altman_z": 4.2,
    "piotroski": 8
  },
  "valuation_relative": {
    "status": "computed",
    "verdict": "Fair",
    "percentile": 55
  }
}
```

**Interpretación:**

- Calidad operativa excelente (FGOS 88)
- Líder competitivo con soporte fuerte (IFS leader, pressure 3)
- Sin alertas de riesgo (Z-Score 4.2, F-Score 8)
- Valoración neutra (percentil 55)

### Caso 2: Empresa en Distress

```json
{
  "ticker": "DISTRESS",
  "fgos_status": "computed",
  "fgos_score": 35,
  "fgos_confidence": 78,
  "ifs": {
    "position": "laggard",
    "pressure": 2,
    "confidence": 85
  },
  "quality_brakes": {
    "applied": true,
    "reasons": [
      "Altman Z < 1.8 (distress zone)",
      "Piotroski F-Score ≤ 3 (weak fundamentals)"
    ],
    "altman_z": 1.2,
    "piotroski": 2
  },
  "valuation_relative": {
    "status": "computed",
    "verdict": "Very Cheap",
    "percentile": 8
  }
}
```

**Interpretación:**

- Calidad operativa baja (FGOS 35)
- Rezagado competitivo (IFS laggard)
- **ALERTAS CRÍTICAS:** Riesgo de quiebra alto (Z 1.2) + fundamentales deteriorados (F 2)
- Valoración muy barata (percentil 8) → Posible value trap

**Acción sugerida:** Análisis de liquidez urgente, revisar vencimientos de deuda.

### Caso 3: Datos Insuficientes

```json
{
  "ticker": "NEWIPO",
  "fgos_status": "pending",
  "fgos_score": null,
  "reason": "Insufficient metrics",
  "ifs": null,
  "quality_brakes": {
    "applied": false,
    "altman_z": null,
    "piotroski": null
  },
  "valuation_relative": {
    "status": "pending",
    "reason": "Insufficient financial history (< 4 quarters)"
  }
}
```

**Interpretación:**

- Empresa sin historia suficiente
- Todos los engines en estado `pending`
- **NO es un error** - es el comportamiento esperado para IPOs recientes

---

## 📖 GLOSARIO

**TTM (Trailing Twelve Months):** Suma de últimos 4 quarters consecutivos.

**Percentile Scoring:** Posición relativa (0-100) dentro de distribución sectorial.

**Block Voting:** Sistema de votación ponderada por bloques temporales.

**Point-in-time:** Cálculo usando solo datos disponibles en una fecha específica (sin look-ahead bias).

**Look-ahead Bias:** Error de usar datos futuros en cálculos históricos.

**Fault Tolerance:** Capacidad de un sistema de continuar operando ante errores parciales.

**Idempotent:** Operación que produce el mismo resultado si se ejecuta múltiples veces.

---

**FIN DEL INFORME**

---

## 📄 METADATA

**Autor:** Sistema de Documentación Técnica Fintra  
**Última Actualización:** 2026-02-05  
**Versión:** 1.0  
**Alcance:** Conceptos fundamentales para contexto externo  
**Audiencia:** Analistas financieros, desarrolladores, consultores externos

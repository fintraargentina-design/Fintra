# 📊 INFORME DE CONCEPTOS FUNDAMENTALES - FINTRA

**Fecha de Extracción:** 2026-02-07  
**Propósito:** Contexto para análisis externo  
**Fuente:** Documentación técnica oficial de Fintra

---

## 🎯 RESUMEN EJECUTIVO

Este documento extrae y sintetiza los conceptos fundamentales del sistema de análisis financiero Fintra:

1. **Valoración Relativa** (Relative Valuation)
2. **Competitive Position** (IFS/IQS)
3. **Calidad Fundamental** (Quality Brakes, FGOS, Competitive Advantage, Moat, Sentiment)
4. **Cash Flow Quality** (Dividend Quality, Relative Return)
5. **Síntesis Integradora** (Fintra Verdict)

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

### D. MOAT (Ventaja Competitiva Sostenible)

#### Definición

Score (0-100) que evalúa la **persistencia de ventajas competitivas** mediante análisis de ROIC histórico y estabilidad de márgenes operativos.

#### Estructura

```typescript
moat: {
  score: number | null,              // 0-100
  status: "computed" | "partial" | "pending",
  confidence: number | null,
  coherenceCheck?: {
    score: number,
    verdict: "High Quality Growth" | "Neutral" | "Inefficient Growth",
    explanation: string
  },
  details?: {
    roic_persistence: number,
    margin_stability: number,
    capital_discipline?: number,
    years_analyzed: number
  }
}
```

#### Componentes (Scoring)

**1. ROIC Persistence (50%):**

- Promedio histórico de ROIC
- Desviación estándar (menor volatilidad = mejor)
- Penalización por años con ROIC < 5%

**Scoring:**

- ROIC > 25% consistente → 90-100
- ROIC 15-25% estable → 70-89
- ROIC 10-15% → 50-69
- ROIC < 10% → <50

**2. Margin Stability (50%):**

- Volatilidad de márgenes operativos (SD)
- Episodios de expansión de margen durante crecimiento

**Scoring:**

- SD < 3% → 90-100
- SD 3-6% → 70-89
- SD 6-10% → 50-69
- SD > 10% → <50

#### Coherence Check (Feature Adicional)

Detecta si el crecimiento viene con **pricing power** (márgenes se expanden) o **presión competitiva** (márgenes se erosionan).

**Inputs:**

- `revenueGrowth`: % de crecimiento (e.g., 0.25 = 25%)
- `operatingMarginChange`: Cambio en pp (e.g., -0.01 = -1pp)

**Verdicts:**

| Verdict                 | Condición                      | Score | Interpretación                          |
| ----------------------- | ------------------------------ | ----- | --------------------------------------- |
| **High Quality Growth** | Revenue +5%+ Y Margin ≥0       | 100   | Pricing power, apalancamiento operativo |
| **Neutral**             | Revenue +5%+ Y Margin -1pp a 0 | 70    | Presión menor aceptable                 |
| **Inefficient Growth**  | Revenue +5%+ Y Margin <-1pp    | 30    | Crecimiento a expensas de rentabilidad  |

**Ejemplos:**

- **Apple 2010-2020:** Revenue +10%, Margin +3pp → High Quality Growth (100)
- **Amazon Retail 2012-2015:** Revenue +25%, Margin -2pp → Inefficient Growth (30)

#### Capital Discipline (Pilar Opcional - 3ª Dimensión)

Evalúa si la empresa **crea valor** cuando reinvierte capital.

**Lógica:**

- **Value Creation:** Capital ↑ Y ROIC mantiene/mejora
- **Value Destruction:** Capital ↑ pero ROIC cae

**Scoring:**

| Escenario                  | Score | Ejemplo                                  |
| -------------------------- | ----- | ---------------------------------------- |
| Capital +30%, ROIC +5pp    | 100   | AAPL (Capital +120%, ROIC 35%→40%)       |
| Capital +30%, ROIC estable | 80    | MSFT (Capital +80%, ROIC 30%→31%)        |
| Capital +30%, ROIC -5pp    | 30    | AMZN Retail (Capital +150%, ROIC 12%→6%) |
| Capital <5% (stagnant)     | 60    | Sin reinversión productiva               |

---

### E. COMPETITIVE ADVANTAGE SCORE

#### Definición

Score avanzado (0-100) que evalúa la **durabilidad de ventajas competitivas** mediante 3 ejes independientes: Return Persistence, Operating Stability y Capital Discipline.

**Diferencia vs Moat:**

- **Moat:** 2 ejes (ROIC + Margins), scoring básico
- **Competitive Advantage:** 3 ejes (ROIC + Margins + Capital Discipline), análisis profundo

#### Estructura

```typescript
competitive_advantage: {
  score: number | null,              // 0-100
  band: "weak" | "defendable" | "strong",
  confidence: number,
  axes: {
    return_persistence: number | null,
    operating_stability: number | null,
    capital_discipline: number | null
  },
  years_analyzed: number
}
```

**Bands:**

- **Strong:** Score > 70
- **Defendable:** Score 50-70
- **Weak:** Score < 50

#### Ejes de Evaluación

**1. Return Persistence (40%)**

**Pregunta:** ¿La empresa mantiene retornos altos consistentemente?

**Métricas:**

- Nivel promedio de ROIC/ROE (30%)
- Estabilidad (SD) (45%)
- Penalización por failures (años ROIC < 5%) (25%)

**Scoring:**

```typescript
// Nivel de retorno
if (meanROIC > 40%) levelScore = 90+
if (meanROIC 20-40%) levelScore = 60-80
if (meanROIC 10-20%) levelScore = 40-60
if (meanROIC < 10%) levelScore < 40

// Estabilidad
stabilityScore = 100 - (stdDev × 200)

// Failures
failurePenalty = (failureYears / totalYears) × 100

// Eje final
returnPersistence = 0.30×level + 0.45×stability - 0.25×penalty
```

**Ejemplos:**

- **Apple:** ROIC 35%, SD 5%, 0 failures → Score 92
- **Coca-Cola:** ROIC 18%, SD 8%, 1 failure → Score 68
- **Airline:** ROIC 4%, SD 20%, 5 failures → Score 25

---

**2. Operating Stability (35%)**

**Pregunta:** ¿La empresa preserva márgenes cuando crece?

**Métricas:**

- Volatilidad de márgenes operativos (60%)
- Episodios buenos: Revenue ↑ + Margin ↑ (25%)
- Episodios malos: Revenue ↑ + Margin ↓ (15% penalty)

**Scoring:**

```typescript
marginStability = 100 - (marginSD × 200)

goodEpisodes = count(revenue > +5% AND margin ≥ 0)
badEpisodes = count(revenue > +5% AND margin < -1pp)

operatingStability = 0.60×marginStability
                   + 0.25×(good/total)×100
                   - 0.15×(bad/total)×100
```

**Ejemplos:**

- **Visa:** Márgenes estables 65%, 8 buenos/0 malos → Score 95
- **Starbucks:** Márgenes 12%, 5 buenos/2 malos → Score 62
- **Commodity Producer:** Márgenes volátiles, 2 buenos/7 malos → Score 30

---

**3. Capital Discipline (25%)**

**Pregunta:** ¿Crea valor al reinvertir capital?

**Scoring:**

```typescript
capitalGrowth = (latestCapital - oldestCapital) / oldestCapital × 100
roicChange = (latestROIC - oldestROIC) × 100  // en pp

if (capitalGrowth > 30 && roicChange >= 5)  return 100  // Excellent
if (capitalGrowth > 30 && roicChange >= 0)  return 80   // Good
if (capitalGrowth > 30 && roicChange < -5)  return 30   // Poor
if (capitalGrowth < 5)                      return 60   // Stagnant
```

---

#### Score Final

```typescript
competitiveAdvantage =
  returnPersistence × 0.40 +
  operatingStability × 0.35 +
  capitalDiscipline × 0.25
```

#### Sistema de Confianza

**Basado en años analizados:**

- ≥7 años → High
- 4-6 años → Medium
- <4 años → Low

**Ajuste por completitud:**

- 3/3 ejes calculados → +20%
- 2/3 ejes → +10%
- 1/3 ejes → Base solo

#### Ejemplo Completo (Visa - V)

```json
{
  "score": 91,
  "band": "strong",
  "confidence": 95,
  "axes": {
    "return_persistence": 94,
    "operating_stability": 92,
    "capital_discipline": 85
  },
  "years_analyzed": 10
}
```

**Interpretación:**

- Score 91 (Strong) → Ventaja competitiva duradera
- Return Persistence 94 → ROIC 40%+ consistente, baja volatilidad
- Operating Stability 92 → Márgenes 65% estables, crecimiento sin erosión
- Capital Discipline 85 → Reinversión eficiente, ROIC se mantiene

---

## 4️⃣ CASH FLOW QUALITY

### A. DIVIDEND QUALITY SCORE

#### Definición

Score (0-100) que evalúa la **sostenibilidad y resiliencia** de dividendos mediante análisis de consistencia, crecimiento, payout ratios y disciplina de capital.

#### Estructura

```typescript
dividend_quality: {
  score: number | null,              // 0-100
  band: "weak" | "acceptable" | "high",
  confidence: number | null,
  axes: {
    consistency: number | null,
    growth_reliability: number | null,
    payout_sustainability: number | null,
    capital_discipline: number | null
  },
  years_analyzed: number
}
```

**Bands:**

- **High:** Score > 75
- **Acceptable:** Score 50-75
- **Weak:** Score < 50

#### Ejes de Evaluación

**1. Consistency (30%)**

**Pregunta:** ¿Paga dividendos consistentemente?

**Métricas:**

- Ratio de años pagando dividendos
- Número de gaps (interrupciones)
- Duración de gaps consecutivos

**Scoring:**

```typescript
baseScore = (yearsPaying / totalYears) × 100
gapPenalty = min(30, gapsCount×8 + maxConsecutiveGaps×4)
consistencyScore = clamp(baseScore - gapPenalty, 0, 100)
```

**Examples:**

- **P&G:** 130 años consecutivos → Score 100
- **GE:** 90% de años, 2 gaps → Score 68
- **Ford:** 5 gaps en 10 años → Score 25

---

**2. Growth Reliability (25%)**

**Pregunta:** ¿Los dividendos crecen predeciblemente?

**Métricas:**

- CAGR de DPS
- Volatilidad del crecimiento (SD)
- Episodios de aumento vs recorte

**Scoring:**

```typescript
// Base por tasa
if (meanGrowth 0-5%)  baseScore = 70   // Sano
if (meanGrowth > 5%)  baseScore = 80   // Alto
if (meanGrowth < 0)   baseScore = 40   // Negativo

// Penalizaciones
volatilityPenalty = min(40, stdDev × 200)
directionPenalty = (hasReversals) ? 15 : 0

growthScore = clamp(baseScore - volatilityPenalty - directionPenalty, 0, 100)
```

**Examples:**

- **MSFT:** +8%/año, SD 2%, sin recortes → Score 90
- **AT&T:** +2%/año, SD 5%, 2 recortes → Score 65

---

**3. Payout Sustainability (30%)**

**Pregunta:** ¿Dividendos cubiertos por earnings y FCF?

**Scoring por Payout Ratio:**

| Payout Ratio | Score | Interpretación                |
| ------------ | ----- | ----------------------------- |
| 30-70%       | 90    | Óptimo (sostenible + espacio) |
| 15-30%       | 80    | Conservador                   |
| 70-90%       | 70    | Ajustado                      |
| 90-100%      | 60    | Límite                        |
| >100%        | 25    | Insostenible                  |
| >150%        | 10    | Crítico                       |

**Lógica:** Promedio de scores EPS y FCF históricos.

**Examples:**

- **JNJ:** Payout EPS 55%, FCF 48% → Score 90
- **Verizon:** Payout EPS 85%, FCF 52% → Score 70
- **Company X:** Payout EPS 120% → Score 25

---

**4. Capital Discipline (15%)**

**Pregunta:** ¿Equilibra dividendos con reinversión productiva?

**Scoring:**

```typescript
divGrowth = (latest - oldest) / oldest
roicChange = latestROIC - oldestROIC

if (divGrowth > 10% && roicChange >= 0)     return 90   // Excelente
if (divGrowth > 10% && roicChange >= -2pp)  return 70   // Aceptable
if (divGrowth > 10% && roicChange < -5pp)   return 30   // A expensas de calidad
if (divGrowth < 0)                          return 40   // Declive
```

**Examples:**

- **Apple:** Div +120%, ROIC mantiene 35% → Score 90
- **McDonald's:** Div +80%, ROIC -2pp → Score 70

---

#### Score Final

```typescript
dividendQuality =
  consistency × 0.30 +
  growthReliability × 0.25 +
  payoutSustainability × 0.30 +
  capitalDiscipline × 0.15
```

#### Ejemplo Completo (Johnson & Johnson - JNJ)

```json
{
  "score": 89,
  "band": "high",
  "confidence": 95,
  "axes": {
    "consistency": 100,
    "growth_reliability": 85,
    "payout_sustainability": 90,
    "capital_discipline": 82
  },
  "years_analyzed": 10
}
```

**Interpretación:**

- Score 89 (High) → Dividendos sostenibles y de alta calidad
- Consistency 100 → 61 años consecutivos incrementando (Dividend Aristocrat)
- Growth 85 → +6%/año, baja volatilidad
- Payout 90 → Ratio 55%, cubierto por FCF
- Discipline 82 → Dividendo crece sin sacrificar reinversión

---

### B. RELATIVE RETURN SCORE

#### Definición

Score (0-100) que evalúa el **rendimiento total** (precio + dividendos) de una acción vs su benchmark sectorial en múltiples ventanas temporales.

#### Estructura

```typescript
relative_return: {
  score: number | null,              // 0-100
  band: "underperformer" | "neutral" | "outperformer",
  confidence: number | null,
  components: {
    window_alpha: {
      '1Y': { asset_return: number; benchmark_return: number; alpha: number; score: number };
      '3Y': { ... };
      '5Y': { ... };
    },
    consistency_score: number,       // 0-100
    drawdown_penalty: number         // 0-100 (penalty)
  },
  windows_used: string[]
}
```

**Bands:**

- **Outperformer:** Score > 60
- **Neutral:** Score 40-60
- **Underperformer:** Score < 40

#### Metodología

**1. Cálculo de Alpha por Ventana:**

```typescript
for (const window of ['1Y', '3Y', '5Y']) {
  const alpha = assetReturn - benchmarkReturn  // En pp

  // Mapear alpha a score 0-100
  const MAX_ALPHA = 20  // ±20pp vs benchmark = extremos
  const clamped = clamp(alpha, -MAX_ALPHA, +MAX_ALPHA)
  const score = 50 + (clamped / MAX_ALPHA) × 50

  alphaScores.push(score)
}
```

**2. Ajuste por Consistencia:**

```typescript
const positiveAlphas = alphas.filter(a => a > 1).length
const negativeAlphas = alphas.filter(a => a < -1).length

// Todas ventanas positivas
if (positiveAlphas === 3 && negativeAlphas === 0) {
  consistencyScore = 75 + min(25, avgAlpha/10 × 25)  // 75-100
}

// Todas ventanas negativas
else if (negativeAlphas === 3 && positiveAlphas === 0) {
  consistencyScore = max(0, 25 - avgAlpha/10 × 25)   // 0-25
}

// Mixtas
else {
  consistencyScore = 50  // Neutral
}
```

**3. Penalización por Drawdown:**

```typescript
for (const window of ['1Y', '3Y', '5Y']) {
  const diff = assetMaxDD - benchmarkMaxDD  // Positivo si asset peor

  if (diff > 0) {
    const MAX_DIFF = 20  // Cap: 20pp peor drawdown
    const penalty = (min(diff, MAX_DIFF) / MAX_DIFF) × 20  // Hasta 20 puntos
    drawdownPenalty = max(drawdownPenalty, penalty)
  }
}
```

**4. Score Final:**

```typescript
relativeReturn = clamp(
  baseScore × 0.60 +
  consistencyScore × 0.30 -
  drawdownPenalty × 0.10,
  0, 100
)
```

#### Sistema de Confianza

**Factores:**

- Cobertura de ventanas (70%): 3/3 → 100%, 2/3 → 67%, 1/3 → 33%
- Disponibilidad de drawdown (30%): Completo → 100%, Parcial → 50%, Sin datos → 0%

#### Ejemplo Completo (Amazon - AMZN)

**Timeline:**
| Window | Asset | Benchmark | Alpha | Score |
|--------|-------|-----------|-------|-------|
| 1Y | 32% | 12% | +20pp | 100 |
| 3Y | 85% | 45% | +40pp | 100 |
| 5Y | 180% | 90% | +90pp | 100 |

**Drawdowns:**

- 1Y: Asset -15%, Bench -18% (mejor)
- 3Y: Asset -25%, Bench -22% (ligeramente peor)
- 5Y: Asset -30%, Bench -25% (peor por 5pp)

**Resultado:**

```json
{
  "score": 90,
  "band": "outperformer",
  "confidence": 95,
  "components": {
    "consistency_score": 100,
    "drawdown_penalty": 5
  },
  "windows_used": ["1Y", "3Y", "5Y"]
}
```

**Interpretación:**

- Score 90 (Outperformer) → Supera consistentemente al sector
- Alpha +50pp promedio → Retornos significativamente superiores
- Consistency 100 → Outperformance en todas las ventanas
- Drawdown Penalty 5 → Ligera mayor volatilidad vs benchmark

---

## 5️⃣ SÍNTESIS INTEGRADORA: FINTRA VERDICT

### Definición

**Fintra Verdict** es el score integrador que sintetiza todos los engines anteriores en un **veredicto multidimensional** que describe el escenario analítico de una empresa.

### Estructura

```typescript
fintra_verdict: {
  verdict_label: "exceptional" | "strong" | "balanced" | "fragile" | "speculative" | "inconclusive",
  verdict_score: number | null,       // 0-100 (agregado ponderado)
  confidence: number | null,
  drivers: {
    positives: string[],
    negatives: string[],
    tensions: string[]
  }
}
```

### Lógica de Veredictos

#### 1. Exceptional (Excepcional)

**Condiciones:**

- FGOS: Strong
- Competitive Advantage: Strong
- Dividend Quality: Acceptable o High
- Relative Return: Outperformer
- Sentiment: NO optimistic (evita riesgo de overvaluation)

**Interpretación:** Negocio excepcional con ventaja competitiva duradera, sin optimismo excesivo de mercado.

**Ejemplo:** Apple (FGOS 87, CompAdv 91, Div High, RelReturn 82, Sentiment Neutral)

---

#### 2. Strong (Fuerte)

**Condiciones:**

- FGOS: Strong o Defendable
- Competitive Advantage: NO Weak
- Dividend Quality: NO Weak
- Relative Return: NO Underperformer

**Interpretación:** Negocio sólido con fundamentales robustos y posición competitiva defendible.

**Ejemplo:** Microsoft (FGOS 82, CompAdv Defendable, Div Acceptable, RelReturn Neutral)

---

#### 3. Balanced (Balanceado)

**Condiciones:**

- Mix de fortalezas y debilidades
- Sin tensiones mayores
- FGOS: Defendable

**Interpretación:** Negocio estable con algunas dimensiones favorables y otras neutrales.

**Ejemplo:** Walmart (FGOS 65, CompAdv Defendable, Div Acceptable, RelReturn Neutral)

---

#### 4. Fragile (Frágil)

**Condiciones (al menos una):**

- FGOS: Weak
- Dividend Quality: Weak
- Relative Return: Underperformer

**Interpretación:** Negocio con vulnerabilidades estructurales que requieren monitoreo cercano.

**Ejemplo:** Ford (FGOS 42, CompAdv Weak, Div Weak, RelReturn Underperformer)

---

#### 5. Speculative (Especulativo)

**Condiciones:**

- FGOS: Weak
- Sentiment: Optimistic

**Interpretación:** Negocio débil con optimismo de mercado (desconexión fundamentales-precio).

**Ejemplo:** Growth stock unprofitable (FGOS 35, Sentiment Optimistic)

---

#### 6. Inconclusive (Inconcluso)

**Condiciones:**

- FGOS: Pending o null
- Insuficientes datos para formar veredicto

**Interpretación:** Faltan datos críticos para análisis completo.

---

### Drivers (Positivos/Negativos/Tensiones)

**Positivos:**

- "Strong business quality" (FGOS Strong)
- "Strong competitive advantage"
- "High dividend quality"
- "Persistent outperformance"

**Negativos:**

- "Weak business quality" (FGOS Weak)
- "Unsustainable dividends"
- "Structural underperformance"

**Tensiones (Alertas Analíticas):**

- "Strong business with pessimistic sentiment" → Posible oportunidad
- "Weak business with optimistic sentiment" → Desconexión riesgosa
- "Good dividends with poor returns" → Dividend trap potencial

### Sistema de Confianza Verdict

```typescript
verdictConfidence =
  min(fgosConfidence, compAdvConfidence) × 0.50 +
  avg(ifsConfidence, sentimentConfidence, divConfidence) × 0.50
```

### Ejemplo Completo (Coca-Cola - KO)

**Inputs:**

```json
{
  "fgos": { "score": 78, "band": "strong" },
  "competitive_advantage": { "score": 85, "band": "strong" },
  "sentiment": { "score": 52, "band": "neutral" },
  "dividend_quality": { "score": 92, "band": "high" },
  "relative_return": { "score": 58, "band": "neutral" }
}
```

**Resultado:**

```json
{
  "verdict_label": "exceptional",
  "verdict_score": 82,
  "confidence": 88,
  "drivers": {
    "positives": [
      "Strong business quality",
      "Strong competitive advantage",
      "High dividend quality"
    ],
    "negatives": [],
    "tensions": []
  }
}
```

**Interpretación:**

- Exceptional: KO combina negocio de calidad con moat fuerte y dividendos sostenibles
- Sin tensiones: Fundamentales y mercado coherentes (sentiment neutral)
- Confidence 88%: Alta disponibilidad de datos, scores consistentes

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
│  FGOS Engine → Quality Score                │
│  Competitive Advantage → Moat Analysis      │
│  IFS Engine → Market Position               │
│  IQS Engine → Structural Quality            │
│  Sentiment → Market Perception              │
│  Valuation → Relative Positioning           │
│  Dividend Quality → Cash Flow Analysis      │
│  Relative Return → Performance Tracking     │
│  Quality Brakes → Risk Alerts               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│     LAYER 4: INTEGRATION                    │
│  Fintra Verdict → Multi-dimensional Synthesis│
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│     fintra_snapshots (FINAL OUTPUT)         │
│  - fgos_status, fgos_score, fgos_confidence │
│  - competitive_advantage (3 axes)           │
│  - ifs, ifs_memory                          │
│  - iqs (structural fundamentals)            │
│  - quality_brakes (risk alerts)             │
│  - valuation_relative                       │
│  - moat, sentiment                          │
│  - dividend_quality (4 axes)                │
│  - relative_return (alpha tracking)         │
│  - fintra_verdict (integrator)              │
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

### Caso 1: Empresa Saludable (Negocio Excepcional)

```json
{
  "ticker": "MSFT",
  "fgos_status": "computed",
  "fgos_score": 88,
  "fgos_confidence": 95,
  "competitive_advantage": {
    "score": 86,
    "band": "strong",
    "confidence": 92
  },
  "ifs": {
    "position": "leader",
    "pressure": 3,
    "confidence": 92
  },
  "dividend_quality": {
    "score": 88,
    "band": "high",
    "confidence": 90
  },
  "relative_return": {
    "score": 72,
    "band": "outperformer",
    "confidence": 95
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
  },
  "fintra_verdict": {
    "verdict_label": "exceptional",
    "verdict_score": 85,
    "confidence": 92,
    "drivers": {
      "positives": [
        "Strong business quality",
        "Strong competitive advantage",
        "High dividend quality",
        "Persistent outperformance"
      ],
      "negatives": [],
      "tensions": []
    }
  }
}
```

**Interpretación:**

- **Calidad Fundamental:** Excelente (FGOS 88, CompAdv 86 Strong)
- **Posición Competitiva:** Líder con soporte fuerte (IFS leader, pressure 3)
- **Cash Flow Quality:** Dividendos sostenibles (DivQuality 88 High)
- **Performance:** Outperformer consistente (RelReturn 72)
- **Sin alertas de riesgo:** Z-Score 4.2, F-Score 8
- **Valoración:** Neutra (percentil 55)
- **Verdict:** Exceptional - Negocio excepcional sin tensiones

---

### Caso 2: Empresa en Distress (Negocio Frágil)

```json
{
  "ticker": "DISTRESS",
  "fgos_status": "computed",
  "fgos_score": 35,
  "fgos_confidence": 78,
  "competitive_advantage": {
    "score": 28,
    "band": "weak",
    "confidence": 72
  }competitive_advantage": null,
  "ifs": null,
  "dividend_quality": null,
  "relative_return": null,
  "quality_brakes": {
    "applied": false,
    "altman_z": null,
    "piotroski": null
  },
  "valuation_relative": {
    "status": "pending",
    "reason": "Insufficient financial history (< 4 quarters)"
  },
  "fintra_verdict": {
    "verdict_label": "inconclusive",
    "verdict_score": null,
    "confidence": null,
    "drivers": {
      "positives": [],
      "negatives": ["Insufficient core FGOS data to form a verdict"],
      "tensions": []
    }
  }
}
```

**Interpretación:**

- Empresa sin historia suficiente (IPO reciente)
- Todos los engines en estado `pending`
- **NO es un error** - es el comportamiento esperado
- Verdict: Inconclusive - Faltan datos críticos para análisis

---

## 📚 TABLA COMPARATIVA DE SCORES

| Score                     | Input                                       | Output                                          | Benchmark       | Propósito                      |
| ------------------------- | ------------------------------------------- | ----------------------------------------------- | --------------- | ------------------------------ |
| **FGOS**                  | Fundamentales (ROIC, márgenes, crecimiento) | 0-100, High/Medium/Low                          | Sector          | Calidad del negocio            |
| **Competitive Advantage** | Historia ROIC + márgenes + capital          | 0-100, Weak/Defendable/Strong                   | Absoluto        | Durabilidad de ventaja         |
| **Moat**                  | Historia ROIC + márgenes (simplificado)     | 0-100 + Coherence Check                         | Absoluto        | Ventaja competitiva sostenible |
| **IFS**                   | Retornos relativos (precio + dividendos)    | Leader/Follower/Laggard + Pressure              | Sector          | Posición de mercado            |
| **IQS**                   | Fundamentales FY (ROIC, márgenes)           | Leader/Follower/Laggard per FY                  | Industria       | Posición estructural           |
| **Sentiment**             | Timeline de múltiplos de valuación          | 0-100, Pessimistic/Neutral/Optimistic           | Historia propia | Percepción de mercado          |
| **Valuation Relative**    | Múltiplos actuales (P/E, EV/EBITDA, P/FCF)  | Percentil 0-100, Cheap/Fair/Expensive           | Sector          | Precio vs sector               |
| **Dividend Quality**      | Historia DPS + payout ratios                | 0-100, Weak/Acceptable/High                     | Absoluto        | Sostenibilidad dividendos      |
| **Relative Return**       | Retornos totales (precio + dividendos)      | 0-100, Underperformer/Neutral/Outperformer      | Sector          | Performance total              |
| **Quality Brakes**        | Altman Z-Score + Piotroski F-Score          | Boolean + Reasons                               | N/A             | Alertas de riesgo              |
| **Fintra Verdict**        | Todos los scores anteriores                 | Exceptional/Strong/Balanced/Fragile/Speculative | N/A             | Síntesis multidimensional      |

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
},
"fintra_verdict": {
"verdict_label": "fragile",
"verdict_score": 26,
"confidence": 75,
"drivers": {
"positives": [],
"negatives": [
"Weak business quality",
"Weak competitive advantage",
"Unsustainable dividends",
"Structural underperformance"
],
"tensions": [
"Good dividends with poor returns"
]
}
}
}

````

**Interpretación:**

- **Calidad Fundamental:** Baja (FGOS 35, CompAdv 28 Weak)
- **Posición Competitiva:** Rezagado (IFS laggard)
- **Cash Flow Quality:** Dividendos insostenibles (DivQuality 22 Weak)
- **Performance:** Underperformer estructural (RelReturn 18)
- **ALERTAS CRÍTICAS:**
  - Riesgo de quiebra alto (Z 1.2)
  - Fundamentales deteriorados (F 2)
- **Valoración:** Muy barata (percentil 8) → **Posible value trap**
- **Verdict:** Fragile - Vulnerabilidades estructurales múltiples
- **Acción sugerida:** Análisis de liquidez urgente, revisar vencimientos de deuda

---

### Caso 3: Datos Insuficientes (IPO Reciente)

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
````

**Interpretación:**

- Empresa sin historia suficiente
- Todos los engines en estado `pending`
- **NO es un error** - es el comportamiento esperado para IPOs recientes

---

## 📖 GLOSARIO

**TTM (Trailing Twelve Months):** Suma de últimos 4 quarters consecutivos.

**Percentile Scoring:** Posición relativa (0-100) dentro de distribución sectorial.

**Block Voting:** Sistema de votación ponderada por bloques temporales (IFS).

**Point-in-time:** Cálculo usando solo datos disponibles en una fecha específica (sin look-ahead bias).

**Look-ahead Bias:** Error de usar datos futuros en cálculos históricos.

**Fault Tolerance:** Capacidad de un sistema de continuar operando ante errores parciales.

**Idempotent:** Operación que produce el mismo resultado si se ejecuta múltiples veces.

**ROIC:** Return on Invested Capital - Retorno sobre capital invertido.

**Alpha:** Retorno diferencial vs benchmark (en puntos porcentuales).

**Drawdown:** Pérdida máxima desde pico (en %).

**Payout Ratio:** Dividendos / Earnings (o FCF).

**DPS:** Dividend Per Share - Dividendo por acción.

**Coherence Check:** Validación de calidad de crecimiento (revenue vs margins).

**Capital Discipline:** Capacidad de crear valor al reinvertir capital.

---

## 📚 REFERENCIAS ACADÉMICAS Y METODOLÓGICAS

### Scores de Riesgo Financiero

- **Altman Z-Score:** Altman, E. (1968). "Financial Ratios, Discriminant Analysis and the Prediction of Corporate Bankruptcy". _Journal of Finance_, 23(4), 589-609.

- **Piotroski F-Score:** Piotroski, J. (2000). "Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers". _Journal of Accounting Research_, 38, 1-41.

### Competitive Advantage & Moat

- **Economic Moats:** Greenblatt, J. (2006). "The Little Book That Still Beats the Market". Wiley.
- **Sustainable Competitive Advantage:** Porter, M. (1985). "Competitive Advantage: Creating and Sustaining Superior Performance". Free Press.

### Dividend Quality

- **Dividend Sustainability:** Lintner, J. (1956). "Distribution of Incomes of Corporations Among Dividends, Retained Earnings, and Taxes". _American Economic Review_, 46(2), 97-113.
- **Dividend Aristocrats Methodology:** S&P Dow Jones Indices, "S&P 500 Dividend Aristocrats Methodology" (2023).

### Relative Valuation

- **Industry-Relative Valuation:** Damodaran, A. (2012). "Investment Valuation: Tools and Techniques for Determining the Value of Any Asset". 3rd Edition. Wiley.

---

## 🔄 CHANGELOG

### 2026-02-07 (v2.0 - ACTUALIZACIÓN MAYOR)

**Agregados:**

- ✅ Competitive Advantage Score (subsección completa con 3 ejes)
- ✅ Dividend Quality Score (4 ejes: Consistency, Growth, Payout, Discipline)
- ✅ Relative Return Score (alpha tracking + consistency + drawdown)
- ✅ Fintra Verdict (integrador con 6 veredictos + drivers + tensiones)
- ✅ Expansión de Moat Score (Coherence Check + Capital Discipline detallado)
- ✅ Tabla comparativa de todos los scores
- ✅ Casos de uso actualizados con Verdict completo
- ✅ Referencias académicas expandidas

**Actualizados:**

- ⚙️ Flujo de integración (Layer 4 agregado)
- ⚙️ Ejemplos de casos de uso (3 escenarios completos)
- ⚙️ Glosario expandido

**Total:** 11 scores documentados (vs 7 previos)

### 2026-02-05 (v1.0 - VERSIÓN INICIAL)

**Contenido original:**

- Valoración Relativa
- IFS/IQS
- Quality Brakes (Altman Z, Piotroski F)
- FGOS básico
- Sentiment
- Moat básico
- Principios de diseño

---

**FIN DEL INFORME**

---

## 📄 METADATA

**Autor:** Sistema de Documentación Técnica Fintra  
**Última Actualización:** 2026-02-07  
**Versión:** 2.0  
**Alcance:** Conceptos fundamentales actualizados para contexto externo  
**Audiencia:** Analistas financieros, desarrolladores, consultores externos  
**Complemento:** Ver FINTRA_SCORES_EXPLICACION.md para documentación técnica exhaustiva (2,315 líneas)

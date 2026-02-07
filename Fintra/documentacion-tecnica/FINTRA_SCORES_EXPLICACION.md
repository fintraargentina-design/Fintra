# Fintra Scores: Arquitectura y Metodología

**Última Actualización:** 7 de febrero de 2026  
**Versión del Sistema:** v4.0  
**Autor:** Documentación técnica del Engine Layer

---

## Índice

1. [Introducción](#introducción)
2. [Arquitectura del Sistema de Scoring](#arquitectura-del-sistema-de-scoring)
3. [FGOS - Fintra Growth & Operations Score](#fgos---fintra-growth--operations-score)
4. [IFS - Industry Fit Score](#ifs---industry-fit-score)
5. [IQS - Industry Quality Score](#iqs---industry-quality-score)
6. [Competitive Advantage Score](#competitive-advantage-score)
7. [Moat Score](#moat-score)
8. [Sentiment Score](#sentiment-score)
9. [Valuation Score (Relative)](#valuation-score-relative)
10. [Dividend Quality Score](#dividend-quality-score)
11. [Relative Return Score](#relative-return-score)
12. [Fintra Verdict (Integrador)](#fintra-verdict-integrador)
13. [Quality Brakes (Frenos de Calidad)](#quality-brakes-frenos-de-calidad)
14. [Sistema de Confianza](#sistema-de-confianza)
15. [Principios de Arquitectura](#principios-de-arquitectura)

---

## Introducción

**Fintra** es una plataforma de análisis financiero estructural que calcula **scores propietarios** para empresas que cotizan en bolsa. A diferencia de sistemas tradicionales que emiten recomendaciones, Fintra **describe escenarios analíticos** basados en datos objetivos y benchmarks sectoriales.

### Filosofía de Fintra

> **"Fintra no inventa datos. Fintra calcula con lo que existe, marca lo que falta y explica por qué."**

**Principios fundamentales:**

- **NUNCA inventar datos:** Si un dato no existe, se marca como `null` o `status: 'pending'`
- **Pending no es Error:** La falta de datos es **esperada** y se reporta transparentemente
- **Tolerancia a Fallos:** Un ticker con error NO detiene el procesamiento del universo
- **Neutralidad Analítica:** Fintra describe dimensiones que requieren análisis, NO emite juicios

---

## Arquitectura del Sistema de Scoring

### Estructura en Capas

```
┌─────────────────────────────────────────────────────────┐
│                  FINTRA VERDICT                         │
│              (Integrador Multidimensional)              │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼───────┐ ┌─▼──────────┐
│ Core Engines │ │ Context  │ │ Market     │
│              │ │ Engines  │ │ Engines    │
│ - FGOS       │ │ - Moat   │ │ - IFS      │
│ - Comp.Adv   │ │ - Senti  │ │ - IQS      │
│              │ │          │ │ - RelReturn│
└──────────────┘ └──────────┘ └────────────┘
        │            │            │
        └────────────┼────────────┘
                     │
┌────────────────────▼────────────────────────┐
│         DATA LAYER (fintra_snapshots)       │
│   - Structural (profile, sector, industry)  │
│   - Fundamentals (TTM + FY history)         │
│   - Market (prices, returns, valuation)     │
│   - Benchmarks (sector/industry aggregates) │
└─────────────────────────────────────────────┘
```

### Tipos de Scores

| Tipo | Scores | Propósito |
|------|--------|-----------|
| **Core** | FGOS, Competitive Advantage | Calidad del negocio (fundamentales) |
| **Context** | Moat, Sentiment | Sostenibilidad y percepción de mercado |
| **Market** | IFS, IQS, Relative Return | Posición relativa vs competencia |
| **Valuation** | Valuation Relative | Valoración vs sector |
| **Cash Flow** | Dividend Quality | Sostenibilidad de dividendos |
| **Integrador** | Fintra Verdict | Síntesis multidimensional |

---

## FGOS - Fintra Growth & Operations Score

### ¿Qué es?

**FGOS (Fintra Growth & Operations Score)** es el **score fundamental** que evalúa la **calidad intrínseca del negocio** basándose en 4 dimensiones: Growth, Profitability, Efficiency y Solvency.

**Score Range:** 0-100  
**Categorías:** High (≥60), Medium (40-59), Low (<40)

### ¿Cómo funciona?

FGOS compara las métricas de la empresa contra **benchmarks sectoriales** (percentiles p10, p25, p50, p75, p90) para calcular un **percentil normalizado** por cada métrica.

#### Dimensiones FGOS

**1. Growth (Crecimiento) - 25%**

Métricas:
- `revenue_cagr` (CAGR de ingresos, 3-5 años)
- `earnings_cagr` (CAGR de ganancias)
- `fcf_cagr` (CAGR de flujo de caja libre)

Interpretación:
- **Percentil 80-100:** Crecimiento excepcional vs sector
- **Percentil 50-79:** Crecimiento sostenido
- **Percentil <50:** Crecimiento por debajo del sector

**2. Profitability (Rentabilidad) - 30%**

Métricas:
- `operating_margin` (Margen operativo)
- `net_margin` (Margen neto)
- `roic` (Return on Invested Capital)
- `roe` (Return on Equity)

Interpretación:
- **Alta Rentabilidad (>75%):** Pricing power, eficiencia operativa
- **Media Rentabilidad (50-75%):** Competitiva en su sector
- **Baja Rentabilidad (<50%):** Presión competitiva o modelo ineficiente

**3. Efficiency (Eficiencia) - 25%**

Métricas:
- `asset_turnover` (Rotación de activos)
- `days_sales_outstanding` (DSO - Días de cobro)
- `days_inventory` (Días de inventario)
- `cash_conversion_cycle` (Ciclo de conversión de efectivo)

Interpretación:
- **Alta Eficiencia:** Activos generan más ingresos, ciclos cortos
- **Baja Eficiencia:** Capital ocioso, ciclos lentos

**4. Solvency (Solvencia) - 20%**

Métricas:
- `debt_to_equity` (Deuda/Patrimonio)
- `interest_coverage` (Cobertura de intereses)
- `current_ratio` (Liquidez corriente)
- `altman_z_score` (Predictor de quiebra)

Interpretación:
- **Alta Solvencia:** Balance robusto, bajo riesgo financiero
- **Baja Solvencia:** Apalancamiento excesivo, riesgo estructural

### Cálculo del Score

```typescript
// Paso 1: Calcular percentil de cada métrica vs sector
const growthScore = avg([
  percentile(revenue_cagr, sector_benchmark),
  percentile(earnings_cagr, sector_benchmark),
  percentile(fcf_cagr, sector_benchmark)
]);

// Paso 2: Promediar dimensiones con pesos
const fgos_raw = 
  growth * 0.25 +
  profitability * 0.30 +
  efficiency * 0.25 +
  solvency * 0.20;

// Paso 3: Aplicar ajustes por contexto
const fgos_adjusted = applyModifiers(fgos_raw, {
  moat_score,
  sentiment_score,
  competitive_advantage,
  quality_brakes
});

// Paso 4: Clampear a rango 0-100
const fgos_score = clamp(fgos_adjusted, 0, 100);
```

### Ajustes Contextuales

**Moat Bonus (+10% max):**
- Si `moat_score > 70` → Ajuste: `+5%`
- Si `moat_score > 85` → Ajuste: `+10%`

**Sentiment Adjustment (±15% max):**
- Si `sentiment = 'optimistic'` y `fgos > 60` → Ajuste: `+10%`
- Si `sentiment = 'pessimistic'` y `fgos < 40` → Ajuste: `-15%`

**Competitive Advantage Bonus (+15% max):**
- Si `competitive_advantage = 'strong'` → Ajuste: `+15%`
- Si `competitive_advantage = 'defendable'` → Ajuste: `+8%`

**Quality Brakes (Penalty -10% max):**
- Si `altman_z < 1.8` → Penalización: `-15%`
- Si `piotroski <= 3` → Penalización: `-15%`

### Sistema de Confianza FGOS

**Factores de Confianza:**

1. **Historia Financiera (30%):**
   - ≥10 años de datos → Factor: 1.00
   - 7-9 años → Factor: 0.90
   - 5-6 años → Factor: 0.75
   - 3-4 años → Factor: 0.55
   - <3 años → Factor: 0.30

2. **Madurez desde IPO (30%):**
   - ≥5 años → Factor: 1.00
   - 3-4 años → Factor: 0.85
   - 1-2 años → Factor: 0.60
   - <1 año → Factor: 0.40

3. **Volatilidad de Earnings (20%):**
   - Volatilidad BAJA → Factor: 1.00
   - Volatilidad MEDIA → Factor: 0.85
   - Volatilidad ALTA → Factor: 0.65

4. **Completitud de Métricas (20%):**
   - 0 métricas faltantes → Factor: 1.00
   - 1 métrica faltante → Factor: 0.85
   - ≥2 métricas faltantes → Factor: 0.65

**Confidence Labels:**
- **High:** ≥80% (Verde)
- **Medium:** 50-79% (Amarillo)
- **Low:** <50% (Rojo)

### Estados FGOS

```typescript
type FgosStatus = 'Mature' | 'Developing' | 'Early-stage' | 'Incomplete';
```

**Mature:**
- Confidence ≥80%
- Historia financiera ≥7 años
- Sector conocido
- <2 métricas faltantes

**Developing:**
- Confidence 50-79%
- Historia financiera 3-6 años
- Algunos gaps en datos

**Early-stage:**
- Confidence <50%
- Historia financiera <3 años
- Datos limitados

**Incomplete:**
- ≥2 métricas core faltantes
- Sector desconocido
- Benchmarks no disponibles

### Output FGOS

```typescript
interface FgosResult {
  ticker: string;
  fgos_score: number | null;          // 0-100
  fgos_category: FgosCategory;        // High/Medium/Low/Pending
  fgos_breakdown: {
    growth: number | null;            // 0-100
    profitability: number | null;     // 0-100
    efficiency: number | null;        // 0-100
    solvency: number | null;          // 0-100
    moat?: number | null;
    sentiment?: number | null;
    competitive_advantage?: {
      score: number | null;
      band: 'weak' | 'defendable' | 'strong';
    };
    quality_brakes?: {
      applied: boolean;
      reasons: string[];
    };
  };
  confidence: number;                  // 0-100
  confidence_label: 'High' | 'Medium' | 'Low';
  fgos_status: FgosStatus;
}
```

### Ejemplo FGOS (Apple Inc. - AAPL)

```json
{
  "ticker": "AAPL",
  "fgos_score": 87,
  "fgos_category": "High",
  "fgos_breakdown": {
    "growth": 78,
    "profitability": 95,
    "efficiency": 88,
    "solvency": 82,
    "moat": 92,
    "sentiment": 65,
    "competitive_advantage": {
      "score": 91,
      "band": "strong"
    }
  },
  "confidence": 95,
  "confidence_label": "High",
  "fgos_status": "Mature"
}
```

**Interpretación:**
- **Score 87 (High):** Apple muestra calidad excepcional de negocio
- **Profitability 95:** Márgenes operativos top 5% del sector Technology
- **Moat 92:** Ventaja competitiva duradera (pricing power vía ecosistema)
- **Confidence 95%:** Datos completos (10+ años), volatilidad baja
- **Status Mature:** Empresa establecida con track record robusto

---

## IFS - Industry Fit Score

### ¿Qué es?

**IFS (Industry Fit Score)** evalúa la **posición competitiva relativa** de una empresa basándose en **RENDIMIENTO DE MERCADO** (market returns) vs su sector a través de múltiples ventanas temporales.

**Diferencia CRÍTICA vs FGOS:**
- **FGOS:** Calidad del negocio (fundamentales: márgenes, ROIC, crecimiento)
- **IFS:** Posición de mercado (retornos relativos: precio + dividendos)

**Score Range:** Position (Leader/Follower/Laggard) + Pressure (0-3)

### ¿Cómo funciona?

IFS utiliza **"Block Voting"** - agrupa ventanas temporales en 3 bloques (Short, Mid, Long) y cada bloque vota según si la mayoría de sus ventanas muestra outperformance o underperformance vs sector.

#### Estructura de Ventanas IFS

**3 Bloques Temporales:**

| Bloque | Ventanas | Propósito |
|--------|----------|-----------|
| **Short** | 1M, 3M | Momentum reciente |
| **Mid** | 6M, 1Y, 2Y | Tendencia estructural |
| **Long** | 3Y, 5Y | Posición secular |

#### Industry Awareness (Metadata)

IFS v1.2 utiliza **metadata de industria** para determinar qué ventanas son **estructuralmente relevantes** según la cadencia del sector:

**Ejemplo - Technology (Fast Industry):**
```json
{
  "industry": "Software - Application",
  "dominant_horizons": ["1M", "3M", "6M", "1Y", "2Y"],
  "structural_horizon_min_years": 2
}
```
→ **Block Long (3Y, 5Y) se IGNORA** porque no son ventanas dominantes.

**Ejemplo - Utilities (Slow Industry):**
```json
{
  "industry": "Electric Utilities",
  "dominant_horizons": ["1Y", "2Y", "3Y", "5Y"],
  "structural_horizon_min_years": 3
}
```
→ **Block Short (1M, 3M) se IGNORA** porque no son ventanas dominantes.

### Algoritmo de Votación

```typescript
// Paso 1: Filtrar ventanas NO dominantes
for (const window of allWindows) {
  if (!dominantHorizons.includes(window.code)) {
    continue; // Ignorar ventana no relevante
  }
  // ... procesar ventana
}

// Paso 2: Cada bloque vota (simplificado)
const shortVote = countPositiveWindows('short') > countNegativeWindows('short') ? +1 : -1;
const midVote = countPositiveWindows('mid') > countNegativeWindows('mid') ? +1 : -1;
const longVote = countPositiveWindows('long') > countNegativeWindows('long') ? +1 : -1;

// Paso 3: Sumar votos
const totalVotes = shortVote + midVote + longVote;

// Paso 4: Resolver posición
if (totalVotes > 0) position = 'leader';
else if (totalVotes < 0) position = 'laggard';
else position = 'follower';

// Paso 5: Calcular presión (intensidad)
const positiveBlocks = [shortVote, midVote, longVote].filter(v => v > 0).length;
const pressure = position === 'leader' ? positiveBlocks : 
                 position === 'laggard' ? abs(totalVotes) : 
                 max(positiveBlocks, negativeBlocks);
```

### Posiciones IFS

**Leader (Líder):**
- **Definición:** Más bloques votaron positivo que negativo
- **Presión 2-3:** Liderazgo consistente (múltiples ventanas)
- **Presión 1:** Liderazgo débil (solo 1 bloque favorable)

**Follower (Seguidor):**
- **Definición:** Empate en votos de bloques
- **Presión:** Max de bloques positivos o negativos
- **Interpretación:** Rendimiento alineado con sector

**Laggard (Rezagado):**
- **Definición:** Más bloques votaron negativo que positivo
- **Presión 2-3:** Rezago estructural (múltiples ventanas)
- **Presión 1:** Rezago débil (solo 1 bloque desfavorable)

### Sistema de Confianza IFS

**Factores:**

1. **Disponibilidad de Datos (40%):**
   - Score = (ventanas con datos / 7) * 100
   - 7/7 ventanas → 100%
   - 4/7 ventanas → 57%

2. **Consistencia de Señales (40%):**
   - Score = (unanimidad de señales) * 100
   - Votación 3-0 → 100%
   - Votación 2-1 → 67%

3. **Tamaño del Universo Sectorial (20%):**
   - ≥100 empresas → 100%
   - 50-99 empresas → 75%
   - 20-49 empresas → 50%
   - <20 empresas → 25%

**Confidence Labels:**
- **High:** ≥75%
- **Medium:** 50-74%
- **Low:** <50%

### Output IFS

```typescript
interface IFSResult {
  position: 'leader' | 'follower' | 'laggard';
  pressure: number;                    // 0-3
  confidence: number;                  // 0-100
  confidence_label: 'High' | 'Medium' | 'Low';
  interpretation?: string;
}
```

### Ejemplo IFS (Tesla - TSLA)

**Datos de Entrada (retornos relativos vs sector):**
```json
{
  "relative_vs_sector_1m": 5.2,
  "relative_vs_sector_3m": 12.8,
  "relative_vs_sector_6m": -3.1,
  "relative_vs_sector_1y": 8.4,
  "relative_vs_sector_2y": 45.3,
  "relative_vs_sector_3y": -12.5,
  "relative_vs_sector_5y": 102.7
}
```

**Metadata de Industria:**
```json
{
  "industry": "Auto Manufacturers",
  "dominant_horizons": ["1M", "3M", "6M", "1Y", "2Y", "3Y"],
  "structural_horizon_min_years": 1
}
```

**Votación:**
- **Short Block (1M, 3M):** +1 (ambas positivas)
- **Mid Block (6M, 1Y, 2Y):** +1 (2 positivas, 1 negativa → mayoría positiva)
- **Long Block (3Y, 5Y):** 5Y ignorada (no dominante), 3Y negativa → 0 (bloque inválido)

**Resultado IFS:**
```json
{
  "position": "leader",
  "pressure": 2,
  "confidence": 78,
  "confidence_label": "High",
  "interpretation": "Liderazgo consistente en horizontes cortos y medios"
}
```

**Interpretación:**
- **Leader con Presión 2:** Tesla supera al sector en momentum (Short) y tendencia (Mid)
- **Confidence 78%:** 6/7 ventanas con datos, votación consistente (2-0-0)
- **Ventana 5Y excluida:** No es horizonte estructural para industria Auto

---

## IQS - Industry Quality Score

### ¿Qué es?

**IQS (Industry Quality Score)** evalúa la **posición competitiva estructural** basándose en **FUNDAMENTALES** (ROIC, márgenes, crecimiento) vs **peers de la misma industria** (NO sector).

**Diferencia vs FGOS:**
- **FGOS:** Compara vs **sector** (Technology, Healthcare, etc.)
- **IQS:** Compara vs **industria** (Software - Application, Electric Utilities, etc.)

**Diferencia vs IFS:**
- **IFS:** Basado en retornos de mercado (precio + dividendos)
- **IQS:** Basado en fundamentales (ROIC, márgenes, leverage)

**Score Range:** Position (Leader/Follower/Laggard) por año fiscal

### ¿Cómo funciona?

IQS calcula **percentiles** de métricas fundamentales vs todos los peers de la misma industria para cada año fiscal (FY).

#### Métricas IQS

**Core Metrics (Requeridas):**
- `roic` (Return on Invested Capital)
- `operating_margin` (Margen operativo)

**Optional Metrics:**
- `net_margin` (Margen neto)
- `revenue_cagr` (CAGR de ingresos)
- `fcf_margin` (Free Cash Flow margin)
- `debt_to_equity` (Apalancamiento)
- `current_ratio` (Liquidez)

### Algoritmo IQS

```typescript
// Paso 1: Obtener últimos 5 FY de la empresa
const fyData = await getFiscalYearData(ticker, limit: 5);

// Paso 2: Para cada FY, obtener universo de peers
for (const fy of fyData) {
  const peers = await getIndustryPeers(industry, fy.fiscal_year);
  
  // Paso 3: Calcular percentil de cada métrica
  const roicPercentile = calculatePercentile(fy.roic, peers.roic_values);
  const marginPercentile = calculatePercentile(fy.operating_margin, peers.margin_values);
  
  // Paso 4: Agregar percentiles
  const avgPercentile = (roicPercentile + marginPercentile) / 2;
  
  // Paso 5: Clasificar posición
  if (avgPercentile >= 75) position = 'leader';       // Top quartile
  else if (avgPercentile >= 35) position = 'follower'; // Middle
  else position = 'laggard';                           // Bottom
}
```

### Confidence IQS

**Basado SOLO en años disponibles:**
- 1 FY → 20%
- 2 FY → 40%
- 3 FY → 60%
- 4 FY → 80%
- 5 FY → 100%

**NO considera:**
- Trend (mejora/deterioro)
- Consistency (volatilidad)
- Improvement (momentum)

**Rationale:** IQS es **snapshot estructural**, NO predictor de tendencia.

### Output IQS

```typescript
interface IQSResult {
  position: IQSPosition;                 // 'leader' | 'follower' | 'laggard'
  confidence: number;                    // 0-100
  fiscal_years: IQSFiscalYearPosition[]; // Array de posiciones por año
}

interface IQSFiscalYearPosition {
  fiscal_year: string;
  position: IQSPosition;
  percentile: number;                    // 0-100
  metrics_used: string[];
}
```

### Ejemplo IQS (Microsoft - MSFT)

**Datos de Entrada (FY 2019-2023):**

| FY | ROIC | Op Margin | Percentile | Position |
|----|------|-----------|------------|----------|
| 2023 | 0.35 | 0.42 | 88 | Leader |
| 2022 | 0.33 | 0.41 | 85 | Leader |
| 2021 | 0.31 | 0.39 | 82 | Leader |
| 2020 | 0.28 | 0.37 | 78 | Leader |
| 2019 | 0.26 | 0.34 | 76 | Leader |

**Industry:** Software - Application (85 peers)

**Resultado IQS:**
```json
{
  "position": "leader",
  "confidence": 100,
  "fiscal_years": [
    { "fiscal_year": "2023", "position": "leader", "percentile": 88 },
    { "fiscal_year": "2022", "position": "leader", "percentile": 85 },
    { "fiscal_year": "2021", "position": "leader", "percentile": 82 },
    { "fiscal_year": "2020", "position": "leader", "percentile": 78 },
    { "fiscal_year": "2019", "position": "leader", "percentile": 76 }
  ]
}
```

**Interpretación:**
- **Leader consistente:** Microsoft está en el top 25% de su industria (Software) en todos los años
- **Confidence 100%:** 5 años fiscales consecutivos disponibles
- **Percentil 88 (2023):** Microsoft supera a ~88% de sus peers de Software en rentabilidad

---

## Competitive Advantage Score

### ¿Qué es?

**Competitive Advantage Score** evalúa la **durabilidad de ventajas competitivas** de un negocio mediante análisis de **persistencia de retornos**, **estabilidad operativa** y **disciplina de capital** a través del tiempo.

**Score Range:** 0-100  
**Bands:** Weak (<50), Defendable (50-70), Strong (>70)

### ¿Cómo funciona?

El score se calcula como promedio ponderado de **3 ejes**:

#### 1. Return Persistence (40%) - Persistencia de Retornos

**Pregunta:** ¿La empresa mantiene retornos altos de forma consistente?

**Métricas:**
- ROIC histórico (preferido) o ROE
- Desviación estándar de retornos
- Número de años con retornos < 5%

**Cálculo:**
```typescript
// Nivel de retorno promedio
if (meanROIC <= 0) levelScore = 0;
else if (meanROIC <= 0.10) levelScore = meanROIC * 400;       // 0-40 points
else if (meanROIC <= 0.20) levelScore = 40 + (meanROIC - 0.10) * 200; // 40-60
else if (meanROIC <= 0.40) levelScore = 60 + (meanROIC - 0.20) * 100; // 60-80
else levelScore = 80 + (meanROIC - 0.40) * 50;                // 80-100

// Estabilidad (menor volatilidad = mejor)
const sdPercent = stdDev(roicHistory) * 100;
stabilityScore = 100 - sdPercent * 2;

// Penalización por failures (años con ROIC < 5%)
const failureRate = failureYears / totalYears;
failurePenalty = failureRate * 100;

// Score final del eje
returnPersistence = 0.30 * levelScore + 0.45 * stabilityScore - 0.25 * failurePenalty;
```

**Ejemplos:**
- **Strong:** Apple (ROIC promedio 35%, SD 5%, 0 failures) → Score: 92
- **Defendable:** Coca-Cola (ROIC promedio 18%, SD 8%, 1 failure) → Score: 68
- **Weak:** Airline (ROIC promedio 4%, SD 20%, 5 failures) → Score: 25

#### 2. Operating Stability (35%) - Estabilidad Operativa

**Pregunta:** ¿La empresa preserva márgenes cuando crece?

**Métricas:**
- Volatilidad de márgenes operativos
- Episodios de crecimiento + expansión de márgenes (buenos)
- Episodios de crecimiento + compresión de márgenes (malos)

**Cálculo:**
```typescript
// Estabilidad de márgenes
const marginSD = stdDev(operatingMarginHistory) * 100;
marginStability = 100 - marginSD * 2;

// Análisis episódico (año-a-año)
for (let i = 1; i < history.length; i++) {
  const revenueGrowth = (curr.revenue - prev.revenue) / prev.revenue;
  const marginChange = curr.operating_margin - prev.operating_margin;
  
  if (revenueGrowth > 0.05 && marginChange >= 0) {
    goodEpisodes++; // High Quality Growth
  } else if (revenueGrowth > 0.05 && marginChange < -0.01) {
    badEpisodes++;  // Inefficient Growth
  }
}

// Score final
operatingStability = 0.60 * marginStability + 
                     0.25 * (goodEpisodes / totalEpisodes) * 100 - 
                     0.15 * (badEpisodes / totalEpisodes) * 100;
```

**Ejemplos:**
- **Strong:** Visa (márgenes estables 65%, 8 episodios buenos, 0 malos) → Score: 95
- **Defendable:** Starbucks (márgenes estables 12%, 5 buenos, 2 malos) → Score: 62
- **Weak:** Commodity Producer (márgenes volátiles, 2 buenos, 7 malos) → Score: 30

#### 3. Capital Discipline (25%) - Disciplina de Capital

**Pregunta:** ¿La empresa crea valor cuando reinvierte capital?

**Lógica:**
- **Value Creation:** Capital crece Y ROIC se mantiene/mejora
- **Value Destruction:** Capital crece pero ROIC cae

**Cálculo:**
```typescript
const capitalGrowth = (latestCapital - oldestCapital) / oldestCapital * 100;
const roicChange = (latestROIC - oldestROIC) * 100; // percentage points

// Escenarios
if (capitalGrowth > 30 && roicChange >= 5) return 100;  // Excellent
if (capitalGrowth > 30 && roicChange >= 0) return 80;   // Good
if (capitalGrowth > 30 && roicChange < -5) return 30;   // Poor (over-expansion)
if (capitalGrowth < 5) return 60;                        // Stagnant
```

**Ejemplos:**
- **Excellent (100):** AAPL (Capital +120%, ROIC 35%→40%)
- **Good (80):** MSFT (Capital +80%, ROIC 30%→31%)
- **Poor (30):** AMZN Retail (Capital +150%, ROIC 12%→6%)

### Score Final

```typescript
const competitiveAdvantage = 
  returnPersistence * 0.40 +
  operatingStability * 0.35 +
  capitalDiscipline * 0.25;
```

### Sistema de Confianza

**Factores:**
- **Años Analizados:** Más años = mayor confianza
  - ≥7 años → Confidence: High
  - 4-6 años → Confidence: Medium
  - <4 años → Confidence: Low

- **Completitud de Métricas:**
  - Todos los ejes calculados → +20%
  - 2/3 ejes calculados → +10%
  - 1/3 ejes calculados → +0%

### Output

```typescript
interface CompetitiveAdvantageResult {
  score: number | null;                  // 0-100
  band: 'weak' | 'defendable' | 'strong';
  confidence: number;                    // 0-100
  axes: {
    return_persistence: number | null;
    operating_stability: number | null;
    capital_discipline: number | null;
  };
  years_analyzed: number;
}
```

### Ejemplo Competitive Advantage (Visa - V)

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
- **Score 91 (Strong):** Visa demuestra ventaja competitiva duradera
- **Return Persistence 94:** ROIC consistentemente alto (40%+) con baja volatilidad
- **Operating Stability 92:** Márgenes estables 65%, crecimiento sin erosión de pricing power
- **Capital Discipline 85:** Reinversión eficiente, ROIC se mantiene alto pese a expansión

---

## Moat Score

### ¿Qué es?

**Moat Score** es una **versión simplificada de Competitive Advantage** enfocada en **persistencia de ROIC** y **estabilidad de márgenes**. No incluye Capital Discipline.

**Score Range:** 0-100  
**Status:** `computed` | `partial` | `pending`

**Diferencia vs Competitive Advantage:**
- **Moat:** 2 ejes (ROIC + Margins), scoring básico
- **Competitive Advantage:** 3 ejes (ROIC + Margins + Capital Discipline), scoring avanzado

### ¿Cómo funciona?

```typescript
const moatScore = (roicPersistence + marginStability) / 2;
```

#### 1. ROIC Persistence (50%)

**Cálculo:**
- Promedio de ROIC histórico (FY)
- Desviación estándar de ROIC
- Penalización por años con ROIC < 5%

**Scoring:**
- ROIC > 25% consistente → Score: 90-100
- ROIC 15-25% estable → Score: 70-89
- ROIC 10-15% estable → Score: 50-69
- ROIC < 10% → Score: <50

#### 2. Margin Stability (50%)

**Cálculo:**
- Desviación estándar de márgenes operativos o netos
- Episodios de expansión de márgenes durante crecimiento

**Scoring:**
- SD < 3% (márgenes muy estables) → Score: 90-100
- SD 3-6% → Score: 70-89
- SD 6-10% → Score: 50-69
- SD > 10% (márgenes volátiles) → Score: <50

### Coherence Check (Opcional)

**Propósito:** Detectar si el crecimiento es de alta calidad (con pricing power) o ineficiente (erosión de márgenes).

**Inputs:**
- `revenueGrowth`: % de crecimiento de ingresos (e.g., 0.25 = 25%)
- `operatingMarginChange`: Cambio en margen operativo en pp (e.g., -0.01 = -1pp)

**Verdicts:**
- **High Quality Growth (100):** Revenue +5%+ Y margin expansion
- **Neutral (50-70):** Revenue +5%+ Y margin decline < -1pp
- **Inefficient Growth (30):** Revenue +5%+ Y margin decline > -1pp

**Ejemplos:**
- **Apple 2010-2020:** Revenue +10%, Margin +3pp → High Quality Growth
- **Amazon Retail 2012-2015:** Revenue +25%, Margin -2pp → Inefficient Growth

### Output Moat

```typescript
interface MoatResult {
  score: number | null;                  // 0-100
  status: 'computed' | 'partial' | 'pending';
  confidence: number | null;
  coherenceCheck?: {
    score: number;
    verdict: 'High Quality Growth' | 'Neutral' | 'Inefficient Growth';
    explanation: string;
  };
  details?: {
    roic_persistence: number;
    margin_stability: number;
    years_analyzed: number;
  };
}
```

### Ejemplo Moat (Costco - COST)

```json
{
  "score": 72,
  "status": "computed",
  "confidence": 85,
  "coherenceCheck": {
    "score": 70,
    "verdict": "Neutral",
    "explanation": "Revenue growth with minor margin pressure - acceptable if investing for future"
  },
  "details": {
    "roic_persistence": 75,
    "margin_stability": 68,
    "years_analyzed": 8
  }
}
```

**Interpretación:**
- **Score 72:** Moat defendible (no excepcional)
- **ROIC 75:** Retornos consistentes (~15%) aunque no excepcionales
- **Margin Stability 68:** Márgenes bajos (~3%) pero muy estables (modelo de volume retail)
- **Coherence: Neutral:** Crecimiento de ingresos con ligera presión en márgenes

---

## Sentiment Score

### ¿Qué es?

**Sentiment Score** captura si el mercado está valuando a la empresa **por encima** o **por debajo** de su historia, usando **trayectorias temporales de múltiplos de valuación**.

**Score Range:** 0-100  
**Bands:** Pessimistic (<40), Neutral (40-60), Optimistic (>60)

### ¿Cómo funciona?

Sentiment compara los múltiplos **actuales (TTM)** con múltiplos **históricos (TTM-1A, TTM-3A, TTM-5A)** para detectar **revaluaciones** (re-ratings) o **desvaluaciones**.

**Lógica:**
- **Optimistic:** Múltiplos actuales > históricos (mercado paga prima)
- **Pessimistic:** Múltiplos actuales < históricos (mercado descuenta)
- **Neutral:** Múltiplos actuales ≈ históricos

#### Múltiplos Analizados

- `pe_ratio` (P/E)
- `ev_ebitda` (EV/EBITDA)
- `price_to_fcf` (Precio/FCF)
- `price_to_sales` (Precio/Ventas)

#### Ventanas Temporales

| Snapshot | Descripción |
|----------|-------------|
| TTM | Actual (Trailing Twelve Months) |
| TTM_1A | Hace 1 año |
| TTM_3A | Hace 3 años |
| TTM_5A | Hace 5 años |

### Algoritmo Sentiment

```typescript
// Paso 1: Calcular desviación relativa para cada múltiplo
for (const multiple of ['pe_ratio', 'ev_ebitda', 'price_to_fcf', 'price_to_sales']) {
  const current = timeline.TTM[multiple];
  const h1 = timeline.TTM_1A[multiple];
  const h3 = timeline.TTM_3A[multiple];
  const h5 = timeline.TTM_5A[multiple];
  
  // Calcular desviación vs cada snapshot histórico
  if (h1 && current) {
    const deviation = (current - h1) / h1;
    deviations.push(deviation);
  }
}

// Paso 2: Calcular score base (mediana de desviaciones)
const medianDeviation = calculateMedian(deviations);
const CLAMP_DEV = 1.5; // Clampear a ±150%
const clamped = Math.max(-CLAMP_DEV, Math.min(CLAMP_DEV, medianDeviation));
const baseScore = 50 + (clamped / CLAMP_DEV) * 50; // -150%→0, 0→50, +150%→100

// Paso 3: Ajustar por consistencia direccional
const positiveSignals = deviations.filter(d => d > 0.05).length;
const negativeSignals = deviations.filter(d => d < -0.05).length;

let consistencyFactor = 1.0;
if (positiveSignals === deviations.length) consistencyFactor = 1.15; // Todas las señales positivas
if (negativeSignals === deviations.length) consistencyFactor = 1.15; // Todas las señales negativas
if (positiveSignals > 0 && negativeSignals > 0) consistencyFactor = 0.85; // Señales mixtas

// Paso 4: Ajustar por intensidad de re-rating
const avgDeviation = Math.abs(medianDeviation);
let intensityPenalty = 0;
if (avgDeviation > 0.50) intensityPenalty = 10; // Re-rating extremo (>50%)
if (avgDeviation > 1.00) intensityPenalty = 20; // Re-rating irracional (>100%)

// Score final
const sentiment = clamp(baseScore * consistencyFactor - intensityPenalty, 0, 100);
```

### Sistema de Confianza Sentiment

**Factores:**

1. **Cobertura de Múltiplos (40%):**
   - 4/4 múltiplos disponibles → 100%
   - 3/4 múltiplos → 75%
   - 2/4 múltiplos → 50%
   - 1/4 múltiplos → 25%

2. **Disponibilidad de Historia (40%):**
   - Historia 5 años disponible → 100%
   - Historia 3 años → 75%
   - Historia 1 año → 50%
   - Sin historia → 0%

3. **Consistencia de Señales (20%):**
   - Todas señales en misma dirección → 100%
   - 80% en misma dirección → 80%
   - Señales mixtas → 50%

### Output Sentiment

```typescript
interface SentimentResult {
  value: number | null;                  // 0-100
  band: 'pessimistic' | 'neutral' | 'optimistic';
  confidence: number | null;             // 0-100
  status: 'computed' | 'partial' | 'pending';
  signals: {
    relative_deviation: number | null;   // Mediana de desviaciones
    directional_consistency: number | null;
    rerating_intensity_penalty: number | null;
  };
}
```

### Ejemplo Sentiment (Nvidia - NVDA)

**Timeline de Múltiplos:**
| Snapshot | P/E | EV/EBITDA | P/FCF | P/S |
|----------|-----|-----------|-------|-----|
| TTM      | 85  | 62        | 75    | 28  |
| TTM_1A   | 45  | 32        | 38    | 18  |
| TTM_3A   | 35  | 28        | 30    | 15  |
| TTM_5A   | 28  | 22        | 25    | 12  |

**Cálculo:**
```typescript
// Desviaciones
PE: (85-45)/45 = 88.8%, (85-35)/35 = 142.8%, (85-28)/28 = 203.5%
EV: (62-32)/32 = 93.7%, (62-28)/28 = 121.4%, (62-22)/22 = 181.8%
// ... etc

// Mediana de desviaciones: ~120%
// Consistencia: 100% (todas positivas)
// Intensidad penalty: 20 (re-rating extremo >100%)
```

**Resultado:**
```json
{
  "value": 82,
  "band": "optimistic",
  "confidence": 88,
  "status": "computed",
  "signals": {
    "relative_deviation": 1.20,
    "directional_consistency": 100,
    "rerating_intensity_penalty": 20
  }
}
```

**Interpretación:**
- **Score 82 (Optimistic):** Mercado valúa NVDA significativamente por encima de su historia
- **Desviación +120%:** Múltiplos han DUPLICADO en 5 años
- **Consistency 100%:** Todas las señales apuntan en misma dirección
- **Penalty 20:** Re-rating extremo merece cautela

---

## Valuation Score (Relative)

### ¿Qué es?

**Valuation Relative Score** evalúa si una empresa está **cara** o **barata** vs su **sector** usando múltiplos de valuación normalizados por percentiles sectoriales.

**Score Range:** Percentil 0-100  
**Verdicts:** Very Cheap (<20), Cheap (20-40), Fair (40-60), Expensive (60-80), Very Expensive (>80)

### ¿Cómo funciona?

Valuation mapea los múltiplos de la empresa a **percentiles sectoriales** (p10, p25, p50, p75, p90) y calcula la **mediana de percentiles**.

#### Múltiplos Analizados

- `pe_ratio` (P/E)
- `ev_ebitda` (EV/EBITDA)
- `price_to_fcf` (Precio/FCF)

**Regla CRÍTICA:** Mínimo **2 de 3 múltiplos** requeridos para status `computed`.

### Algoritmo Valuation

```typescript
// Paso 1: Validar múltiplos (deben ser >0 y finitos)
const pe = validate(input.pe_ratio);       // null si ≤0 o no finito
const ev = validate(input.ev_ebitda);
const pfcf = validate(input.price_to_fcf);

// Paso 2: Calcular percentil de cada múltiplo vs sector
const percentiles = [];
if (pe) percentiles.push(resolvePercentile(pe, sectorBenchmark.pe_ratio));
if (ev) percentiles.push(resolvePercentile(ev, sectorBenchmark.ev_ebitda));
if (pfcf) percentiles.push(resolvePercentile(pfcf, sectorBenchmark.price_to_fcf));

// Paso 3: Verificar mínimo de cobertura
if (percentiles.length < 2) {
  return { status: 'pending', valuation_status: 'pending' };
}

// Paso 4: Calcular mediana de percentiles
const medianPercentile = calculateMedian(percentiles);

// Paso 5: Mapear a verdict
if (medianPercentile <= 20) return 'very_cheap_sector';
if (medianPercentile <= 40) return 'cheap_sector';
if (medianPercentile <= 60) return 'fair_sector';
if (medianPercentile < 80) return 'expensive_sector';
return 'very_expensive_sector';
```

### Función de Percentil (Interpolación)

```typescript
function resolvePercentile(value: number, stats: SectorBenchmark): number {
  const points = [
    { p: 10, v: stats.p10 },
    { p: 25, v: stats.p25 },
    { p: 50, v: stats.p50 },
    { p: 75, v: stats.p75 },
    { p: 90, v: stats.p90 }
  ];
  
  // Interpolar linealmente entre puntos
  // Ejemplo: Si value está entre p25 y p50, interpolar percentil exacto
}
```

### Sistema de Confianza Valuation

**Factores:**

1. **Cobertura de Múltiplos (60%):**
   - 3/3 múltiplos → 100%
   - 2/3 múltiplos → 67%
   - 1/3 múltiplos → 33% (insuficiente, status: pending)

2. **Dispersión de Percentiles (40%):**
   - Dispersion = max(percentiles) - min(percentiles)
   - Dispersión 0-20 → Penalización: 0%
   - Dispersión 20-50 → Penalización: 20%
   - Dispersión >50 → Penalización: 40%

**Confidence Labels:**
- **High:** >70%
- **Medium:** 40-70%
- **Low:** <40%

### Output Valuation

```typescript
interface ValuationState {
  stage: 'pending' | 'partial' | 'computed';
  valuation_status: 'very_cheap_sector' | 'cheap_sector' | 'fair_sector' | 
                    'expensive_sector' | 'very_expensive_sector' | 'pending';
  metrics: {
    pe_ratio: number | null;
    ev_ebitda: number | null;
    price_to_fcf: number | null;
  };
  confidence: number;                      // 0-100
  confidence_label: 'High' | 'Medium' | 'Low';
  percentile: number;                      // 0-100
}
```

### Ejemplo Valuation (Walmart - WMT)

**Sector:** Discount Stores

**Benchmarks Sectoriales:**
| Multiple | p10 | p25 | p50 | p75 | p90 |
|----------|-----|-----|-----|-----|-----|
| P/E      | 12  | 18  | 24  | 32  | 45  |
| EV/EBITDA| 8   | 11  | 14  | 18  | 24  |
| P/FCF    | 10  | 15  | 20  | 27  | 38  |

**Datos Walmart:**
- P/E: 26
- EV/EBITDA: 12
- P/FCF: 18

**Cálculo:**
```typescript
// Percentil P/E: 26 está entre p50 (24) y p75 (32)
// Interpolación: 50 + ((26-24)/(32-24)) * 25 = 56.25

// Percentil EV/EBITDA: 12 está entre p25 (11) y p50 (14)
// Interpolación: 25 + ((12-11)/(14-11)) * 25 = 33.33

// Percentil P/FCF: 18 está entre p25 (15) y p50 (20)
// Interpolación: 25 + ((18-15)/(20-15)) * 25 = 40.0

// Mediana de percentiles: [56.25, 33.33, 40.0] → 40.0
```

**Resultado:**
```json
{
  "stage": "computed",
  "valuation_status": "fair_sector",
  "metrics": {
    "pe_ratio": 26,
    "ev_ebitda": 12,
    "price_to_fcf": 18
  },
  "confidence": 75,
  "confidence_label": "High",
  "percentile": 40
}
```

**Interpretación:**
- **Fair (percentil 40):** Walmart cotiza en línea con la mediana de su sector
- **Confidence 75%:** 3/3 múltiplos disponibles, baja dispersión (56-33 = 23)
- **No está cara ni barata:** Valuación neutral vs peers

---

## Dividend Quality Score

### ¿Qué es?

**Dividend Quality Score** evalúa la **sostenibilidad** y **resiliencia** de los dividendos de una empresa mediante análisis de **consistencia**, **crecimiento**, **payout ratios** y **disciplina de capital**.

**Score Range:** 0-100  
**Bands:** Weak (<50), Acceptable (50-75), High (>75)

### ¿Cómo funciona?

Score calculado como promedio ponderado de **4 ejes**:

#### 1. Consistency (Consistencia) - 30%

**Pregunta:** ¿La empresa paga dividendos de forma consistente?

**Métricas:**
- Ratio de años pagando dividendos
- Número de interrupciones (gaps)
- Duración de interrupciones consecutivas

**Scoring:**
```typescript
const payRatio = yearsPaying / totalYears;
const baseScore = payRatio * 100;

// Penalización por gaps
const gapPenalty = min(30, gapsCount * 8 + maxConsecutiveGaps * 4);
const consistencyScore = clamp(baseScore - gapPenalty, 0, 100);
```

**Ejemplos:**
- **High (95):** Procter & Gamble - 130 años consecutivos sin interrupciones
- **Acceptable (68):** General Electric - Dividendos en 90% de años, 2 gaps
- **Weak (25):** Ford - Dividendos suspendidos en crisis, 5 gaps en 10 años

#### 2. Growth Reliability (Confiabilidad de Crecimiento) - 25%

**Pregunta:** ¿Los dividendos crecen de forma predecible?

**Métricas:**
- Tasa de crecimiento promedio de DPS (Dividend Per Share)
- Volatilidad del crecimiento (SD)
- Número de episodios de aumento vs recorte

**Scoring:**
```typescript
// Base por tasa de crecimiento
if (meanGrowth >= 0 && meanGrowth <= 0.05) baseScore = 70;  // Crecimiento sano 0-5%
else if (meanGrowth > 0.05) baseScore = 80;                 // Crecimiento alto >5%
else baseScore = 40;                                         // Crecimiento negativo

// Penalización por volatilidad
const volatilityPenalty = min(40, stdDev * 200);

// Penalización por reversiones
if (positiveYears > 0 && negativeYears > 0) {
  directionPenalty = 15; // Crecimiento inconsistente
}

const growthScore = clamp(baseScore - volatilityPenalty - directionPenalty, 0, 100);
```

**Ejemplos:**
- **High (90):** Microsoft - Crecimiento 8%/año, SD 2%, sin recortes
- **Acceptable (65):** AT&T - Crecimiento 2%/año, SD 5%, 2 recortes
- **Weak (30):** Airline - Crecimiento volátil, múltiples recortes

#### 3. Payout Sustainability (Sostenibilidad del Payout) - 30%

**Pregunta:** ¿Los dividendos están cubiertos por ganancias y flujo de caja?

**Métricas:**
- `payout_eps` (Dividendos / EPS)
- `payout_fcf` (Dividendos / Free Cash Flow)

**Scoring por Rango de Payout:**

| Payout Ratio | Score | Interpretación |
|--------------|-------|----------------|
| 30-70%       | 90    | Óptimo (sostenible + espacio para crecer) |
| 15-30%       | 80    | Conservador (muy sostenible, bajo rendimiento) |
| 70-90%       | 70    | Ajustado (riesgo moderado si ganancias caen) |
| 90-100%      | 60    | Límite (poco espacio de maniobra) |
| >100%        | 25    | Insostenible (pagando más de lo que gana) |
| >150%        | 10    | Crítico (consumiendo reservas) |

**Lógica:**
- Promedio de scores EPS y FCF por año
- Promedio histórico (10 años max)

**Ejemplos:**
- **High (90):** Johnson & Johnson - Payout EPS 55%, Payout FCF 48%
- **Acceptable (70):** Verizon - Payout EPS 85%, Payout FCF 52%
- **Weak (25):** Company X - Payout EPS 120% (insostenible)

#### 4. Capital Discipline (Disciplina de Capital) - 15%

**Pregunta:** ¿La empresa equilibra dividendos con reinversión productiva?

**Métricas:**
- Dividendo absoluto crece Y ROIC/ROE se mantiene o mejora
- Dividendo crece pero ROIC cae (malas decisiones de asignación)

**Scoring:**
```typescript
const divGrowth = (latestDividend - oldestDividend) / oldestDividend;
const roicChange = latestROIC - oldestROIC;

if (divGrowth > 0.10 && roicChange >= 0) return 90;        // Disciplina excelente
if (divGrowth > 0.10 && roicChange >= -0.02) return 70;    // Aceptable
if (divGrowth > 0.10 && roicChange < -0.05) return 30;     // Dividendo a expensas de calidad
if (divGrowth < 0) return 40;                               // Dividendo en declive
```

**Ejemplos:**
- **Excellent (90):** Apple - Dividendo +120%, ROIC mantiene 35%
- **Good (70):** McDonald's - Dividendo +80%, ROIC cae 2pp
- **Poor (30):** Company Y - Dividendo +50%, ROIC cae 10pp (priorizando payout sobre reinversión)

### Score Final

```typescript
const dividendQuality = 
  consistency * 0.30 +
  growthReliability * 0.25 +
  payoutSustainability * 0.30 +
  capitalDiscipline * 0.15;
```

### Sistema de Confianza

**Basado en años analizados:**
- ≥7 años → Confidence: High
- 4-6 años → Confidence: Medium
- <4 años → Confidence: Low

### Output

```typescript
interface DividendQualityResult {
  score: number | null;                  // 0-100
  band: 'weak' | 'acceptable' | 'high';
  confidence: number | null;
  axes: {
    consistency: number | null;
    growth_reliability: number | null;
    payout_sustainability: number | null;
    capital_discipline: number | null;
  };
  years_analyzed: number;
}
```

### Ejemplo Dividend Quality (Johnson & Johnson - JNJ)

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
- **Score 89 (High):** Dividendos de JNJ son de alta calidad y sostenibles
- **Consistency 100:** 61 años consecutivos incrementando dividendos (Dividend Aristocrat)
- **Growth 85:** Crecimiento 6%/año, baja volatilidad, sin reversiones
- **Payout 90:** Payout ratio 55% (óptimo), cubierto por FCF
- **Discipline 82:** Dividendo crece sin sacrificar reinversión

---

## Relative Return Score

### ¿Qué es?

**Relative Return Score** evalúa el **rendimiento total** (precio + dividendos) de una acción vs su benchmark sectorial a través de múltiples ventanas temporales.

**Score Range:** 0-100  
**Bands:** Underperformer (<40), Neutral (40-60), Outperformer (>60)

### ¿Cómo funciona?

Score calculado como promedio ponderado de **alpha por ventana**, ajustado por **consistencia** y **drawdown penalty**.

#### Ventanas Analizadas

- **1Y:** Rendimiento en último año
- **3Y:** Rendimiento en últimos 3 años
- **5Y:** Rendimiento en últimos 5 años

### Cálculo del Score

```typescript
// Paso 1: Calcular alpha por ventana
for (const window of ['1Y', '3Y', '5Y']) {
  const assetReturn = timeline[window].asset_return;  // % total return
  const benchReturn = timeline[window].benchmark_return;
  const alpha = assetReturn - benchReturn;            // Puntos porcentuales
  
  // Mapear alpha a score 0-100
  const MAX_ALPHA = 20; // ±20pp vs benchmark = extremos
  const clamped = clamp(alpha, -MAX_ALPHA, +MAX_ALPHA);
  const score = 50 + (clamped / MAX_ALPHA) * 50;      // -20pp→0, 0→50, +20pp→100
  
  alphaScores.push(score);
}

// Paso 2: Promedio de ventanas
const baseScore = average(alphaScores);

// Paso 3: Ajustar por consistencia
const positiveAlphas = alphas.filter(a => a > 1).length;
const negativeAlphas = alphas.filter(a => a < -1).length;

let consistencyScore = 50; // Neutral
if (positiveAlphas === 3 && negativeAlphas === 0) {
  consistencyScore = 75 + min(25, avgAlpha / 10 * 25); // All outperform (75-100)
} else if (negativeAlphas === 3 && positiveAlphas === 0) {
  consistencyScore = max(0, 25 - avgAlpha / 10 * 25);  // All underperform (0-25)
}

// Paso 4: Penalización por drawdown
let drawdownPenalty = 0;
for (const window of ['1Y', '3Y', '5Y']) {
  const assetDD = timeline[window].asset_max_drawdown;
  const benchDD = timeline[window].benchmark_max_drawdown;
  const diff = assetDD - benchDD; // Positivo si asset tuvo peor drawdown
  
  if (diff > 0) {
    const MAX_DIFF = 20; // Cap: 20pp peor drawdown
    const penalty = (min(diff, MAX_DIFF) / MAX_DIFF) * 20; // Hasta 20 puntos
    drawdownPenalty = max(drawdownPenalty, penalty);
  }
}

// Score final
const relativeReturn = clamp(
  baseScore * 0.60 + consistencyScore * 0.30 - drawdownPenalty * 0.10,
  0, 100
);
```

### Sistema de Confianza

**Factores:**
- **Cobertura de Ventanas (70%):**
  - 3/3 ventanas → 100%
  - 2/3 ventanas → 67%
  - 1/3 ventanas → 33%

- **Disponibilidad de Drawdown (30%):**
  - Drawdown disponible en todas ventanas → 100%
  - Drawdown parcial → 50%
  - Sin drawdown → 0%

### Output

```typescript
interface RelativeReturnResult {
  score: number | null;                  // 0-100
  band: 'underperformer' | 'neutral' | 'outperformer';
  confidence: number | null;
  components: {
    window_alpha: {
      '1Y': { asset_return: number; benchmark_return: number; alpha: number; score: number };
      '3Y': { ... };
      '5Y': { ... };
    };
    consistency_score: number;           // 0-100
    drawdown_penalty: number;            // 0-100 (penalty)
  };
  windows_used: string[];
}
```

### Ejemplo Relative Return (Amazon - AMZN)

**Timeline de Retornos:**

| Window | Asset Return | Benchmark Return | Alpha | Score |
|--------|--------------|------------------|-------|-------|
| 1Y     | 32%          | 12%              | +20pp | 100   |
| 3Y     | 85%          | 45%              | +40pp | 100   |
| 5Y     | 180%         | 90%              | +90pp | 100   |

**Drawdowns:**
- 1Y: Asset -15%, Benchmark -18% (asset mejor)
- 3Y: Asset -25%, Benchmark -22% (asset ligeramente peor)
- 5Y: Asset -30%, Benchmark -25% (asset peor por 5pp)

**Cálculo:**
```typescript
// Base Score: (100 + 100 + 100) / 3 = 100
// Consistency: Todas ventanas positivas → 100
// Drawdown Penalty: Max diff = 5pp → (5/20) * 20 = 5 puntos

// Score Final:
relativeReturn = 100 * 0.60 + 100 * 0.30 - 5 * 0.10 = 89.5 → 90
```

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
- **Score 90 (Outperformer):** Amazon ha superado consistentemente a su sector
- **Alpha +50pp promedio:** Retornos significativamente superiores
- **Consistency 100:** Outperformance en todas las ventanas temporales
- **Drawdown Penalty 5:** Ligera mayor volatilidad vs benchmark

---

## Fintra Verdict (Integrador)

### ¿Qué es?

**Fintra Verdict** es el **score integrador** que sintetiza todos los scores anteriores en un **veredicto multidimensional** que describe el escenario analítico de una empresa.

**Verdicts:** Exceptional, Strong, Balanced, Fragile, Speculative, Inconclusive

### ¿Cómo funciona?

Fintra Verdict evalúa **coherencia** y **tensiones** entre diferentes dimensiones analíticas.

#### Inputs Requeridos

```typescript
interface FintraVerdictInputs {
  fgos: { score: number; band: 'weak' | 'defendable' | 'strong' };
  competitive_advantage?: { score: number; band: 'weak' | 'defendable' | 'strong' };
  sentiment?: { score: number; band: 'pessimistic' | 'neutral' | 'optimistic' };
  dividend_quality?: { score: number; band: 'weak' | 'acceptable' | 'high' };
  relative_return?: { score: number; band: 'underperformer' | 'neutral' | 'outperformer' };
}
```

### Lógica de Veredictos

#### 1. Exceptional (Excepcional)

**Condiciones:**
- FGOS: Strong
- Competitive Advantage: Strong
- Dividend Quality: Acceptable o High
- Relative Return: Outperformer
- Sentiment: NO optimistic (evita overvaluation risk)

**Interpretación:** Negocio excepcional con ventaja competitiva duradera, sin optimismo excesivo de mercado.

**Ejemplo:** Apple con FGOS 87, Comp.Adv 91, Dividend High, Relative Return 82, Sentiment Neutral.

---

#### 2. Strong (Fuerte)

**Condiciones:**
- FGOS: Strong o Defendable
- Competitive Advantage: NO Weak
- Dividend Quality: NO Weak
- Relative Return: NO Underperformer

**Interpretación:** Negocio sólido con fundamentales robustos y posición competitiva defendible.

**Ejemplo:** Microsoft con FGOS 82, Comp.Adv Defendable, Dividend Acceptable, Relative Return Neutral.

---

#### 3. Balanced (Balanceado)

**Condiciones:**
- Mix de fortalezas y debilidades
- Sin tensiones mayores
- FGOS: Defendable

**Interpretación:** Negocio estable con algunas dimensiones favorables y otras neutrales.

**Ejemplo:** Walmart con FGOS 65, Comp.Adv Defendable, Dividend Acceptable, Relative Return Neutral.

---

#### 4. Fragile (Frágil)

**Condiciones (al menos una):**
- FGOS: Weak
- Dividend Quality: Weak
- Relative Return: Underperformer

**Interpretación:** Negocio con vulnerabilidades estructurales que requieren monitoreo cercano.

**Ejemplo:** Ford con FGOS 42, Comp.Adv Weak, Dividend Weak, Relative Return Underperformer.

---

#### 5. Speculative (Especulativo)

**Condiciones:**
- FGOS: Weak
- Sentiment: Optimistic

**Interpretación:** Negocio débil con optimismo de mercado (desconexión fundamentales-precio).

**Ejemplo:** Growth stock unprofitable con FGOS 35, Sentiment Optimistic.

---

#### 6. Inconclusive (Inconcluso)

**Condiciones:**
- FGOS: Pending o null
- Insuficientes datos para formar veredicto

**Interpretación:** Faltan datos críticos para análisis completo.

---

### Drivers (Positivos/Negativos/Tensiones)

Fintra Verdict identifica **drivers** específicos:

**Positivos:**
- "Strong business quality" (FGOS Strong)
- "Strong competitive advantage"
- "High dividend quality"
- "Persistent outperformance"

**Negativos:**
- "Weak business quality" (FGOS Weak)
- "Unsustainable dividends"
- "Structural underperformance"

**Tensiones (Alertas analíticas):**
- "Strong business with pessimistic sentiment" → Posible oportunidad
- "Weak business with optimistic sentiment" → Desconexión riesgosa
- "Good dividends with poor returns" → Dividend trap potencial

### Output

```typescript
interface FintraVerdictResult {
  verdict_label: 'exceptional' | 'strong' | 'balanced' | 'fragile' | 'speculative' | 'inconclusive';
  verdict_score: number | null;          // 0-100 (agregado ponderado)
  confidence: number | null;
  drivers: {
    positives: string[];
    negatives: string[];
    tensions: string[];
  };
}
```

### Ejemplo Fintra Verdict (Coca-Cola - KO)

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
- **Exceptional:** Coca-Cola combina negocio de calidad con moat fuerte y dividendos sostenibles
- **Sin tensiones:** Fundamentales y mercado coherentes (sentiment neutral)
- **Confidence 88%:** Alta disponibilidad de datos, scores consistentes

---

## Quality Brakes (Frenos de Calidad)

### ¿Qué son?

**Quality Brakes** son **ajustes defensivos** al FGOS Score cuando métricas de riesgo contable/financiero detectan vulnerabilidades estructurales.

**Propósito:** Penalizar empresas con fundamentales aparentemente sólidos pero con **riesgo financiero elevado** o **baja calidad contable**.

### Métricas Utilizadas

#### 1. Altman Z-Score

**Propósito:** Predictor de quiebra (bankruptcy risk).

**Interpretación:**
- Z > 3.0 → Zona segura (sin penalización)
- 1.8 < Z < 3.0 → Zona gris (penalización leve: -5 puntos)
- Z < 1.8 → Zona de riesgo (penalización fuerte: -15 puntos)

**Ejemplo:**
- **Empresa A:** Altman Z = 1.2 → Quality Brakes applied (-15)
- **Empresa B:** Altman Z = 2.5 → Penalización leve (-5)
- **Empresa C:** Altman Z = 4.5 → Sin penalización

---

#### 2. Piotroski F-Score

**Propósito:** Calidad contable y salud financiera (9 señales binarias).

**Interpretación:**
- Piotroski ≥ 7 → Alta calidad (sin penalización)
- 4 ≤ Piotroski ≤ 6 → Calidad media (penalización leve: -5 puntos)
- Piotroski ≤ 3 → Baja calidad (penalización fuerte: -15 puntos)

**Ejemplo:**
- **Empresa X:** Piotroski = 3 → Quality Brakes applied (-15)
- **Empresa Y:** Piotroski = 5 → Penalización leve (-5)
- **Empresa Z:** Piotroski = 8 → Sin penalización

---

### Aplicación de Quality Brakes

```typescript
let penalty = 0;
const warnings = [];

// Altman Z
if (altmanZ < 1.8) {
  penalty += 15;
  warnings.push("Altman Z bajo (riesgo financiero)");
} else if (altmanZ < 3.0) {
  penalty += 5;
  warnings.push("Altman Z zona gris");
}

// Piotroski
if (piotroskiScore <= 3) {
  penalty += 15;
  warnings.push("Piotroski bajo (calidad débil)");
} else if (piotroskiScore <= 6) {
  penalty += 5;
  warnings.push("Piotroski medio");
}

// Aplicar ajuste al FGOS Score
const confidence = 100 - penalty;
if (confidence <= 85) {
  adjustedFGOS = round(fgosScore * 0.90); // Reducción 10%
}
```

### Output

```typescript
interface QualityBrakesResult {
  adjustedScore: number;                 // FGOS ajustado
  confidence: number;                    // 0-100
  warnings: string[];
  quality_brakes: {
    applied: boolean;
    reasons: string[];                   // ['altman_distress', 'piotroski_weak']
  };
}
```

### Ejemplo Quality Brakes (Company X)

**FGOS Raw:** 72

**Inputs:**
- Altman Z: 1.5 (Zona de riesgo)
- Piotroski: 4 (Calidad media)

**Cálculo:**
```typescript
penalty = 15 (Altman) + 5 (Piotroski) = 20
confidence = 100 - 20 = 80
adjustedFGOS = 72 * 0.90 = 64.8 → 65
```

**Resultado:**
```json
{
  "adjustedScore": 65,
  "confidence": 80,
  "warnings": [
    "Altman Z bajo (riesgo financiero)",
    "Piotroski medio"
  ],
  "quality_brakes": {
    "applied": true,
    "reasons": ["altman_distress"]
  }
}
```

**Interpretación:**
- **FGOS ajustado de 72 a 65:** Penalización por riesgo financiero
- **Confidence 80%:** Métricas fundamentales sólidas pero con vulnerabilidad estructural
- **Warning Altman:** Empresa en zona de riesgo de quiebra (Z < 1.8)

---

## Sistema de Confianza

### Arquitectura General

Fintra implementa **confianza en múltiples capas**:

#### 1. Score-Level Confidence (Por Score)

Cada score tiene su propio sistema de confianza basado en:
- **Disponibilidad de datos:** Métricas completas vs parciales
- **Calidad de benchmarks:** Tamaño de universo sectorial
- **Historia temporal:** Años de datos disponibles

**Ejemplo:**
```typescript
{
  "fgos_score": 87,
  "fgos_confidence": 95,  // High (≥10 años datos, sector 100+ empresas)
  "fgos_confidence_label": "High"
}
```

---

#### 2. Layer-Level Confidence (Por Dimensión)

Agregación de confianza a nivel de dimensión:

**FGOS Confidence:**
- Historia financiera (30%)
- Madurez desde IPO (30%)
- Volatilidad earnings (20%)
- Completitud métricas (20%)

**IFS Confidence:**
- Disponibilidad ventanas (40%)
- Consistencia señales (40%)
- Universo sectorial (20%)

---

#### 3. Verdict-Level Confidence (Integrador)

Confianza del Fintra Verdict basada en:
- Confianza de scores individuales
- Coherencia entre dimensiones
- Ausencia de tensiones mayores

**Lógica:**
```typescript
const verdictConfidence = 
  min(fgos_confidence, competitive_advantage_confidence) * 0.50 +
  avg(ifs_confidence, sentiment_confidence, dividend_confidence) * 0.50;
```

---

### Labels de Confianza

**Rangos universales:**
- **High:** ≥75-80% (verde)
- **Medium:** 50-74% (amarillo)
- **Low:** <50% (rojo)

**Interpretación:**
- **High:** Datos completos, benchmarks robustos, historia suficiente → Conclusiones confiables
- **Medium:** Algunos gaps de datos, benchmarks aceptables → Conclusiones preliminares
- **Low:** Datos limitados, benchmarks débiles → Requiere análisis cualitativo adicional

---

### Ejemplo Integrado de Confianza

**Empresa:** Meta Platforms (META)

**Scores y Confidence:**
```json
{
  "fgos": { "score": 82, "confidence": 78 },  // Medium (historia 8 años, IPO 2012)
  "ifs": { "confidence": 88 },                // High (7/7 ventanas, sector Tech 200+)
  "competitive_advantage": { "confidence": 72 }, // Medium (6 años datos)
  "sentiment": { "confidence": 85 },          // High (historia completa)
  "dividend_quality": null,                   // N/A (no paga dividendos)
  "verdict_confidence": 79                    // Medium
}
```

**Interpretación del Verdict:**
- **Confidence 79% (Medium):** Análisis robusto pero empresa relativamente joven (IPO 2012)
- **Limitante principal:** Historia financiera <10 años afecta confidence de FGOS y Competitive Advantage
- **Fortalezas de confianza:** IFS y Sentiment con datos completos

---

## Principios de Arquitectura

### 1. Fintra NUNCA Inventa Datos

```typescript
// ✅ CORRECTO
if (!sector) {
  return { fgos_status: 'pending', reason: 'Sector missing' };
}

// ❌ INCORRECTO
if (!sector) {
  sector = 'Technology'; // NUNCA inferir
  throw new Error('Sector required'); // NUNCA abortar
}
```

**Rationale:** La ausencia de datos es información valiosa que debe reportarse transparentemente.

---

### 2. Pending NO es Error

```typescript
// ✅ CORRECTO
{
  fgos_status: 'pending',
  fgos_score: null,
  reason: 'Insufficient metrics'
}

// ❌ INCORRECTO
throw new Error('Cannot calculate FGOS without ROIC'); // NUNCA abortar cron
```

**Rationale:** Missing data es **esperado** en mercados reales. El pipeline debe ser fault-tolerant.

---

### 3. Sector Awareness (Benchmarking)

**CRÍTICO:** Todos los scores basados en percentiles **REQUIEREN** comparación sectorial.

```typescript
// ✅ CORRECTO
const benchmark = await getSectorBenchmark(sector, 'roic');
if (!benchmark) {
  return { status: 'pending', reason: 'Benchmark unavailable' };
}

// ❌ INCORRECTO
const benchmark = getDefaultBenchmark(); // NUNCA usar defaults universales
```

**Rationale:** Una métrica solo tiene sentido en contexto sectorial (e.g., P/E 30 es caro en Utilities, barato en Software).

---

### 4. Temporal Consistency (No Look-Ahead Bias)

```typescript
// ✅ CORRECTO
const benchmark = await getBenchmark(sector, asOfDate); // Point-in-time
const metrics = await getMetrics(ticker, asOfDate);     // Solo datos pasados

// ❌ INCORRECTO
const benchmark = await getLatestBenchmark(sector); // Usa datos futuros!
```

**Rationale:** Cálculos históricos NO pueden usar información del futuro.

---

### 5. TTM Construction (Trailing Twelve Months)

**Regla CRÍTICA:** TTM = suma de ÚLTIMOS 4 quarters. NUNCA promediar, NUNCA aproximar.

```typescript
// ✅ CORRECTO
const last4Q = getLastNQuarters(ticker, 4);
if (last4Q.length < 4) return null; // NO aproximar

const ttmRevenue = last4Q.reduce((sum, q) => sum + q.revenue, 0);

// ❌ INCORRECTO
const ttmRevenue = quarters.reduce((s, q) => s + q.revenue, 0) / 4; // NUNCA promediar
```

---

### 6. Null Propagation

**Regla:** `null` en inputs → `null` en output. NUNCA usar defaults (0, mean, etc.).

```typescript
// ✅ CORRECTO
if (roic === null || operatingMargin === null) {
  return { score: null, status: 'pending' };
}

// ❌ INCORRECTO
const roic = data.roic ?? 0.10; // NUNCA asumir default
```

---

### 7. Fault Tolerance en Cron Jobs

```typescript
// ✅ CORRECTO
for (const ticker of tickers) {
  try {
    await processSnapshot(ticker);
    console.log(`[${ticker}] SNAPSHOT OK`);
  } catch (error) {
    console.error(`[${ticker}] SNAPSHOT FAILED:`, error);
    // Continue con siguiente ticker
  }
}

// ❌ INCORRECTO
for (const ticker of tickers) {
  await processSnapshot(ticker); // Aborta en primer error
}
```

**Rationale:** Un ticker con error NO debe detener el procesamiento de 7,000+ empresas.

---

### 8. Dual Head Architecture (Web + Desktop)

**Regla:** Desktop client (C# .NET) **SOLO LEE** `fintra_snapshots`. Cron jobs calculan una vez.

```csharp
// ✅ CORRECTO (Desktop)
var snapshot = await supabase
  .From<FintraSnapshot>("fintra_snapshots")
  .Where(x => x.Ticker == ticker)
  .Single();

// ❌ INCORRECTO (Desktop)
var fgos = CalculateFGOS(metrics); // NUNCA recalcular en cliente
```

**Rationale:** Single source of truth. Web y Desktop siempre muestran **mismos números**.

---

## Resumen Comparativo de Scores

| Score | Propósito | Input Principal | Output | Benchmark |
|-------|-----------|-----------------|--------|-----------|
| **FGOS** | Calidad del negocio | Fundamentales (ROIC, márgenes, crecimiento) | 0-100, High/Medium/Low | Sector |
| **IFS** | Posición de mercado | Retornos relativos (precio + dividendos) | Leader/Follower/Laggard + Pressure | Sector |
| **IQS** | Posición estructural | Fundamentales (ROIC, márgenes) | Leader/Follower/Laggard per FY | Industry |
| **Competitive Advantage** | Durabilidad de ventaja | Historia ROIC + márgenes + capital | 0-100, Weak/Defendable/Strong | N/A (absoluto) |
| **Moat** | Persistencia de ventaja (simplificado) | Historia ROIC + márgenes | 0-100 | N/A (absoluto) |
| **Sentiment** | Percepción de mercado | Timeline de múltiplos de valuación | 0-100, Pessimistic/Neutral/Optimistic | Historia propia |
| **Valuation** | Precio vs sector | Múltiplos actuales (P/E, EV/EBITDA, P/FCF) | Percentil 0-100, Cheap/Fair/Expensive | Sector |
| **Dividend Quality** | Sostenibilidad dividendos | Historia DPS + payout ratios | 0-100, Weak/Acceptable/High | N/A (absoluto) |
| **Relative Return** | Performance total | Retornos totales (precio + dividendos) | 0-100, Underperformer/Neutral/Outperformer | Sector |
| **Fintra Verdict** | Síntesis multidimensional | Todos los scores | Exceptional/Strong/Balanced/Fragile/Speculative | N/A (integrador) |

---

## Glosario de Términos

| Término | Definición |
|---------|------------|
| **TTM** | Trailing Twelve Months - Suma de últimos 4 quarters |
| **ROIC** | Return on Invested Capital - Retorno sobre capital invertido |
| **FY** | Fiscal Year - Año fiscal |
| **DPS** | Dividend Per Share - Dividendo por acción |
| **FCF** | Free Cash Flow - Flujo de caja libre |
| **Percentile** | Posición relativa en distribución (0-100) |
| **Benchmark** | Estadísticas sectoriales (p10, p25, p50, p75, p90) |
| **Pending** | Estado cuando faltan datos para calcular |
| **Alpha** | Retorno diferencial vs benchmark (en pp) |
| **Drawdown** | Pérdida máxima desde pico (en %) |
| **Block Voting** | Método IFS que agrupa ventanas temporales |
| **Coherence Check** | Validación si crecimiento preserva márgenes |

---

## Referencias

- Codebase: `/lib/engine/`
- Pipeline: `/scripts/pipeline/`
- Documentación Engines: `/documentacion-tecnica/04-ENGINES/`
- Valoración Proyecto: `/documentacion-tecnica/VALOR_DESARROLLO_FINTRA.md`

---

**Fin del Documento**

Última revisión: 7 de febrero de 2026  
Autor: Documentación Técnica Fintra  
Versión: 1.0

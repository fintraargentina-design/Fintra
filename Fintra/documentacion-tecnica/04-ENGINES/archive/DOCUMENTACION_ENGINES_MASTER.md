# Fintra Engines - Documentación Técnica Completa

**Fecha de actualización:** 6 de febrero de 2026  
**Sistema:** Fintra v2.0  
**Autor:** Sistema de auditoría técnica

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [FGOS - Fintra Growth & Operations Score](#fgos)
3. [IFS Live - Industry Fit Score](#ifs-live)
4. [IQS - Industry Quality Score](#iqs)
5. [Valuation - Valoración Relativa](#valuation)
6. [Moat - Foso Competitivo](#moat)
7. [Competitive Advantage - Ventaja Competitiva](#competitive-advantage)
8. [Quality Brakes - Frenos de Calidad](#quality-brakes)
9. [Fundamentals Maturity - Madurez de Datos](#fundamentals-maturity)
10. [Pipeline de Cálculo](#pipeline-de-cálculo)
11. [Interacciones entre Engines](#interacciones)

---

## 📊 Visión General

### Arquitectura de Engines

Fintra implementa **8 engines complementarios** que analizan diferentes dimensiones de las empresas:

| Engine                    | Tipo     | Frecuencia | Comparación             | Output                                        |
| ------------------------- | -------- | ---------- | ----------------------- | --------------------------------------------- |
| **FGOS**                  | Absoluto | Diaria     | Benchmarks objetivos    | Score 0-100                                   |
| **IFS Live**              | Relativo | Diaria     | Sector (momentum)       | Position (leader/follower/laggard)            |
| **IQS**                   | Relativo | Anual (FY) | Industria (estructural) | Position + Percentiles                        |
| **Valuation**             | Relativo | Diaria     | Sector                  | Verdict (Very Cheap → Very Expensive)         |
| **Moat**                  | Absoluto | Anual (FY) | N/A                     | Score 0-100 + Coherence                       |
| **Competitive Advantage** | Absoluto | Anual (FY) | N/A                     | Score 0-100 + Band (weak/defendable/strong)   |
| **Quality Brakes**        | Absoluto | Diaria     | Thresholds fijos        | Boolean + Reasons                             |
| **Fundamentals Maturity** | Absoluto | Diaria     | N/A                     | Classification (early/developing/established) |

### Principios de Diseño

#### 1. **Fintra No Inventa Datos**

```typescript
// ✅ CORRECTO - Manejar datos faltantes
if (!sector) {
  return { fgos_status: "pending", reason: "Sector missing" };
}

// ❌ PROHIBIDO - Inferir o inventar
if (!sector) {
  sector = "Technology"; // ❌ NUNCA inferir
}
```

#### 2. **Pending No Es Error**

```typescript
// ✅ CORRECTO - Estado pending es válido
{
  fgos_status: 'pending',
  fgos_score: null,
  reason: 'Insufficient metrics'
}

// ❌ PROHIBIDO - Abortar por datos faltantes
throw new Error('Cannot calculate without ROIC');
```

#### 3. **Separación Temporal**

- **Estados de Mercado (diarios):** FGOS, IFS Live, Valuation, Quality Brakes
- **Estados Estructurales (anuales):** IQS, Moat, Competitive Advantage
- **NUNCA mezclar contextos temporales**

---

## 1️⃣ FGOS - Fintra Growth & Operations Score {#fgos}

### Definición

**FGOS** es un score absoluto (0-100) que evalúa la calidad operativa y financiera de una empresa usando benchmarks objetivos.

### Arquitectura

**Ubicación:** `lib/engine/fgos-recompute.ts`

```typescript
interface FgosResult {
  fgos_score: number | null; // 0-100
  fgos_category: "High" | "Medium" | "Low" | "Pending";
  fgos_confidence_percent: number; // 0-100
  fgos_confidence_label: "High" | "Medium" | "Low";
  fgos_status:
    | "computed"
    | "pending"
    | "Mature"
    | "Developing"
    | "Early-stage"
    | "Incomplete";
  fgos_components: FgosBreakdown;
}
```

### Componentes (4 Pilares)

#### 1. Growth (25%)

**Métricas:**

- Revenue CAGR (3Y, 5Y)
- Earnings CAGR (3Y, 5Y)
- FCF CAGR (3Y, 5Y)

**Cálculo:**

```typescript
const growthItems = [
  { value: growth.revenue_cagr, benchmark: benchmarks.revenue_growth },
  { value: growth.earnings_cagr, benchmark: benchmarks.earnings_growth },
  { value: growth.fcf_cagr, benchmark: benchmarks.fcf_growth },
];

const growthScore = calculateComponent(growthItems);
```

**Benchmark:** Comparación percentil vs sector (p10, p25, p50, p75, p90)

#### 2. Profitability (25%)

**Métricas:**

- Operating Margin
- Net Margin
- ROE (Return on Equity)
- ROIC (Return on Invested Capital)

**Interpretación:**

- **80-100:** Rentabilidad excepcional (top 20% del sector)
- **60-79:** Rentabilidad sólida (above average)
- **40-59:** Rentabilidad media (sector promedio)
- **0-39:** Rentabilidad débil (below average)

#### 3. Efficiency (25%)

**Métricas:**

- Asset Turnover
- Inventory Turnover (si aplica)
- Receivables Turnover
- Days Sales Outstanding (DSO)

**Sectores especiales:**

- **Financiero:** No aplica asset turnover (usar otros ratios)
- **Retail:** Mayor peso a inventory turnover
- **SaaS:** Foco en capital efficiency (Rule of 40)

#### 4. Solvency (25%)

**Métricas:**

- Debt to Equity
- Current Ratio
- Quick Ratio
- Interest Coverage

**Thresholds críticos:**

- Debt/Equity > 2.0 → Penalización (apalancamiento alto)
- Current Ratio < 1.0 → Alerta de liquidez
- Interest Coverage < 2.0 → Riesgo de solvencia

### Confianza (Confidence)

**Cálculo multidimensional:**

```typescript
interface ConfidenceInputs {
  years_of_data: number; // 0-10 años
  missing_core_metrics: number; // 0-12 métricas core
  sector_benchmark_quality: "low" | "medium" | "high";
  profile_completeness: number; // 0-100%
}

// Ponderación
const confidence =
  yearsScore * 0.3 + // 30% - Historia disponible
  metricsScore * 0.3 + // 30% - Cobertura de métricas
  benchmarkScore * 0.25 + // 25% - Calidad de benchmarks
  profileScore * 0.15; // 15% - Completitud de perfil
```

**Interpretación:**

- **80-100:** High Confidence → Usar FGOS para decisiones
- **60-79:** Medium Confidence → Complementar con análisis manual
- **0-59:** Low Confidence → NO usar FGOS como input primario

### Status (Estado del Cálculo)

```typescript
type FgosStatus =
  | "computed" // ✅ Calculado correctamente
  | "pending" // ⏳ Datos insuficientes / Sector missing
  | "Mature" // 📊 5+ años de datos fundamentales
  | "Developing" // 📈 3-4 años de datos fundamentales
  | "Early-stage" // 🌱 1-2 años de datos fundamentales
  | "Incomplete"; // ❌ < 1 año de datos
```

### Low Confidence Impact

Cuando benchmark tiene `sample_size < 20`, se aplica **penalización automática**:

```typescript
interface LowConfidenceImpact {
  raw_percentile: number; // Percentil original
  effective_percentile: number; // Percentil ajustado (penalizado)
  sample_size: number; // Tamaño del universo
  weight: number; // Factor de ajuste (0-1)
  benchmark_low_confidence: true; // Flag de alerta
}
```

**Penalización:**

```
effective_percentile = raw_percentile * weight
weight = sample_size / 20  // Si sample_size = 10 → weight = 0.5
```

**Ejemplo:**

```json
{
  "fgos_score": 68,
  "fgos_components": {
    "growth": 75,
    "growth_impact": {
      "raw_percentile": 82,
      "effective_percentile": 75,
      "sample_size": 15,
      "weight": 0.75,
      "benchmark_low_confidence": true
    }
  }
}
```

### Integración con Otros Engines

**FGOS + Quality Brakes:**

```typescript
if (qualityBrakes.applied) {
  fgos_components.quality_brakes = qualityBrakes;
  // UI debe mostrar alerta: "FGOS de 85, pero Quality Brakes activados"
}
```

**FGOS + Moat:**

```typescript
fgos_components.moat = moatScore; // 0-100
// Si FGOS alto + Moat bajo → "Buen momento actual, sostenibilidad cuestionable"
```

**FGOS + Competitive Advantage:**

```typescript
fgos_components.competitive_advantage = {
  score: 78,
  band: "defendable",
  confidence: 85,
};
```

### Reglas de Negocio

#### Regla 1: Sector Obligatorio

```typescript
if (!sector) {
  return { fgos_status: "pending", reason: "Sector missing" };
}
```

#### Regla 2: Mínimo de Métricas

```typescript
const REQUIRED_METRICS = [
  "roic",
  "operating_margin",
  "net_margin",
  "debt_to_equity",
];
const available = REQUIRED_METRICS.filter((m) => snapshot[m] !== null);

if (available.length < 2) {
  return { fgos_status: "pending", reason: "Insufficient core metrics" };
}
```

#### Regla 3: Benchmarks Requeridos

```typescript
if (!benchmarks || Object.keys(benchmarks).length === 0) {
  return { fgos_status: "pending", reason: "Benchmarks not available" };
}
```

### Testing

**Ubicación:** `lib/engine/fintra-brain.test.ts`, `lib/engine/fgos-state.ts`

**Casos de prueba críticos:**

```typescript
describe('FGOS Computation', () => {
  it('returns pending when sector is null', () => {
    const result = computeFGOS({ sector: null, ... });
    expect(result.fgos_status).toBe('pending');
    expect(result.fgos_score).toBeNull();
  });

  it('handles low confidence benchmarks correctly', () => {
    const result = computeFGOS({ ..., benchmarks: lowConfBenchmarks });
    expect(result.fgos_components.growth_impact).toBeDefined();
    expect(result.fgos_components.growth_impact.benchmark_low_confidence).toBe(true);
  });

  it('propagates null for missing metrics', () => {
    const result = computeFGOS({ roic: null, ... });
    expect(result.fgos_components.efficiency).toBeNull();
  });
});
```

---

## 2️⃣ IFS Live - Industry Fit Score {#ifs-live}

### Definición

**IFS Live** evalúa la **posición competitiva relativa** de una empresa vs su sector basándose en **momentum de mercado** (precio relativo).

**Pregunta que responde:** _"¿Quién está ganando en su sector en este momento?"_

### Arquitectura

**Ubicación:** `lib/engine/ifs.ts`

```typescript
interface IFSResult {
  position: "leader" | "follower" | "laggard";
  pressure: number; // 0-3 (bloques de soporte)
  confidence: number; // 0-100
  confidence_label: "High" | "Medium" | "Low";
  interpretation?: string;
}

interface RelativePerformanceInputs {
  relative_vs_sector_1m: number | null;
  relative_vs_sector_3m: number | null;
  relative_vs_sector_6m: number | null;
  relative_vs_sector_1y: number | null;
  relative_vs_sector_2y: number | null;
  relative_vs_sector_3y: number | null;
  relative_vs_sector_5y: number | null;
}
```

### IFS v1.2: Industry-Aware Structural Voting

#### Estructura de Bloques

```typescript
// Bloques temporales
const blocks = {
  short: ["1M", "3M"], // Corto plazo
  mid: ["6M", "1Y", "2Y"], // Mediano plazo
  long: ["3Y", "5Y"], // Largo plazo
};
```

#### Industry Awareness (NUEVO)

**Metadatos de industria:**

```typescript
interface IndustryMetadata {
  dominant_horizons: string[]; // Horizontes relevantes para esta industria
}

// Ejemplo: Industria "Software"
{
  dominant_horizons: ["1M", "3M", "6M", "1Y"]; // Solo corto/medio plazo
  // Ignora 2Y, 3Y, 5Y (no relevantes para SaaS)
}

// Ejemplo: Industria "Utilities"
{
  dominant_horizons: ["1Y", "2Y", "3Y", "5Y"]; // Solo largo plazo
  // Ignora 1M, 3M, 6M (volatilidad no relevante)
}
```

**Impacto en cálculo:**

- Si `dominantHorizons` presente → **SOLO** ventanas en la lista participan
- Ventanas fuera de la lista se ignoran (aunque tengan datos)
- **Beneficio:** Elimina ruido de horizontes no relevantes para la industria

#### Votación por Bloques

**Algoritmo:**

```typescript
for (const block of ["short", "mid", "long"]) {
  const windows = getWindowsInBlock(block);

  // Filtrar por dominantHorizons (si aplica)
  const participating = windows.filter(
    (w) => !dominantHorizons || dominantHorizons.includes(w.code),
  );

  // Contar señales
  let positive = 0;
  let negative = 0;

  for (const window of participating) {
    if (window.value > 0) positive++;
    if (window.value < 0) negative++;
  }

  // Determinar voto del bloque
  let blockVote = 0;
  if (positive > negative) blockVote = +1;
  else if (negative > positive) blockVote = -1;
  else blockVote = 0; // Empate

  votes.push(blockVote);
}
```

**Posición final:**

```typescript
const positiveBlocks = votes.filter((v) => v === +1).length;
const negativeBlocks = votes.filter((v) => v === -1).length;

if (positiveBlocks > negativeBlocks) position = "leader";
else if (negativeBlocks > positiveBlocks) position = "laggard";
else position = "follower"; // Empate
```

#### Pressure (Intensidad)

**Definición:** Número de bloques que **soportan** la posición final.

```typescript
// Caso 1: Leader con 3/3 bloques positivos
{ position: 'leader', pressure: 3 }  // 🟢 Alta convicción

// Caso 2: Leader con 2/3 bloques positivos (1 negativo)
{ position: 'leader', pressure: 2 }  // 🟡 Convicción media

// Caso 3: Follower (empate 1/1/1)
{ position: 'follower', pressure: 1 }  // ⚪ Sin momentum claro
```

**Interpretación:**

- **Pressure = 3:** Unanimidad (todos los bloques de acuerdo)
- **Pressure = 2:** Mayoría (victoria clara pero no unánime)
- **Pressure = 1:** Señal débil (empate o victoria ajustada)
- **Pressure = 0:** Clasificación inválida (sin datos suficientes)

#### Confidence

**Factores:**

```typescript
interface IFSConfidenceInputs {
  availableWindows: number; // Ventanas con datos (de 7 posibles)
  signalConsistency: number; // Unanimidad de señales (0-1)
  sectorUniverseSize: number; // Tamaño del universo sectorial
}

// Ponderación
const confidence =
  availabilityScore * 0.4 + // 40% - Cobertura de datos
  consistencyScore * 0.4 + // 40% - Coherencia de señales
  universeScore * 0.2; // 20% - Tamaño del universo
```

**Umbral de validez:**

```typescript
// v1.2: Requiere mínimo 2 bloques válidos
if (validBlocksCount < 2) {
  return null; // Insuficientes datos para clasificar
}
```

### Diferencias vs IQS

| Aspecto         | IFS Live            | IQS                    |
| --------------- | ------------------- | ---------------------- |
| **Naturaleza**  | Momentum de mercado | Fundamentales fiscales |
| **Frecuencia**  | Diaria              | Anual (FY)             |
| **Comparación** | Sector              | Industria              |
| **Fuente**      | Precios de mercado  | Estados financieros    |
| **Horizonte**   | Corto-mediano plazo | Largo plazo            |
| **Volatilidad** | Alta                | Baja                   |

**IMPORTANTE:** IFS Live y IQS **NO convergen**. Son métricas paralelas e independientes.

### IFS Memory (Modelo de Memoria)

**Ubicación en snapshot:** `fintra_snapshots.ifs_memory`

```typescript
interface IFSMemory {
  window_years: number; // Ventana máxima (5 años)
  observed_years: number; // Años realmente observados (1-5)
  distribution: {
    leader: number; // Snapshots como leader
    follower: number; // Snapshots como follower
    laggard: number; // Snapshots como laggard
  };
  dominant_position: "leader" | "follower" | "laggard";
  consistency: number; // 0-100 (uniformidad histórica)
}
```

**Cálculo:**

```typescript
// Retroactivo 5 años (1,825 días)
const memoryWindow = 5 * 365;
const snapshots = await getHistoricalSnapshots(ticker, memoryWindow);

const distribution = {
  leader: snapshots.filter((s) => s.ifs.position === "leader").length,
  follower: snapshots.filter((s) => s.ifs.position === "follower").length,
  laggard: snapshots.filter((s) => s.ifs.position === "laggard").length,
};

const total =
  distribution.leader + distribution.follower + distribution.laggard;
const dominant = Object.entries(distribution).sort((a, b) => b[1] - a[1])[0][0];

const consistency = (distribution[dominant] / total) * 100;
```

**Interpretación:**

```json
{
  "window_years": 5,
  "observed_years": 4,
  "distribution": { "leader": 180, "follower": 520, "laggard": 100 },
  "dominant_position": "follower",
  "consistency": 65
}
```

→ _"En 4 años de historia, ha sido follower el 65% del tiempo (520/800 días)"_

---

## 3️⃣ IQS - Industry Quality Score {#iqs}

### Definición

**IQS** evalúa la **posición competitiva estructural** usando datos fiscales (FY) vs industria, **NO sector**.

**Pregunta que responde:** _"¿Qué tan sólida es esta empresa estructuralmente comparada con sus competidores directos?"_

### Arquitectura

**Ubicación:** `lib/engine/ifs-fy.ts`

```typescript
interface IQSResult {
  position: "leader" | "follower" | "laggard";
  percentile: number; // 0-100
  confidence: number; // 0-100
  fiscal_positions: IQSFiscalYearPosition[];
  metrics_breakdown?: {
    roic_percentile: number;
    margin_percentile: number;
    growth_percentile: number;
    leverage_percentile: number;
  };
}

interface IQSFiscalYearPosition {
  fiscal_year: string; // '2023'
  position: "leader" | "follower" | "laggard";
  percentile: number; // Percentil compuesto
}
```

### Principios Arquitectónicos

#### Principio 1: Separación Temporal

```
IFS Live:  [Snapshot Diario] → [Snapshot Diario] → ...
           (Momentum corto plazo)

IQS:       [FY 2021] ───────────────► [FY 2022] ───────────────► [FY 2023]
           (Estructural largo plazo)
```

**IFS Live NO se convierte en IQS con el tiempo.** Son sistemas paralelos, no evolutivos.

#### Principio 2: Explicitación Fiscal

**CADA posición mapeada a un fiscal year real:**

```typescript
// ✅ CORRECTO - Mapeo explícito
{
  fiscal_positions: [
    { fiscal_year: "2021", position: "follower", percentile: 68 },
    { fiscal_year: "2022", position: "leader", percentile: 82 },
    { fiscal_year: "2023", position: "leader", percentile: 85 },
  ];
}

// ❌ PROHIBIDO - Inferir años intermedios
// ❌ PROHIBIDO - Asumir continuidad
// ❌ PROHIBIDO - Calcular "trends" sintéticos
```

#### Principio 3: Percentiles vs Absolutos

**IQS usa ranking relativo dentro de industria:**

```typescript
// ✅ CORRECTO - Percentil relativo
roic_percentile = calculatePercentile(company.roic, industry.roic_distribution);
// Resultado: 82 → "Top 18% de ROIC en su industria"

// ❌ PROHIBIDO - Normalización absoluta
roic_score = normalize(company.roic, { min: -10, max: 40, optimal: 25 });
```

### Algoritmo de Cálculo

#### Paso 1: Validación de Datos

```typescript
async function getFiscalYearData(ticker: string): Promise<FiscalYearData[]> {
  const data = await supabaseAdmin
    .from("datos_financieros")
    .select("*")
    .eq("ticker", ticker)
    .eq("period_type", "FY")
    .order("period_end_date", { ascending: false })
    .limit(5);

  // STRICT: Requiere ROIC y Operating Margin obligatorios
  const valid = data.filter(
    (row) => row.roic !== null && row.operating_margin !== null,
  );

  // STRICT: No inferir años faltantes
  return valid; // Retornar SOLO años con datos completos
}
```

**Reglas de validación:**

1. **Obligatorios:** ROIC, Operating Margin
2. **Opcionales:** Net Margin, Revenue CAGR, FCF Margin, Debt/Equity
3. **Máximo:** 5 fiscal years (cap)
4. **Continuidad:** NO requerida (gaps permitidos)

#### Paso 2: Obtener Benchmarks de Industria

```typescript
async function getIndustryFYMetrics(
  industry: string,
  fiscalYear: string
): Promise<IndustryBenchmark> {
  // IMPORTANTE: Usar industria, NO sector
  const peers = await getPeersByIndustry(industry);

  const roic_values = peers.map(p => p.roic).filter(v => v !== null);
  const margin_values = peers.map(p => p.operating_margin).filter(v => v !== null);

  // Requisito: Mínimo 3 peers para benchmarking válido
  if (roic_values.length < 3) {
    return null;  // Insuficiente tamaño de peer group
  }

  return { roic_values, margin_values, ... };
}
```

#### Paso 3: Calcular Percentiles

```typescript
function calculatePercentile(
  value: number,
  distribution: number[],
): number | null {
  if (distribution.length < 3) return null;

  const sorted = [...distribution].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v <= value).length;

  return (rank / sorted.length) * 100;
}

// Ejemplo
roic_percentile = calculatePercentile(
  0.18,
  [0.05, 0.08, 0.12, 0.15, 0.22, 0.28],
);
// value = 0.18 → Supera 4 de 6 valores → 4/6 = 66.7 percentil
```

#### Paso 4: Clasificar Posición

```typescript
function classifyPosition(percentile: number): IQSPosition {
  if (percentile >= 75) return "leader"; // Top cuartil
  if (percentile >= 35) return "follower"; // Medio
  return "laggard"; // Bottom
}
```

**Umbrales:**

- **Leader:** Percentil ≥ 75 (top 25%)
- **Follower:** Percentil 35-74 (medio 40%)
- **Laggard:** Percentil < 35 (bottom 35%)

#### Paso 5: Calcular Confidence

```typescript
function calculateConfidence(fyCount: number): number {
  // Más años fiscales = mayor confianza
  // 1 FY = 20%, 2 FY = 40%, 3 FY = 60%, 4 FY = 80%, 5 FY = 100%
  return Math.min(100, fyCount * 20);
}
```

**Rationale:** Confianza basada SOLO en completitud de datos, NO en tendencias.

### Comparación con IFS Live

| Dimensión       | IFS Live                    | IQS                    |
| --------------- | --------------------------- | ---------------------- |
| **Fuente**      | Precios de mercado          | Estados financieros    |
| **Frecuencia**  | Diaria                      | Anual (FY)             |
| **Volatilidad** | Alta (reacciona a noticias) | Baja (fundamentales)   |
| **Comparación** | Sector (amplio)             | Industria (específico) |
| **Horizonte**   | 1M - 5Y (7 ventanas)        | 1-5 años fiscales      |
| **Output**      | Position + Pressure         | Position + Percentile  |
| **Uso**         | Timing, momentum            | Análisis estructural   |

**Ejemplo de divergencia:**

```json
{
  "ifs_live": {
    "position": "laggard",
    "pressure": 2,
    "reason": "Caída de precio reciente (momentum negativo)"
  },
  "iqs": {
    "position": "leader",
    "percentile": 82,
    "reason": "ROIC excepcional vs competidores (fundamentales sólidos)"
  }
}
```

→ _"Precio bajo pero fundamentales fuertes = Oportunidad de compra"_

### Reglas de Producción

#### Regla 1: No Invent Data

```typescript
// ✅ CORRECTO
if (row.roic === null) {
  continue; // Saltar este FY, NO aproximar
}

// ❌ PROHIBIDO
if (row.roic === null) {
  row.roic = avgROIC; // ❌ NUNCA inferir
}
```

#### Regla 2: Explicit Fiscal Years

```typescript
// ✅ CORRECTO - Años explícitos
fiscal_positions: [
  { fiscal_year: '2021', ... },
  { fiscal_year: '2023', ... }  // Gap en 2022 es OK
]

// ❌ PROHIBIDO - Interpolar 2022
```

#### Regla 3: Industry Not Sector

```typescript
// ✅ CORRECTO
const peers = await getPeersByIndustry("Cloud Computing");

// ❌ PROHIBIDO
const peers = await getPeersBySector("Technology"); // Demasiado amplio
```

---

## 4️⃣ Valuation - Valoración Relativa {#valuation}

### Definición

**Valuation** evalúa si una empresa está **cara o barata** vs su sector usando múltiplos de valoración.

**Pregunta que responde:** _"¿El precio actual es atractivo comparado con el sector?"_

### Arquitectura

**Ubicación:** `lib/engine/resolveValuationFromSector.ts`

```typescript
interface ValuationState {
  stage: "pending" | "partial" | "computed";
  metrics: ValuationMetrics;
  percentiles: {
    pe_ratio?: number; // 0-100
    ev_ebitda?: number; // 0-100
    price_to_fcf?: number; // 0-100
  };
  composite_percentile: number | null; // Promedio ponderado
  coverage: number; // % de métricas disponibles
  confidence: number; // 0-100
  verdict: ValuationVerdict;
}

interface ValuationMetrics {
  pe_ratio: number | null;
  ev_ebitda: number | null;
  price_to_fcf: number | null;
}

type ValuationVerdict =
  | "Very Cheap" // < 25 percentil
  | "Cheap" // 25-40 percentil
  | "Fair" // 40-60 percentil
  | "Expensive" // 60-75 percentil
  | "Very Expensive"; // > 75 percentil
```

### Métricas de Valoración

#### 1. P/E Ratio (Price to Earnings)

**Fórmula:**

```
P/E = Market Cap / Net Income (TTM)
```

**Interpretación:**

- **P/E < 10:** Muy barato (value stock)
- **P/E 10-20:** Razonable (mercado promedio)
- **P/E 20-30:** Caro (growth premium)
- **P/E > 30:** Muy caro (high growth expectations)

**Casos especiales:**

```typescript
// ❌ PROHIBIDO usar si Net Income ≤ 0
if (netIncome <= 0) {
  pe_ratio = null; // NO calcular (sin sentido)
}
```

#### 2. EV/EBITDA (Enterprise Value to EBITDA)

**Fórmula:**

```
EV/EBITDA = (Market Cap + Debt - Cash) / EBITDA (TTM)
```

**Ventajas:**

- No afectado por estructura de capital
- Ignora diferencias en depreciación/amortización
- Útil para comparar empresas con diferentes apalancamientos

**Interpretación:**

- **EV/EBITDA < 8:** Barato
- **EV/EBITDA 8-12:** Fair value
- **EV/EBITDA > 12:** Caro

#### 3. Price to FCF (Price to Free Cash Flow)

**Fórmula:**

```
P/FCF = Market Cap / Free Cash Flow (TTM)
```

**Ventaja clave:** Mide capacidad de generar cash real (no earnings contables).

**Interpretación:**

- **P/FCF < 15:** Barato
- **P/FCF 15-25:** Fair value
- **P/FCF > 25:** Caro

### Algoritmo de Cálculo

#### Paso 1: Validación de Métricas

```typescript
function validate(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (!Number.isFinite(val)) return null;
  if (val <= 0) return null; // ✅ STRICT: Descartar negativos/cero
  return val;
}

const pe = validate(input.pe_ratio);
const ev = validate(input.ev_ebitda);
const pfcf = validate(input.price_to_fcf);
```

**Regla crítica:** Valores ≤ 0 son inválidos (no informativos).

#### Paso 2: Normalización por Sector

```typescript
function resolvePercentile(
  value: number,
  benchmark: SectorBenchmarkMetric,
): number | null {
  // Interpolación lineal entre percentiles (p10, p25, p50, p75, p90)
  const points = [
    { p: 10, v: benchmark.p10 },
    { p: 25, v: benchmark.p25 },
    { p: 50, v: benchmark.p50 },
    { p: 75, v: benchmark.p75 },
    { p: 90, v: benchmark.p90 },
  ].filter((pt) => Number.isFinite(pt.v));

  if (points.length < 2) return null;

  // Sort by value
  const sorted = points.slice().sort((a, b) => a.v - b.v);

  // Interpolate percentile
  if (value <= sorted[0].v) {
    return interpolate(sorted[0], sorted[1], value);
  } else if (value >= sorted[sorted.length - 1].v) {
    return interpolate(
      sorted[sorted.length - 2],
      sorted[sorted.length - 1],
      value,
    );
  } else {
    // Find bracket
    for (let i = 0; i < sorted.length - 1; i++) {
      if (value >= sorted[i].v && value <= sorted[i + 1].v) {
        return interpolate(sorted[i], sorted[i + 1], value);
      }
    }
  }

  return null;
}

function interpolate(a, b, value) {
  if (a.v === b.v) return a.p;
  return a.p + ((value - a.v) * (b.p - a.p)) / (b.v - a.v);
}
```

**Ejemplo:**

```typescript
// Sector: Technology
// P/E benchmark: { p10: 8, p25: 15, p50: 25, p75: 35, p90: 50 }

// Empresa A: P/E = 20
percentile = resolvePercentile(20, benchmark);
// 20 está entre p25 (15) y p50 (25)
// Interpolación: 25 + ((20 - 15) / (25 - 15)) * (50 - 25) = 37.5 percentil

// Empresa B: P/E = 45
percentile = resolvePercentile(45, benchmark);
// 45 está entre p75 (35) y p90 (50)
// Interpolación: 75 + ((45 - 35) / (50 - 35)) * (90 - 75) = 85 percentil
```

#### Paso 3: Composite Percentile

```typescript
// Promedio simple de percentiles disponibles
const percentiles = [pe_percentile, ev_percentile, pfcf_percentile].filter(
  (p) => p !== null,
);

if (percentiles.length === 0) {
  composite_percentile = null;
  stage = "pending";
} else {
  composite_percentile =
    percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length;

  // Stage
  if (percentiles.length < 2) stage = "pending";
  else if (percentiles.length === 2) stage = "partial";
  else stage = "computed"; // 3 métricas
}
```

#### Paso 4: Verdict

```typescript
function classifyValuation(percentile: number): ValuationVerdict {
  if (percentile < 25) return "Very Cheap"; // Bottom quartile
  if (percentile < 40) return "Cheap"; // Below average
  if (percentile <= 60) return "Fair"; // Average
  if (percentile <= 75) return "Expensive"; // Above average
  return "Very Expensive"; // Top quartile
}
```

**Interpretación inversa:** Percentil ALTO = Empresa MÁS CARA que el sector.

```
Percentil 10 → "Solo 10% del sector es más barato que esta empresa" → Very Cheap ✅
Percentil 90 → "90% del sector es más barato que esta empresa" → Very Expensive ❌
```

### Confidence

```typescript
interface ValuationConfidence {
  coverage: number; // % de métricas disponibles (0-100)
  dispersion: number; // Rango entre percentiles (0-100)
  confidence_score: number; // Final (0-100)
  confidence_label: "Low" | "Medium" | "High";
}

function calculateValuationConfidence(
  percentiles: number[],
  valid_count: number,
): ValuationConfidence {
  // Factor 1: Coverage (33%)
  const coverage_percent = (valid_count / 3) * 100;

  // Factor 2: Dispersion (67%)
  let dispersion_range = 0;
  if (valid_count >= 2) {
    const min_p = Math.min(...percentiles);
    const max_p = Math.max(...percentiles);
    dispersion_range = max_p - min_p;
  }

  // Penalizar alta dispersión (señales contradictorias)
  const dispersion_score = Math.max(0, 100 - dispersion_range);

  // Weighted average
  const confidence_score = coverage_percent * 0.33 + dispersion_score * 0.67;

  // Label
  let confidence_label: "Low" | "Medium" | "High";
  if (confidence_score >= 75) confidence_label = "High";
  else if (confidence_score >= 50) confidence_label = "Medium";
  else confidence_label = "Low";

  return {
    coverage: coverage_percent,
    dispersion: dispersion_range,
    confidence_score: Math.round(confidence_score),
    confidence_label,
  };
}
```

**Ejemplo:**

```json
{
  "percentiles": {
    "pe_ratio": 35,
    "ev_ebitda": 82, // Dispersión alta (82 - 35 = 47)
    "price_to_fcf": 40
  },
  "composite_percentile": 52,
  "coverage": 100,
  "dispersion": 47,
  "confidence_score": 53, // Penalizado por dispersión
  "confidence_label": "Medium",
  "verdict": "Fair"
}
```

→ _"Fair value, pero confianza media debido a señales contradictorias (EV/EBITDA alto vs P/E bajo)"_

### Reglas de Negocio

#### Regla 1: Minimum 2 Metrics

```typescript
// ✅ CORRECTO
if (valid_count < 2) {
  stage = "pending";
  verdict = null;
}

// ❌ PROHIBIDO - Usar 1 sola métrica
if (valid_count >= 1) {
  verdict = classifyValuation(pe_percentile); // ❌ Insuficiente
}
```

#### Regla 2: Positive Values Only

```typescript
// ✅ CORRECTO
if (pe_ratio <= 0) {
  pe_ratio = null; // Descartar (empresa con pérdidas)
}

// ❌ PROHIBIDO - Usar negativos
if (pe_ratio < 0) {
  pe_ratio = Math.abs(pe_ratio); // ❌ Sin sentido económico
}
```

#### Regla 3: Sector Benchmarks Required

```typescript
// ✅ CORRECTO
const benchmark = sectorBenchmarks["pe_ratio"];
if (!benchmark || !benchmark.p50) {
  return null; // Sin benchmark = Sin comparación posible
}

// ❌ PROHIBIDO - Usar benchmarks genéricos
const genericBenchmark = { p50: 20 }; // ❌ No específico del sector
```

### Integración con Otros Engines

**Valuation + FGOS:**

```typescript
// Escenario: FGOS alto + Valuation "Very Cheap"
if (fgos_score > 80 && valuation.verdict === "Very Cheap") {
  // → "Empresa de alta calidad infravalorada" (Strong Buy signal)
}

// Escenario: FGOS bajo + Valuation "Very Expensive"
if (fgos_score < 40 && valuation.verdict === "Very Expensive") {
  // → "Empresa mediocre sobrevalorada" (Strong Sell signal)
}
```

**Valuation + IFS Live:**

```typescript
// Escenario: Valuation "Cheap" + IFS "laggard"
if (valuation.verdict === "Cheap" && ifs.position === "laggard") {
  // → "Barato por momentum negativo (value trap risk)"
}

// Escenario: Valuation "Expensive" + IFS "leader"
if (valuation.verdict === "Expensive" && ifs.position === "leader") {
  // → "Caro pero con momentum positivo (growth at premium)"
}
```

---

## 5️⃣ Moat - Foso Competitivo {#moat}

### Definición

**Moat** evalúa la **sostenibilidad** del crecimiento mediante el análisis de coherencia entre crecimiento de ingresos y evolución de márgenes.

**Pregunta que responde:** _"¿El crecimiento viene con pricing power o a costa de erosionar márgenes?"_

### Arquitectura

**Ubicación:** `lib/engine/moat.ts`

```typescript
interface MoatResult {
  score: number | null; // 0-100
  status: "computed" | "partial" | "pending";
  confidence: number | null; // 0-100
  coherenceCheck?: CoherenceCheckResult;
  details?: {
    roic_persistence: number; // Persistencia de ROIC
    margin_stability: number; // Estabilidad de márgenes
    capital_discipline: number; // Disciplina de capital
    years_analyzed: number; // Años de historia
  };
}

interface CoherenceCheckResult {
  score: number; // 0-100
  verdict: "High Quality Growth" | "Neutral" | "Inefficient Growth";
  explanation: string;
  metadata?: {
    revenueGrowth: number;
    marginChange: number;
  };
}
```

### Coherence Check (Verificación de Coherencia)

#### Algoritmo

```typescript
function calculateCoherenceCheck(input: {
  revenueGrowth: number; // % growth (e.g., 0.25 = 25%)
  operatingMarginChange: number; // Cambio en puntos porcentuales
}): CoherenceCheckResult {
  const { revenueGrowth, operatingMarginChange } = input;

  const REVENUE_GROWTH_THRESHOLD = 0.05; // 5%
  const MARGIN_DECLINE_THRESHOLD = -0.01; // -1 pp

  // CASO 1: HIGH QUALITY GROWTH
  // Revenue sube Y margin se mantiene o sube
  if (revenueGrowth > REVENUE_GROWTH_THRESHOLD && operatingMarginChange >= 0) {
    return {
      score: 100,
      verdict: "High Quality Growth",
      explanation:
        "Revenue growth with margin expansion indicates strong pricing power",
    };
  }

  // CASO 2: INEFFICIENT GROWTH
  // Revenue sube PERO margin cae significativamente
  if (
    revenueGrowth > REVENUE_GROWTH_THRESHOLD &&
    operatingMarginChange < MARGIN_DECLINE_THRESHOLD
  ) {
    return {
      score: 30,
      verdict: "Inefficient Growth",
      explanation:
        "Revenue growth at expense of margins suggests weak pricing power",
    };
  }

  // CASO 3: NEUTRAL
  // Crecimiento con presión menor en márgenes
  if (
    revenueGrowth > REVENUE_GROWTH_THRESHOLD &&
    operatingMarginChange < 0 &&
    operatingMarginChange >= MARGIN_DECLINE_THRESHOLD
  ) {
    return {
      score: 70,
      verdict: "Neutral",
      explanation: "Revenue growth with minor margin pressure",
    };
  }

  // CASO 4: Sin crecimiento significativo
  return {
    score: 50,
    verdict: "Neutral",
    explanation: "No significant revenue growth",
  };
}
```

#### Ejemplos Reales

**Apple 2010-2020: High Quality Growth**

```json
{
  "revenueGrowth": 0.1, // +10% anual
  "operatingMarginChange": 0.03, // +3 pp
  "verdict": "High Quality Growth",
  "score": 100,
  "explanation": "iPhone pricing power fortaleció márgenes mientras crecían ventas"
}
```

**Amazon Retail 2012-2015: Inefficient Growth**

```json
{
  "revenueGrowth": 0.25, // +25% anual
  "operatingMarginChange": -0.02, // -2 pp
  "verdict": "Inefficient Growth",
  "score": 30,
  "explanation": "Crecimiento agresivo a costa de márgenes (competencia intensa)"
}
```

**Netflix 2019-2021: Neutral**

```json
{
  "revenueGrowth": 0.12, // +12% anual
  "operatingMarginChange": -0.005, // -0.5 pp
  "verdict": "Neutral",
  "score": 70,
  "explanation": "Inversión en contenido original presionó ligeramente márgenes"
}
```

### Componentes del Moat (3 Pilares)

#### 1. ROIC Persistence (40%)

**Métrica:** Persistencia del retorno sobre capital invertido.

```typescript
function computeReturnPersistenceAxis(history: FinancialHistoryRow[]): {
  score: number;
  years: number;
} {
  const fyRows = history
    .filter((r) => r.period_type === "FY")
    .sort(
      (a, b) =>
        new Date(a.period_end_date).getTime() -
        new Date(b.period_end_date).getTime(),
    );

  const roicValues = fyRows.map((r) => r.roic).filter((v) => v !== null);
  const years = roicValues.length;

  if (years === 0) return { score: null, years: 0 };

  // Level Score (nivel promedio de ROIC)
  const meanROIC =
    roicValues.reduce((sum, r) => sum + r, 0) / roicValues.length;
  let levelScore = 0;
  if (meanROIC <= 0) levelScore = 0;
  else if (meanROIC <= 0.1)
    levelScore = meanROIC * 400; // 0-10% → 0-40
  else if (meanROIC <= 0.2)
    levelScore = 40 + (meanROIC - 0.1) * 200; // 10-20% → 40-60
  else if (meanROIC <= 0.4)
    levelScore = 60 + (meanROIC - 0.2) * 100; // 20-40% → 60-80
  else levelScore = 80 + (meanROIC - 0.4) * 50; // 40%+ → 80-100

  // Stability Score (volatilidad de ROIC)
  const stdDev = calculateStdDev(roicValues);
  const stabilityScore = Math.max(0, 100 - stdDev * 200); // Penalizar volatilidad

  // Combined Score (50% level, 50% stability)
  const combined_score = levelScore * 0.5 + stabilityScore * 0.5;

  return { score: Math.round(combined_score), years };
}
```

**Interpretación:**

- **ROIC > 20% sostenido:** Ventaja competitiva fuerte (Moat alto)
- **ROIC 10-20% sostenido:** Ventaja defendible (Moat medio)
- **ROIC < 10% o volátil:** Ventaja débil (Moat bajo)

#### 2. Margin Stability (40%)

**Métrica:** Estabilidad de márgenes operativos y netos.

```typescript
function computeOperatingStabilityAxis(history: FinancialHistoryRow[]): {
  score: number;
  years: number;
} {
  const fyRows = history
    .filter((r) => r.period_type === "FY")
    .sort(
      (a, b) =>
        new Date(a.period_end_date).getTime() -
        new Date(b.period_end_date).getTime(),
    );

  const operatingMargins = fyRows
    .map((r) => r.operating_margin)
    .filter((v) => v !== null);
  const netMargins = fyRows.map((r) => r.net_margin).filter((v) => v !== null);

  const years = Math.max(operatingMargins.length, netMargins.length);
  if (years === 0) return { score: null, years: 0 };

  // Operating Margin Stability
  const opStdDev = calculateStdDev(operatingMargins);
  const opStability = Math.max(0, 100 - opStdDev * 200);

  // Net Margin Stability
  const netStdDev = calculateStdDev(netMargins);
  const netStability = Math.max(0, 100 - netStdDev * 200);

  // Average
  const combined_score = (opStability + netStability) / 2;

  return { score: Math.round(combined_score), years };
}
```

**Interpretación:**

- **StdDev < 2 pp:** Márgenes estables (Moat fuerte)
- **StdDev 2-5 pp:** Márgenes moderadamente volátiles (Moat medio)
- **StdDev > 5 pp:** Márgenes inestables (Moat débil)

#### 3. Capital Discipline (20%)

**Métrica:** Eficiencia en el uso del capital (CAPEX vs FCF).

```typescript
function computeCapitalDisciplineAxis(history: FinancialHistoryRow[]): {
  score: number;
  years: number;
} {
  const fyRows = history
    .filter((r) => r.period_type === "FY")
    .sort(
      (a, b) =>
        new Date(a.period_end_date).getTime() -
        new Date(b.period_end_date).getTime(),
    );

  const ratios = fyRows
    .filter((r) => r.capex !== null && r.free_cash_flow !== null)
    .map((r) => {
      const capexIntensity = Math.abs(r.capex) / r.revenue; // CAPEX/Revenue
      const fcfMargin = r.free_cash_flow / r.revenue; // FCF/Revenue
      return { capexIntensity, fcfMargin };
    });

  const years = ratios.length;
  if (years === 0) return { score: null, years: 0 };

  // Average CAPEX Intensity (menor es mejor)
  const avgCapexIntensity =
    ratios.reduce((sum, r) => sum + r.capexIntensity, 0) / years;
  const capexScore = Math.max(0, 100 - avgCapexIntensity * 500); // Penalizar CAPEX alto

  // Average FCF Margin (mayor es mejor)
  const avgFCFMargin = ratios.reduce((sum, r) => sum + r.fcfMargin, 0) / years;
  const fcfScore = Math.min(100, avgFCFMargin * 500); // Recompensar FCF alto

  // Combined Score (50% CAPEX, 50% FCF)
  const combined_score = capexScore * 0.5 + fcfScore * 0.5;

  return { score: Math.round(combined_score), years };
}
```

**Interpretación:**

- **CAPEX < 5% revenue + FCF > 15% revenue:** Disciplina excelente
- **CAPEX 5-10% revenue + FCF 10-15% revenue:** Disciplina aceptable
- **CAPEX > 10% revenue + FCF < 10% revenue:** Disciplina débil

### Cálculo Final del Moat Score

```typescript
function calculateMoat(history: FinancialHistoryRow[]): MoatResult {
  // Calcular componentes
  const roicAxis = computeReturnPersistenceAxis(history);
  const marginAxis = computeOperatingStabilityAxis(history);
  const capitalAxis = computeCapitalDisciplineAxis(history);

  // Verificar disponibilidad
  const components = [roicAxis, marginAxis, capitalAxis].filter(
    (c) => c.score !== null,
  );
  if (components.length === 0) {
    return { score: null, status: "pending", confidence: 0 };
  }

  // Weighted Average
  const moat_score =
    (roicAxis.score || 0) * 0.4 + // 40% ROIC Persistence
    (marginAxis.score || 0) * 0.4 + // 40% Margin Stability
    (capitalAxis.score || 0) * 0.2; // 20% Capital Discipline

  // Status
  let status: "computed" | "partial" | "pending";
  if (components.length === 3) status = "computed";
  else if (components.length >= 2) status = "partial";
  else status = "pending";

  // Confidence (basado en años de historia)
  const maxYears = Math.max(
    roicAxis.years,
    marginAxis.years,
    capitalAxis.years,
  );
  const confidence = Math.min(100, maxYears * 20); // 1 año = 20%, 5 años = 100%

  return {
    score: Math.round(moat_score),
    status,
    confidence,
    details: {
      roic_persistence: roicAxis.score,
      margin_stability: marginAxis.score,
      capital_discipline: capitalAxis.score,
      years_analyzed: maxYears,
    },
  };
}
```

### Interpretación del Moat Score

| Score      | Clasificación | Interpretación                                                       |
| ---------- | ------------- | -------------------------------------------------------------------- |
| **80-100** | Wide Moat     | Ventaja competitiva sostenible y defendible (e.g., Apple, Microsoft) |
| **60-79**  | Narrow Moat   | Ventaja moderada pero vulnerable a disrupciones (e.g., Starbucks)    |
| **40-59**  | Weak Moat     | Ventaja limitada, competencia intensa (e.g., retail tradicional)     |
| **0-39**   | No Moat       | Sin ventaja estructural (commodity businesses)                       |

### Integración con FGOS

**En `fgos_components`:**

```typescript
fgos_components.moat = moatScore; // 0-100
fgos_components.coherenceCheck = coherenceResult;
```

**Escenarios de análisis:**

```typescript
// Escenario 1: FGOS alto + Moat alto
if (fgos_score > 80 && moat_score > 80) {
  // → "Quality & Sustainability" (Best case)
}

// Escenario 2: FGOS alto + Moat bajo
if (fgos_score > 80 && moat_score < 40) {
  // → "Momento fuerte pero sostenibilidad cuestionable" (Cautela)
}

// Escenario 3: FGOS bajo + Moat alto
if (fgos_score < 40 && moat_score > 80) {
  // → "Mal momento pero ventaja estructural intacta" (Turnaround candidate)
}
```

---

## 6️⃣ Competitive Advantage - Ventaja Competitiva {#competitive-advantage}

### Definición

**Competitive Advantage** mide la **durabilidad de la ventaja competitiva** mediante 3 ejes complementarios al Moat.

**Diferencia con Moat:**

- **Moat:** Enfocado en coherencia crecimiento-margen (corto plazo)
- **Competitive Advantage:** Enfocado en estructural persistence (largo plazo)

### Arquitectura

**Ubicación:** `lib/engine/competitive-advantage.ts`

```typescript
interface CompetitiveAdvantageResult {
  score: number | null; // 0-100
  band: "weak" | "defendable" | "strong";
  confidence: number; // 0-100
  axes: {
    return_persistence: number | null; // 35%
    operating_stability: number | null; // 35%
    capital_discipline: number | null; // 30%
  };
  years_analyzed: number;
}
```

### 3 Ejes de Medición

#### 1. Return Persistence (35%)

**Métrica:** Nivel y estabilidad del ROIC/ROE.

```typescript
function computeReturnPersistenceAxis(
  history: CompetitiveAdvantageHistoryRow[],
): { score: number; years: number } {
  const fyRows = history
    .filter((r) => !r.period_type || r.period_type === "FY")
    .sort(
      (a, b) =>
        new Date(a.period_end_date).getTime() -
        new Date(b.period_end_date).getTime(),
    );

  // Preferir ROIC, fallback a ROE
  const returns = fyRows.map((r) => r.roic ?? r.roe).filter((v) => v !== null);
  const years = returns.length;

  if (years === 0) return { score: null, years: 0 };

  // Level Score (nivel promedio)
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const returnPct = meanReturn * 100;

  let levelScore = 0;
  if (returnPct <= 0) levelScore = 0;
  else if (returnPct <= 10)
    levelScore = returnPct * 4; // 0-10% → 0-40
  else if (returnPct <= 20)
    levelScore = 40 + (returnPct - 10) * 2; // 10-20% → 40-60
  else if (returnPct <= 40)
    levelScore = 60 + (returnPct - 20); // 20-40% → 60-80
  else levelScore = 80 + (returnPct - 40) * 0.5; // 40%+ → 80-100

  // Stability Score (volatilidad)
  const stdDev = calculateStdDev(returns);
  const stdDevPct = stdDev * 100;
  const stabilityScore = Math.max(0, 100 - stdDevPct * 2);

  // Combined (50% level, 50% stability)
  const combined_score = levelScore * 0.5 + stabilityScore * 0.5;

  return { score: Math.round(combined_score), years };
}
```

**Ejemplos:**

```typescript
// Apple: ROIC promedio 35%, StdDev 3%
// Level Score: 80 + (35 - 40) * 0.5 = 77.5 (penalización por caída reciente)
// Stability Score: 100 - (3 * 2) = 94 (alta estabilidad)
// Combined: (77.5 * 0.5) + (94 * 0.5) = 85.75 → 86

// Retail Tradicional: ROIC promedio 8%, StdDev 6%
// Level Score: 8 * 4 = 32
// Stability Score: 100 - (6 * 2) = 88
// Combined: (32 * 0.5) + (88 * 0.5) = 60
```

#### 2. Operating Stability (35%)

**Métrica:** Estabilidad histórica de márgenes operativos y netos.

```typescript
function computeOperatingStabilityAxis(
  history: CompetitiveAdvantageHistoryRow[],
): { score: number; years: number } {
  const fyRows = history
    .filter((r) => !r.period_type || r.period_type === "FY")
    .sort(
      (a, b) =>
        new Date(a.period_end_date).getTime() -
        new Date(b.period_end_date).getTime(),
    );

  const operatingMargins = fyRows
    .map((r) => r.operating_margin)
    .filter((v) => v !== null);
  const netMargins = fyRows.map((r) => r.net_margin).filter((v) => v !== null);

  const years = Math.max(operatingMargins.length, netMargins.length);
  if (years === 0) return { score: null, years: 0 };

  // Operating Margin Stability
  const opStdDev = calculateStdDev(operatingMargins);
  const opStdDevPct = opStdDev * 100;
  const opStability = Math.max(0, 100 - opStdDevPct * 2);

  // Net Margin Stability
  const netStdDev = calculateStdDev(netMargins);
  const netStdDevPct = netStdDev * 100;
  const netStability = Math.max(0, 100 - netStdDevPct * 2);

  // Combine
  const scoresPre = [opStability, netStability].filter(
    (s) => !isNaN(s) && s > 0,
  );
  if (!scoresPre.length) return { score: null, years };

  const combined_score =
    scoresPre.reduce((sum, s) => sum + s, 0) / scoresPre.length;

  return { score: Math.round(combined_score), years };
}
```

**Interpretación:**

- **Score > 80:** Márgenes muy estables (pricing power fuerte)
- **Score 60-80:** Márgenes moderadamente estables
- **Score < 60:** Márgenes volátiles (competencia intensa)

#### 3. Capital Discipline (30%)

**Métrica:** Eficiencia en uso de capital (reinversión vs shareholder returns).

```typescript
function computeCapitalDisciplineAxis(
  history: CompetitiveAdvantageHistoryRow[],
): { score: number; years: number } {
  const fyRows = history
    .filter((r) => !r.period_type || r.period_type === "FY")
    .sort(
      (a, b) =>
        new Date(a.period_end_date).getTime() -
        new Date(b.period_end_date).getTime(),
    );

  const validRows = fyRows.filter(
    (r) => r.revenue !== null && r.capex !== null && r.free_cash_flow !== null,
  );

  const years = validRows.length;
  if (years === 0) return { score: null, years: 0 };

  // CAPEX Intensity (ratio con revenue)
  const capexIntensities = validRows.map((r) => Math.abs(r.capex) / r.revenue);
  const avgCapexIntensity =
    capexIntensities.reduce((sum, v) => sum + v, 0) / years;
  const capexScore = Math.max(0, 100 - avgCapexIntensity * 500);

  // FCF Margin
  const fcfMargins = validRows.map((r) => r.free_cash_flow / r.revenue);
  const avgFCFMargin = fcfMargins.reduce((sum, v) => sum + v, 0) / years;
  const fcfScore = Math.min(100, avgFCFMargin * 500);

  // Buyback Intensity (opcional, si disponible)
  // TODO: Implementar cuando bought_back_shares_ttm esté disponible

  // Combined (50% CAPEX, 50% FCF por ahora)
  const combined_score = capexScore * 0.5 + fcfScore * 0.5;

  return { score: Math.round(combined_score), years };
}
```

**Interpretación:**

- **CAPEX < 5% + FCF > 15%:** Disciplina excelente (asset-light model)
- **CAPEX 5-10% + FCF 10-15%:** Disciplina aceptable
- **CAPEX > 15% + FCF < 5%:** Disciplina débil (capital intensive)

### Cálculo del Score y Band

```typescript
function calculateCompetitiveAdvantage(
  history: CompetitiveAdvantageHistoryRow[],
): CompetitiveAdvantageResult {
  // Calcular ejes
  const returnAxis = computeReturnPersistenceAxis(history);
  const stabilityAxis = computeOperatingStabilityAxis(history);
  const capitalAxis = computeCapitalDisciplineAxis(history);

  // Verificar disponibilidad
  const axes = [
    { name: "return_persistence", result: returnAxis },
    { name: "operating_stability", result: stabilityAxis },
    { name: "capital_discipline", result: capitalAxis },
  ].filter((a) => a.result.score !== null);

  if (axes.length === 0) {
    return {
      score: null,
      band: null,
      confidence: 0,
      axes: {
        return_persistence: null,
        operating_stability: null,
        capital_discipline: null,
      },
      years_analyzed: 0,
    };
  }

  // Weighted Average
  const score =
    (returnAxis.score || 0) * 0.35 + // 35% Return Persistence
    (stabilityAxis.score || 0) * 0.35 + // 35% Operating Stability
    (capitalAxis.score || 0) * 0.3; // 30% Capital Discipline

  // Classify Band
  let band: "weak" | "defendable" | "strong";
  if (score >= 75) band = "strong";
  else if (score >= 50) band = "defendable";
  else band = "weak";

  // Confidence (basado en años de historia)
  const maxYears = Math.max(
    returnAxis.years || 0,
    stabilityAxis.years || 0,
    capitalAxis.years || 0,
  );
  const confidence = Math.min(100, maxYears * 20); // 1 año = 20%, 5 años = 100%

  return {
    score: Math.round(score),
    band,
    confidence,
    axes: {
      return_persistence: returnAxis.score,
      operating_stability: stabilityAxis.score,
      capital_discipline: capitalAxis.score,
    },
    years_analyzed: maxYears,
  };
}
```

### Bandas de Clasificación

| Band           | Score  | Interpretación                   | Ejemplo                      |
| -------------- | ------ | -------------------------------- | ---------------------------- |
| **Strong**     | 75-100 | Ventaja sostenible y defendible  | Apple, Microsoft, Visa       |
| **Defendable** | 50-74  | Ventaja moderada pero vulnerable | Starbucks, Nike              |
| **Weak**       | 0-49   | Ventaja limitada o inexistente   | Retail tradicional, airlines |

### Integración con FGOS

**En `fgos_components`:**

```typescript
fgos_components.competitive_advantage = {
  score: 78,
  band: "defendable",
  confidence: 85,
  axes: {
    return_persistence: 82,
    operating_stability: 75,
    capital_discipline: 76,
  },
  years_analyzed: 5,
};
```

**Análisis combinado:**

```typescript
// Escenario 1: FGOS alto + CA fuerte
if (fgos_score > 80 && ca_band === "strong") {
  // → "Quality Company con moat sostenible" (Core holding)
}

// Escenario 2: FGOS alto + CA weak
if (fgos_score > 80 && ca_band === "weak") {
  // → "Buen momento pero sin defensa estructural" (Tactical play)
}

// Escenario 3: FGOS bajo + CA strong
if (fgos_score < 40 && ca_band === "strong") {
  // → "Momento difícil pero moat intacto" (Contrarian opportunity)
}
```

---

## 7️⃣ Quality Brakes - Frenos de Calidad {#quality-brakes}

### Definición

**Quality Brakes** son alertas automáticas de **riesgo financiero estructural** basadas en:

1. **Altman Z-Score** (riesgo de quiebra)
2. **Piotroski F-Score** (calidad financiera)

**Principio fundamental:** Los Quality Brakes NO son recomendaciones. Son alertas para **enfocar análisis** en dimensiones específicas.

### Arquitectura

**Ubicación:** `lib/engine/applyQualityBrakes.ts`

```typescript
interface QualityBrakes {
  applied: boolean; // ¿Se activó algún freno?
  reasons: string[]; // Lista de motivos
  altman_z?: number | null; // Z-Score calculado
  piotroski?: number | null; // F-Score calculado
}
```

### Freno 1: Altman Z-Score < 1.8

#### Definición

Modelo predictivo de quiebra desarrollado por Edward Altman (1968). Combina 5 ratios financieros ponderados.

**Fórmula:**

```
Z = 1.2×(WC/TA) + 1.4×(RE/TA) + 3.3×(EBIT/TA) + 0.6×(MVE/TL) + 1.0×(Sales/TA)
```

**Componentes:**

- **WC/TA:** Working Capital / Total Assets (liquidez)
- **RE/TA:** Retained Earnings / Total Assets (rentabilidad acumulada)
- **EBIT/TA:** Earnings Before Interest & Tax / Total Assets (eficiencia operativa)
- **MVE/TL:** Market Value Equity / Total Liabilities (solvencia)
- **Sales/TA:** Sales / Total Assets (rotación de activos)

#### Interpretación de Zonas

| Z-Score        | Zona            | Significado | Probabilidad de Quiebra |
| -------------- | --------------- | ----------- | ----------------------- |
| **< 1.8**      | 🔴 **Distress** | Alto riesgo | 72% en 2 años           |
| **1.8 - 2.99** | 🟡 **Grey**     | Zona gris   | 35% en 2 años           |
| **≥ 3.0**      | 🟢 **Safe**     | Bajo riesgo | < 5% en 2 años          |

#### Activación del Freno

```typescript
function applyQualityBrakes(snapshot: FinancialSnapshot): QualityBrakes {
  const reasons: string[] = [];

  // Calcular Altman Z-Score
  const altmanZ = calculateAltmanZScore(snapshot);

  if (altmanZ !== null && altmanZ < 1.8) {
    reasons.push("Altman Z < 1.8 (distress zone)");
  }

  // Calcular Piotroski F-Score
  const piotroski = calculatePiotroskiFScore(snapshot);

  if (piotroski !== null && piotroski <= 3) {
    reasons.push("Piotroski F-Score ≤ 3 (low quality)");
  }

  return {
    applied: reasons.length > 0,
    reasons,
    altman_z: altmanZ,
    piotroski,
  };
}
```

#### Dimensiones a Analizar (Si Activado)

**1. Liquidez inmediata:**

- Current Ratio (ratio corriente)
- Quick Ratio (prueba ácida)
- Vencimientos de deuda corto plazo

**2. Estructura de capital:**

- Debt-to-Equity ratio
- Interest Coverage ratio
- Credit ratings (si disponibles)

**3. Cash burn rate:**

- Operating Cash Flow trends
- Days of cash remaining
- Emergency liquidity sources

**4. Rentabilidad operativa:**

- EBIT margin trends
- Revenue sustainability
- Cost structure flexibility

### Freno 2: Piotroski F-Score ≤ 3

#### Definición

Sistema de puntuación desarrollado por Joseph Piotroski (2000) que evalúa **9 criterios binarios** (0 o 1) de salud financiera.

**Total posible:** 0-9 puntos

#### 9 Criterios (Agrupados)

**A. Rentabilidad (4 puntos)**

1. **ROA positivo:** `1` si ROA > 0, `0` si ≤ 0
2. **OCF positivo:** `1` si Operating Cash Flow > 0, `0` si ≤ 0
3. **Δ ROA:** `1` si ROA(t) > ROA(t-1), `0` si no
4. **Accruals:** `1` si OCF > Net Income (calidad de earnings), `0` si no

**B. Apalancamiento/Liquidez (3 puntos)** 5. **Δ Leverage:** `1` si Debt/Assets(t) < Debt/Assets(t-1), `0` si no 6. **Δ Liquidez:** `1` si Current Ratio(t) > Current Ratio(t-1), `0` si no 7. **No emisión de acciones:** `1` si Shares Outstanding(t) ≤ Shares(t-1), `0` si no

**C. Eficiencia Operativa (2 puntos)** 8. **Δ Gross Margin:** `1` si Gross Margin(t) > Gross Margin(t-1), `0` si no 9. **Δ Asset Turnover:** `1` si Asset Turnover(t) > Asset Turnover(t-1), `0` si no

#### Interpretación

| F-Score | Interpretación      | Acción Sugerida                         |
| ------- | ------------------- | --------------------------------------- |
| **8-9** | 🟢 High Quality     | Empresa sólida, bajo riesgo             |
| **5-7** | 🟡 Medium Quality   | Revisar tendencias y contexto           |
| **3-4** | 🟠 Low Quality      | Deterioro financiero, cautela           |
| **0-2** | 🔴 Very Low Quality | Riesgo alto, evitar o análisis profundo |

#### Activación del Freno

```typescript
// SE ACTIVA SI F-SCORE ≤ 3
if (piotroski !== null && piotroski <= 3) {
  reasons.push("Piotroski F-Score ≤ 3 (low quality)");
}
```

#### Dimensiones a Analizar (Si Activado)

**1. Deterioro de rentabilidad:**

- ROA trends (últimos 3-5 años)
- Operating margin compression
- Net income vs cash flow divergence

**2. Incremento de apalancamiento:**

- Debt growth rate
- Debt maturity schedule
- Covenant compliance

**3. Dilución de shareholders:**

- Share issuance patterns
- Use of proceeds from equity raises
- Insider selling activity

**4. Deterioro operativo:**

- Gross margin trends (pricing power)
- Asset turnover decline (efficiency loss)
- Working capital deterioration

### Integración con FGOS

**En `fgos_components`:**

```typescript
fgos_components.quality_brakes = {
  applied: true,
  reasons: ["Altman Z < 1.8 (distress zone)"],
  altman_z: 1.45,
  piotroski: 6,
};
```

**Escenarios de análisis:**

```typescript
// Escenario 1: FGOS alto + Quality Brakes activados
if (fgos_score > 80 && qualityBrakes.applied) {
  // → "Momento fuerte pero con riesgos estructurales latentes"
  // UI: Mostrar alerta prominente
}

// Escenario 2: FGOS bajo + Quality Brakes activados
if (fgos_score < 40 && qualityBrakes.applied) {
  // → "Empresa en distress, riesgo alto"
  // UI: Señal de venta clara
}

// Escenario 3: FGOS alto + Sin Quality Brakes
if (fgos_score > 80 && !qualityBrakes.applied) {
  // → "Calidad sólida sin señales de alerta"
  // UI: Verde total
}
```

### Ejemplos Reales

**Caso 1: Tesla 2019**

```json
{
  "fgos_score": 72,
  "quality_brakes": {
    "applied": true,
    "reasons": ["Altman Z < 1.8 (distress zone)"],
    "altman_z": 1.32,
    "piotroski": 5
  }
}
```

→ _"Buen momentum operativo pero con estrés financiero (cash burn alto)"_

**Caso 2: Sears 2017**

```json
{
  "fgos_score": 25,
  "quality_brakes": {
    "applied": true,
    "reasons": [
      "Altman Z < 1.8 (distress zone)",
      "Piotroski F-Score ≤ 3 (low quality)"
    ],
    "altman_z": 0.85,
    "piotroski": 2
  }
}
```

→ _"Deterioro extremo en todas las dimensiones (quiebra en 2018)"_

---

## 8️⃣ Fundamentals Maturity - Madurez de Datos {#fundamentals-maturity}

### Definición

**Fundamentals Maturity** clasifica empresas según la **cantidad de años fiscales con datos completos** disponibles.

**Propósito:** Indicar el nivel de confianza en análisis históricos y scores calculados.

### Arquitectura

**Ubicación:** `lib/engine/fundamentals-maturity.ts`

```typescript
type MaturityClassification = "early" | "developing" | "established";

interface FundamentalsMaturityResult {
  fundamentals_years_count: number; // Años consecutivos con datos
  fundamentals_first_year: number | null; // Año más antiguo
  fundamentals_last_year: number | null; // Año más reciente
  fgos_maturity: MaturityClassification;
}
```

### Clasificación

| Classification  | Años | Interpretación    | Uso de Scores                                  |
| --------------- | ---- | ----------------- | ---------------------------------------------- |
| **Established** | ≥ 5  | Historia completa | Alta confianza en FGOS, Moat, CA               |
| **Developing**  | 3-4  | Historia parcial  | Confianza media, completar con análisis manual |
| **Early**       | 1-2  | Historia mínima   | Baja confianza, scores preliminares            |
| **Incomplete**  | 0    | Sin datos         | Scores no calculables                          |

### Algoritmo

```typescript
function calculateFundamentalsMaturity(
  financialHistory: any[],
): FundamentalsMaturityResult {
  // 1. Filtrar FY con métricas core válidas
  const validYears = financialHistory
    .filter(
      (row) =>
        row.period_type === "FY" &&
        row.revenue !== null &&
        row.net_income !== null &&
        row.free_cash_flow !== null,
    )
    .sort(
      (a, b) =>
        new Date(b.period_end_date).getTime() -
        new Date(a.period_end_date).getTime(),
    );

  if (validYears.length === 0) {
    return {
      fundamentals_years_count: 0,
      fundamentals_first_year: null,
      fundamentals_last_year: null,
      fgos_maturity: "early",
    };
  }

  // 2. Contar bloque consecutivo (desde más reciente)
  let count = 0;
  let lastYearVal = -1;

  for (let i = 0; i < validYears.length; i++) {
    const row = validYears[i];
    const currentFy =
      parseInt(row.period_label) || new Date(row.period_end_date).getFullYear();

    if (i === 0) {
      count = 1;
      lastYearVal = currentFy;
    } else {
      const prevRow = validYears[i - 1];
      const prevFy =
        parseInt(prevRow.period_label) ||
        new Date(prevRow.period_end_date).getFullYear();

      const diff = prevFy - currentFy;

      if (diff === 1) {
        count++;
        lastYearVal = currentFy;
      } else if (diff === 0) {
        continue; // Duplicate, skip
      } else {
        break; // Gap > 1, break chain
      }
    }
  }

  // 3. Resolve bounds
  const newestRow = validYears[0];
  const newestYear =
    parseInt(newestRow.period_label) ||
    new Date(newestRow.period_end_date).getFullYear();

  // 4. Classify
  let maturity: MaturityClassification;
  if (count < 3) maturity = "early";
  else if (count >= 3 && count < 5) maturity = "developing";
  else maturity = "established";

  return {
    fundamentals_years_count: count,
    fundamentals_first_year: lastYearVal,
    fundamentals_last_year: newestYear,
    fgos_maturity: maturity,
  };
}
```

### Reglas de Validación

#### Regla 1: Consecutividad Estricta

```typescript
// ✅ CORRECTO - 5 años consecutivos
[2023, 2022, 2021, 2020, 2019] → count = 5, maturity = 'established'

// ✅ CORRECTO - 3 años consecutivos (gap después)
[2023, 2022, 2021] → count = 3, maturity = 'developing'
// (aunque existan 2019, 2018 con datos, NO se cuentan por el gap)

// ✅ CORRECTO - 2 años consecutivos
[2023, 2022] → count = 2, maturity = 'early'
```

#### Regla 2: Métricas Core Requeridas

```typescript
// Para contar un FY como válido, DEBE tener:
row.revenue !== null && row.net_income !== null && row.free_cash_flow !== null;

// Si falta alguna → Ese FY NO cuenta
```

#### Regla 3: No Inferir Años Intermedios

```typescript
// ❌ PROHIBIDO - Asumir continuidad si hay gap
[2023, 2022, 2020, 2019] → count = 2 (solo 2023, 2022)
// NO count = 4 (existe gap en 2021)
```

### Impacto en Confidence de Otros Engines

**FGOS:**

```typescript
// Fundamentals Maturity → FGOS Confidence (ponderación 30%)
const yearsScore = Math.min(100, (fundamentals_years_count / 5) * 100);
// 1 año = 20%, 5 años = 100%
```

**Moat:**

```typescript
// Moat Confidence basado 100% en años disponibles
const moat_confidence = Math.min(100, years_analyzed * 20);
```

**Competitive Advantage:**

```typescript
// CA Confidence basado 100% en años disponibles
const ca_confidence = Math.min(100, years_analyzed * 20);
```

**IQS:**

```typescript
// IQS Confidence lineal con años fiscales
const iqs_confidence = Math.min(100, fyCount * 20);
```

### Almacenamiento en Snapshot

```typescript
// En fintra_snapshots
{
  "ticker": "AAPL",
  "fgos_status": "Mature",  // = 'established' maturity
  "fundamentals_maturity": {
    "classification": "established",
    "years_count": 10,
    "first_year": 2014,
    "last_year": 2023
  }
}
```

---

## 9️⃣ Pipeline de Cálculo {#pipeline-de-cálculo}

### Orden de Ejecución

El cálculo de engines sigue un **orden estricto** por dependencias:

```
1. Profile Structural → Sector/Industry/Country extraction
   ↓
2. Fundamentals Maturity → Contar años de historia
   ↓
3. FGOS Core Components → Growth, Profitability, Efficiency, Solvency
   ↓
4. Quality Brakes → Altman Z, Piotroski F-Score
   ↓
5. Moat → Coherence Check + 3 Pillars
   ↓
6. Competitive Advantage → 3 Axes
   ↓
7. IFS Live → Block Voting (si hay relative performance data)
   ↓
8. IQS → Fiscal Year Analysis (si industry disponible)
   ↓
9. Valuation → Sector percentiles (si benchmarks disponibles)
   ↓
10. FGOS Final Score → Integrar todos los componentes
```

### Arquitectura del Pipeline

**Ubicación:** `lib/engine/fintra-brain.ts`

```typescript
async function buildFintraSnapshot(ticker: string): Promise<FintraSnapshot> {
  // 1. Load raw data
  const profile = await getCompanyProfile(ticker);
  const financialHistory = await getFinancialHistory(ticker);
  const ratios = await getRatios(ticker);
  const marketData = await getMarketData(ticker);

  // 2. Profile Structural
  const profileStructural = extractProfileStructural(profile);

  if (!profileStructural || !profileStructural.sector) {
    return {
      ticker,
      fgos_status: "pending",
      fgos_score: null,
      // ... todos los engines en pending
    };
  }

  // 3. Fundamentals Maturity
  const maturity = calculateFundamentalsMaturity(financialHistory);

  // 4. Quality Brakes
  const qualityBrakes = applyQualityBrakes({
    ...ratios,
    ...marketData,
  });

  // 5. Moat
  const moat = calculateMoat(financialHistory);

  // 6. Competitive Advantage
  const competitiveAdvantage = calculateCompetitiveAdvantage(financialHistory);

  // 7. Sector Benchmarks
  const benchmarks = await getBenchmarksForSector(profileStructural.sector);

  // 8. FGOS
  const fgosResult = computeFGOS(
    ticker,
    { ...ratios, ...profileStructural },
    ratios,
    metrics,
    growth,
    benchmarks,
    confidenceInputs,
    financialHistory,
    valuationTimeline,
  );

  // 9. IFS Live (si hay datos de relative performance)
  let ifsLive: IFSResult | null = null;
  if (marketData.relative_vs_sector_1m !== null) {
    const industryMetadata = await getIndustryMetadata(
      profileStructural.industry,
    );
    ifsLive = calculateIFS(
      marketData.relativePerformanceInputs,
      industryMetadata?.dominant_horizons,
    );
  }

  // 10. IQS (si hay industria)
  let iqs: IQSResult | null = null;
  if (profileStructural.industry) {
    iqs = await calculateIQS(ticker, profileStructural.industry);
  }

  // 11. Valuation
  let valuation: ValuationState | null = null;
  if (benchmarks) {
    valuation = buildValuationState(
      {
        sector: profileStructural.sector,
        pe_ratio: ratios.pe_ratio,
        ev_ebitda: ratios.ev_ebitda,
        price_to_fcf: ratios.price_to_fcf,
      },
      benchmarks,
      {
        fgos_maturity: maturity.fgos_maturity,
        interpretation_context: {
          dominant_horizons_used: industryMetadata?.dominant_horizons || [],
        },
      },
    );
  }

  // 12. Build final snapshot
  return {
    ticker,
    snapshot_date: new Date().toISOString().split("T")[0],
    profile_structural: profileStructural,
    fgos_score: fgosResult.fgos_score,
    fgos_category: fgosResult.fgos_category,
    fgos_confidence_percent: fgosResult.fgos_confidence_percent,
    fgos_status: fgosResult.fgos_status,
    fgos_components: {
      ...fgosResult.fgos_components,
      quality_brakes: qualityBrakes,
      moat: moat.score,
      competitive_advantage: competitiveAdvantage,
    },
    ifs: ifsLive,
    iqs,
    valuation_relative: valuation,
    fundamentals_maturity: maturity,
  };
}
```

### Fault Tolerance

**Regla crítica:** Un engine fallido NO debe abortar el snapshot completo.

```typescript
// ✅ CORRECTO - Try-catch por engine
try {
  const moat = calculateMoat(financialHistory);
  snapshot.fgos_components.moat = moat.score;
} catch (error) {
  console.error(`[${ticker}] Moat calculation failed:`, error);
  snapshot.fgos_components.moat = null; // Continuar con null
}

// ❌ PROHIBIDO - Dejar que exceptions propaguen
const moat = calculateMoat(financialHistory); // Sin try-catch
// Si falla → Aborta todo el snapshot
```

### Validaciones Pre-Cálculo

```typescript
// Validar inputs críticos ANTES de calcular
function validateInputs(ticker: string, profile: any): boolean {
  const errors: string[] = [];

  if (!ticker) errors.push("Ticker missing");
  if (!profile) errors.push("Profile missing");
  if (profile && !profile.sector) errors.push("Sector missing");

  if (errors.length > 0) {
    console.warn(`[${ticker}] Validation failed:`, errors);
    return false;
  }

  return true;
}

// En pipeline
if (!validateInputs(ticker, profile)) {
  return createPendingSnapshot(ticker); // Snapshot en pending
}
```

### Logging Requerido

**Eventos obligatorios:**

```typescript
console.log(`[${ticker}] SNAPSHOT START`);
console.log(`[${ticker}] PROFILE OK`);
console.warn(`[${ticker}] SECTOR MISSING`); // Si falta
console.log(`[${ticker}] FGOS COMPUTED: ${fgos_score}`);
console.log(`[${ticker}] IFS: ${ifs.position}, Pressure: ${ifs.pressure}`);
console.log(`[${ticker}] SNAPSHOT OK`);
console.error(`[${ticker}] UPSERT FAILED:`, error);
```

---

## 🔗 Interacciones entre Engines {#interacciones}

### Matriz de Interacciones

| Engine A      | Engine B              | Tipo de Relación  | Interpretación Combinada                               |
| ------------- | --------------------- | ----------------- | ------------------------------------------------------ |
| **FGOS**      | Quality Brakes        | Atenuación        | FGOS alto + Brakes = Momento fuerte con riesgo latente |
| **FGOS**      | Moat                  | Sostenibilidad    | FGOS alto + Moat alto = Quality duradera               |
| **FGOS**      | Competitive Advantage | Defensa           | FGOS alto + CA bajo = Vulnerabilidad estructural       |
| **FGOS**      | Valuation             | Value/Growth      | FGOS alto + Cheap = Growth at discount                 |
| **FGOS**      | IFS Live              | Timing            | FGOS alto + Laggard = Buy the dip                      |
| **IFS Live**  | IQS                   | Temporal          | IFS líder + IQS laggard = Momentum vs Fundamentals     |
| **Moat**      | Competitive Advantage | Complementariedad | Moat corto plazo + CA largo plazo                      |
| **Valuation** | Quality Brakes        | Riesgo            | Cheap + Brakes = Value trap risk                       |
| **IFS Live**  | Valuation             | Momentum/Price    | Líder + Expensive = Momentum premium                   |
| **FGOS**      | Fundamentals Maturity | Confianza         | FGOS alto + Early = Preliminar, validar                |

### Escenarios de Análisis

#### Escenario 1: Quality con Momentum

**Condiciones:**

- FGOS > 80
- IFS Live = 'leader', Pressure = 3
- Quality Brakes = false
- Valuation = 'Fair' o 'Cheap'

**Interpretación:**

```
✅ Strong Buy Signal
- Calidad operativa excepcional (FGOS 80+)
- Momentum positivo en todos los horizontes (IFS pressure 3)
- Sin señales de riesgo estructural
- Valoración razonable o atractiva
```

**Código:**

```typescript
if (
  fgos_score > 80 &&
  ifs?.position === "leader" &&
  ifs?.pressure === 3 &&
  !qualityBrakes.applied &&
  ["Fair", "Cheap", "Very Cheap"].includes(valuation.verdict)
) {
  return {
    signal: "Strong Buy",
    confidence: "High",
    rationale: "Quality company with strong momentum at reasonable price",
  };
}
```

#### Escenario 2: Value Trap Detection

**Condiciones:**

- Valuation = 'Very Cheap'
- Quality Brakes = true (Altman Z < 1.8)
- FGOS < 40
- IFS Live = 'laggard', Pressure = 2+

**Interpretación:**

```
⚠️ Value Trap - Avoid
- Precio bajo por razones fundamentales (no oportunidad)
- Riesgo de quiebra elevado (Altman Z)
- Calidad operativa débil (FGOS)
- Momentum negativo persistente (IFS laggard)
```

**Código:**

```typescript
if (
  ["Cheap", "Very Cheap"].includes(valuation.verdict) &&
  qualityBrakes.applied &&
  qualityBrakes.reasons.includes("Altman Z < 1.8 (distress zone)") &&
  fgos_score < 40 &&
  ifs?.position === "laggard" &&
  ifs?.pressure >= 2
) {
  return {
    signal: "Avoid",
    confidence: "High",
    rationale: "Value trap - cheap for a reason (distress risk)",
  };
}
```

#### Escenario 3: Growth at Premium (Tolerable)

**Condiciones:**

- FGOS > 85
- Competitive Advantage = 'strong'
- Moat > 80
- Valuation = 'Expensive' (60-75 percentil)
- IFS Live = 'leader'

**Interpretación:**

```
✅ Hold / Accumulate on Dips
- Calidad excepcional con moat ancho (FGOS + CA + Moat)
- Momentum positivo (IFS leader)
- Premium justificado por calidad y sostenibilidad
- Esperar correcciones para acumular
```

**Código:**

```typescript
if (
  fgos_score > 85 &&
  competitive_advantage?.band === "strong" &&
  moat_score > 80 &&
  valuation.verdict === "Expensive" &&
  ifs?.position === "leader"
) {
  return {
    signal: "Hold / Accumulate on Dips",
    confidence: "High",
    rationale:
      "Quality moat company - premium justified but wait for pullbacks",
  };
}
```

#### Escenario 4: Contrarian Opportunity

**Condiciones:**

- FGOS 60-80 (calidad sólida)
- Competitive Advantage = 'defendable' o 'strong'
- IFS Live = 'laggard' (momentum negativo temporal)
- Valuation = 'Cheap' o 'Very Cheap'
- Quality Brakes = false

**Interpretación:**

```
🔄 Contrarian Buy
- Fundamentales sólidos (FGOS + CA)
- Precio temporalmente deprimido por sentiment
- Sin riesgos estructurales (Quality Brakes)
- Momentum negativo puede revertir
```

**Código:**

```typescript
if (
  fgos_score >= 60 &&
  fgos_score <= 80 &&
  ["defendable", "strong"].includes(competitive_advantage?.band) &&
  ifs?.position === "laggard" &&
  ["Cheap", "Very Cheap"].includes(valuation.verdict) &&
  !qualityBrakes.applied
) {
  return {
    signal: "Contrarian Buy",
    confidence: "Medium",
    rationale: "Solid fundamentals with temporary negative sentiment",
  };
}
```

#### Escenario 5: Momentum Divergence (IFS vs IQS)

**Condiciones:**

- IFS Live = 'laggard' (momentum negativo)
- IQS = 'leader', Percentile > 75 (fundamentales fuertes)
- Quality Brakes = false

**Interpretación:**

```
🔍 Deep Value Investigation
- Mercado castiga precio (IFS laggard)
- Fundamentales estructurales fuertes (IQS leader)
- Posible mispricing o catalyst pending
- Requiere análisis cualitativo de causas
```

**Código:**

```typescript
if (
  ifs?.position === "laggard" &&
  iqs?.position === "leader" &&
  iqs?.percentile > 75 &&
  !qualityBrakes.applied
) {
  return {
    signal: "Deep Value Investigation",
    confidence: "Medium",
    rationale:
      "Market pessimism vs strong structural fundamentals - investigate catalyst",
  };
}
```

#### Escenario 6: Quality Deterioration

**Condiciones:**

- FGOS < 40 (calidad baja)
- Moat < 40 (sin foso)
- Competitive Advantage = 'weak'
- IFS Memory: Dominant position = 'follower' o 'laggard' (históricamente débil)

**Interpretación:**

```
❌ Avoid / Sell
- Calidad operativa débil (FGOS)
- Sin ventaja competitiva sostenible (Moat + CA)
- Históricamente mediocre (IFS Memory)
- No hay catalizadores claros de mejora
```

**Código:**

```typescript
if (
  fgos_score < 40 &&
  moat_score < 40 &&
  competitive_advantage?.band === "weak" &&
  ["follower", "laggard"].includes(ifs_memory?.dominant_position)
) {
  return {
    signal: "Avoid / Sell",
    confidence: "High",
    rationale:
      "Weak quality with no competitive advantage - secular decline risk",
  };
}
```

### Dashboard de Interacciones (Propuesto)

**Widget sugerido para UI:**

```typescript
interface EngineInteractionSummary {
  primary_signal: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Avoid";
  confidence: "High" | "Medium" | "Low";
  supporting_engines: string[]; // Engines que apoyan la señal
  contradicting_engines: string[]; // Engines que contradicen
  rationale: string;
  key_metrics: {
    fgos: number;
    valuation_verdict: string;
    ifs_position: string;
    quality_brakes_applied: boolean;
  };
}
```

**Ejemplo de salida:**

```json
{
  "primary_signal": "Hold / Accumulate on Dips",
  "confidence": "High",
  "supporting_engines": [
    "FGOS (88) - Excellent quality",
    "Competitive Advantage (85, strong) - Durable moat",
    "IFS Live (leader, pressure 3) - Strong momentum"
  ],
  "contradicting_engines": [
    "Valuation (Expensive, 72nd percentile) - Premium pricing"
  ],
  "rationale": "Quality moat company with strong momentum, but wait for price correction",
  "key_metrics": {
    "fgos": 88,
    "valuation_verdict": "Expensive",
    "ifs_position": "leader",
    "quality_brakes_applied": false
  }
}
```

### Reglas de Interpretación

#### Regla 1: Quality Brakes Override

**Principio:** Si Quality Brakes están activados, cualquier señal positiva debe ser atenuada.

```typescript
if (qualityBrakes.applied) {
  signal_strength = Math.max("Hold", signal_strength); // Never "Buy" con brakes
  confidence = Math.min("Medium", confidence); // Nunca "High" confidence
  rationale += " (Quality brakes active - caution advised)";
}
```

#### Regla 2: Confidence Degradation

**Principio:** Confianza baja en cualquier engine crítico degrada confianza total.

```typescript
const criticalEngines = [
  { name: "FGOS", confidence: fgos_confidence },
  { name: "Valuation", confidence: valuation.confidence_score },
  { name: "IFS", confidence: ifs?.confidence },
];

const minConfidence = Math.min(...criticalEngines.map((e) => e.confidence));

if (minConfidence < 50) {
  overall_confidence = "Low";
} else if (minConfidence < 75) {
  overall_confidence = "Medium";
} else {
  overall_confidence = "High";
}
```

#### Regla 3: Temporal Context

**Principio:** Engines diarios (FGOS, IFS Live, Valuation) son tácticos. Engines anuales (IQS, Moat, CA) son estratégicos.

```typescript
// Para trading/timing → Priorizar engines diarios
if (use_case === "trading") {
  weights = {
    ifs_live: 0.4,
    valuation: 0.3,
    fgos: 0.2,
    iqs: 0.1,
  };
}

// Para inversión largo plazo → Priorizar engines estructurales
if (use_case === "long_term_investing") {
  weights = {
    fgos: 0.3,
    competitive_advantage: 0.25,
    moat: 0.2,
    iqs: 0.15,
    valuation: 0.1,
  };
}
```

---

## 📚 Referencias Técnicas

### Papers Académicos

1. **Altman Z-Score:**
   - Altman, E. I. (1968). "Financial Ratios, Discriminant Analysis and the Prediction of Corporate Bankruptcy". Journal of Finance, 23(4), 589-609.

2. **Piotroski F-Score:**
   - Piotroski, J. D. (2000). "Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers". Journal of Accounting Research, 38, 1-41.

3. **ROIC as Moat Indicator:**
   - Mauboussin, M. J. (2016). "The Base Rate Book". Credit Suisse.

### Libros de Referencia

1. **"Competitive Advantage" - Michael Porter:**
   - Framework de moat y ventaja competitiva sostenible

2. **"Quality Investing" - Akre & Housel:**
   - Métricas de calidad y persistencia de retornos

3. **"The Little Book that Builds Wealth" - Pat Dorsey:**
   - Identificación de moats económicos

### Implementaciones de Referencia

- **FactSet:** Quality Score, Efficiency Metrics
- **Morningstar:** Economic Moat Rating, Capital Allocation
- **S&P Capital IQ:** Financial Health Scores

---

## 🔄 Historial de Versiones

### v2.0 (Febrero 2026) - ACTUAL

- ✅ IFS v1.2: Industry-Aware Structural Voting con metadata
- ✅ IQS implementado (scoring fiscal vs industria)
- ✅ Competitive Advantage con 3 ejes (Return, Stability, Capital)
- ✅ Moat con Coherence Check + 3 pilares
- ✅ Quality Brakes (Altman Z + Piotroski F)
- ✅ Fundamentals Maturity classification
- ✅ Valuation con confidence detallado
- ✅ FGOS con low confidence impact tracking

### v1.5 (Enero 2026)

- IFS v1.1: Block voting básico (sin industry awareness)
- FGOS con 4 componentes
- Valuation percentiles básicos

### v1.0 (Diciembre 2025)

- FGOS inicial
- IFS simple (agregación de ventanas)
- Valuation binario (cheap/expensive)

---

## 📝 Notas de Implementación

### Cron Jobs que Invocan Engines

1. **`run-master-cron.ts`** (Diario, 2 AM):
   - Ejecuta secuencialmente todos los pipelines
   - Calcula FGOS, IFS Live, Valuation, Quality Brakes, Fundamentals Maturity

2. **`fmp-bulk.ts`** (Diario, post-universo):
   - Construye snapshots completos
   - Invoca `lib/engine/fintra-brain.ts`

3. **`iqs-backfill.ts`** (Mensual, 1ra semana):
   - Recalcula IQS para todos los FY nuevos
   - Invoca `lib/engine/ifs-fy.ts`

4. **`sector-benchmarks-update.ts`** (Semanal, Domingos):
   - Actualiza benchmarks sectoriales
   - Invoca `lib/engine/buildSectorBenchmark.ts`

### Testing Strategy

**Unit Tests:**

- Cada engine tiene su archivo `.test.ts`
- Focus en edge cases (null handling, low confidence, gaps)

**Integration Tests:**

- `fintra-brain.test.ts`: Pipeline completo
- `fintra-verdict.test.ts`: Interacciones entre engines

**Test Coverage Goal:** 80%+ en `/lib/engine/`

---

## 🚨 Troubleshooting

### Problema 1: FGOS Status 'pending'

**Causa común:**

```typescript
// Sector faltante
if (!profileStructural?.sector) {
  return { fgos_status: "pending", reason: "Sector missing" };
}
```

**Solución:**

1. Verificar que `fintra_snapshots.profile_structural` tiene valor
2. Verificar que `profile_structural.sector` !== null
3. Re-ejecutar `fmp-bulk` para ese ticker

### Problema 2: IFS Live = null

**Causas posibles:**

```typescript
// 1. Sin datos de relative performance
if (relative_vs_sector_1m === null && relative_vs_sector_3m === null && ...) {
  return null;
}

// 2. Menos de 2 bloques válidos
if (validBlocksCount < 2) {
  return null;
}
```

**Solución:**

1. Verificar que `fintra_market_state` tiene valores de `relative_vs_sector_*`
2. Ejecutar `relative-return-calculate.ts` cron

### Problema 3: Valuation Confidence Baja

**Causa común:**

```typescript
// Alta dispersión entre métricas
{
  "pe_percentile": 30,
  "ev_ebitda_percentile": 85,  // Dispersión = 55
  "price_to_fcf_percentile": 40
}
// Confidence penalizado por señales contradictorias
```

**Interpretación:**

- NO es un error, es señal de que las métricas no coinciden
- Requiere análisis manual para entender causas (e.g., estructura de capital atípica)

### Problema 4: Moat Score = null

**Causa común:**

```typescript
// <3 años de historia FY
const validYears = financialHistory.filter(
  (r) => r.period_type === "FY" && r.roic !== null,
);

if (validYears.length < 3) {
  return { score: null, status: "pending" };
}
```

**Solución:**

1. Verificar que `datos_financieros` tiene ≥3 FY con ROIC
2. Backfill datos faltantes con `backfillFinancials.ts`

---

## ✅ Checklist de Validación Post-Cálculo

Antes de considerar un snapshot como "válido":

- [ ] `profile_structural.status !== 'pending'`
- [ ] `profile_structural.sector !== null`
- [ ] `fgos_score !== null` O `fgos_status === 'pending'` con reason clara
- [ ] `fgos_confidence_percent` presente si `fgos_status === 'computed'`
- [ ] Si `quality_brakes.applied === true`, `reasons` array no vacío
- [ ] Si `ifs !== null`, `pressure` en rango [0-3]
- [ ] Si `valuation !== null`, `stage` coherente con `valid_count`
- [ ] `fundamentals_maturity.fgos_maturity` presente
- [ ] Logs completos: `SNAPSHOT START`, `SNAPSHOT OK` o `SNAPSHOT FAILED`

---

## 🎯 Roadmap Futuro

### Q1 2026 (Prioridad Alta)

- [ ] **Dividend Quality Engine:** Sostenibilidad y crecimiento de dividendos
- [ ] **ESG Integration:** Scorecard ambiental, social, governance
- [ ] **Insider Trading Engine:** Tracking de compras/ventas de insiders

### Q2 2026 (Prioridad Media)

- [ ] **Earnings Quality Engine:** Accruals analysis, cash conversion
- [ ] **Management Efficiency Engine:** SG&A ratio, employee productivity
- [ ] **Innovation Engine:** R&D efficiency, patent analysis

### Q3 2026 (Prioridad Baja)

- [ ] **Supply Chain Risk Engine:** Geographic concentration, supplier diversity
- [ ] **Regulatory Risk Engine:** Compliance costs, pending litigations
- [ ] **Macro Sensitivity Engine:** Interest rate, inflation, currency exposure

---

**Fin de la documentación**

Para consultas técnicas específicas, referirse a:

- `DOCUMENTACION_IFS.md` → Detalles de IFS Memory
- `IQS_INFORME.md` → IQS implementation deep dive
- `QUALITY_BRAKES_GUIDE.md` → Guía práctica de Quality Brakes

**Última actualización:** 6 de febrero de 2026  
**Responsable:** Sistema de auditoría técnica Fintra

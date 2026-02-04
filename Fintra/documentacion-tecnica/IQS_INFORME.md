# IQS - Industry Quality Score

## Informe Técnico Completo

**Fecha:** 2 de febrero de 2026  
**Versión:** 1.0  
**Estado:** Implementado y operativo

---

## 1. Resumen Ejecutivo

**IQS (Industry Quality Score)** es una métrica estructural que evalúa la posición competitiva de una empresa dentro de su industria basándose en **datos fiscales reales (FY)**, no en momentum de mercado.

### Propósito

Complementar IFS Live con una evaluación fundamental de largo plazo que responda:

> _"¿Qué tan sólida es esta empresa estructuralmente comparada con sus competidores directos de industria?"_

### Características Clave

- ✅ **Estructural**: Basado en fundamentales fiscales (FY), no precios de mercado
- ✅ **Relativo**: Comparación vs industria (no sector), usando percentiles
- ✅ **Determinista**: Sin interpolación ni inferencias narrativas
- ✅ **Explícito**: Cada fiscal year mapeado individualmente
- ✅ **Complementario**: Coexiste con IFS Live, no lo reemplaza

---

## 2. Arquitectura Conceptual

### 2.1 Separación de Métricas

| Aspecto         | IFS Live           | IQS                 |
| --------------- | ------------------ | ------------------- |
| **Naturaleza**  | Momentum           | Estructural         |
| **Frecuencia**  | Diaria             | Anual (FY)          |
| **Comparación** | Sector             | Industria           |
| **Fuente**      | Precios de mercado | Estados financieros |
| **Horizonte**   | Corto plazo        | Largo plazo         |
| **Volatilidad** | Alta               | Baja                |

### 2.2 Principios Arquitectónicos

#### Principio 1: Separación Temporal

```
IFS Live:  [Snapshot] ──► [Snapshot] ──► [Snapshot]
           (Diario)       (Diario)       (Diario)

IQS:       [FY 2021] ──────────► [FY 2022] ──────────► [FY 2023]
           (Anual)                (Anual)                (Anual)
```

**IFS Live NO se convierte en IQS con el tiempo.**  
Son métricas paralelas, no evolutivas.

#### Principio 2: Explicitación Fiscal

Cada posición está mapeada a un **fiscal year real**:

```json
{
  "fiscal_positions": [
    { "fiscal_year": "2021", "position": "follower", "percentile": 68 },
    { "fiscal_year": "2022", "position": "leader", "percentile": 82 },
    { "fiscal_year": "2023", "position": "leader", "percentile": 85 }
  ]
}
```

**Prohibido:**

- Inferir años intermedios
- Asumir continuidad
- Calcular "trends" (eso es interpretación humana, no dato)

#### Principio 3: Percentiles vs Absolutos

IQS usa **ranking relativo dentro de industria**, no scores absolutos.

**Correcto:**

```typescript
roic_percentile = calculatePercentile(company.roic, industry.roic_distribution);
// Resultado: 82 → "Esta empresa está en el percentil 82 de ROIC vs su industria"
```

**Incorrecto:**

```typescript
roic_score = normalize(company.roic, { min: -10, max: 40, optimal: 25 });
// ❌ Bounds arbitrarios, no relativos a la industria real
```

---

## 3. Algoritmo de Cálculo

### 3.1 Flujo General

```
┌─────────────────┐
│ Fetch FY Data   │ ← Last 5 fiscal years (datos_financieros)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Get Industry    │ ← Tickers en misma industria (fintra_snapshots)
│ Peer Metrics    │   Batch query (NO O(N²) loops)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculate       │ ← Por cada métrica: percentile vs industria
│ Percentiles     │   ROIC, Margin, Growth, Leverage, FCF
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Composite       │ ← Weighted average de percentiles
│ Percentile      │   (30% ROIC + 25% Margin + 20% Growth + 15% Leverage + 10% FCF)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Classify        │ ← Percentile ≥75: Leader
│ Position        │   Percentile ≥35: Follower
└────────┬────────┘   Percentile <35: Laggard
         │
         ▼
┌─────────────────┐
│ Build Result    │ ← IQSResult con fiscal_positions explícitas
└─────────────────┘
```

### 3.2 Pesos de Métricas

Las métricas se ponderan según su importancia estratégica:

| Métrica                | Peso | Justificación                                     |
| ---------------------- | ---- | ------------------------------------------------- |
| **ROIC**               | 30%  | Eficiencia en uso de capital (core profitability) |
| **Operating Margin**   | 25%  | Poder de pricing y estructura de costos           |
| **Revenue Growth YoY** | 20%  | Expansión y captura de mercado                    |
| **Leverage (D/E)**     | 15%  | Salud financiera (invertido: menor deuda = mejor) |
| **FCF Margin**         | 10%  | Generación de caja real                           |

**Métricas Requeridas (Mínimo):**

- ROIC ✅
- Operating Margin ✅

Si faltan, el FY se omite (no se inventa dato).

### 3.3 Clasificación de Posición

Basado en percentile composite dentro de industria:

```typescript
function classifyPosition(percentile: number): IQSPosition {
  if (percentile >= 75) return "leader"; // Top quartile
  if (percentile >= 35) return "follower"; // Middle
  return "laggard"; // Bottom
}
```

**Interpretación:**

- **Leader (LD)**: Top 25% de la industria
- **Follower (FL)**: Middle 40% (percentiles 35-75)
- **Laggard (LG)**: Bottom 35%

### 3.4 Confianza

La confianza se basa **únicamente** en cantidad de fiscal years disponibles:

```typescript
function calculateConfidence(fyCount: number): number {
  return Math.min(100, fyCount * 20);
}
```

| Fiscal Years | Confianza |
| ------------ | --------- |
| 1 FY         | 20%       |
| 2 FY         | 40%       |
| 3 FY         | 60%       |
| 4 FY         | 80%       |
| 5 FY         | 100%      |

**NO se considera:**

- Consistencia de posiciones (eso sería narrativa)
- "Tendencias" (eso sería inferencia)
- Volatilidad histórica (eso sería juicio)

---

## 4. Estructura de Datos

### 4.1 Tipo IQSResult

```typescript
interface IQSResult {
  mode: "fy_industry_structural";

  fiscal_years: string[]; // ["2021", "2022", "2023"]

  fiscal_positions: IQSFiscalYearPosition[];

  current_fy: {
    fiscal_year: string;
    position: IQSPosition;
  };

  confidence: number; // 0-100
}

interface IQSFiscalYearPosition {
  fiscal_year: string; // "2023"
  position: IQSPosition; // "leader" | "follower" | "laggard"
  percentile: number; // 0-100
}
```

### 4.2 Persistencia

**Tabla:** `fintra_snapshots`  
**Columna:** `ifs_fy` (JSONB)

Ejemplo de dato persistido:

```json
{
  "mode": "fy_industry_structural",
  "fiscal_years": ["2021", "2022", "2023"],
  "fiscal_positions": [
    {
      "fiscal_year": "2021",
      "position": "follower",
      "percentile": 68
    },
    {
      "fiscal_year": "2022",
      "position": "leader",
      "percentile": 82
    },
    {
      "fiscal_year": "2023",
      "position": "leader",
      "percentile": 85
    }
  ],
  "current_fy": {
    "fiscal_year": "2023",
    "position": "leader"
  },
  "confidence": 60
}
```

---

## 5. Diferencias con IFS Live

### 5.1 Tabla Comparativa

| Característica          | IFS Live                             | IQS                                       |
| ----------------------- | ------------------------------------ | ----------------------------------------- |
| **Nombre Interno**      | `ifs`                                | `ifs_fy`                                  |
| **Nombre Público**      | IFS                                  | IQS                                       |
| **Etiqueta UI**         | LD / FL / LG                         | Pie chart (🟢🟡🔴)                        |
| **Fuente de Datos**     | Precios diarios + sector performance | Fundamentales anuales (datos_financieros) |
| **Comparación**         | Sector                               | Industria                                 |
| **Temporalidad**        | Snapshot diario                      | Fiscal year anual                         |
| **Horizon Temporal**    | 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y  | Solo FY completos                         |
| **Calculation Trigger** | Cada snapshot (cron diario)          | Cada snapshot (pero usa FY históricos)    |
| **Volatilidad**         | Alta (sigue mercado)                 | Baja (cambia solo con FY)                 |
| **Business Question**   | "¿Quién gana HOY en mercado?"        | "¿Quién es sólido ESTRUCTURALMENTE?"      |

### 5.2 Casos de Uso

#### Cuando Usar IFS Live

- Detectar momentum actual
- Evaluar sentiment de mercado
- Trading de corto plazo
- Análisis técnico complementario

#### Cuando Usar IQS

- Due diligence de largo plazo
- Evaluación fundamental
- Comparación estructural vs competencia
- Inversión value/quality

#### Cuando Ambos Son Importantes

**Divergencias interesantes:**

| IFS Live | IQS     | Interpretación                                         |
| -------- | ------- | ------------------------------------------------------ |
| Leader   | Laggard | "Mercado sobrestima, fundamentales débiles"            |
| Laggard  | Leader  | "Mercado castiga, fundamentales sólidos" (oportunidad) |
| Leader   | Leader  | "Momentum + calidad estructural" (fuerte)              |
| Laggard  | Laggard | "Problemas confirmados en ambos frentes"               |

---

## 6. Implementación Técnica

### 6.1 Archivos Clave

```
lib/engine/
├── ifs-fy.ts              # Motor de cálculo IQS
└── types.ts               # IQSResult, IQSFiscalYearPosition

components/
├── visuals/
│   └── IFSFYPie.tsx       # Pie chart (renombrado IQSPie)
└── tables/
    └── IFSDualCell.tsx    # Dual display (IFS + IQS)

app/api/cron/fmp-bulk/
└── buildSnapshots.ts      # Integración en snapshot builder
```

### 6.2 Función Principal

```typescript
export async function calculateIFS_FY(
  ticker: string,
  industry: string,
): Promise<IQSResult | null>;
```

**Ubicación:** `lib/engine/ifs-fy.ts`

**Returns:**

- `IQSResult` si tiene al menos 1 FY con datos suficientes
- `null` si no hay FY o peer group insuficiente (<3 peers)

**Complexity:**

- Tiempo: O(N) por ticker (batch queries)
- Espacio: O(FY × Peers) para distributions (limitado a 5 FY)

### 6.3 Optimización (TODO)

**Current:** Queries por ticker (funcional pero subóptimo)

**Futuro:** Precomputed benchmarks

```sql
CREATE TABLE industry_fy_benchmarks (
  industry TEXT,
  fiscal_year TEXT,
  roic_distribution NUMERIC[],
  margin_distribution NUMERIC[],
  growth_distribution NUMERIC[],
  leverage_distribution NUMERIC[],
  fcf_distribution NUMERIC[],
  sample_size INTEGER,
  computed_at TIMESTAMP,
  PRIMARY KEY (industry, fiscal_year)
);
```

**Ventajas:**

- O(1) lookup vs O(Peers) query
- Cálculo batch una sola vez
- Histórico inmutable (no recalcula)

---

## 7. UI/UX

### 7.1 Visualización Dual en TablaIFS

**Columna: "COMPETITIVE"** (reemplaza antigua columna "IFS")

Formato visual: `LD / 🟢🟢🟢`

```
┌──────────────────────────────────────┐
│      COMPETITIVE COLUMN              │
├──────────────────────────────────────┤
│  [ LD ]  /  [ 🟢🟢🟢 ]              │
│    ↑          ↑                      │
│  IFS Live    IQS                     │
│ (Momentum) (Structural)              │
└──────────────────────────────────────┘
```

**LEFT SIDE - IFS Live:**

- Badge circular con 2 letras
- **LD** = Leader (verde/emerald)
- **FL** = Follower (amarillo/amber)
- **LG** = Laggard (rojo/red)
- Tooltip: "IFS Live\nCurrent competitive position\nBenchmark: Sector\nFrequency: Daily snapshot"

**SEPARATOR:**

- Slash "/" visible (texto gris)
- Separación semántica obligatoria

**RIGHT SIDE - IQS:**

- Pie chart con porciones iguales
- Una porción por fiscal year real (1-5 FY)
- Color por posición: 🟢 Leader, 🟡 Follower, 🔴 Laggard
- Orden cronológico: oldest → newest
- Tooltip hover: "FY 2023: LEADER\nYears: 2021, 2022, 2023\nConfidence: 60%"

**Estados Empty:**

- Si no hay IFS Live: "—"
- Si no hay IQS: "—" (con tooltip explicativo)

### 7.2 Componente IFSDualCell

**Ubicación:** `components/tables/IFSDualCell.tsx`

**Props:**

```typescript
interface IFSDualCellProps {
  ifs: IFSData | null; // IFS Live
  ifs_fy: IQSResult | null; // IQS
  size?: "compact" | "standard" | "large";
}
```

**Responsabilidades:**

- ✅ Renderizar badge IFS Live (LD/FL/LG)
- ✅ Renderizar separator "/"
- ✅ Renderizar IQS pie chart
- ✅ Manejar nulls gracefully
- ❌ NO calcular nada
- ❌ NO inferir datos

**Tamaños:**

- `compact`: Usado en TablaIFS (pie 24px, badge 7x5)
- `standard`: Uso general (pie 32px, badge 10x8)
- `large`: Vistas detalladas (pie 48px, badge 12x10)

### 7.3 Tabla de Stocks (TablaIFS)

**Columnas actuales:**

| Columna         | Contenido                             |
| --------------- | ------------------------------------- |
| TICKER          | Símbolo (ej: AAPL)                    |
| R.V             | Relative Valuation (5 barras)         |
| **COMPETITIVE** | **IFS Live + IQS (dual display)**     |
| STAGE           | Life Cycle (Mature, Developing, etc.) |
| FGOS            | Score + barra + sentiment icon        |
| EOD             | Precio de cierre                      |
| MKT CAP         | Capitalización formateada             |

**Uso en código:**

```tsx
<IFSDualCell ifs={snapshot.ifs} ifs_fy={snapshot.ifs_fy} size="compact" />
```

**Ejemplo de fila completa:**

```
AAPL | ⚫⚫⚫⚫⚫ | LD / 🟢🟢🟢 | Mature | 90 ↑ | 259.48 | 3.8T
```

**Interpretación:**

- "AAPL es líder hoy en momentum de mercado (LD)"
- "Estructuralmente fuerte en su industria en últimos 3 años fiscales (🟢🟢🟢)"
- "Empresa madura (Mature) con FGOS de 90 (optimista ↑)"

---

## 8. Casos de Uso Reales

### 8.1 Caso: AAPL (Apple)

**Expectativa:** Empresa madura, líder estructural consistente

**Resultado Esperado:**

```json
{
  "mode": "fy_industry_structural",
  "fiscal_years": ["2021", "2022", "2023"],
  "fiscal_positions": [
    { "fiscal_year": "2021", "position": "leader", "percentile": 88 },
    { "fiscal_year": "2022", "position": "leader", "percentile": 92 },
    { "fiscal_year": "2023", "position": "leader", "percentile": 91 }
  ],
  "current_fy": { "fiscal_year": "2023", "position": "leader" },
  "confidence": 60
}
```

**Interpretación:**

- Top quartile consistente en Consumer Electronics
- Márgenes operativos superiores a peers
- ROIC excepcional (ecosystem lock-in)
- Pie chart: 🟢🟢🟢 (3 porciones verdes)

### 8.2 Caso: TSLA (Tesla)

**Expectativa:** Empresa en transición, posición variable por FY

**Resultado Esperado:**

```json
{
  "fiscal_positions": [
    { "fiscal_year": "2021", "position": "follower", "percentile": 55 },
    { "fiscal_year": "2022", "position": "leader", "percentile": 78 },
    { "fiscal_year": "2023", "position": "leader", "percentile": 82 }
  ]
}
```

**Interpretación:**

- Mejora estructural visible (follower → leader)
- Escala operativa mejorando márgenes
- Pie chart: 🟡🟢🟢 (mejora visible)

### 8.3 Caso: F (Ford)

**Expectativa:** Incumbent tradicional, rezagado estructuralmente

**Resultado Esperado:**

```json
{
  "fiscal_positions": [
    { "fiscal_year": "2021", "position": "laggard", "percentile": 28 },
    { "fiscal_year": "2022", "position": "follower", "percentile": 42 },
    { "fiscal_year": "2023", "position": "follower", "percentile": 48 }
  ]
}
```

**Interpretación:**

- Bottom tier moviéndose a middle (recuperación)
- Márgenes comprimidos vs nuevos entrantes
- Pie chart: 🔴🟡🟡 (esfuerzo de recuperación)

---

## 9. Validación y Testing

### 9.1 Test Script

**Ubicación:** `scripts/test-ifs-fy.ts`

**Ejecutar:**

```bash
pnpm tsx scripts/test-ifs-fy.ts
```

**Output Esperado:**

```
🧪 Testing IQS - Industry Quality Score (STRUCTURAL)
================================================================================

📊 AAPL (Consumer Electronics)
--------------------------------------------------------------------------------
   ✅ Mode: fy_industry_structural
   📅 Fiscal Years: 2021, 2022, 2023
   📊 Positions: 🟢 🟢 🟢
   🎯 Current: FY 2023 - LEADER
   🎲 Confidence: 60%
   📈 Details:
      🟢 FY 2021: leader (88th percentile)
      🟢 FY 2022: leader (92th percentile)
      🟢 FY 2023: leader (91th percentile)
   💡 Medium confidence - 3 FY available
```

### 9.2 Queries de Validación

**Coverage Check:**

```sql
SELECT
  COUNT(*) FILTER (WHERE ifs_fy IS NOT NULL) as with_iqs,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ifs_fy IS NOT NULL) / COUNT(*), 2) as coverage_pct
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE;
```

**Sample Data:**

```sql
SELECT
  ticker,
  ifs->>'position' as ifs_live,
  ifs_fy->>'current_fy' as iqs_current,
  ifs_fy->'fiscal_years' as iqs_years,
  ifs_fy->>'confidence' as iqs_confidence
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND ifs_fy IS NOT NULL
LIMIT 10;
```

**Divergences (Interesting Insights):**

```sql
-- Casos donde momentum y estructura difieren
SELECT
  ticker,
  ifs->>'position' as momentum,
  ifs_fy->'current_fy'->>'position' as structural,
  profile_structural->'classification'->>'industry' as industry
FROM fintra_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND ifs->>'position' != ifs_fy->'current_fy'->>'position'
ORDER BY ticker;
```

---

## 10. Reglas de Oro

### ✅ DO (Hacer)

1. **Usar percentiles relativos a industria**
   - Siempre comparar contra distribución real de peers
2. **Mapear explícitamente fiscal years**
   - Cada posición debe tener `fiscal_year` string

3. **Retornar null si datos insuficientes**
   - Mejor null que inventar datos

4. **Batch queries para peers**
   - Evitar O(N²) loops

5. **Confianza basada en FY count**
   - No en narrativas

### ❌ DON'T (No Hacer)

1. **NO usar bounds absolutos**
   - ❌ `normalize(value, { min: -10, max: 40 })`
   - ✅ `calculatePercentile(value, industry_distribution)`

2. **NO inferir años intermedios**
   - Si faltan datos de FY 2022, omitir (no aproximar)

3. **NO calcular "trends" como campo persistido**
   - Interpretación humana, no dato objetivo

4. **NO mezclar sector e industria**
   - IQS es SOLO industria

5. **NO backfill histórico**
   - Snapshots pasados no se recalculan con nueva lógica

---

## 11. Roadmap

### Fase Actual (Implemented ✅)

- [x] Motor de cálculo IQS
- [x] Tipos explícitos (IQSResult)
- [x] Integración en buildSnapshots
- [x] UI dual (IFS + IQS)
- [x] Migración DB (columna ifs_fy)

### Fase 2 (Q1 2026)

- [ ] Precomputed industry benchmarks table
- [ ] Cron job para actualizar benchmarks mensualmente
- [ ] Cache layer para distributions

### Fase 3 (Q2 2026)

- [ ] API endpoint público `/api/iqs/:ticker`
- [ ] Historical IQS chart (FY timeline)
- [ ] IQS vs IFS divergence alerts

### Fase 4 (Future)

- [ ] Machine learning para predicción de próximo FY position
- [ ] IQS Score decomposition (drill-down por métrica)
- [ ] Industry benchmark reports públicos

---

## 12. Contacto y Mantenimiento

**Owner:** Fintra Engineering Team  
**Documentación:** `docs/IQS_INFORME.md`  
**Código:** `lib/engine/ifs-fy.ts`

**Para reportar issues:**

1. Verificar que industria esté clasificada
2. Verificar que haya datos FY en `datos_financieros`
3. Verificar que peer group tenga ≥3 empresas

**Logs relevantes:**

```
✅ IQS: FY 2023 - leader (3 FY, confidence: 60%)
⚠️  IQS: Insufficient FY data or peer group
⚠️  IQS: Missing industry classification
❌ IQS calculation failed: [error details]
```

---

## Apéndice A: Glosario

- **FY (Fiscal Year):** Año fiscal completo de la empresa
- **Percentile:** Posición relativa en distribución (0-100)
- **Industry:** Clasificación específica (e.g., "Semiconductors")
- **Sector:** Clasificación amplia (e.g., "Technology")
- **ROIC:** Return on Invested Capital
- **Structural:** Basado en fundamentales, no momentum
- **Momentum:** Basado en movimiento de precios

## Apéndice B: Referencias

- **Principio Fundamental Fintra:** "Fintra no inventa datos"
- **IFS Live Documentation:** `docs/metodologia/ifs.md`
- **FGOS Documentation:** `docs/metodologia/fgos.md`
- **Fintra Copilot Instructions:** `.github/copilot-instructions.md`

---

**Fin del Informe**  
_Documento vivo - Se actualiza con cambios mayores en arquitectura IQS_

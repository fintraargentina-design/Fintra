# 🛠️ SOLUCIÓN PARA EL PROBLEMA DE SOLVENCY

**Fecha:** 2026-01-31
**Problema:** 100% de snapshots tienen `solvency = NULL`
**Causa Raíz:** El endpoint `fmp_bulk` NO incluye los campos necesarios para calcular Interest Coverage

---

## 🔍 **PROBLEMA IDENTIFICADO**

### Datos Faltantes en `datos_financieros`

**Para AAPL (ejemplo):**
```
✅ Disponible:
  - revenue: 391B
  - net_income: 94B
  - gross_margin: 46.21%
  - operating_margin: 32%
  - debt_to_equity: 2.09
  - total_debt: 119B
  - total_equity: 57B

❌ Faltante (NULL):
  - interest_coverage: NULL
  - ebitda: NULL
  - capex: NULL
  - invested_capital: NULL
```

### ¿Por Qué Faltan?

El endpoint de FMP que se usa en `fmp-bulk` probablemente devuelve **ratios y métricas pre-calculadas**, pero NO los datos brutos de:
- EBIT (Operating Income)
- Interest Expense
- EBITDA
- CAPEX

**Sin estos datos NO se puede calcular Interest Coverage:**
```
Interest Coverage = EBIT / Interest Expense
```

---

## 💡 **SOLUCIONES PROPUESTAS**

### ✅ **SOLUCIÓN 1: Usar Endpoint de FMP con Income Statement Completo** (RECOMENDADA)

#### Descripción
FMP tiene un endpoint que devuelve el **Income Statement completo** con todos los campos necesarios.

#### Endpoint de FMP
```
GET /api/v3/income-statement/{symbol}?period=annual
GET /api/v3/income-statement/{symbol}?period=quarter&limit=4
```

#### Campos que devuelve
```json
{
  "symbol": "AAPL",
  "date": "2024-09-28",
  "revenue": 391035000000,
  "netIncome": 93736000000,
  "operatingIncome": 125256000000,     // ← EBIT
  "interestExpense": 3933000000,       // ← Interest Expense
  "ebitda": 137532000000,              // ← EBITDA
  ...
}
```

#### Implementación

**1. Agregar a `fmp-bulk` el fetch de Income Statement:**

```typescript
// En app/api/cron/fmp-bulk/core.ts

// Después de fetch de ratios/metrics
const incomeStatements = await fetchIncomeStatement(ticker);

// Normalizar y agregar campos
const normalized = {
  ...existingData,

  // Agregar campos de Income Statement
  operating_income: incomeStatements.operatingIncome,
  interest_expense: incomeStatements.interestExpense,
  ebitda: incomeStatements.ebitda,

  // Calcular Interest Coverage
  interest_coverage: incomeStatements.interestExpense > 0
    ? incomeStatements.operatingIncome / incomeStatements.interestExpense
    : null
};
```

**2. Actualizar schema de `datos_financieros`:**

```sql
ALTER TABLE datos_financieros
ADD COLUMN IF NOT EXISTS operating_income NUMERIC,
ADD COLUMN IF NOT EXISTS interest_expense NUMERIC;
```

**3. Actualizar `deriveFinancialMetrics.ts`:**

```typescript
// Usar los nuevos campos
const interestCoverage = params.operating_income && params.interest_expense
  ? params.operating_income / params.interest_expense
  : null;
```

#### Ventajas
- ✅ Datos precisos directamente de FMP
- ✅ No requiere cálculos complejos
- ✅ Incluye EBITDA y otros campos útiles

#### Desventajas
- ⚠️ Requiere llamadas adicionales a FMP API (más consumo de rate limit)
- ⚠️ Modifica el schema de la tabla

---

### ✅ **SOLUCIÓN 2: Calcular con Datos Disponibles** (ALTERNATIVA)

#### Descripción
Usar los datos que **YA tenemos** para aproximar Interest Coverage.

#### Aproximación Posible

```
EBIT ≈ Operating Margin × Revenue
Interest Coverage ≈ EBIT / (Net Income - EBIT + taxes)
```

**PROBLEMA:** No tenemos `Interest Expense` directo, necesitaríamos inferirlo, lo cual es impreciso.

#### No Recomendado
❌ Aproximaciones pueden ser muy imprecisas
❌ No cumple con la filosofía de "No Inventar Datos" de Fintra

---

### ✅ **SOLUCIÓN 3: Usar Endpoint de Ratios TTM de FMP**

#### Descripción
FMP tiene un endpoint específico de **ratios TTM** que podría incluir Interest Coverage.

#### Endpoint
```
GET /api/v3/ratios-ttm/{symbol}
```

#### Verificar si devuelve
```json
{
  "symbol": "AAPL",
  "interestCoverageTTM": 31.85,  // ← ¿Existe?
  "debtEquityRatioTTM": 2.09,
  ...
}
```

#### Implementación

**1. Verificar primero si existe:**

```bash
curl "https://financialmodelingprep.com/api/v3/ratios-ttm/AAPL?apikey=YOUR_KEY"
```

**2. Si existe, agregar al fetch de `fmp-bulk`:**

```typescript
// Buscar en el response de ratios TTM
const interestCoverage = ratios.interestCoverageTTM ?? null;
```

#### Ventajas
- ✅ No requiere cálculos manuales
- ✅ Pre-calculado por FMP
- ✅ Solo una llamada adicional

#### Desventajas
- ⚠️ Solo disponible si FMP lo incluye (verificar)

---

## 🎯 **PLAN DE ACCIÓN RECOMENDADO**

### PASO 1: Verificar qué incluye FMP (HOY - 10 minutos)

```bash
# 1. Verificar ratios-ttm
curl "https://financialmodelingprep.com/api/v3/ratios-ttm/AAPL?apikey=scYafUs9cEq4PzLVbZ8SPlmMh8r9Jm8V" | jq '.'

# 2. Verificar income-statement
curl "https://financialmodelingprep.com/api/v3/income-statement/AAPL?period=annual&limit=1&apikey=scYafUs9cEq4PzLVbZ8SPlmMh8r9Jm8V" | jq '.'

# Buscar campos:
# - interestCoverageTTM
# - operatingIncome
# - interestExpense
```

---

### PASO 2: Implementar Solución (MAÑANA - 2-3 horas)

#### Si `ratios-ttm` incluye `interestCoverageTTM`:

```typescript
// En app/api/cron/fmp-bulk/core.ts
const ratiosTTM = await fetchRatiosTTM(ticker);

normalized.interest_coverage = ratiosTTM.interestCoverageTTM ?? null;
```

#### Si NO, usar Income Statement:

```typescript
// En app/api/cron/fmp-bulk/core.ts
const incomeStatement = await fetchIncomeStatement(ticker, 'annual', 1);

normalized.operating_income = incomeStatement[0]?.operatingIncome;
normalized.interest_expense = incomeStatement[0]?.interestExpense;
normalized.ebitda = incomeStatement[0]?.ebitda;
normalized.interest_coverage = div(
  incomeStatement[0]?.operatingIncome,
  incomeStatement[0]?.interestExpense
);
```

---

### PASO 3: Actualizar Schema de DB (MAÑANA - 15 minutos)

```sql
-- Agregar columnas faltantes
ALTER TABLE datos_financieros
ADD COLUMN IF NOT EXISTS operating_income NUMERIC,
ADD COLUMN IF NOT EXISTS interest_expense NUMERIC;

-- Si no existe, crear índices
CREATE INDEX IF NOT EXISTS idx_datos_financieros_period
ON datos_financieros(ticker, period_type, period_end_date);
```

---

### PASO 4: Backfill Datos Históricos (SIGUIENTE SEMANA - 4-6 horas)

```bash
# Ejecutar cron de fmp-bulk nuevamente para rellenar datos
curl -X GET http://localhost:3000/api/cron/fmp-bulk

# Tiempo estimado: 4-6 horas para ~15,000 tickers
```

---

### PASO 5: Recomputar Snapshots (SIGUIENTE SEMANA - 2-4 horas)

```bash
# Una vez que interest_coverage esté poblado, recomputar snapshots
curl -X POST http://localhost:3000/api/admin/reprocess-snapshots \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -d '{
    "dryRun": false,
    "batchSize": 100
  }'
```

---

### PASO 6: Validar (SIGUIENTE SEMANA - 30 minutos)

```sql
-- Verificar que interest_coverage está poblado
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE interest_coverage IS NOT NULL) as con_interest_coverage,
  ROUND(AVG(interest_coverage), 2) as promedio
FROM datos_financieros
WHERE period_type = 'TTM';

-- Verificar que solvency se calculó
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE (fgos_components->>'solvency')::numeric IS NOT NULL) as con_solvency
FROM fintra_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days';
```

**Resultado esperado:**
```
interest_coverage: >80% poblado
solvency en snapshots: >80% poblado
```

---

## 📊 **ESTIMACIÓN DE TIEMPOS**

| Tarea | Tiempo | Responsable |
|-------|--------|-------------|
| Verificar endpoints FMP | 10 min | Dev |
| Implementar fetch de campos | 2-3 horas | Dev |
| Actualizar schema DB | 15 min | Dev |
| Testing local | 1 hora | Dev |
| Deploy a producción | 30 min | Dev/Ops |
| Backfill datos históricos | 4-6 horas | Automated |
| Recomputar snapshots | 2-4 horas | Automated |
| Validación y QA | 1 hora | Dev |
| **TOTAL** | **~12-16 horas** | |

**Distribución:**
- Trabajo manual: ~5 horas
- Procesos automatizados: ~7-11 horas (desatendido)

---

## 🚨 **CONSIDERACIONES IMPORTANTES**

### Rate Limiting de FMP

Si agregamos llamadas adicionales (Income Statement), el rate limit de FMP puede ser un problema.

**Estrategia:**
1. Verificar plan actual de FMP (cuántas requests/min)
2. Agregar delays entre requests si es necesario
3. Considerar cachear responses por 24 horas

```typescript
// Agregar delay entre requests
await new Promise(resolve => setTimeout(resolve, 200)); // 200ms = 5 req/s
```

---

### Efficiency Component

**Nota:** `efficiency` TAMBIÉN está NULL en 100% de snapshots.

**Verificar qué métricas necesita efficiency:**

```typescript
// En fgos-recompute.ts, buscar cálculo de efficiency
// Probablemente necesita:
// - roic
// - fcf_margin
// - asset_turnover (?)
```

**Agregar a la solución si faltan campos.**

---

## ✅ **CHECKLIST DE IMPLEMENTACIÓN**

### Pre-implementación
- [ ] Verificar que `ratios-ttm` incluye `interestCoverageTTM`
- [ ] Si NO, verificar que `income-statement` incluye `operatingIncome` e `interestExpense`
- [ ] Decidir cuál endpoint usar (ratios-ttm vs income-statement)

### Implementación
- [ ] Actualizar `app/api/cron/fmp-bulk/core.ts` para fetch de campos
- [ ] Actualizar `app/api/cron/fmp-bulk/normalizeFinancials.ts` para guardar campos
- [ ] Agregar columnas a `datos_financieros` schema
- [ ] Actualizar tipos en `lib/fmp/types.ts`
- [ ] Testing local con 3-5 tickers

### Deploy
- [ ] Commit y push cambios
- [ ] Ejecutar migrations de DB
- [ ] Deploy a producción
- [ ] Ejecutar `fmp-bulk` para backfill
- [ ] Monitorear logs para errores

### Post-Deploy
- [ ] Validar que `interest_coverage` se pobló
- [ ] Ejecutar reprocessing de snapshots
- [ ] Validar que `solvency` se calculó
- [ ] Auditoría final (ejecutar `audit-supabase-tables.ts`)

---

## 📞 **SIGUIENTE PASO INMEDIATO**

**AHORA (siguientes 10 minutos):**

```bash
# Verificar qué devuelve FMP
curl "https://financialmodelingprep.com/api/v3/ratios-ttm/AAPL?apikey=scYafUs9cEq4PzLVbZ8SPlmMh8r9Jm8V" > fmp-ratios-ttm.json

curl "https://financialmodelingprep.com/api/v3/income-statement/AAPL?period=annual&limit=1&apikey=scYafUs9cEq4PzLVbZ8SPlmMh8r9Jm8V" > fmp-income-statement.json

# Analizar resultados
cat fmp-ratios-ttm.json | jq '.[] | {interestCoverageTTM, debtEquityRatioTTM}'
cat fmp-income-statement.json | jq '.[0] | {operatingIncome, interestExpense, ebitda}'
```

**Compartir resultados para decidir la implementación.**

---

**Generado por:** Claude Sonnet 4.5
**Fecha:** 2026-01-31
**Archivo:** SOLUCION_SOLVENCY.md

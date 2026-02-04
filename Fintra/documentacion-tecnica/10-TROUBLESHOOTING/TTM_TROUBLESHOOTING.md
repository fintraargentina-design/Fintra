# 🔧 TTM Valuation - Guía de Resolución de Problemas

**Última actualización:** 2026-02-04  
**Motor:** `computeTTMv2` (lib/engine/ttm.ts)  
**Tabla:** `datos_valuacion_ttm`

---

## 📋 ÍNDICE

1. [Data Gaps Comunes](#data-gaps-comunes)
2. [Errores de Backfill](#errores-de-backfill)
3. [Valores NULL en Ratios](#valores-null-en-ratios)
4. [Valores Negativos o Extremos](#valores-negativos-o-extremos)
5. [Performance Issues](#performance-issues)
6. [Validación de Datos](#validación-de-datos)

---

## 1. Data Gaps Comunes

### 1.1 EPS/PE Ratio Missing (NULL)

**Síntoma:**
```sql
SELECT ticker, valuation_date, eps_ttm, pe_ratio
FROM datos_valuacion_ttm
WHERE ticker = 'AAPL' AND eps_ttm IS NULL;
-- Resultado: 37 de 40 registros con NULL
```

**Causa:**
- Campo `weighted_shares_out` faltante en `datos_financieros`
- EPS = net_income_ttm / shares_outstanding
- Si shares = NULL → EPS = NULL → PE = NULL

**Diagnóstico:**
```sql
-- Verificar cobertura de shares
SELECT 
  COUNT(*) as total_quarters,
  COUNT(weighted_shares_out) as with_shares,
  ROUND(100.0 * COUNT(weighted_shares_out) / COUNT(*), 2) as coverage_pct
FROM datos_financieros
WHERE ticker = 'AAPL' AND period_type = 'Q';
```

**Solución:**
```bash
# Backfill shares outstanding histórico (PENDIENTE - script por crear)
npx tsx scripts/backfill/backfill-shares-outstanding.ts
```

**Workaround temporal:**
- Usar `price_to_sales` o `price_to_fcf` para análisis
- PE solo confiable desde Q3 2023 en adelante (~52% cobertura global)

---

### 1.2 EV/EBITDA Missing (NULL)

**Síntoma:**
```sql
SELECT ticker, ev_ebitda, enterprise_value, net_debt
FROM datos_valuacion_ttm
WHERE ticker = 'AAPL';
-- Resultado: Todos NULL
```

**Causa:**
- Campo `cash_and_equivalents` faltante en `datos_financieros`
- net_debt = total_debt - cash_and_equivalents
- Si cash = NULL → net_debt = NULL → EV = NULL → EV/EBITDA = NULL

**Diagnóstico:**
```sql
-- Verificar cobertura de cash
SELECT 
  COUNT(*) as total_quarters,
  COUNT(cash_and_equivalents) as with_cash,
  ROUND(100.0 * COUNT(cash_and_equivalents) / COUNT(*), 2) as coverage_pct
FROM datos_financieros
WHERE ticker = 'AAPL' AND period_type = 'Q';
-- Resultado actual: 0% (columna existe pero vacía)
```

**Solución:**
```bash
# Backfill cash histórico (CRÍTICO - Ver PENDIENTES.md)
npx tsx scripts/backfill/backfill-cash-equivalents.ts
```

---

### 1.3 Price Data Missing

**Síntoma:**
```
[AAPL] Skipping 2015-03-31: no price data
```

**Causa:**
- Ticker no tiene histórico de precios en `prices_daily`
- Fecha específica no tiene datos (feriado, delisting, etc)

**Diagnóstico:**
```sql
-- Ver rango de precios disponibles
SELECT ticker, MIN(price_date), MAX(price_date), COUNT(*)
FROM prices_daily
WHERE ticker = 'AAPL'
GROUP BY ticker;
```

**Solución:**
```bash
# Backfill precios históricos
npx tsx scripts/backfill-ticker-full.ts --ticker=AAPL
```

**Nota:** Si el ticker fue delisted, es ESPERADO que no haya precios recientes.

---

## 2. Errores de Backfill

### 2.1 "Error: Missing required columns"

**Síntoma:**
```
Error: Missing required columns: weighted_shares_out, cash_and_equivalents
Process exits...
```

**Causa:** Migración no aplicada

**Solución:**
```bash
# Verificar schema
npx supabase db pull

# Aplicar migraciones faltantes
npx supabase migration up

# O usar MCP tool si está disponible
```

---

### 2.2 "Query timed out" en ticker específico

**Síntoma:**
```
[MSFT] SNAPSHOT START
[MSFT] Error: Query timed out
Process exits...
```

**Causa:** Ticker con muchos quarters (>100) excede timeout

**Solución A:** Skip ticker y continuar
```bash
# Modificar script temporalmente (línea ~430)
if (ticker === 'MSFT') continue;
```

**Solución B:** Aumentar timeout
```typescript
// lib/supabase-admin.ts
const supabaseAdmin = createClient(url, key, {
  db: { 
    timeout: 60000  // Aumentar a 60 segundos
  }
});
```

---

### 2.3 Script se detiene después de 100 tickers

**Síntoma:**
```
[100/100] Last ticker processed
✨ Backfill Complete!
```

**Causa:** `MAX_TICKERS_PER_RUN = 100` (safety limit)

**Solución:** 
**DESDE Feb 4:** Script ahora es automático, ejecuta batches de 100 hasta completar todos.

```bash
# Simplemente ejecutar una vez
npx tsx scripts/backfill/backfill-ttm-valuation.ts
# Procesará TODOS los tickers pendientes automáticamente
```

**Alternativa:** Aumentar límite manualmente (línea 37)
```typescript
const MAX_TICKERS_PER_RUN = 500; // Aumentar si tienes suficiente RAM
```

---

## 3. Valores NULL en Ratios

### 3.1 ¿Por qué hay NULLs si los datos básicos existen?

**Regla fundamental:** Fintra NO inventa datos.

**Casos válidos de NULL:**

1. **TTM incompleto (<4 quarters):**
```sql
-- Si empresa tiene solo 2 quarters cerrados
-- TTM = NULL (correcto, NO aproximar)
```

2. **Métrica NULL en algún quarter:**
```sql
-- Quarter 1: net_income = 100
-- Quarter 2: net_income = NULL  ← Dato faltante
-- Quarter 3: net_income = 120
-- Quarter 4: net_income = 110
-- → net_income_ttm = NULL (propagación correcta)
```

3. **Denominador NULL:**
```sql
-- net_income_ttm = 500 (OK)
-- shares_outstanding = NULL (falta dato)
-- → eps_ttm = NULL (no se puede calcular)
```

**Verificación:**
```sql
-- Ver por qué un ratio específico es NULL
SELECT 
  ticker,
  valuation_date,
  net_income_ttm,  -- ¿Es NULL?
  ebitda_ttm,      -- ¿Es NULL?
  price,           -- ¿Es NULL?
  pe_ratio,        -- NULL esperado si net_income o price es NULL
  ev_ebitda        -- NULL esperado si ebitda o cash es NULL
FROM datos_valuacion_ttm
WHERE ticker = 'AAPL' AND valuation_date = '2023-03-31';
```

---

## 4. Valores Negativos o Extremos

### 4.1 PE Ratio negativo

**Síntoma:**
```sql
SELECT ticker, pe_ratio FROM datos_valuacion_ttm 
WHERE pe_ratio < 0;
-- Resultado: 5,234 registros con PE negativo
```

**Causa:** Net income negativo (empresa con pérdidas)

**¿Es un error?** NO - Es comportamiento correcto.

**Interpretación:**
- PE = price / eps
- Si net_income < 0 → eps < 0 → PE < 0
- Empresa está perdiendo dinero

**Filtrado en queries:**
```sql
-- PE válido solo si positivo y razonable
SELECT * FROM datos_valuacion_ttm
WHERE pe_ratio > 0 AND pe_ratio < 100;
```

---

### 4.2 PE Ratio extremo (>1000 o <-1000)

**Síntoma:**
```sql
SELECT ticker, pe_ratio FROM datos_valuacion_ttm 
WHERE ABS(pe_ratio) > 1000;
-- Resultado: 856 registros
```

**Causa:** Net income muy pequeño (casi breakeven)

**Ejemplo:**
- Price = $100
- EPS = $0.01
- PE = 100 / 0.01 = 10,000

**¿Es un error?** NO - Matemáticamente correcto.

**Solución en análisis:**
```sql
-- Excluir PE extremos (umbral arbitrario)
WHERE pe_ratio BETWEEN 0 AND 100
```

---

### 4.3 EV/EBITDA negativo

**Síntoma:**
```sql
SELECT ticker, ev_ebitda, enterprise_value, ebitda_ttm
FROM datos_valuacion_ttm
WHERE ev_ebitda < 0;
```

**Causas posibles:**
1. **EV negativo:** net_debt > market_cap (empresa con mucho cash)
2. **EBITDA negativo:** Empresa con pérdidas operativas

**¿Es válido?**
- Sí, ambos casos son posibles
- EV negativo: Empresa tiene más cash que su valor de mercado
- EBITDA negativo: Empresa pierde dinero antes de intereses/impuestos

---

## 5. Performance Issues

### 5.1 Backfill muy lento

**Síntoma:** 100 tickers tarda >1 hora

**Causas:**
1. Delay de 150ms entre tickers (intencional para Supabase throttling)
2. Queries lentas en `prices_daily` (falta índice)
3. Ticker con muchos quarters (>100)

**Solución:**
```sql
-- Crear índice en prices_daily (si no existe)
CREATE INDEX IF NOT EXISTS idx_prices_daily_ticker_date 
ON prices_daily(ticker, price_date DESC);

-- Verificar índices
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'prices_daily';
```

---

### 5.2 RAM spike al procesar

**Síntoma:** Proceso killed por OOM (Out of Memory)

**Causa:** `MAX_TICKERS_PER_RUN` muy alto

**Solución:**
```typescript
// Reducir batch size (línea 37)
const MAX_TICKERS_PER_RUN = 50; // Reducir de 100 a 50
```

---

## 6. Validación de Datos

### 6.1 ¿Cómo verificar que TTM está correcto?

**Test manual:**
```sql
-- Verificar suma de quarters para AAPL Q1 2024
WITH quarters AS (
  SELECT period_end_date, revenue, net_income
  FROM datos_financieros
  WHERE ticker = 'AAPL' 
    AND period_type = 'Q'
    AND period_end_date <= '2024-03-31'
  ORDER BY period_end_date DESC
  LIMIT 4
)
SELECT 
  SUM(revenue) as manual_revenue_ttm,
  SUM(net_income) as manual_net_income_ttm
FROM quarters;

-- Comparar con datos_valuacion_ttm
SELECT revenue_ttm, net_income_ttm
FROM datos_valuacion_ttm
WHERE ticker = 'AAPL' AND valuation_date = '2024-03-31';

-- Deben coincidir exactamente
```

---

### 6.2 ¿Cómo identificar data gaps por sector?

```sql
-- Cobertura de PE por sector
SELECT 
  cp.sector,
  COUNT(*) as total_records,
  COUNT(ttm.pe_ratio) as with_pe,
  ROUND(100.0 * COUNT(ttm.pe_ratio) / COUNT(*), 2) as pe_coverage_pct
FROM datos_valuacion_ttm ttm
JOIN company_profiles cp ON ttm.ticker = cp.ticker
GROUP BY cp.sector
ORDER BY pe_coverage_pct ASC;

-- Sectores con baja cobertura requieren backfill de shares
```

---

### 6.3 ¿Cuántos registros debería tener cada ticker?

**Estimado:**
- Ticker activo desde 2014: ~40 quarters = 40 registros TTM
- Ticker activo desde 2020: ~16 quarters = 16 registros TTM
- IPO reciente (2023): ~4 quarters = 4 registros TTM

**Verificación:**
```sql
-- Ver distribución de registros por ticker
SELECT 
  ticker,
  COUNT(*) as ttm_records,
  MIN(valuation_date) as first_ttm,
  MAX(valuation_date) as last_ttm
FROM datos_valuacion_ttm
GROUP BY ticker
ORDER BY ttm_records DESC
LIMIT 20;
```

---

## 📝 REGLAS DE ORO TTM

1. **NULL es válido:** NO es un error, significa dato faltante
2. **No aproximar:** <4 quarters → NULL (no estimar)
3. **Propagación de NULL:** Si 1 quarter tiene NULL → TTM es NULL
4. **PE negativo:** Válido (empresa con pérdidas)
5. **PE extremo:** Válido pero filtrar en análisis (>100 o <0)
6. **Idempotencia:** Re-ejecutar backfill es seguro (salta existentes)

---

## 🔗 REFERENCIAS

- Motor canónico: [lib/engine/ttm.ts](../lib/engine/ttm.ts)
- Script de backfill: [scripts/backfill/backfill-ttm-valuation.ts](../scripts/backfill/backfill-ttm-valuation.ts)
- Data gaps: [PENDIENTES.md](PENDIENTES.md)
- Orden de crons: [CRON_EXECUTION_ORDER.md](CRON_EXECUTION_ORDER.md)

---

**¿Problemas no resueltos?** Agregar issue en PENDIENTES.md con:
- Síntoma específico
- Query de diagnóstico ejecutada
- Ticker afectado (si aplica)

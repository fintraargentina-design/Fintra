# 06-BACKFILLS - Scripts de Poblado Inicial

**Última actualización:** 7 de febrero de 2026  
**Propósito:** Scripts para poblar datos históricos (ejecución única o periódica)

---

## 📋 ÍNDICE

1. [Introducción](#introducción)
2. [Documentos Disponibles](#documentos-disponibles)
3. [Guía Rápida de Ejecución](#guía-rápida-de-ejecución)
4. [Backfills por Criticidad](#backfills-por-criticidad)

---

## 📖 INTRODUCCIÓN

### ¿Qué son los Backfills?

Los backfills son scripts de **ejecución única** (o periódica) que:

- **Pueblan datos históricos** en la base de datos
- **Llenan gaps** de información faltante
- **Recalculan métricas** retrospectivas cuando hay cambios arquitectónicos
- **Generan materializaciones** de datos derivados

### ¿Cuándo ejecutarlos?

| Tipo          | Frecuencia         | Ejemplo                            |
| ------------- | ------------------ | ---------------------------------- |
| **Inicial**   | 1 vez (setup)      | TTM Valuation, Performance Windows |
| **Periódico** | Semanal/Mensual    | Sector PE, Industry Performance    |
| **Ad-Hoc**    | Solo si falta data | Ticker Price History (individual)  |

**Diferencia con Cron Jobs:**

- **Cron jobs:** Actualizan datos diarios (incremental)
- **Backfills:** Pueblan históricos completos (bulk)

---

## 📚 DOCUMENTOS DISPONIBLES

### [00-BACKFILL_INSTRUCTIONS.md](./00-BACKFILL_INSTRUCTIONS.md) ⭐ ÍNDICE PRINCIPAL

**Tema:** Catálogo completo de scripts de backfill disponibles

**Audiencia:** DevOps, desarrolladores ejecutando backfills

**Contenido clave:**

- **6+ backfills documentados** con comandos de ejecución
- TTM Valuation (CRÍTICO - ratios históricos PE, EV/EBITDA)
- Precios históricos por ticker
- Sector/Industry Performance
- Sector/Industry P/E
- Estadísticas sectoriales
- Timing estimado por backfill
- Data gaps conocidos y soluciones

**Cuándo consultar:**

- Primer setup del proyecto (poblar base de datos)
- Ejecutando backfills después de añadir nuevos tickers
- Debugging de datos faltantes
- Verificando qué backfills están completos

---

### [TTM_HISTORICAL_VALUATION_IMPLEMENTATION.md](./TTM_HISTORICAL_VALUATION_IMPLEMENTATION.md) 📖 DOC TÉCNICO

**Tema:** TTM Valuation Backfill - Implementación profunda

**Audiencia:** Desarrolladores, arquitectos de datos

**Contenido técnico:**

- **Arquitectura completa** del sistema TTM histórico
- Schema de `datos_valuacion_ttm` (campos, constraints, indices)
- Principios de diseño (TTM canónico, no interpolaciones, materializado)
- Componentes: backfill script + incremental cron
- Fault tolerance y batch processing
- Troubleshooting (gaps de data, errores comunes)
- Testing checklist
- Performance notes (timing, database size)
- Changelog de implementación

**Cuándo consultar:**

- Implementando nuevo backfill similar
- Entendiendo arquitectura de TTM histórico
- Debugging problemas de TTM valuation
- Modificando lógica de cálculo de ratios
- Optimizando performance de backfills

---

## 🚀 GUÍA RÁPIDA DE EJECUCIÓN

### Primer Setup (Ejecutar en orden)

#### 1. TTM Valuation ⭐ CRÍTICO

```bash
# Testing (1 ticker)
npx tsx scripts/backfill/backfill-ttm-valuation.ts --limit=1

# Producción (batches automáticos de 100)
npx tsx scripts/backfill/backfill-ttm-valuation.ts
```

**Duración:** ~25-30 horas para 10,000 tickers  
**Output:** `datos_valuacion_ttm` (~40 rows/ticker)

---

#### 2. Performance Windows (Si no está en cron)

```bash
npx tsx scripts/backfill/backfill-performance-windows.ts
```

**Duración:** ~5-10 minutos  
**Output:** `performance_windows` (~6 rows/ticker × ventanas)

---

#### 3. Sector Performance (OPCIONAL - históricos)

```bash
npx tsx scripts/backfill/backfill-sector-performance.ts
```

**Duración:** ~10-20 minutos  
**Cuándo:** Si necesitas benchmarks sectoriales de fechas pasadas

---

#### 4. Industry Performance (OPCIONAL - históricos)

```bash
npx tsx scripts/backfill/backfill-industry-performance.ts
```

**Duración:** ~15-30 minutos  
**Cuándo:** Si necesitas performance por industria histórica

---

### Backfills Ad-Hoc

#### Ticker Individual (Precios completos)

```bash
npx tsx scripts/backfill-ticker-full.ts --ticker=AAPL
```

**Uso:** Poblar historial de precios para ticker específico

---

#### Sector P/E Historical

```bash
npx tsx scripts/backfill/backfill-sector-pe.ts
```

**Cuándo:** Análisis de valuación sectorial histórica

---

#### Industry P/E Historical

```bash
npx tsx scripts/backfill/backfill-industry-pe-historical.ts
```

**Cuándo:** P/E ratios por industria retrospectivos

---

## 📊 BACKFILLS POR CRITICIDAD

### ⭐⭐⭐ CRÍTICO (Ejecutar siempre)

| Backfill            | Script                          | Tabla Destino       | Duración  |
| ------------------- | ------------------------------- | ------------------- | --------- |
| TTM Valuation       | backfill-ttm-valuation.ts       | datos_valuacion_ttm | 25-30 hrs |
| Performance Windows | backfill-performance-windows.ts | performance_windows | 5-10 min  |

**Sin estos:** FGOS, Valuation, y análisis competitivo no funcionan correctamente.

---

### ⭐⭐ ALTA PRIORIDAD (Recomendado)

| Backfill             | Script                                      | Duración  |
| -------------------- | ------------------------------------------- | --------- |
| Sector Performance   | backfill-sector-performance.ts              | 10-20 min |
| Industry Performance | backfill-industry-performance-historical.ts | 15-30 min |

**Para:** Benchmarks sectoriales/industriales históricos

---

### ⭐ OPCIONAL (Según necesidad)

| Backfill     | Script                             | Uso                           |
| ------------ | ---------------------------------- | ----------------------------- |
| Sector P/E   | backfill-sector-pe.ts              | Valuación sectorial histórica |
| Industry P/E | backfill-industry-pe-historical.ts | P/E por industria             |
| Ticker Full  | backfill-ticker-full.ts            | Precios de ticker específico  |
| Sector Stats | run-sector-stats-backfill.ts       | Estadísticas agregadas        |

---

## 🔍 VERIFICACIÓN POST-EJECUCIÓN

### TTM Valuation

```sql
-- Verificar cobertura
SELECT
  COUNT(DISTINCT ticker) as tickers_con_ttm,
  COUNT(*) as total_rows,
  AVG(rows_per_ticker) as promedio_rows_por_ticker
FROM (
  SELECT ticker, COUNT(*) as rows_per_ticker
  FROM datos_valuacion_ttm
  GROUP BY ticker
) subquery;

-- Esperado:
-- - tickers_con_ttm: ~10,000+
-- - promedio_rows_por_ticker: ~30-40
```

---

### Performance Windows

```sql
-- Verificar ventanas pobladas
SELECT
  window,
  COUNT(*) as tickers_count
FROM performance_windows
WHERE as_of_date = CURRENT_DATE
GROUP BY window
ORDER BY window;

-- Esperado: ~20,000 rows por ventana (1M, 3M, 6M, 1Y, 3Y, 5Y)
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### Fault Tolerance

- ✅ **Todos los backfills son fault-tolerant**: Error en 1 ticker NO detiene el proceso
- ✅ **Idempotentes**: Seguros para re-ejecutar sin duplicados
- ✅ **Batch processing**: Procesan en lotes para evitar memory leaks

### Data Gaps Conocidos

**TTM Valuation:**

- EPS/PE: ~52% cobertura (requiere `weighted_shares_out`)
- EV/EBITDA: ~0% cobertura (requiere `cash_and_equivalents`)

**Solución:** Ver [PENDIENTES.md](../11-PENDIENTES/PENDIENTES.md) para backfills de datos faltantes

### Performance

**Optimizaciones recomendadas:**

- Ejecutar backfills pesados durante off-peak hours (2-6 AM)
- Usar `--limit` para testing antes de ejecutar completo
- Monitorear logs para detectar errores tempranos
- Verificar espacio en disco antes de backfills masivos

---

## 🔄 FLUJO DE NAVEGACIÓN RECOMENDADO

### Para Ejecutar Backfills:

1. **[00-BACKFILL_INSTRUCTIONS.md](./00-BACKFILL_INSTRUCTIONS.md)** → Ver catálogo completo y comandos
2. Ejecutar backfills críticos (TTM, Performance Windows)
3. Verificar resultados con queries SQL
4. Ejecutar backfills opcionales según necesidad

### Para Implementar Nuevos Backfills:

1. **[TTM_HISTORICAL_VALUATION_IMPLEMENTATION.md](./TTM_HISTORICAL_VALUATION_IMPLEMENTATION.md)** → Estudiar arquitectura de referencia
2. Seguir principios de diseño (fault tolerance, idempotencia, batch)
3. Documentar en 00-BACKFILL_INSTRUCTIONS.md
4. Testing con `--limit=1` antes de producción

### Para Debugging:

- **TTM ratios NULL** → TTM_HISTORICAL_VALUATION, sección "Troubleshooting"
- **Performance windows vacías** → Verificar backfill ejecutado
- **Sector benchmarks faltantes** → backfill-sector-performance.ts
- **Precios históricos missing** → backfill-ticker-full.ts

---

## 📝 RESUMEN EJECUTIVO

### Backfills Mínimos para Operación

```bash
# 1. TTM Valuation (CRÍTICO - 25-30 hrs)
npx tsx scripts/backfill/backfill-ttm-valuation.ts

# 2. Performance Windows (5-10 min)
npx tsx scripts/backfill/backfill-performance-windows.ts
```

**Total mínimo:** ~30 horas (ejecutar overnight)

---

### Estado del Proyecto

**Backfills Completados:**

- ✅ Performance Windows (2026-02-02) - 131,926 rows

**Backfills Pendientes:**

- ⏳ TTM Valuation (en progreso según necesidad)
- ⏳ Sector/Industry Performance (opcional)

---

**Última revisión:** 7 de febrero de 2026  
**Backfills documentados:** 6+ scripts  
**Cobertura:** Initial setup + ad-hoc + históricos opcionales

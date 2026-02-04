# 📋 TAREAS PENDIENTES - FINTRA

**Última actualización:** 2026-02-04

---

## 📖 REGLAS DE USO

- **Tareas pendientes:** `- [ ]` checkbox sin marcar
- **Tareas completadas:** `- [x]` checkbox marcado + ~~texto tachado~~
- **Ejemplo:**
  - ~~`- [x] Verificar que quality_brakes está funcionando (COMPLETADO)`~~

---

## ✅ COMPLETADO RECIENTEMENTE (Feb 2-4, 2026)

### Refactors y Correcciones

- ~~- [x] Refactor IQS (IFS_FY) a percentile-based (Feb 2)~~
- ~~- [x] Refactor TTM v2 con computeTTMv2 canónico (Feb 3)~~
- ~~- [x] Corregir backfill-ttm-valuation.ts (procesamiento automático) (Feb 3)~~
- ~~- [x] Agregar column cash_and_equivalents a datos_financieros (Feb 3)~~

### Documentación

- ~~- [x] Crear TTM_TROUBLESHOOTING.md (Feb 4)~~
- ~~- [x] Crear QUALITY_BRAKES_GUIDE.md (Feb 4)~~
- ~~- [x] Actualizar CRON_EXECUTION_ORDER.md con ttm-valuation-cron (Feb 4)~~
- ~~- [x] Actualizar 00-BACKFILL_INSTRUCTIONS.md con TTM valuation (Feb 4)~~
- ~~- [x] Reorganizar documentación en carpetas por flujo (Feb 4)~~
- ~~- [x] Crear DIAGRAMA_DE_FLUJO.md (Feb 4)~~

---

## 🔴 CRÍTICO - Backfills de Datos

### TTM Valuation - Datos Faltantes

#### 1. Cash and Equivalents (Balance Sheet)

- [ ] Crear script de backfill para `cash_and_equivalents` en `datos_financieros`
- [ ] Endpoint FMP: `/api/v3/balance-sheet-statement/{ticker}?period=quarter`
- [ ] Columnas a poblar: `cash_and_equivalents` (1.5M registros)
- [ ] Impacto: Habilita cálculo de `net_debt`, `enterprise_value`, `ev_ebitda`
- [ ] Prioridad: **ALTA** - Sin esto no hay EV correcto

#### 2. Weighted Shares Outstanding (Income Statement)

- [ ] Backfill histórico de `weighted_shares_out` (pre-2023)
- [ ] Endpoint FMP: `/api/v3/income-statement/{ticker}?period=quarter`
- [ ] Cobertura actual: Solo últimos 3 quarters (8%)
- [ ] Objetivo: 100% cobertura desde 2014
- [ ] Impacto: Habilita `eps_ttm`, `pe_ratio`, `market_cap`
- [ ] Prioridad: **ALTA** - Sin esto no hay PE histórico

---

## 🟡 MEDIO - Optimizaciones y Scripts

### Backfills Operativos

#### 3. TTM Valuation - Ejecución Completa

- [ ] Ejecutar backfill completo para todos los tickers activos
- [ ] Comando: `npx tsx scripts/backfill/backfill-ttm-valuation.ts`
- [ ] Estimado: ~40,000 tickers × 40 quarters promedio = 1.6M registros
- [ ] Tiempo estimado: 6-8 horas (con throttling de 150ms)
- [ ] Prioridad: **MEDIA** - Ejecutar después de poblar cash

#### 4. Limpieza de Scripts Duplicados

- [ ] Eliminar `scripts/backfill/backfill-ttm-valuation-history.ts` (deprecated)
- [ ] Documentar por qué se eliminó (lógica duplicada, no usa motor canónico)
- [ ] Prioridad: **BAJA** - Housekeeping

---

## 🟢 BAJO - Monitoreo y Validación

### Validación de Datos

#### 5. Auditoría de Quality Brakes

- [x] Verificar que quality_brakes está funcionando (COMPLETADO)
- [x] Confirmar 14,455 empresas con penalización (COMPLETADO)
- [x] Confirmar 15,469 empresas sin penalización (COMPLETADO)
- [ ] Documentar casos edge de empresas US con penalización
- [ ] Prioridad: **BAJA** - Ya validado

#### 6. Monitoreo de TTM Valuation

- [ ] Crear dashboard de cobertura de datos
- [ ] Alertas si cobertura de `cash_and_equivalents` < 95%
- [ ] Alertas si cobertura de `weighted_shares_out` < 95%
- [ ] Prioridad: **BAJA** - Después de backfills

---

## 📊 ESTADO ACTUAL DE DATOS

### datos_financieros (Quarterly)

| Campo                  | Registros | Cobertura | Estado |
| ---------------------- | --------- | --------- | ------ |
| `revenue`              | 1,561,673 | 100%      | ✅     |
| `ebitda`               | 1,561,673 | 100%      | ✅     |
| `net_income`           | 1,561,673 | 100%      | ✅     |
| `total_debt`           | 1,561,631 | 99.99%    | ✅     |
| `weighted_shares_out`  | 808,546   | 51.8%     | ⚠️     |
| `cash_and_equivalents` | **0**     | **0%**    | ❌     |

### datos_valuacion_ttm

| Estado        | Registros | Tickers |
| ------------- | --------- | ------- |
| Total         | 39        | 1       |
| Con EPS/PE    | 3         | 1       |
| Con EV/EBITDA | 0         | 0       |

---

## 🎯 ORDEN DE EJECUCIÓN RECOMENDADO

1. **Backfill Cash** → Crea script y ejecuta para todos los tickers
2. **Backfill Shares** → Crea script y ejecuta para tickers pre-2023
3. **Re-ejecutar TTM Valuation** → Con datos completos
4. **Validar Resultados** → Verificar cobertura > 95%
5. **Cleanup** → Eliminar scripts deprecated

---

## 📝 NOTAS

- **TTM Valuation funcionando:** El motor está OK, solo faltan datos de entrada
- **Quality Brakes validado:** 29,924 empresas evaluadas, funcionando correctamente
- **Tabla prices_daily:** Corregida de `datos_eod` (no existía)
- **Motor TTM v2:** Centralizado en `/lib/engine/ttm.ts` (single source of truth)

---

**Próxima revisión:** Después de ejecutar backfills de cash y shares

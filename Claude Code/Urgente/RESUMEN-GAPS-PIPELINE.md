# Resumen: Gaps Críticos de Data Pipeline Agregados a Auditoría

## ✅ Actualización Completada

Se agregó **FASE 12 completa** al script de auditoría con 7 tareas críticas para diagnosticar problemas de ejecución de pipelines.

---

## 🚨 Problema Central Detectado

**"Código existe pero no se ejecuta"**

Existen 6 gaps críticos donde:
- ✅ Código implementado (archivos .ts presentes)
- ❌ Cron jobs activos (endpoints NO ejecutándose)
- ❌ Datos en base de datos (campos vacíos o <10% cobertura)

---

## 📋 Las 7 Tareas de FASE 12

### TAREA 12.1: IFS Computation Job ❌ CRÍTICO

**Problema:**
- Código `ifs.ts` existe
- Importado en `fgos-recompute.ts`
- Pero NO existe `/api/cron/compute-ifs`
- Campos `ifs` e `ifs_memory` vacíos (0% cobertura)

**Impacto:**
→ IFS nunca se calcula automáticamente
→ Framework de 5 dimensiones incompleto

**Qué verifica la tarea:**
```bash
- Existe archivo ifs.ts
- Existe endpoint /api/cron/compute-ifs
- calculateIFS se invoca en algún cron
- Campos se populan en DB
```

---

### TAREA 12.2: Sector Ranking Job ⚠️ ALTO

**Problema:**
- Endpoint `/api/cron/compute-ranks` EXISTE
- Pero solo llama a SQL RPC: `compute_sector_ranks()`
- Si función SQL no existe/falla → Rankings nunca se calculan

**Impacto:**
→ Rankings sectoriales sin datos
→ Comparaciones relativas imposibles

**Qué verifica la tarea:**
```bash
- Endpoint compute-ranks existe
- Llama a RPC de Supabase
- Función SQL existe en DB
- Función SQL tiene lógica (no vacía)
```

**Requiere verificación manual en Supabase:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'compute_sector_ranks';
```

---

### TAREA 12.3: Relative Performance (Alpha) ❌ CRÍTICO

**Problema:**
- NO existe `/api/cron/sector-performance-relative`
- Existe `sector-performance-windows-aggregator` (calcula índices de sector)
- Pero falta cruce: ticker vs sector → Alpha

**Impacto:**
→ No hay medición de performance relativa
→ No se puede saber si un ticker supera/underperform su sector

**Qué verifica la tarea:**
```bash
- Cron sector-performance-windows-aggregator existe (índices)
- Cron sector-performance-relative existe (Alpha)
- Cálculo de Alpha implementado
- Campo performance_relative en DB poblado
```

---

### TAREA 12.4: Performance Windows Discrepancias ⚠️ ALTO

**Problema:**
- Código define `['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y']`
- Pero 3M/6M/2Y pueden no verse en DB (problema de ejecución)
- 1W y YTD ausentes (comentados o no implementados)

**Impacto:**
→ Análisis de momentum incompleto
→ Comparaciones temporales limitadas

**Qué verifica la tarea:**
```bash
- Ventanas configuradas en código
- Ventanas con datos en DB (query SQL)
- Discrepancias (código vs DB)
- Ventanas comentadas/ausentes
```

**Query SQL de verificación:**
```sql
SELECT DISTINCT jsonb_object_keys(performance_windows) 
FROM fintra_snapshots 
LIMIT 10;
```

---

### TAREA 12.5: FGOS Confidence Source ⚠️ MEDIO

**Problema:**
- Código usa `calculateDimensionalConfidence()` (basado en datos actuales)
- Usuario espera `calculateConfidenceLayer()` (basado en historia + volatility + universe)
- Ambas funciones existen pero se usa la menos robusta

**Impacto:**
→ Confidence menos preciso
→ No penaliza empresas con poca historia

**Qué verifica la tarea:**
```bash
- Qué función se usa en FGOS
- Inputs de cada función
- Discrepancia expectativa vs realidad
- Evaluar si cambiar o documentar
```

---

### TAREA 12.6: Sentiment/News Layer ❌ CRÍTICO

**Problema:**
- NO existe `/api/cron/sentiment-bulk`
- Cobertura actual: 7.55% (residual de pruebas manuales)
- Sin automatización activa

**Impacto:**
→ Noticias no se procesan automáticamente
→ Narrative risk/bias no se actualiza
→ Motor de noticias no funcional (92.45% sin datos)

**Qué verifica la tarea:**
```bash
- Cron sentiment-bulk existe
- Código news engine existe
- Integración n8n configurada
- Campos narrative_risk/bias poblados
```

**Pipeline completo esperado:**
```
1. Cron fetch news → FMP API
2. Por cada noticia → Webhook n8n
3. n8n → LLM analysis → Structured insight
4. Cron → Guarda insights en DB
5. Cron aggregator → Calcula Bias/Risk
```

**Pipeline actual:**
```
✅ Webhook n8n existe
❌ Cron fetch news NO existe
❌ Cron aggregator NO existe
```

---

### TAREA 12.7: Scheduling de Crons ⚠️ ALTO

**Problema:**
- Crons pueden existir como archivos
- Pero no estar configurados en `vercel.json`
- Sin scheduling → Nunca se ejecutan

**Impacto:**
→ Crons dormidos (código existe pero no corre)

**Qué verifica la tarea:**
```bash
- vercel.json con crons configurados
- Todos los cron endpoints incluidos
- Schedules no conflictivos
- Crons faltantes en scheduling
```

**Ejemplo de problema:**
```json
// vercel.json actual
{
  "crons": [
    {
      "path": "/api/cron/snapshot",
      "schedule": "0 2 * * *"
    }
  ]
}

// Faltantes:
// - /api/cron/compute-ifs
// - /api/cron/sector-performance-relative
// - /api/cron/sentiment-bulk
```

---

## 📊 Matriz de Gaps (Resumen)

| Gap | Código | Endpoint | Scheduled | DB | Severidad |
|-----|--------|----------|-----------|-----|-----------|
| **IFS Computation** | ✅ | ❌ | ❌ | 0% | CRÍTICO |
| **Sector Ranks (SQL)** | ✅ | ✅ | ✅ | ⚠️ | ALTO |
| **Relative Performance** | ⚠️ | ❌ | ❌ | 0% | CRÍTICO |
| **Windows 3M/6M/2Y** | ✅ | ✅ | ✅ | ❌ | ALTO |
| **Windows 1W/YTD** | ❌ | ❌ | ❌ | ❌ | MEDIO |
| **Confidence Source** | ✅ | ✅ | ✅ | ⚠️ | MEDIO |
| **Sentiment/News** | ⚠️ | ❌ | ❌ | 7.55% | CRÍTICO |

### Impacto Acumulado

**Engines sin datos:**
- ❌ IFS: 0% cobertura
- ❌ News: 7.55% cobertura (residual)

**Engines con datos parciales:**
- ⚠️ Performance: Ventanas incompletas
- ⚠️ Sector Ranks: Depende de SQL RPC

**Engines funcionales:**
- ✅ FGOS: (verificar con auditoría)
- ✅ Valuation: (verificar con auditoría)
- ✅ Life Cycle: (verificar con auditoría)

---

## 🎯 Priorización de Correcciones

### URGENTE (Esta semana)

**1. Crear /api/cron/compute-ifs** [1 día]
```typescript
// Lógica:
for (const ticker of tickers) {
  const ifs = await calculateIFS(ticker);
  await updateSnapshot(ticker, { ifs, ifs_memory });
}
```

**2. Crear /api/cron/sector-performance-relative** [2 días]
```typescript
// Lógica:
const sectorReturn = getSectorIndex(sector, window);
const tickerReturn = getTickerReturn(ticker, window);
const alpha = tickerReturn - sectorReturn;
await updateSnapshot(ticker, { performance_vs_sector: alpha });
```

**3. Completar pipeline de Sentiment** [3 días]
```typescript
// Paso 1: Crear sentiment-bulk (fetch news)
// Paso 2: POST a n8n webhook por cada noticia
// Paso 3: Crear sentiment-aggregator (Bias/Risk)
```

**4. Verificar SQL compute_sector_ranks** [4 horas]
```sql
-- Verificar existe
-- Si no, crearla
-- Probar ejecución
```

**Total urgente:** ~7 días de trabajo

---

### ALTO (Próximas 2 semanas)

**5. Debugging de Windows 3M/6M/2Y** [1 semana]
- Investigar por qué código existe pero DB no tiene datos
- Agregar logging detallado
- Verificar parsing de FMP API
- Verificar persistencia en DB

**6. Agregar Windows 1W y YTD** [3 días]
- Descomentar o implementar
- Agregar a pipeline

**7. Clarificar Confidence Source** [2 días]
- Decidir: Dimensional vs Layer
- Implementar o documentar

---

## 📝 Comandos de Verificación Rápida

### Verificar cobertura de campos:

```sql
-- En Supabase SQL Editor
SELECT 
  COUNT(*) as total_tickers,
  
  -- IFS
  COUNT(ifs) as ifs_present,
  ROUND(100.0 * COUNT(ifs) / COUNT(*), 2) as ifs_coverage,
  
  -- Performance relative
  COUNT(performance_vs_sector) as perf_relative_present,
  ROUND(100.0 * COUNT(performance_vs_sector) / COUNT(*), 2) as perf_relative_coverage,
  
  -- News
  COUNT(narrative_risk) as news_present,
  ROUND(100.0 * COUNT(narrative_risk) / COUNT(*), 2) as news_coverage
  
FROM fintra_snapshots;
```

### Verificar endpoints de cron:

```bash
# En terminal del proyecto
find app/api/cron -name "route.ts" | \
  sed 's|app/api/cron/||' | \
  sed 's|/route.ts||' | \
  sort
```

### Verificar scheduling:

```bash
# Ver vercel.json
cat vercel.json | grep -A 30 "cron"
```

---

## 🔄 Workflow de Corrección

### Fase 1: Crear Endpoints Faltantes (Semana 1)

**Día 1-2:** compute-ifs
```bash
1. Crear /app/api/cron/compute-ifs/route.ts
2. Implementar loop con calculateIFS()
3. Agregar try-catch por ticker
4. Logs obligatorios (START, OK, FAILED)
```

**Día 3-4:** sector-performance-relative
```bash
1. Crear /app/api/cron/sector-performance-relative/route.ts
2. Obtener índices de sector (de aggregator)
3. Cruzar con ticker returns
4. Calcular Alpha
5. Persistir en DB
```

**Día 5:** sentiment-bulk + aggregator
```bash
1. Crear /app/api/cron/sentiment-bulk/route.ts
2. Fetch news de FMP
3. POST a n8n webhook
4. Guardar insights
5. Crear sentiment-aggregator para Bias/Risk
```

---

### Fase 2: Configurar Scheduling (Semana 1)

```json
// Actualizar vercel.json
{
  "crons": [
    {
      "path": "/api/cron/snapshot",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/compute-ifs",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/sector-performance-relative",
      "schedule": "0 4 * * *"
    },
    {
      "path": "/api/cron/sentiment-bulk",
      "schedule": "0 5 * * *"
    },
    {
      "path": "/api/cron/sentiment-aggregator",
      "schedule": "0 6 * * *"
    }
  ]
}
```

---

### Fase 3: Validar Ejecución (Semana 2)

**Día 1-2:** Ejecutar manualmente cada cron
```bash
# Trigger manual via URL
curl https://tu-dominio.vercel.app/api/cron/compute-ifs?secret=XXX

# Verificar logs en Vercel
# Verificar DB en Supabase
```

**Día 3-4:** Verificar cobertura
```sql
-- Ejecutar queries de verificación
-- Medir cobertura antes/después
```

**Día 5:** Generar reporte
```
Cobertura inicial:
- IFS: 0% → 90%+
- Performance Relative: 0% → 95%+
- News: 7.55% → 85%+
```

---

## ✅ Checklist de Validación Post-Corrección

Después de implementar todos los fixes, ejecutar:

### [ ] Verificar endpoints existen
```bash
find app/api/cron -name "route.ts" | wc -l
# Debe ser >= 7 (snapshot + ifs + relative + sentiment-bulk + aggregator + ranks + performance-windows)
```

### [ ] Verificar scheduling configurado
```bash
cat vercel.json | grep -c "path.*cron"
# Debe coincidir con número de endpoints
```

### [ ] Verificar SQL functions
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE '%compute%';
```

### [ ] Verificar cobertura en DB
```sql
-- Query de cobertura completa (ver arriba)
-- Target: >85% en todos los campos
```

### [ ] Ejecutar auditoría completa nuevamente
```bash
# Pasar script completo a Claude Code
# Verificar que todos los ✅ estén verdes
```

---

## 📈 Métricas de Éxito

**ANTES (estado actual):**
- IFS coverage: 0%
- Performance Relative coverage: 0%
- News coverage: 7.55%
- Pipelines activos: 3-4 de 7

**DESPUÉS (target):**
- IFS coverage: >90%
- Performance Relative coverage: >95%
- News coverage: >85%
- Pipelines activos: 7 de 7

**Timeline:**
- Semana 1: Implementación de endpoints + scheduling
- Semana 2: Validación + debugging
- Semana 3: Re-auditoría + ajustes finales

**Inversión:** ~3 semanas de 1 desarrollador

---

## 🎓 Lecciones Aprendidas

### Problema Arquitectural Detectado

**"Código desconectado de ejecución"**

Causas:
1. Código implementado pero no "wired up" (sin endpoint)
2. Endpoints creados pero no scheduled (sin vercel.json)
3. SQL functions invocadas pero nunca creadas
4. Crons ejecutándose pero fallando silenciosamente (sin logs)

### Prevención Futura

**Checklist para nuevos features:**
1. ✅ Implementar lógica (lib/engine/)
2. ✅ Crear endpoint (app/api/cron/)
3. ✅ Agregar a scheduling (vercel.json)
4. ✅ Crear SQL functions si necesario
5. ✅ Agregar logs obligatorios
6. ✅ Ejecutar manualmente y verificar
7. ✅ Verificar cobertura en DB
8. ✅ Documentar en auditoría

---

## 🔗 Integración con Auditoría Principal

Esta FASE 12 se agregó al archivo:
**AUDITORIA-ENGINES-FINTRA.md**

Ubicación en el script:
- FASE 1-11: Auditoría de metodología (código)
- **FASE 12: Auditoría de pipelines (ejecución)** ← NUEVA
- FASE 13: Reporte final consolidado

El reporte final ahora incluye:
- ✅ Cumplimiento de metodología
- ✅ Infracciones de código
- ✅ **Gaps de pipeline** ← NUEVO
- ✅ Matriz de impacto
- ✅ Plan de acción priorizado

---

## 🚀 Próximo Paso

**Ejecutar auditoría completa con Claude Code:**

```bash
cd /path/to/fintra
claude-code chat
```

```
Audita Fintra usando el script AUDITORIA-ENGINES-FINTRA.md

Ejecuta TODAS las fases (1-13) incluyendo la nueva FASE 12 
de data pipeline gaps.

Genera reporte completo con:
1. Cumplimiento de metodología
2. Infracciones de código
3. Gaps de pipeline (CRÍTICO)
4. Plan de acción priorizado

Enfócate especialmente en FASE 12 para diagnosticar 
por qué IFS, Performance Relative y News no tienen datos.
```

**Tiempo estimado:** 3-4 horas de auditoría automática

**Output esperado:**
- Reporte markdown completo
- Código de corrección para cada gap
- Plan de implementación priorizado
- Timeline de 3 semanas para restaurar pipelines

---

**CRÍTICO:** No implementes Sprint Plan de mejoras hasta completar esta auditoría y corregir gaps de pipeline. Sin datos, las mejoras son inútiles.

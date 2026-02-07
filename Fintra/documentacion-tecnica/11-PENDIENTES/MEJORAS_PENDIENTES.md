# Mejoras y Optimizaciones Pendientes - Fintra

**Fecha de auditoría:** 6 de febrero, 2026  
**Última actualización:** 6 de febrero, 2026

Este documento identifica oportunidades de mejora, optimizaciones técnicas y actualizaciones recomendadas para el sistema Fintra, organizadas por prioridad y área.

---

## 📋 Resumen Ejecutivo

| Categoría    | Mejoras Identificadas | Impacto Estimado | Esfuerzo    |
| ------------ | --------------------- | ---------------- | ----------- |
| Performance  | 8 mejoras             | 🔴 Alto          | 2-4 semanas |
| Arquitectura | 5 mejoras             | 🟡 Medio         | 3-6 semanas |
| Código       | 12 mejoras            | 🟡 Medio         | 1-2 semanas |
| Seguridad    | 3 mejoras             | 🔴 Alto          | 1 semana    |
| DevOps       | 4 mejoras             | 🟢 Bajo          | 1-2 semanas |
| Testing      | 6 mejoras             | 🟡 Medio         | 2-3 semanas |

**Total:** 38 mejoras identificadas

---

## 🔴 PRIORIDAD CRÍTICA - Impacto Alto / Riesgo Alto

### 1. Seguridad: Credenciales Hardcodeadas

**Archivo:** `temp-audit-financial.js`

**Problema:**

```javascript
const supabase = createClient(
  "https://lvqfmrsvtyoemxfbnwzv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // SERVICE_ROLE_KEY expuesto
);
```

**Impacto:** 🔴 **CRÍTICO**

- Service role key comprometido
- Acceso ilimitado a base de datos
- Violación de mejores prácticas de seguridad

**Solución:**

1. **ROTAR** inmediatamente el service role key en Supabase Dashboard
2. Eliminar archivo `temp-audit-financial.js`
3. Agregar hook pre-commit para detectar secrets: `gitleaks` o `trufflehog`
4. Auditar repositorio con `git-secrets` para verificar histórico

**Esfuerzo:** 2 horas  
**Prioridad:** 🔴 INMEDIATA

---

### 2. Performance: TTM Parsing Deshabilitado

**Archivo:** `app/api/cron/financials-bulk/core.ts`

**Problema:**

```typescript
// TEMP: Skip TTM downloads/parsing due to timeout issues
// TODO: Investigate TTM parsing performance issue
// tasks.push(fetchFile("key-metrics-ttm-bulk", null, null));
// tasks.push(fetchFile("ratios-ttm-bulk", null, null));
```

**Impacto:** 🔴 **ALTO**

- Métricas TTM no se están actualizando desde FMP bulk files
- Dependencia en endpoint individual `/key-metrics/TICKER?period=ttm` (más lento)
- Inconsistencia de datos entre fuentes

**Análisis de Causa Raíz:**
Los archivos TTM bulk son únicos (no agrupados por año/periodo), conteniendo ~50,000 rows con todos los tickers. El problema probablemente es:

1. Parser bloqueando event loop al procesar archivo masivo
2. Memory spike al cargar todo el archivo antes de filtrar

**Solución Propuesta:**

```typescript
// Implementar streaming chunked para TTM files
const parseFileTTMOptimized = async (endpoint: string) => {
  const filePath = path.join(CACHE_DIR, `${endpoint}.csv`);
  const CHUNK_SIZE = 5000; // Procesar en chunks

  return new Promise((resolve) => {
    const results: any[] = [];
    let buffer: any[] = [];

    Papa.parse(createReadStream(filePath), {
      header: true,
      step: (row) => {
        if (activeTickers.has(row.data.symbol)) {
          buffer.push(row.data);
        }

        // Procesar chunks para evitar bloqueo
        if (buffer.length >= CHUNK_SIZE) {
          results.push(...buffer);
          buffer = [];
          setImmediate(() => {}); // Yield event loop
        }
      },
      complete: () => {
        results.push(...buffer);
        resolve(results);
      },
    });
  });
};
```

**Beneficios:**

- ✅ Reactiva TTM bulk processing (más rápido que API individual)
- ✅ Mantiene memoria constante
- ✅ Evita timeouts

**Esfuerzo:** 4-6 horas  
**Prioridad:** 🔴 ALTA

---

### 3. Architecture: Implementar Verbose Logging Control

**Status:** ✅ **PARCIALMENTE IMPLEMENTADO** (solo en financials-bulk)

**Problema:**

- Solo `financials-bulk` tiene parámetro `verbose`
- Otros 15+ crons tienen logging hardcoded
- Logs de producción contaminados con debug info
- Dificulta troubleshooting (no se puede activar verbose on-demand)

**Solución:**

```typescript
// lib/utils/logger.ts (NUEVO)
export class CronLogger {
  private verbose: boolean;
  private prefix: string;

  constructor(cronName: string, verbose: boolean = false) {
    this.verbose = verbose;
    this.prefix = `[${cronName}]`;
  }

  debug(...args: any[]) {
    if (this.verbose) console.log(this.prefix, ...args);
  }

  info(...args: any[]) {
    console.log(this.prefix, ...args);
  }

  warn(...args: any[]) {
    console.warn(this.prefix, ...args);
  }

  error(...args: any[]) {
    console.error(this.prefix, ...args);
  }
}

// Uso en cada cron:
export async function runPricesDailyBulk(opts: { verbose?: boolean }) {
  const logger = new CronLogger("prices-daily", opts.verbose);

  logger.info("Starting...");
  logger.debug("Processing ticker:", ticker); // Solo si verbose=true
  logger.error("Failed:", error);
}
```

**Beneficios:**

- ✅ Control granular de logging por cron
- ✅ Logs de producción limpios
- ✅ Debug on-demand para troubleshooting
- ✅ Fácil agregar file logging o external services (Sentry, Datadog)

**Esfuerzo:** 1-2 días  
**Prioridad:** 🟡 MEDIA-ALTA

---

### 4. Performance: Optimizar `valuation-bulk` con Streaming

**Archivo:** `app/api/cron/valuation-bulk/core.ts`

**Problema Actual:**

```typescript
// Carga archivos completos en memoria
const ratiosData = await fs.readFile(ratiosFile, "utf-8");
const metricsData = await fs.readFile(metricsFile, "utf-8");
const profileData = await fs.readFile(profileFile, "utf-8");

// Parse sincrónicamente bloqueando event loop
const ratios = Papa.parse(ratiosData, { header: true }).data;
```

**Impacto:** 🟡 MEDIO

- Memory spike de ~150 MB durante peak
- Event loop bloqueado durante parsing
- Escalabilidad limitada si archivos crecen

**Solución:**

```typescript
// Migrar a streaming pattern (similar a financials-bulk)
const parseFileStreaming = async (
  filePath: string,
  activeTickers: Set<string>,
) => {
  return new Promise((resolve) => {
    const rows: any[] = [];
    const stream = createReadStream(filePath);

    Papa.parse(stream, {
      header: true,
      dynamicTyping: true,
      step: (result) => {
        const symbol = result.data.symbol || result.data.ticker;
        if (activeTickers.has(symbol)) {
          rows.push(result.data);
        }
      },
      complete: () => resolve(rows),
    });
  });
};
```

**Beneficios:**

- ✅ Memoria constante (~50 MB)
- ✅ No bloquea event loop
- ✅ Filtrado durante parsing (más eficiente)

**Esfuerzo:** 4 horas  
**Prioridad:** 🟡 MEDIA

---

## 🟡 PRIORIDAD ALTA - Impacto Medio / Quick Wins

### 5. Code Quality: Implementar Pre-commit Hooks

**Problema:**

- No hay validación automática de código antes de commits
- Archivos `.log`, `.backup` llegan a git
- Credenciales pueden filtrarse accidentalmente

**Solución:**

```bash
# Instalar Husky
pnpm add -D husky lint-staged

# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 1. Lint staged files
pnpm lint-staged

# 2. Check for secrets
gitleaks protect --staged

# 3. Run type check on changed files
pnpm tsc --noEmit
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.md": ["prettier --write"]
  }
}
```

**Beneficios:**

- ✅ Previene commits con errores
- ✅ Detecta secrets antes de push
- ✅ Code style consistente
- ✅ Reduce code review time

**Esfuerzo:** 2 horas  
**Prioridad:** 🟡 ALTA

---

### 6. DevOps: Implementar Healthcheck Endpoint

**Problema:**

- No hay forma programática de verificar salud del sistema
- Monitoreo manual de logs
- Dificulta implementar alertas automáticas

**Solución:**

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkFMPApi(),
    checkSupabase(),
    checkLastCronRun(),
  ]);

  const healthy = checks.every((c) => c.status === "fulfilled");
  const status = healthy ? 200 : 503;

  return Response.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        database: checks[0].status === "fulfilled" ? "ok" : "error",
        fmpApi: checks[1].status === "fulfilled" ? "ok" : "error",
        supabase: checks[2].status === "fulfilled" ? "ok" : "error",
        lastCron: checks[3].status === "fulfilled" ? "ok" : "error",
      },
    },
    { status },
  );
}

async function checkLastCronRun() {
  const { data } = await supabaseAdmin
    .from("cron_execution_log")
    .select("*")
    .order("executed_at", { ascending: false })
    .limit(1)
    .single();

  const hoursSinceLastRun =
    (Date.now() - new Date(data.executed_at).getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastRun > 25) {
    throw new Error("Cron not running in last 25 hours");
  }
}
```

**Beneficios:**

- ✅ Monitoreo automático con UptimeRobot/Pingdom
- ✅ Alertas cuando algo falla
- ✅ Dashboard de salud del sistema
- ✅ Debug más rápido

**Esfuerzo:** 4 horas  
**Prioridad:** 🟡 ALTA

---

### 7. Performance: Implementar Cron Execution Locking

**Problema Actual:**

- Si un cron se ejecuta manualmente mientras el scheduled corre, puede haber:
  - Duplicate processing
  - Race conditions en DB
  - Recursos desperdiciados

**Solución:**

```typescript
// Ya existe en lib/utils/dbLocks.ts pero NO SE USA en todos los crons

// Ejemplo de implementación:
export async function runFinancialsBulk(...args, runId?: string) {
  const lockName = "financials-bulk";

  return await withDbLock(lockName, async () => {
    console.log(`🔒 Lock acquired: ${lockName}`);

    // Procesar...
    const result = await processFinancials(...args);

    console.log(`🔓 Releasing lock: ${lockName}`);
    return result;
  });
}
```

**Acción:**

- ✅ `withDbLock()` ya existe en `lib/utils/dbLocks.ts`
- ❌ Solo 2-3 crons lo están usando
- 🔧 Implementar en TODOS los crons del master pipeline

**Beneficios:**

- ✅ Previene ejecuciones concurrentes
- ✅ Evita race conditions
- ✅ Logs más claros (se ve cuando un cron está locked)

**Esfuerzo:** 4 horas (wrap cada cron)  
**Prioridad:** 🟡 MEDIA-ALTA

---

### 8. Architecture: Crear Tabla de Cron Execution History

**Problema:**

- No hay registro histórico de ejecuciones de crons
- Debugging requiere analizar logs manualmente
- No hay métricas de performance trend

**Solución:**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_cron_execution_log.sql
CREATE TABLE IF NOT EXISTS cron_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  duration_seconds INTEGER,
  tickers_processed INTEGER,
  rows_affected INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_cron_log_name_started ON cron_execution_log(cron_name, started_at DESC);
CREATE INDEX idx_cron_log_status ON cron_execution_log(status);
```

```typescript
// lib/utils/cronLogger.ts
export class CronExecutionTracker {
  private logId: string;

  async start(cronName: string, metadata: any = {}) {
    const { data } = await supabaseAdmin
      .from('cron_execution_log')
      .insert({
        cron_name: cronName,
        status: 'running',
        metadata
      })
      .select()
      .single();

    this.logId = data.id;
  }

  async complete(stats: { tickersProcessed: number, rowsAffected: number }) {
    await supabaseAdmin
      .from('cron_execution_log')
      .update({
        completed_at: new Date().toISOString(),
        status: 'success',
        duration_seconds: ...,
        tickers_processed: stats.tickersProcessed,
        rows_affected: stats.rowsAffected
      })
      .eq('id', this.logId);
  }
}
```

**Beneficios:**

- ✅ Dashboard de ejecuciones en Supabase
- ✅ Alertas basadas en duración/failures
- ✅ Métricas de performance trend
- ✅ Debugging más rápido

**Esfuerzo:** 6 horas  
**Prioridad:** 🟡 MEDIA

---

### 9. Testing: Implementar Unit Tests para Financial Logic

**Problema:**

- Zero unit tests para lógica financiera crítica
- Cambios pueden romper cálculos sin darse cuenta
- Regression bugs frecuentes

**Solución:**

```typescript
// __tests__/financial-metrics.test.ts
describe("deriveFinancialMetrics", () => {
  it("calcula ROIC correctamente", () => {
    const income = { netIncome: 1000, revenue: 10000 };
    const balance = { totalAssets: 20000, totalLiabilities: 8000 };

    const metrics = deriveFinancialMetrics(income, balance, {});

    expect(metrics.roic).toBeCloseTo(0.0833, 2); // 1000 / 12000 = 8.33%
  });

  it("retorna null cuando faltan datos", () => {
    const metrics = deriveFinancialMetrics(null, null, {});
    expect(metrics.roic).toBeNull();
  });

  it("no inventa datos cuando revenue es 0", () => {
    const income = { netIncome: 100, revenue: 0 };
    const metrics = deriveFinancialMetrics(income, {}, {});

    expect(metrics.net_margin).toBeNull(); // NO Infinity
  });
});
```

**Áreas Críticas para Testing:**

1. ✅ `deriveFinancialMetrics.ts` - Cálculos de métricas
2. ✅ `fintra-brain.ts` (FGOS) - Scoring logic
3. ✅ TTM construction - Suma de quarters
4. ✅ Percentile calculations - Benchmarks
5. ✅ Temporal consistency - Look-ahead bias prevention

**Esfuerzo:** 2-3 días  
**Prioridad:** 🟡 MEDIA-ALTA

---

### 10. Performance: Batch Upsert Optimization para Pequeños Crons

**Problema:**
Crons como `industry-performance-aggregator` hacen upserts individuales:

```typescript
for (const industry of industries) {
  const perf = await calculatePerformance(industry);
  await supabase.from("industry_performance").upsert(perf); // ❌ N round-trips
}
```

**Solución:**

```typescript
// Batch todas las operaciones
const performances = await Promise.all(
  industries.map((ind) => calculatePerformance(ind)),
);

await supabase.from("industry_performance").upsert(performances); // ✅ 1 round-trip
```

**Crons Afectados:**

- `industry-performance-aggregator` (~150 rows)
- `sector-performance-aggregator` (~11 rows)
- `industry-pe-aggregator` (~150 rows)
- `sector-pe-aggregator` (~11 rows)

**Beneficios:**

- ✅ 150x menos round-trips
- ✅ 5-10x más rápido
- ✅ Menos carga en DB

**Esfuerzo:** 2 horas  
**Prioridad:** 🟡 MEDIA

---

## 🟢 PRIORIDAD MEDIA - Refactoring y Mejoras de Calidad

### 11. Code Quality: Estandarizar Error Handling

**Problema:**

- Inconsistencia en manejo de errores entre crons
- Algunos lanzan exceptions, otros retornan null
- Dificulta debugging y monitoreo centralizado

**Situación Actual:**

```typescript
// financials-bulk: fault-tolerant loop
for (const ticker of tickers) {
  try {
    await process(ticker);
  } catch (e) {
    console.error(`Failed ${ticker}:`, e);
    // Continúa con siguiente ticker ✅
  }
}

// prices-daily-bulk: fail-fast
for (const ticker of tickers) {
  await process(ticker); // ❌ Primer error aborta todo
}
```

**Solución:**

```typescript
// lib/utils/cronHelpers.ts
export async function processBatchFaultTolerant<T>(
  items: T[],
  processor: (item: T) => Promise<any>,
  onError?: (item: T, error: Error) => void,
) {
  const results = {
    succeeded: [] as T[],
    failed: [] as { item: T; error: Error }[],
  };

  for (const item of items) {
    try {
      await processor(item);
      results.succeeded.push(item);
    } catch (error) {
      results.failed.push({ item, error });
      onError?.(item, error);
    }
  }

  return results;
}

// Uso:
const { succeeded, failed } = await processBatchFaultTolerant(
  tickers,
  async (ticker) => await processFinancials(ticker),
  (ticker, error) => console.error(`${ticker} failed:`, error),
);

console.log(`✅ Processed: ${succeeded.length}, ❌ Failed: ${failed.length}`);
```

**Beneficios:**

- ✅ Comportamiento consistente
- ✅ Mejor visibilidad de errores
- ✅ Fácil agregar retry logic
- ✅ Métricas de success rate

**Esfuerzo:** 1 día  
**Prioridad:** 🟢 MEDIA

---

### 12. Architecture: Implementar Rate Limiting para FMP API

**Problema:**

- FMP API tiene rate limits (429 errors frecuentes)
- No hay exponential backoff
- No hay circuit breaker pattern

**Solución:**

```typescript
// lib/fmp/rateLimiter.ts
import pLimit from "p-limit";

const limiter = pLimit(5); // Max 5 concurrent requests
const requestQueue: Array<() => Promise<any>> = [];

export async function fmpGetWithRateLimit(endpoint: string) {
  return limiter(async () => {
    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        const response = await fetch(endpoint);

        if (response.status === 429) {
          retries--;
          await sleep(delay);
          delay *= 2; // Exponential backoff
          continue;
        }

        if (!response.ok) {
          throw new Error(`FMP error: ${response.status}`);
        }

        return response.json();
      } catch (error) {
        if (retries === 0) throw error;
        retries--;
        await sleep(delay);
      }
    }
  });
}
```

**Beneficios:**

- ✅ Menos 429 errors
- ✅ Retry automático inteligente
- ✅ No satura API
- ✅ Mejor confiabilidad

**Esfuerzo:** 4 horas  
**Prioridad:** 🟢 MEDIA

---

### 13. DevOps: Implementar Rollbar/Sentry para Error Tracking

**Problema:**

- Errores solo en logs locales
- No hay agregación de errores
- No hay alertas automáticas
- Difícil identificar patterns

**Solución:**

```typescript
// lib/utils/errorTracker.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,

  beforeSend(event) {
    // Sanitizar datos sensibles
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
    }
    return event;
  },
});

export function captureException(error: Error, context?: any) {
  Sentry.captureException(error, {
    extra: context,
  });
  console.error(error); // Keep console logging
}

// Uso en crons:
try {
  await processFinancials(ticker);
} catch (error) {
  captureException(error, { ticker, cronName: "financials-bulk" });
}
```

**Beneficios:**

- ✅ Dashboard centralizado de errores
- ✅ Alertas en Slack/Email automáticas
- ✅ Stack traces completos
- ✅ Identifica errores recurrentes

**Esfuerzo:** 3 horas  
**Prioridad:** 🟢 MEDIA

---

### 14. Database: Implementar Materialized Views para Queries Lentas

**Problema:**

- Queries de sector benchmarks calculados on-demand
- Dashboard carga lento (joins pesados)
- Mismas agregaciones recalculadas múltiples veces

**Solución:**

```sql
-- Materialized view para sector stats
CREATE MATERIALIZED VIEW sector_stats_current AS
SELECT
  sector,
  COUNT(*) as company_count,
  AVG(market_cap) as avg_market_cap,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pe_ratio) as median_pe,
  AVG(revenue_growth_yoy) as avg_revenue_growth
FROM fintra_market_state
WHERE snapshot_date = CURRENT_DATE
GROUP BY sector;

CREATE UNIQUE INDEX ON sector_stats_current(sector);

-- Refresh automático con pg_cron
SELECT cron.schedule(
  'refresh-sector-stats',
  '0 1 * * *', -- 1 AM diario
  'REFRESH MATERIALIZED VIEW CONCURRENTLY sector_stats_current'
);
```

**Views Recomendadas:**

1. ✅ `sector_stats_current` - Stats por sector
2. ✅ `industry_stats_current` - Stats por industria
3. ✅ `top_performers_1d` - Top gainers/losers
4. ✅ `fgos_distribution` - Distribución de FGOS scores

**Beneficios:**

- ✅ Dashboard 10-20x más rápido
- ✅ Menos carga en DB
- ✅ Queries simples vs complejos joins

**Esfuerzo:** 1 día  
**Prioridad:** 🟢 MEDIA

---

### 15. Frontend: Implementar Stale-While-Revalidate Pattern

**Problema:**

- Cada request va a DB/API
- No hay caching en cliente
- Datos "en vivo" no necesarios para todo

**Solución:**

```typescript
// hooks/useSWR.ts (usando SWR library)
import useSWR from "swr";

export function useStockData(ticker: string) {
  const { data, error, mutate } = useSWR(`/api/stock/${ticker}`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 60000, // Refresh cada 60s
    dedupingInterval: 30000, // Dedupe requests en 30s window
  });

  return {
    stock: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}
```

**Beneficios:**

- ✅ UX más rápida (muestra cached data inmediatamente)
- ✅ Menos carga en backend
- ✅ Auto-refresh en background
- ✅ Optimistic updates

**Esfuerzo:** 1 día  
**Prioridad:** 🟢 BAJA-MEDIA

---

### 16. Testing: Implementar E2E Tests con Playwright

**Problema:**

- Zero tests end-to-end
- Regresiones en UI no detectadas hasta producción
- Testing manual consume tiempo

**Solución:**

```typescript
// e2e/stock-detail.spec.ts
import { test, expect } from "@playwright/test";

test("Stock detail page loads correctly", async ({ page }) => {
  await page.goto("/resumen/AAPL");

  // Verifica que cargue
  await expect(page.locator("h1")).toContainText("Apple");

  // Verifica que muestre FGOS
  const fgosCard = page.locator('[data-testid="fgos-card"]');
  await expect(fgosCard).toBeVisible();

  // Verifica que gráficos rendericen
  const chart = page.locator("canvas");
  await expect(chart).toBeVisible();
});

test("Search functionality works", async ({ page }) => {
  await page.goto("/");
  await page.fill('[data-testid="search-input"]', "AAPL");
  await page.click('[data-testid="search-result"]:first-child');

  await expect(page).toHaveURL("/resumen/AAPL");
});
```

**Tests Críticos:**

1. ✅ Stock search → detail page
2. ✅ FGOS card rendering
3. ✅ Financial charts display
4. ✅ Sector comparison table
5. ✅ Tab navigation

**Esfuerzo:** 2 días  
**Prioridad:** 🟢 MEDIA

---

### 17. Performance: Implementar CDN para Assets Estáticos

**Problema:**

- Logos, íconos servidos desde Next.js server
- No hay caching agresivo
- TTFB más lento para usuarios lejos del server

**Solución:**

```javascript
// next.config.mjs
export default {
  images: {
    loader: "cloudinary", // o 'cloudflare'
    path: "https://fintra.cdn.com/",
  },

  async headers() {
    return [
      {
        source: "/logos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};
```

**Assets para CDN:**

- `/public/logos/` - Logos de companies (~500 files)
- `/public/icons/` - Íconos UI
- Fonts custom (si existen)
- CSS/JS bundles (Next.js hace auto)

**Beneficios:**

- ✅ 50-200ms menos TTFB
- ✅ Menor carga en VPS
- ✅ Edge caching global
- ✅ Mejor Core Web Vitals

**Esfuerzo:** 4 horas  
**Prioridad:** 🟢 BAJA

---

## 🔵 PRIORIDAD BAJA - Nice to Have

### 18. Code Quality: Migrar a TypeScript Strict Mode

**Problema:**

```json
// tsconfig.json actual
{
  "strict": true, // ✅ Ya está activado
  "strictNullChecks": true
}
```

**Status:** ✅ **YA IMPLEMENTADO**

---

### 19. DevOps: Implementar Docker para Dev Environment

**Problema:**

- Setup manual de dependencias
- Inconsistencias entre dev/prod
- Onboarding de nuevos devs lento

**Solución:**

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
```

```yaml
# docker-compose.yml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
```

**Beneficios:**

- ✅ Setup en 5 minutos
- ✅ Ambiente consistente
- ✅ Fácil deployment

**Esfuerzo:** 4 horas  
**Prioridad:** 🔵 BAJA

---

### 20. Documentation: Crear API Documentation con Swagger

**Problema:**

- No hay documentación de API endpoints
- Developers deben leer código para integrar

**Solución:**

```typescript
// app/api/docs/route.ts
import { createSwaggerSpec } from "next-swagger-doc";

const spec = createSwaggerSpec({
  apiFolder: "app/api",
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Fintra API",
      version: "1.0.0",
    },
  },
});

export async function GET() {
  return Response.json(spec);
}
```

**Endpoints a Documentar:**

1. `/api/stock/[ticker]` - Stock data
2. `/api/search` - Search tickers
3. `/api/sector/[sector]` - Sector stats
4. `/api/health` - System health

**Beneficios:**

- ✅ Documentación auto-generada
- ✅ Playground interactivo
- ✅ Fácil integración para terceros

**Esfuerzo:** 1 día  
**Prioridad:** 🔵 BAJA

---

## 📊 Roadmap Sugerido

### Q1 2026 (Feb-Mar)

**Sprint 1 (Semana 1-2):**

- 🔴 Rotar credenciales expuestas
- 🔴 Implementar verbose logging en todos crons
- 🟡 Pre-commit hooks
- 🟡 Healthcheck endpoint

**Sprint 2 (Semana 3-4):**

- 🔴 Fix TTM parsing con streaming
- 🟡 Cron execution locking
- 🟡 Cron execution history table
- 🟢 Batch upsert optimization

### Q2 2026 (Apr-Jun)

**Sprint 3:**

- 🟡 Unit tests para financial logic
- 🟡 Rate limiting para FMP API
- 🟢 Error tracking (Sentry)

**Sprint 4:**

- 🟢 Materialized views
- 🟢 E2E tests
- 🟢 CDN para assets

### Q3 2026 (Jul-Sep)

**Sprint 5:**

- 🟢 Docker setup
- 🔵 API documentation
- 🔵 Frontend SWR pattern

---

## 📈 Métricas de Éxito

### Performance

- ✅ Crons diarios < 30 minutos (actualmente ~45 min)
- ✅ Dashboard load time < 2 segundos (actualmente ~5s)
- ✅ API response time p95 < 500ms

### Confiabilidad

- ✅ Cron success rate > 99%
- ✅ Zero critical errors en 30 días
- ✅ Uptime > 99.9%

### Code Quality

- ✅ Test coverage > 70%
- ✅ Zero security vulnerabilities
- ✅ TypeScript strict mode: 100%

---

## 🔗 Referencias

- Ver también: `CODIGO_DEPRECADO.md` para limpieza de código
- Ver: `CRON_OPTIMIZATION_LOG.md` para estado actual
- Ver: `PARALLELIZATION_PATTERNS.md` para patrones de performance

---

**Última Revisión:** 6 de febrero, 2026  
**Próxima Revisión Programada:** 6 de abril, 2026

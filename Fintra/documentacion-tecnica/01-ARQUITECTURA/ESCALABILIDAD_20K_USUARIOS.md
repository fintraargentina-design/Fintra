# Plan de Escalabilidad: 20,000 Usuarios Concurrentes

**Fecha:** 6 de febrero de 2026  
**Estado Actual:** ~500-2,000 usuarios concurrentes estimados  
**Objetivo:** 20,000 usuarios concurrentes con latencia <500ms

---

## 1. Análisis del Estado Actual

### 1.1 Fortalezas Arquitectónicas

✅ **Pre-cálculo Nocturno**

- Snapshots calculados en cron jobs (no en request time)
- FGOS, IFS, Valuation, Life Cycle pre-computados
- Estrategia correcta: compute-heavy en background, read-only en frontend

✅ **Separación de Responsabilidades**

- Server Actions para queries complejas
- Cliente anónimo para operaciones públicas
- Service role para operaciones administrativas

✅ **Datos Estructurados**

- Schema bien definido (fintra_snapshots, datos_financieros, etc.)
- Primary keys y constraints correctos
- Temporal consistency mantenida

### 1.2 Cuellos de Botella Identificados

❌ **Caching Inexistente**

- Cada request golpea Supabase directamente
- Snapshots se leen miles de veces (data casi estática)
- No hay invalidación inteligente

❌ **Query Optimization**

- Queries sin paginación en algunos endpoints
- Falta de índices estratégicos visibles
- No hay query plan analysis documentado

❌ **Connection Pooling**

- Supabase JS client por defecto (pool limitado)
- No hay gestión explícita de conexiones

❌ **CDN y Asset Optimization**

- No hay CDN configurado para assets estáticos
- JavaScript bundles potencialmente grandes
- Sin compresión Brotli/Gzip explícita

❌ **Rate Limiting**

- No hay protección contra abuso
- No hay throttling por usuario/IP
- Vulnerable a ataques DoS

❌ **Monitoring y Observability**

- No se detectó configuración de APM
- Falta de métricas de performance en tiempo real
- No hay alertas automáticas

---

## 2. Plan de Escalabilidad por Fases

### FASE 1: Quick Wins (1-2 semanas) → 5K usuarios

**Objetivo:** Optimizaciones con impacto inmediato y bajo esfuerzo.

#### 1.1 Caching en Vercel Edge

```typescript
// lib/cache/edge-cache.ts
export async function getCachedSnapshot(ticker: string) {
  const cacheKey = `snapshot:${ticker}`;

  // Vercel Edge Config (built-in)
  const cached = await fetch(`https://edge-config.vercel.com/${cacheKey}`, {
    next: { revalidate: 3600 }, // 1 hour
  });

  if (cached.ok) return cached.json();

  // Fallback a Supabase
  const data = await fetchFromSupabase(ticker);
  return data;
}
```

**Beneficios:**

- 80% reducción en queries a Supabase
- Latencia <50ms para datos cacheados
- Sin infraestructura adicional (Vercel built-in)

**Costo:** $0 (incluido en Vercel Pro)

#### 1.2 Índices Críticos en Supabase

```sql
-- Índices para fintra_snapshots
CREATE INDEX CONCURRENTLY idx_snapshots_ticker_date
ON fintra_snapshots(ticker, snapshot_date DESC);

CREATE INDEX CONCURRENTLY idx_snapshots_sector_fgos
ON fintra_snapshots(sector, fgos_score)
WHERE fgos_status = 'computed';

-- Índices para datos_financieros
CREATE INDEX CONCURRENTLY idx_financieros_ticker_period
ON datos_financieros(ticker, period_end_date DESC);

CREATE INDEX CONCURRENTLY idx_financieros_ttm
ON datos_financieros(ticker, period_type)
WHERE period_type = 'TTM';

-- Índices para prices_daily
CREATE INDEX CONCURRENTLY idx_prices_ticker_date
ON prices_daily(ticker, date DESC);
```

**Beneficios:**

- 70% reducción en query time
- Scans secuenciales → index scans

**Costo:** Incluido en plan actual

#### 1.3 Query Pagination Estándar

```typescript
// lib/services/pagination.service.ts
export interface PaginatedQuery {
  page: number;
  pageSize: number;
  filters?: Record<string, any>;
}

export async function getPaginatedSnapshots({
  page = 1,
  pageSize = 50,
  filters = {},
}: PaginatedQuery) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await supabase
    .from("fintra_snapshots")
    .select("*", { count: "exact" })
    .match(filters)
    .range(from, to);

  return {
    data,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}
```

**Beneficios:**

- Límite de 50-100 registros por request
- Infinite scroll/pagination eficiente

**Impacto:** 5K usuarios alcanzable

---

### FASE 2: Caching Layer (2-4 semanas) → 10K usuarios

**Objetivo:** Redis para hot data, TTL inteligente.

#### 2.1 Redis Stack con Upstash

```typescript
// lib/cache/redis-cache.ts
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface CacheOptions {
  ttl?: number; // seconds
  tags?: string[];
}

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const { ttl = 3600, tags = [] } = options;

  // Try cache
  const cached = await redis.get<T>(key);
  if (cached) return cached;

  // Miss: fetch and cache
  const data = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(data));

  // Store tags for invalidation
  for (const tag of tags) {
    await redis.sadd(`tag:${tag}`, key);
  }

  return data;
}

export async function invalidateByTag(tag: string) {
  const keys = await redis.smembers(`tag:${tag}`);
  if (keys.length > 0) {
    await redis.del(...keys);
    await redis.del(`tag:${tag}`);
  }
}
```

#### 2.2 Cache Strategy por Tipo de Dato

| Tipo de Data       | TTL      | Invalidación              | Prioridad |
| ------------------ | -------- | ------------------------- | --------- |
| Snapshots (último) | 1 hora   | Por ticker al actualizar  | ALTA      |
| Historical prices  | 24 horas | Por ticker/fecha          | MEDIA     |
| Sector benchmarks  | 6 horas  | Por sector al recalcular  | ALTA      |
| Company profiles   | 12 horas | Por ticker al actualizar  | MEDIA     |
| Universe list      | 30 min   | Al ejecutar sync-universe | BAJA      |

#### 2.3 Server Actions con Cache

```typescript
// lib/actions/resumen.ts
"use server";

import { getCached, invalidateByTag } from "@/lib/cache/redis-cache";

export async function fetchTickerResumen(ticker: string) {
  return getCached(
    `ticker:resumen:${ticker}`,
    async () => {
      // Query pesado a Supabase
      const snapshot = await supabaseAdmin
        .from("fintra_snapshots")
        .select("*")
        .eq("ticker", ticker)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .single();

      // ... más queries

      return assembledData;
    },
    { ttl: 3600, tags: [`ticker:${ticker}`] },
  );
}

// Invalidar al actualizar snapshot
export async function onSnapshotUpdated(ticker: string) {
  await invalidateByTag(`ticker:${ticker}`);
}
```

**Costo:** Upstash Pro ~$30/mes (10GB storage, 1M requests/day)

**Beneficios:**

- 95% reducción en queries a Supabase
- Latencia <100ms para hot data
- Invalidación granular por ticker/sector

**Impacto:** 10K usuarios alcanzable

---

### FASE 3: Read Replicas y Connection Pooling (3-5 semanas) → 15K usuarios

**Objetivo:** Distribuir carga de lecturas, optimizar conexiones.

#### 3.1 Supabase Read Replicas

```typescript
// lib/supabase-replicas.ts
import { createClient } from "@supabase/supabase-js";

// Primary (writes + critical reads)
export const supabasePrimary = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Read Replica 1 (snapshots, prices)
export const supabaseRead1 = createClient(
  process.env.SUPABASE_READ_REPLICA_1_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Read Replica 2 (company profiles, benchmarks)
export const supabaseRead2 = createClient(
  process.env.SUPABASE_READ_REPLICA_2_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Load balancer
export function getReadClient(): typeof supabasePrimary {
  const replicas = [supabaseRead1, supabaseRead2];
  return replicas[Math.floor(Math.random() * replicas.length)];
}
```

#### 3.2 Connection Pooling con PgBouncer

```typescript
// supabase/config.toml (agregar)
[pooler];
default_pool_size = 20;
max_client_conn = 1000;
pool_mode = "transaction";
```

**Beneficios:**

- 3x capacidad de lecturas concurrentes
- Primary libre para writes (crons)
- Latencia estable bajo carga

**Costo:** Supabase Pro + Read Replicas ~$100/mes adicionales

**Impacto:** 15K usuarios alcanzable

---

### FASE 4: CDN y Asset Optimization (1-2 semanas) → 18K usuarios

**Objetivo:** Reducir latencia global, optimizar bundles.

#### 4.1 Vercel Edge Network (CDN)

```typescript
// next.config.mjs
export default {
  images: {
    domains: ["yourdomain.com"],
    formats: ["image/avif", "image/webp"],
  },

  // Edge runtime para rutas estáticas
  experimental: {
    runtime: "edge",
  },

  // Compresión
  compress: true,

  // Headers para cache
  async headers() {
    return [
      {
        source: "/(.*).json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};
```

#### 4.2 Code Splitting y Lazy Loading

```typescript
// Lazy load components pesados
const RadarChart = dynamic(() => import('@/components/charts/RadarChart'), {
  loading: () => <Skeleton className="h-[400px]" />,
  ssr: false,
});

const DataTable = dynamic(() => import('@/components/tables/DataTable'), {
  loading: () => <TableSkeleton />,
});
```

#### 4.3 Bundle Analysis y Optimización

```bash
# Instalar analyzer
pnpm add -D @next/bundle-analyzer

# Analizar bundles
ANALYZE=true pnpm build
```

**Objetivos:**

- First Load JS: <200KB
- LCP (Largest Contentful Paint): <2.5s
- FID (First Input Delay): <100ms

**Beneficios:**

- 50% reducción en bundle size
- Latencia global <200ms (Edge)

**Costo:** Incluido en Vercel Pro

**Impacto:** 18K usuarios alcanzable

---

### FASE 5: Rate Limiting y Security (1 semana) → 20K usuarios

**Objetivo:** Proteger contra abuso, garantizar disponibilidad.

#### 5.1 Rate Limiting con Upstash Rate Limit

```typescript
// lib/middleware/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Tier-based limits
export const rateLimiters = {
  free: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 h"), // 100 req/hour
    analytics: true,
  }),

  pro: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, "1 h"), // 1K req/hour
    analytics: true,
  }),

  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10000, "1 h"), // 10K req/hour
    analytics: true,
  }),
};

// Middleware
export async function rateLimit(
  identifier: string,
  tier: "free" | "pro" | "api" = "free",
) {
  const { success, remaining, reset } =
    await rateLimiters[tier].limit(identifier);

  return {
    success,
    remaining,
    reset: new Date(reset),
  };
}
```

#### 5.2 Aplicar en Server Actions

```typescript
// lib/actions/resumen.ts
"use server";

import { rateLimit } from "@/lib/middleware/rate-limit";
import { headers } from "next/headers";

export async function fetchTickerResumen(ticker: string) {
  const headersList = headers();
  const ip = headersList.get("x-forwarded-for") || "unknown";

  // Rate limit check
  const { success, remaining } = await rateLimit(ip, "free");

  if (!success) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  // ... fetch data
}
```

#### 5.3 DDoS Protection con Cloudflare (Opcional)

**Ventajas:**

- WAF (Web Application Firewall)
- Bot detection
- Challenge pages para tráfico sospechoso

**Costo:** Cloudflare Pro $20/mes

**Impacto:** 20K+ usuarios con alta disponibilidad

---

## 3. Infraestructura y Costos

### 3.1 Stack Tecnológico Recomendado

| Componente      | Solución                  | Costo Mensual    |
| --------------- | ------------------------- | ---------------- |
| Hosting         | Vercel Pro                | $20              |
| Database        | Supabase Pro              | $25              |
| Read Replicas   | Supabase                  | $100             |
| Redis Cache     | Upstash Pro               | $30              |
| CDN             | Vercel Edge (incluido)    | $0               |
| Rate Limiting   | Upstash (incluido)        | $0               |
| Monitoring      | Vercel Analytics          | $10              |
| DDoS Protection | Cloudflare Pro (opcional) | $20              |
| **TOTAL**       |                           | **$185-205/mes** |

### 3.2 Escalabilidad de Costos

| Usuarios | Costo Mensual | Costo por Usuario |
| -------- | ------------- | ----------------- |
| 2,000    | $45 (base)    | $0.022            |
| 5,000    | $75           | $0.015            |
| 10,000   | $125          | $0.012            |
| 20,000   | $205          | $0.010            |

**Modelo viable:** Cobrar $5-10/mes por usuario pro = ROI positivo desde 100 usuarios.

---

## 4. Monitoring y Observability

### 4.1 Métricas Clave (KPIs)

```typescript
// lib/monitoring/metrics.ts
export interface PerformanceMetrics {
  // Latency
  p50ResponseTime: number; // Target: <200ms
  p95ResponseTime: number; // Target: <500ms
  p99ResponseTime: number; // Target: <1000ms

  // Throughput
  requestsPerSecond: number; // Target: >100 req/s

  // Availability
  uptime: number; // Target: 99.9%
  errorRate: number; // Target: <0.1%

  // Cache
  cacheHitRate: number; // Target: >80%

  // Database
  dbQueryTime: number; // Target: <100ms
  dbConnectionPoolUsage: number; // Target: <70%
}
```

### 4.2 Alertas Automáticas

```typescript
// Configuración en Vercel
{
  "alerts": [
    {
      "name": "High Error Rate",
      "condition": "error_rate > 1%",
      "action": "email",
      "recipients": ["dev@fintra.com"]
    },
    {
      "name": "Slow Response Time",
      "condition": "p95_response_time > 1000ms",
      "action": "slack",
      "channel": "#alerts"
    },
    {
      "name": "Cache Miss Rate High",
      "condition": "cache_hit_rate < 70%",
      "action": "email"
    }
  ]
}
```

### 4.3 Logging Estructurado

```typescript
// lib/monitoring/logger.ts
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  service: string;
  action: string;
  ticker?: string;
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export function log(entry: Omit<LogEntry, 'timestamp'>) {
  console.log(JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString(),
  }));
}

// Uso en Server Actions
export async function fetchTickerResumen(ticker: string) {
  const startTime = Date.now();

  try {
    const data = await getCached(...);

    log({
      level: 'info',
      service: 'resumen',
      action: 'fetch',
      ticker,
      duration: Date.now() - startTime,
    });

    return data;
  } catch (error) {
    log({
      level: 'error',
      service: 'resumen',
      action: 'fetch',
      ticker,
      duration: Date.now() - startTime,
      error: error.message,
    });

    throw error;
  }
}
```

---

## 5. Plan de Implementación

### Timeline Recomendado

```
Semana 1-2:  Fase 1 (Quick Wins)
             - Índices en Supabase
             - Pagination estándar
             - Edge caching básico
             ✓ Milestone: 5K usuarios

Semana 3-6:  Fase 2 (Redis Layer)
             - Upstash setup
             - Cache strategy
             - Invalidation logic
             ✓ Milestone: 10K usuarios

Semana 7-11: Fase 3 (Read Replicas)
             - Supabase replicas
             - Load balancing
             - Connection pooling
             ✓ Milestone: 15K usuarios

Semana 12-13: Fase 4 (CDN + Assets)
              - Bundle optimization
              - Lazy loading
              - Image optimization
              ✓ Milestone: 18K usuarios

Semana 14:    Fase 5 (Rate Limiting)
              - Upstash rate limit
              - DDoS protection
              - Monitoring setup
              ✓ Milestone: 20K+ usuarios
```

### Recursos Necesarios

**Desarrollador:**

- 1 Senior Full-Stack (14 semanas)
- Conocimientos: Next.js, Supabase, Redis, Performance optimization

**DevOps (opcional):**

- 1 DevOps Engineer (4 semanas part-time)
- Para: Monitoring, alertas, infraestructura

**Presupuesto Estimado:**

- Desarrollo: $25,000 - $35,000 (14 semanas × $2K/semana)
- Infraestructura: $3,000/año (~$205/mes × 12)
- **TOTAL AÑO 1:** $28,000 - $38,000

---

## 6. Validación y Testing

### 6.1 Load Testing con k6

```javascript
// tests/load/snapshot-read.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up
    { duration: "5m", target: 1000 }, // Sustained load
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% < 500ms
    http_req_failed: ["rate<0.01"], // <1% errors
  },
};

export default function () {
  const tickers = ["AAPL", "MSFT", "GOOGL", "AMZN"];
  const ticker = tickers[Math.floor(Math.random() * tickers.length)];

  const res = http.get(`https://fintra.com/api/snapshot/${ticker}`);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### 6.2 Stress Testing

```bash
# Ejecutar load test
k6 run --vus 1000 --duration 10m tests/load/snapshot-read.js

# Stress test (encontrar límite)
k6 run --vus 5000 --duration 5m tests/load/stress-test.js
```

### 6.3 Criterios de Éxito

**Performance:**

- ✅ p95 response time <500ms bajo 20K usuarios concurrentes
- ✅ Error rate <0.1%
- ✅ Cache hit rate >80%

**Availability:**

- ✅ Uptime 99.9% (43 min downtime/mes máximo)
- ✅ RTO (Recovery Time Objective): <5 min
- ✅ RPO (Recovery Point Objective): <1 hora

**Cost Efficiency:**

- ✅ Costo por usuario <$0.015/mes
- ✅ ROI positivo con >100 usuarios pro

---

## 7. Riesgos y Mitigaciones

| Riesgo                    | Probabilidad | Impacto | Mitigación                            |
| ------------------------- | ------------ | ------- | ------------------------------------- |
| Supabase rate limits      | Media        | Alto    | Read replicas + caching agresivo      |
| Cache invalidation bugs   | Alta         | Medio   | Tests exhaustivos + TTL conservador   |
| DDoS attacks              | Baja         | Alto    | Cloudflare + rate limiting            |
| Database migration issues | Media        | Alto    | Blue-green deployment + rollback plan |
| Budget overruns           | Media        | Medio   | Monitoring de costos + alertas        |

---

## 8. Conclusiones y Next Steps

### 8.1 Decisión Recomendada

**Implementar Fase 1 y 2 inmediatamente:**

- Retorno rápido (4-6 semanas)
- Bajo costo ($75/mes)
- Alcance 10K usuarios (5x capacidad actual)

**Fases 3-5 cuando se acerque a 8K usuarios:**

- Evitar sobre-ingeniería prematura
- Validar demanda real primero
- Costos solo cuando sean necesarios

### 8.2 Quick Win Inmediato (1 día)

```sql
-- Ejecutar estos índices HOY
CREATE INDEX CONCURRENTLY idx_snapshots_ticker_date
ON fintra_snapshots(ticker, snapshot_date DESC);

CREATE INDEX CONCURRENTLY idx_prices_ticker_date
ON prices_daily(ticker, date DESC);
```

**Impacto esperado:** 50-70% reducción en query time, sin costo adicional.

### 8.3 Siguiente Acción

1. **Ejecutar índices críticos** (arriba)
2. **Configurar Vercel Analytics** ($10/mes)
3. **Implementar pagination estándar** (2-3 días)
4. **Load test baseline** (validar capacidad actual)
5. **Decidir timeline para Fase 2** (Redis)

---

**Contacto para Implementación:**  
Este plan puede ejecutarse internamente o con consultoría externa especializada en Next.js/Supabase performance optimization.

**Última Actualización:** 6 de febrero de 2026

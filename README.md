# Fintra: Terminal Financiero de Acciones

Fintra es un sistema de análisis financiero automatizado que combina ingesta masiva de datos, un motor de scoring propietario (FGOS 3.1) y un frontend moderno para ofrecer insights accionables sobre miles de activos. Construido sobre Next.js 15, Supabase y Financial Modeling Prep (FMP).

---

## Características Principales

### 🧠 Fintra Engine (FGOS 3.1)
Nuestro motor propietario de análisis fundamental:
- **FGOS Score (0-100)**: Evaluación sintética basada en Crecimiento, Rentabilidad, Eficiencia y Solvencia.
- **Valuación Relativa**: Comparación contra benchmarks sectoriales ajustados por confianza estadística.
- **Quality Brakes**: Penalizaciones automáticas por riesgos de quiebra (Altman Z) o manipulación contable (Piotroski F-Score).
- **Veredicto de Inversión**: Recomendación operativa ("Oportunidad", "Esperar", "Evitar") basada en la intersección de calidad y precio.

### 🏗️ Arquitectura de Crons
Sistema backend robusto para procesamiento masivo:
- **Bulk Ingestion**: Procesa +10,000 tickers diarios desde FMP de manera tolerante a fallos.
- **Sector Benchmarks**: Construye percentiles dinámicos diarios por sector e industria.
- **Ecosistema**: Mapeo de relaciones cliente-proveedor y scores de salud de cadena de suministro.
- **Idempotencia**: Todos los procesos son reentrantes y usan cursores de estado en base de datos.

### 🛡️ Integridad y Seguridad
- **Zero Fabrication**: No inferimos datos. Si falta información, el estado es explícitamente `Pending`.
- **Confidence Aware**: Cada métrica calculada incluye un nivel de confianza (High/Medium/Low) basado en la calidad y cantidad de datos subyacentes.
- **Role Separation**: Estricta separación entre claves públicas (Frontend) y `service_role` (Backend Crons).

---

## Arquitectura Técnica

### Stack Tecnológico
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Shadcn UI, Recharts.
- **Backend / Jobs**: Next.js API Routes (Serverless), Cron Jobs.
- **Base de Datos**: Supabase (PostgreSQL) para persistencia de snapshots y series de tiempo.
- **Proveedor de Datos**: Financial Modeling Prep (FMP) Enterprise/Premium.

### Estructura de Carpetas Clave

```bash
/app/
  /api/cron/               # Jobs programados
    /fmp-bulk/             # Ingesta masiva de snapshots (Core)
    /sector-benchmarks/    # Cálculo de percentiles sectoriales
    /sync-universe/        # Sincronización de lista de activos
    /fmp-peers-bulk/       # Relaciones y competidores
    /healthcheck-fmp-bulk/ # Monitoreo y alertas
  /api/fmp/                # Proxies para cliente público (evita exponer API Keys)

/lib/
  /engine/                 # Motor Financiero (Core Logic)
    fintra-brain.ts        # Cálculo de FGOS y Quality Brakes
    resolveValuation...    # Valuación relativa sectorial
    benchmarks.ts          # Definiciones estáticas de benchmarks
    types.ts               # Definiciones de tipos del dominio
  /fmp/                    # Cliente FMP
    server.ts              # Cliente robusto con retry/backoff
    client.ts              # Instancia singleton
  /supabase/               # Clientes DB
    supabase-admin.ts      # Cliente con service_role (Backend Only)
    supabase.ts            # Cliente público (Frontend)

/components/               # Biblioteca de UI
  /cards/                  # Tarjetas de datos (Fundamental, Valoración, etc.)
  /charts/                 # Gráficos (Recharts, Chart.js)
  /dashboard/              # Paneles compuestos
```

---

## Instalación y Despliegue

### Requisitos
- Node.js >= 18
- Cuenta de Supabase
- API Key de Financial Modeling Prep

### Variables de Entorno (.env.local)

```env
# Proveedores de Datos
FMP_API_KEY=tu_api_key
FMP_BASE_URL=https://financialmodelingprep.com

# Base de Datos (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_secreto

# Alertas (Opcional)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

### Comandos

```bash
# Instalación
pnpm install

# Desarrollo
pnpm dev

# Build
pnpm build
```

---

## Operación de Crons

Los crons están diseñados para ser invocados vía HTTP (Vercel Cron o manual):

| Ruta | Descripción | Frecuencia |
|------|-------------|------------|
| `/api/cron/sync-universe` | Sincroniza lista de tickers activos | Diario |
| `/api/cron/fmp-bulk` | Ingesta masiva de fundamentales | Diario |
| `/api/cron/sector-benchmarks` | Construye percentiles sectoriales | Diario (post-bulk) |
| `/api/cron/healthcheck-fmp-bulk` | Verifica ejecución correcta | Diario |

---

## Reglas de Ingeniería

Consulte [FINTRA_ENGINEERING_RULES.md](./FINTRA_ENGINEERING_RULES.md) para detalles sobre:
1. **Tolerancia a Fallos**: Un error en un ticker nunca detiene un proceso masivo.
2. **Manejo de Datos**: `Pending` no es un error.
3. **Seguridad**: Nunca usar `service_role` en componentes de cliente.

---

## Licencia

Propiedad de Fintra. Todos los derechos reservados.

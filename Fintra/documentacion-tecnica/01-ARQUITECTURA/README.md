# 01-ARQUITECTURA - Documentación Arquitectónica

**Última actualización:** 7 de febrero de 2026  
**Consolidación:** Documentos arquitectónicos de alto nivel

---

## 📋 Índice de Documentos

### ⭐ Documentos Principales

**[DIAGRAMA_DE_FLUJO.md](./DIAGRAMA_DE_FLUJO.md)** - Visualización completa del sistema Fintra

**Contenido:**

- Arquitectura general (Vista de alto nivel, Principios)
- Flujo de datos completo (Pipeline de 3 capas)
- Orden de ejecución de cron jobs (5 niveles, dependencias)
- Engines de scoring (FGOS, IFS, IQS, integración)
- Flujo frontend (Next.js, Server Actions, componentes)
- Backfills y mantenimiento
- Arquitectura de base de datos (Schema completo, relaciones)
- Puntos críticos de integración
- Decisiones arquitectónicas clave

**Audiencia:** Todos los roles técnicos (desarrolladores, DevOps, arquitectos)

**Cuándo consultar:**

- Primera vez trabajando con Fintra
- Necesitas entender el flujo completo del sistema
- Debugging de dependencias entre componentes
- Documentando cambios arquitectónicos

---

**[ARCHITECTURAL_STATUS_REPORT.md](./ARCHITECTURAL_STATUS_REPORT.md)** - Reporte de estado arquitectónico

**Contenido:**

- Estado actual de la arquitectura (capas de datos)
- Issues resueltos recientemente (violaciones detectadas y corregidas)
- Gaps conocidos y esperados (performance_windows, datos faltantes)
- Determinismo y auditabilidad
- Validación de integridad arquitectónica

**Fecha:** 2 de febrero de 2026  
**Audiencia:** Arquitectos, tech leads

**Cuándo consultar:**

- Validando integridad del sistema
- Debugging de problemas de datos faltantes
- Revisión de principios arquitectónicos (no inventar datos, pending no es error)
- Auditorías de calidad

---

**[ESCALABILIDAD_20K_USUARIOS.md](./ESCALABILIDAD_20K_USUARIOS.md)** - Plan de escalabilidad

**Contenido:**

- Análisis del estado actual (~2K usuarios concurrentes)
- Objetivo: 20K usuarios concurrentes con latencia <500ms
- Fortalezas arquitectónicas existentes
- Bottlenecks identificados (DB queries, bundle size, crons)
- Plan de optimización por fases (corto, mediano, largo plazo)
- Estimaciones de costos (Supabase, Vercel, infraestructura)
- Métricas y monitoreo
- Plan de pruebas de carga

**Fecha:** 6 de febrero de 2026  
**Audiencia:** Arquitectos, product managers, DevOps

**Cuándo consultar:**

- Planeando crecimiento del sistema
- Debugging de problemas de performance
- Decisiones de infraestructura
- Estimaciones de ROI técnico

---

**[PARALLELIZATION_PATTERNS.md](./PARALLELIZATION_PATTERNS.md)** - Patrones de paralelización

**Contenido:**

- Filosofía core: "Parallelize I/O, Keep CPU Sequential"
- Cuándo paralelizar (database writes, API calls, file I/O)
- Cuándo NO paralelizar (stateful processing, sequential logic)
- Patrones implementados en Fintra:
  - Financials bulk ingestion (~3 min con chunks paralelos)
  - TTM valuation backfill (batches secuenciales + writes paralelos)
  - Sector benchmarks (sequential processing + batch upserts)
- Anti-patrones y errores comunes
- Guías de debugging (logs, memory profiling)

**Fecha:** 6 de febrero de 2026  
**Audiencia:** Desarrolladores backend, optimizadores de performance

**Cuándo consultar:**

- Implementando nuevos cron jobs o backfills
- Optimizando performance de pipelines
- Debugging de memory leaks o race conditions
- Revisión de código para PRs de pipeline

---

## 🎯 Flujo de Lectura Recomendado

### Para Nuevos Desarrolladores

1. **[DIAGRAMA_DE_FLUJO.md](./DIAGRAMA_DE_FLUJO.md)** - Empezar aquí para entender el big picture
2. **[ARCHITECTURAL_STATUS_REPORT.md](./ARCHITECTURAL_STATUS_REPORT.md)** - Entender estado actual y principios
3. **[PARALLELIZATION_PATTERNS.md](./PARALLELIZATION_PATTERNS.md)** - Antes de escribir código de pipeline

### Para Troubleshooting

1. **[ARCHITECTURAL_STATUS_REPORT.md](./ARCHITECTURAL_STATUS_REPORT.md)** - Verificar que el problema no sea un "gap esperado"
2. **[DIAGRAMA_DE_FLUJO.md](./DIAGRAMA_DE_FLUJO.md)** - Revisar dependencias y flujos
3. Consultar [10-TROUBLESHOOTING/](../10-TROUBLESHOOTING/) para problemas específicos

### Para Optimización

1. **[ESCALABILIDAD_20K_USUARIOS.md](./ESCALABILIDAD_20K_USUARIOS.md)** - Identificar bottlenecks prioritarios
2. **[PARALLELIZATION_PATTERNS.md](./PARALLELIZATION_PATTERNS.md)** - Aplicar patrones correctos
3. Medir impacto y documentar en CHANGELOG

---

## 📚 Documentación Relacionada

**Complementa con:**

- [04-ENGINES/](../04-ENGINES/) - Lógica de scoring (FGOS, IFS, IQS)
- [05-CRON-JOBS/](../05-CRON-JOBS/) - Ejecución y orden de cron jobs
- [06-BACKFILLS/](../06-BACKFILLS/) - Scripts de poblado inicial
- [08-DATABASE/](../08-DATABASE/) - Schema completo de tablas

---

## 🔧 Principios Arquitectónicos de Fintra

Estos principios están documentados en profundidad en los archivos de esta carpeta:

1. **Fintra no inventa datos** → `NULL` > defaults
2. **Single source of truth** → Cron jobs calculan 1 vez, clientes leen
3. **Dual head** → Web y Desktop leen mismos snapshots
4. **Fault tolerant** → Error en 1 ticker ≠ abort total
5. **Point-in-time** → No look-ahead bias
6. **Parallelize I/O, Sequential CPU** → Mantener estado predecible
7. **Pending is not an error** → Representar datos faltantes honestamente

Consulta [ARCHITECTURAL_STATUS_REPORT.md](./ARCHITECTURAL_STATUS_REPORT.md) para validación de estos principios.

---

## 📊 Métricas de Consolidación

**Antes (documentacion-tecnica/ completa):**

- ~50+ documentos dispersos en raíz y subcarpetas
- README obsoleto con 32+ referencias incorrectas
- Duplicados sin resolver (CRON_EXECUTION_ORDER.md × 2)
- Documentos de arquitectura mezclados con operativos

**Después (01-ARQUITECTURA/):**

- 4 documentos arquitectónicos consolidados
- README preciso y actualizado
- Sin duplicados
- Clara separación de responsabilidades

**Total eliminado/movido:** 8+ docs reorganizados en esta consolidación

---

## 🔗 Enlaces Rápidos

- [Raíz documentación](../)
- [Diagrama de flujo completo](./DIAGRAMA_DE_FLUJO.md)
- [Estado arquitectónico](./ARCHITECTURAL_STATUS_REPORT.md)
- [Plan de escalabilidad](./ESCALABILIDAD_20K_USUARIOS.md)
- [Patrones de paralelización](./PARALLELIZATION_PATTERNS.md)

---

**Última revisión:** 2026-02-07  
**Mantenido por:** Fintra Engineering Team  
**Consolidación:** Febrero 2026 (reorganización completa de documentación)

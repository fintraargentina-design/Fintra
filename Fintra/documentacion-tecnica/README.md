# 📚 DOCUMENTACIÓN TÉCNICA - FINTRA

**Última actualización:** 2026-02-04  
**Versión:** 2.0 (Reorganizada)

---

## 🎯 INICIO RÁPIDO

- **¿Primera vez aquí?** Lee [DIAGRAMA_DE_FLUJO.md](DIAGRAMA_DE_FLUJO.md)
- **¿Necesitas ejecutar algo?** Ve a [05-CRON-JOBS/](05-CRON-JOBS/)
- **¿Problemas técnicos?** Consulta [10-TROUBLESHOOTING/](10-TROUBLESHOOTING/)
- **¿Tareas pendientes?** Revisa [11-PENDIENTES/](11-PENDIENTES/)

---

## 📂 ESTRUCTURA DE LA DOCUMENTACIÓN

### [📊 DIAGRAMA_DE_FLUJO.md](DIAGRAMA_DE_FLUJO.md)

**⭐ DOCUMENTO MAESTRO** - Visualización completa de arquitectura y flujos

Contiene:

- Arquitectura general
- Flujo de datos (Data Pipeline)
- Orden de ejecución de cron jobs
- Engines de scoring (FGOS, IFS, IQS)
- Arquitectura frontend
- Base de datos (schema completo)

---

## 📁 CARPETAS ORGANIZADAS POR FLUJO

### [01-ARQUITECTURA/](01-ARQUITECTURA/)

Diseño general del sistema

- `CATALOGO_ANALISIS_USUARIO.md` - Escenarios y focos analíticos
- `ARCHITECTURAL_STATUS_REPORT.md` - Estado de arquitectura

**📖 Leer si:** Necesitas entender la filosofía del sistema

---

### [02-SETUP/](02-SETUP/)

Configuración inicial y deployment

- `LOCAL_SETUP.md` - Setup de entorno local
- `DEPLOYMENT_CHECKLIST.md` - Deploy a producción
- `README_EJECUTABLES.md` - Scripts auxiliares
- `INSTRUCCIONES_MIGRATION.md` - Migraciones de DB
- `MIGRATION_PERFORMANCE_WINDOWS.md` - Performance específico

**📖 Leer si:** Estás configurando Fintra por primera vez

---

### [03-DATA-PIPELINE/](03-DATA-PIPELINE/)

Ingesta y transformación de datos

- `TTM_VALUATION_IMPLEMENTATION_GUIDE.md` - Guía TTM valuation

**📖 Leer si:** Trabajas con datos financieros o FMP API

---

### [04-ENGINES/](04-ENGINES/)

Motores de scoring y análisis

- `QUALITY_BRAKES_GUIDE.md` ⭐ - Guía de Quality Brakes (Altman Z, Piotroski)
- `DOCUMENTACION_IFS.md` - Industry Financial Standing
- `IQS_INFORME.md` - Industry Quality Score
- `IQS_REFACTORING_COMPLETE.md` - Refactor IQS (Feb 2)
- `TTM_V2_REFACTORING_SUMMARY.md` - Refactor TTM (Feb 3)

**📖 Leer si:** Necesitas entender cómo se calculan los scores

---

### [05-CRON-JOBS/](05-CRON-JOBS/)

Ejecución automatizada

- `CRON_EXECUTION_ORDER.md` ⭐ - Orden de ejecución (CRÍTICO)
- `CRON_EXECUTION_ORDER_CORRECTED.md` - Versión corregida
- `RUN-CRONS-README.md` - Cómo ejecutar crons
- `EJECUCION_CRON_BACKFILL.md` - Ejecución de backfills

**📖 Leer si:** Necesitas ejecutar actualizaciones diarias

---

### [06-BACKFILLS/](06-BACKFILLS/)

Scripts de población histórica

- `00-BACKFILL_INSTRUCTIONS.md` ⭐ - Lista completa de backfills
- `TTM_HISTORICAL_VALUATION_IMPLEMENTATION.md` - TTM backfill histórico

**📖 Leer si:** Necesitas poblar datos históricos

---

### [07-FRONTEND/](07-FRONTEND/)

Arquitectura web y desktop

- `RELACION_NOTICIAS_ESCENARIOS.md` - Relación noticias/escenarios

**📖 Leer si:** Desarrollas en frontend o integras desktop client

---

### [08-DATABASE/](08-DATABASE/)

Schema y validaciones

- `COMO_VALIDAR_BASE_DATOS.md` - Queries de validación

**📖 Leer si:** Necesitas verificar integridad de datos

---

### [09-AUDITORIAS/](09-AUDITORIAS/)

Reportes de auditoría técnica

- `AUDITORIA_DOCUMENTACION_COMPLETA_2026-02-04.md` ⭐ - Auditoría completa (Feb 4)
- `AUDITORIA_ENGINES_COMPLETA_2026-02-02.md` - Auditoría engines (Feb 2)
- `AUDITORIA_TECNICA_MASTER.md` - Auditoría master
- `AUDITORIA_FINTRA_COMPLETA.md` - Auditoría general
- `AUDITORIA_CRON_BACKFILL.md` - Auditoría crons
- `AUDITORIA_IFS_RADIAL.md` - Auditoría IFS
- `AUDIT_FIXES_REPORT.md` - Reporte de fixes
- `INFORME_CORRECCIONES_COMPLETO.md` - Correcciones aplicadas
- `INFORME_CRON_BACKFILL.md` - Informe backfills
- `RESUMEN_AUDITORIA.md` - Resumen ejecutivo
- `SOLUCIONES_IMPLEMENTADAS.md` - Soluciones aplicadas
- `VERIFICACION_COMPLETADA.md` - Verificaciones

**📖 Leer si:** Necesitas contexto histórico de cambios

---

### [10-TROUBLESHOOTING/](10-TROUBLESHOOTING/)

Resolución de problemas

- `TTM_TROUBLESHOOTING.md` ⭐ - Problemas TTM valuation
- `PROBLEMA_RELATIVERETURN1Y.md` - Problema específico

**📖 Leer si:** Tienes errores o comportamientos inesperados

---

### [11-PENDIENTES/](11-PENDIENTES/)

Tareas y seguimiento

- `PENDIENTES.md` ⭐ - Lista de tareas con checkboxes
- `CHANGELOG.md` - Historial de cambios

**📖 Leer si:** Quieres saber qué falta por hacer

---

### [archive/](archive/)

Documentos obsoletos o superseded

- Documentos pre-refactor
- Versiones antiguas

**📖 Leer si:** Investigas historia del proyecto

---

## 🎯 FLUJOS DE TRABAJO COMUNES

### 1. Setup Inicial

```
1. Leer: 02-SETUP/LOCAL_SETUP.md
2. Leer: DIAGRAMA_DE_FLUJO.md (sección "Arquitectura")
3. Ejecutar: Migraciones de DB
4. Ejecutar: Primer backfill (06-BACKFILLS/)
5. Ejecutar: Cron jobs (05-CRON-JOBS/)
```

### 2. Debugging de Datos

```
1. Leer: 10-TROUBLESHOOTING/TTM_TROUBLESHOOTING.md
2. Ejecutar: 08-DATABASE/COMO_VALIDAR_BASE_DATOS.md
3. Verificar: DIAGRAMA_DE_FLUJO.md (sección "Quality Gates")
4. Si persiste: Crear issue en 11-PENDIENTES/PENDIENTES.md
```

### 3. Agregar Nuevo Engine

```
1. Leer: DIAGRAMA_DE_FLUJO.md (sección "Engines")
2. Revisar: 04-ENGINES/ (engines existentes)
3. Implementar: Seguir patrón de computeTTMv2
4. Integrar: En bulk-update cron (05-CRON-JOBS/)
5. Documentar: Crear nuevo .md en 04-ENGINES/
6. Actualizar: DIAGRAMA_DE_FLUJO.md
```

### 4. Deployment a Producción

```
1. Leer: 02-SETUP/DEPLOYMENT_CHECKLIST.md
2. Verificar: 08-DATABASE/COMO_VALIDAR_BASE_DATOS.md
3. Ejecutar: Migraciones pendientes
4. Ejecutar: Backfills necesarios
5. Validar: Cron jobs funcionando
6. Monitor: Logs por 24 horas
```

---

## 📖 DOCUMENTOS ESENCIALES (Orden de lectura)

### Para Desarrolladores Nuevos:

1. ⭐ [DIAGRAMA_DE_FLUJO.md](DIAGRAMA_DE_FLUJO.md)
2. ⭐ [01-ARQUITECTURA/CATALOGO_ANALISIS_USUARIO.md](01-ARQUITECTURA/CATALOGO_ANALISIS_USUARIO.md)
3. ⭐ [05-CRON-JOBS/CRON_EXECUTION_ORDER.md](05-CRON-JOBS/CRON_EXECUTION_ORDER.md)
4. [02-SETUP/LOCAL_SETUP.md](02-SETUP/LOCAL_SETUP.md)
5. [04-ENGINES/QUALITY_BRAKES_GUIDE.md](04-ENGINES/QUALITY_BRAKES_GUIDE.md)

### Para Analistas Financieros:

1. ⭐ [01-ARQUITECTURA/CATALOGO_ANALISIS_USUARIO.md](01-ARQUITECTURA/CATALOGO_ANALISIS_USUARIO.md)
2. ⭐ [04-ENGINES/QUALITY_BRAKES_GUIDE.md](04-ENGINES/QUALITY_BRAKES_GUIDE.md)
3. [DIAGRAMA_DE_FLUJO.md](DIAGRAMA_DE_FLUJO.md) (secciones Engines)
4. [08-DATABASE/COMO_VALIDAR_BASE_DATOS.md](08-DATABASE/COMO_VALIDAR_BASE_DATOS.md)

### Para Operaciones/DevOps:

1. ⭐ [05-CRON-JOBS/CRON_EXECUTION_ORDER.md](05-CRON-JOBS/CRON_EXECUTION_ORDER.md)
2. ⭐ [06-BACKFILLS/00-BACKFILL_INSTRUCTIONS.md](06-BACKFILLS/00-BACKFILL_INSTRUCTIONS.md)
3. [02-SETUP/DEPLOYMENT_CHECKLIST.md](02-SETUP/DEPLOYMENT_CHECKLIST.md)
4. [10-TROUBLESHOOTING/TTM_TROUBLESHOOTING.md](10-TROUBLESHOOTING/TTM_TROUBLESHOOTING.md)
5. [11-PENDIENTES/PENDIENTES.md](11-PENDIENTES/PENDIENTES.md)

---

## 🔄 PROCESO DE ACTUALIZACIÓN DE DOCS

Cuando modifiques código que afecte arquitectura:

1. **Actualizar DIAGRAMA_DE_FLUJO.md** si cambia flujo principal
2. **Actualizar documento específico** en carpeta correspondiente
3. **Actualizar PENDIENTES.md** si quedan tareas
4. **Marcar como completado** (~~texto tachado~~) lo que terminó
5. **Crear entry en CHANGELOG.md**

**Ejemplo:**

```markdown
// Si modificas TTM engine:

1. Actualizar: 04-ENGINES/TTM_V2_REFACTORING_SUMMARY.md
2. Actualizar: DIAGRAMA_DE_FLUJO.md (sección 4.1)
3. Actualizar: 10-TROUBLESHOOTING/TTM_TROUBLESHOOTING.md (si aplica)
4. Actualizar: 11-PENDIENTES/PENDIENTES.md (marcar completado)
```

---

## 🆘 ¿NECESITAS AYUDA?

1. **Busca en:** [10-TROUBLESHOOTING/](10-TROUBLESHOOTING/)
2. **Consulta auditorías:** [09-AUDITORIAS/](09-AUDITORIAS/)
3. **Revisa pendientes:** [11-PENDIENTES/PENDIENTES.md](11-PENDIENTES/PENDIENTES.md)
4. **Si no resuelves:** Crea issue con:
   - Síntoma específico
   - Queries ejecutadas
   - Ticker afectado (si aplica)
   - Logs relevantes

---

## 📊 ESTADÍSTICAS DE DOCUMENTACIÓN

- **Total documentos:** 36
- **Carpetas:** 11
- **Documentos ⭐ (críticos):** 8
- **Última reorganización:** 2026-02-04
- **Última auditoría completa:** 2026-02-04

---

## 🔗 LINKS EXTERNOS ÚTILES

- [Supabase Admin Console](https://supabase.com/dashboard)
- [FMP API Documentation](https://site.financialmodelingprep.com/developer/docs)
- [Altman Z-Score Paper (1968)](https://www.jstor.org/stable/2490171)
- [Piotroski F-Score Paper (2000)](https://www.jstor.org/stable/2672906)

---

**Mantenido por:** Fintra Engineering Team  
**Última revisión:** 2026-02-04  
**Versión de documentación:** 2.0

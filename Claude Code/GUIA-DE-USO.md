# Guía de Uso de los Documentos Fintra

## 📚 Resumen de Documentos Creados

He creado **3 documentos diferentes** para gestionar las 57 mejoras de Fintra:

### 1. **fintra-roadmap-executive.md**
**Para:** Stakeholders, Product Owner, tú (para visión estratégica)
**Cuándo usar:** Planning trimestral, reportes de progreso, decisiones de priorización

### 2. **fintra-backlog-technical.md**
**Para:** Claude Code (con supervisión humana)
**Cuándo usar:** Como referencia completa de todos los tickets técnicos

### 3. **fintra-sprint-1-plan.md** ⭐ **ESTE ES EL QUE USAS CON CLAUDE CODE**
**Para:** Ejecución inmediata, día a día
**Cuándo usar:** Darle a Claude Code para implementar en las próximas 2 semanas

---

## 🎯 Cómo Usar Cada Documento

### ROADMAP EJECUTIVO (fintra-roadmap-executive.md)

**Propósito:**
Vista de alto nivel para planificación estratégica.

**Contenido:**
- Timeline de 4 trimestres (Q1-Q4 2025)
- Objetivos por quarter
- Estimación de costos
- KPIs de éxito
- Decisiones críticas pendientes

**Uso recomendado:**
```
1. Úsalo para planificar con tu equipo/stakeholders
2. Define prioridades por trimestre
3. Trackea progreso contra objetivos
4. Justifica inversión (muestra ROI de usar Claude Code)
```

**Ejemplo de uso:**
> "Necesitamos decidir si invertir en validación empírica. 
> Abre fintra-roadmap-executive.md → Sección Q2 2025 
> → Ve que backtesting es CRÍTICO para certificación institucional
> → Decisión: Sí, priorizar Q2 para backtesting"

---

### BACKLOG TÉCNICO (fintra-backlog-technical.md)

**Propósito:**
Catálogo completo de todos los tickets técnicos con detalles de implementación.

**Contenido:**
- 57 tickets con checkboxes
- Descripción técnica detallada
- Archivos involucrados
- Criterios de aceptación
- Estimaciones de tiempo

**Uso recomendado:**
```
1. Referencia cuando necesites detalles de un ticket específico
2. Para crear Sprints futuros (Sprint 2, 3, 4...)
3. Como knowledge base de qué hay que hacer
```

**Ejemplo de uso:**
> "Terminamos Sprint 1, ¿qué sigue?
> Abre fintra-backlog-technical.md
> → Busca tickets marcados [ ] (pendientes)
> → Filtra por SPRINT 2 o SPRINT 3
> → Crea nuevo sprint-plan basado en esos tickets"

**NO le des este documento completo a Claude Code** (es muy largo, se confundirá).
Úsalo como referencia para crear Sprints específicos.

---

### SPRINT PLAN (fintra-sprint-1-plan.md) ⭐

**Propósito:**
Plan de ejecución detallado para las próximas 2 semanas.

**Contenido:**
- 11 tickets priorizados y ordenados
- Pasos específicos con código completo
- Orden de ejecución lógico (evita bloqueos)
- Tests para cada ticket
- Checkboxes para tracking

**Uso recomendado:**
```
✅ SÍ: Darle este documento a Claude Code
✅ SÍ: Usarlo como plan día a día
✅ SÍ: Marcar checkboxes conforme avanzas
```

**Cómo trabajar con Claude Code:**

#### Opción A: Todo el Sprint de una vez (Recomendado si supervises poco)
```
1. Abre Claude Code en tu terminal
2. Ejecuta: claude-code chat
3. Mensaje a Claude Code:

"Aquí está el plan completo del Sprint 1. 
Implementa los tickets en orden, comenzando por Ticket #1.

Después de cada ticket:
- Muéstrame qué archivos modificaste
- Pídeme que revise antes de continuar
- Espera mi confirmación para seguir

[Pega contenido de fintra-sprint-1-plan.md]"
```

#### Opción B: Ticket por Ticket (Recomendado si quieres control)
```
1. Abre Claude Code
2. Copia solo el TICKET #1 del Sprint Plan
3. Mensaje a Claude Code:

"Implementa este ticket siguiendo los pasos exactos.
Cuando termines, muéstrame un diff de los cambios.

[Pega solo Ticket #1]"

4. Revisa el trabajo
5. Si OK → Dale siguiente ticket
6. Si NOT OK → Pídele correcciones
```

---

## 🔄 Workflow Recomendado (Ciclo Completo)

### FASE 1: Planificación (1 vez al inicio)
```
1. Lee fintra-roadmap-executive.md
2. Decide qué trimestre estás atacando (probablemente Q1)
3. Confirma que las prioridades están correctas
```

### FASE 2: Sprint Actual (Cada 2 semanas)
```
1. Usa fintra-sprint-1-plan.md con Claude Code
2. Implementa los 11 tickets
3. Marca checkboxes conforme completas
4. Revisa cada ticket antes de seguir
```

### FASE 3: Próximos Sprints
```
1. Cuando termines Sprint 1
2. Abre fintra-backlog-technical.md
3. Busca siguiente grupo de tickets
4. Créame un nuevo sprint-plan.md (yo te ayudo)
5. Repite Fase 2
```

### FASE 4: Fin de Trimestre
```
1. Revisa fintra-roadmap-executive.md
2. Verifica si cumpliste objetivos del quarter
3. Ajusta prioridades para siguiente quarter
```

---

## 💡 Tips para Trabajar con Claude Code

### ✅ DO's (Haz esto)

1. **Dale contexto de proyecto**
```
"Estás trabajando en Fintra, una app Next.js + Supabase para análisis financiero.
Los archivos principales están en:
- /lib/engine/ (motores de cálculo)
- /app/ (rutas Next.js)
- /components/ (UI components)

Aquí está el ticket a implementar..."
```

2. **Pídele que te muestre cambios antes de aplicarlos**
```
"Antes de modificar cualquier archivo, muéstrame un diff de los cambios propuestos"
```

3. **Divide tickets grandes**
```
Si un ticket tiene 5 pasos, pídele que haga 1 paso a la vez:
"Primero implementa solo el paso 1 (crear migration SQL)"
```

4. **Usa los tests incluidos**
```
Cada ticket en el Sprint Plan incluye sección de Tests.
"Ahora ejecuta los tests que vienen en el ticket para verificar"
```

### ❌ DON'Ts (No hagas esto)

1. **No le des los 3 documentos juntos**
```
❌ "Aquí están roadmap + backlog + sprint, implementa todo"
✅ "Aquí está el Sprint 1, implementa ticket por ticket"
```

2. **No asumas que recuerda contexto entre sesiones**
```
Cada vez que abras Claude Code, dale contexto de nuevo:
- En qué proyecto trabajas
- Qué tecnologías usas
- Qué ticket vas a atacar
```

3. **No dejes que modifique archivos sin revisar**
```
❌ "Implementa todo el sprint y avísame cuando termines"
✅ "Implementa Ticket #1, muéstrame diff, espera mi OK"
```

4. **No uses el backlog técnico completo como input**
```
❌ 57 tickets de una vez → Claude Code se confunde
✅ 1 sprint a la vez (10-15 tickets máximo)
```

---

## 📋 Checklist Antes de Empezar

Antes de darle trabajo a Claude Code, asegúrate:

- [ ] Tienes acceso a Supabase (para crear tablas)
- [ ] Tienes acceso al repo de Fintra
- [ ] Conoces la estructura de carpetas del proyecto
- [ ] Has leído el Sprint Plan completo
- [ ] Entiendes qué hace cada ticket
- [ ] Sabes qué archivos se van a modificar
- [ ] Tienes tiempo para supervisar (no lo dejes solo 8 horas)

---

## 🎯 Ejemplo Práctico: Primer Día con Claude Code

### Paso a Paso

**1. Prepara el entorno** (5 min)
```bash
cd /ruta/a/fintra
git checkout -b sprint-1-transparency
git pull origin main
```

**2. Abre Claude Code** (1 min)
```bash
claude-code chat
```

**3. Dale contexto inicial** (Copy/paste esto)
```
Hola Claude Code! Voy a trabajar contigo en implementar mejoras para Fintra.

CONTEXTO DEL PROYECTO:
- Fintra es una app de análisis financiero (Next.js 14 + Supabase)
- Tenemos 4 "engines": FGOS, IFS, Valuation, Life Cycle
- Los engines calculan scores para empresas del S&P 500
- Código principal en /lib/engine/
- UI en /app/ y /components/

ESTRUCTURA DE DATOS:
- Tabla principal: fintra_snapshots (JSONB con todos los scores)
- Usamos Supabase como DB + Auth
- API de datos: Financial Modeling Prep (FMP)

TECNOLOGÍAS:
- TypeScript (strict mode)
- Next.js 14 (App Router)
- Supabase (PostgreSQL + Auth)
- TailwindCSS para UI

PLAN DE HOY:
Vamos a implementar Ticket #1: Sistema de Versioning de Benchmarks

¿Listo para empezar?
```

**4. Dale el Ticket #1** (Copy/paste del Sprint Plan)
```
Aquí está el ticket completo:

[Pega todo el contenido de TICKET #1 desde fintra-sprint-1-plan.md]

INSTRUCCIONES:
1. Lee todo el ticket primero
2. Implementa paso 1 (crear migration SQL)
3. Muéstrame el SQL antes de ejecutarlo
4. Espera mi confirmación
5. Luego seguimos con paso 2

¿Entendido? Comienza con el paso 1.
```

**5. Revisa su trabajo**
```
Claude Code te mostrará el SQL.
TÚ revisas:
- ¿Nombres de columnas correctos?
- ¿Tipos de datos apropiados?
- ¿Índices necesarios?

Si OK → "Perfecto, ejecuta esa migration en Supabase"
Si NOT OK → "Cambia el tipo de 'universe_size' a integer, no numeric"
```

**6. Continúa así con cada paso**
```
Paso 1 ✅ → Paso 2 ✅ → Paso 3 ✅ ... → Paso 5 ✅

Al final del ticket:
"Ejecuta los tests del ticket para verificar que todo funciona"
```

**7. Marca el ticket como completo**
```
En tu Sprint Plan local:
✅ TICKET #1: Sistema de Versioning de Benchmarks [DONE]

Git:
git add .
git commit -m "feat: implement benchmark versioning system (Ticket #1)"
```

**8. Siguiente ticket**
```
"Excelente Claude Code! Ahora vamos con Ticket #2: Benchmark Changelog Público

[Pega Ticket #2]

Mismo proceso: paso a paso, muéstrame cambios, espera confirmación."
```

---

## 🚀 Resumen Ejecutivo

### Para empezar AHORA:

1. **Lee:** `fintra-roadmap-executive.md` (10 min) - Entiende el plan general
2. **Referencia:** `fintra-backlog-technical.md` - Guárdalo para consultar
3. **USA:** `fintra-sprint-1-plan.md` - Dale esto a Claude Code

### Primera sesión con Claude Code:

```
1. Abre Claude Code
2. Dale contexto del proyecto
3. Dale Ticket #1 del Sprint Plan
4. Supervisa paso a paso
5. Marca completados
6. Continúa con siguiente ticket
```

### Cuando termines Sprint 1:

```
1. Marca todos los checkboxes en Sprint Plan
2. Revisa que todo funcione
3. Merge a main
4. Créame un nuevo Sprint Plan para Sprint 2
```

---

## 📞 Cuándo Contactarme

**Créame un nuevo Sprint Plan si:**
- Terminaste Sprint 1 y necesitas Sprint 2
- Quieres cambiar prioridades
- Necesitas más detalle en algún ticket

**Pregúntame directamente si:**
- Claude Code está confundido con un ticket
- No estás seguro de una decisión técnica
- Algo no funciona como esperado

---

## ✨ Última Recomendación

**No intentes hacer los 57 items de una vez.**

Sprint 1 (11 tickets) te tomará ~2 semanas con Claude Code.
Si lo completas, habrás agregado:
- ✅ Versioning de benchmarks
- ✅ Changelog público
- ✅ Confidence scores
- ✅ Trajectory analysis
- ✅ Dashboards de transparencia
- ✅ Documentación técnica
- ✅ FAQ y disclaimers

**Eso ya es 30% de mejora visible en el producto.**

Celebra ese win, muéstraselo a usuarios, recoge feedback, y luego ataca Sprint 2.

**Velocidad sostenible > velocidad insostenible**

---

**¿Listo para empezar con Ticket #1?** 🚀


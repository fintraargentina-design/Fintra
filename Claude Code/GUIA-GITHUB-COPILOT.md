# Guía para GitHub Copilot + Sprint Plan

## 🎯 Setup Inicial

### 1. Configurar Copilot en VS Code

```bash
# Instalar extensiones (si no las tienes)
code --install-extension GitHub.copilot
code --install-extension GitHub.copilot-chat
```

En VS Code:
- Settings → GitHub Copilot → Model → **Claude 3.5 Sonnet**
- Reinicia VS Code

### 2. Abrir Proyecto

```bash
cd /path/to/fintra
code .
```

### 3. Abrir Copilot Chat

- **Atajo:** `Cmd+Shift+I` (Mac) o `Ctrl+Shift+I` (Windows/Linux)
- **O:** View → Command Palette → "GitHub Copilot: Open Chat"

---

## 💬 Template de Contexto Inicial

**COPIA/PEGA ESTO AL INICIO DE CADA SESIÓN:**

```
Hola GitHub Copilot! 

Voy a implementar mejoras en Fintra usando un Sprint Plan detallado.
Para cada ticket, te voy a pedir código específico que yo copiaré a los archivos.

CONTEXTO DEL PROYECTO:
- Fintra: App de análisis financiero (Next.js 14 + Supabase + TypeScript)
- 4 Engines: FGOS, IFS, Valuation, Life Cycle
- DB: Supabase (PostgreSQL)
- API externa: Financial Modeling Prep (FMP)

ESTRUCTURA DE CARPETAS:
- /lib/engine/ → Lógica de cálculo de scores
- /app/ → Rutas Next.js (App Router)
- /components/ → React components
- /lib/supabase/ → Cliente de Supabase

MI WORKFLOW:
1. Te daré un ticket del Sprint Plan
2. Tú me darás el código paso a paso
3. Yo copiaré/pegaré en archivos
4. Yo ejecutaré SQL en Supabase manualmente
5. Te confirmo cuando un paso esté listo
6. Continuamos con el siguiente

¿Listo? Voy a darte el primer ticket.
```

---

## 📋 Template por Ticket

**Para CADA ticket, usa este template:**

```
# TICKET: [Número y nombre]

[Pega aquí el ticket completo del Sprint Plan]

---

CONTEXTO:
- Tengo VS Code abierto con el proyecto Fintra
- Tengo acceso a Supabase Dashboard (para SQL)
- Puedo crear/modificar archivos manualmente

INSTRUCCIONES:
1. Dame el código para el PASO 1 solamente
2. Espera mi "✅ Paso 1 completo" antes de continuar
3. Si es SQL: dame el SQL completo (yo lo ejecutaré en Supabase)
4. Si es TypeScript: dame el archivo completo
5. Si es modificación: dame el código exacto a agregar/cambiar

Empecemos con PASO 1.
```

---

## 🔄 Workflow Paso a Paso

### PASO 1: Copilot da código
```
TÚ: "Dame el código para PASO 1"

COPILOT: [SQL o TypeScript]
```

### PASO 2: Tú ejecutas/copias
```
Si es SQL:
1. Copia el SQL
2. Abre Supabase Dashboard
3. SQL Editor → New Query
4. Pega y ejecuta

Si es TypeScript:
1. Crea el archivo en VS Code
2. Pega el código
3. Guarda (Cmd+S)
```

### PASO 3: Confirmas
```
TÚ: "✅ Paso 1 completo. Dame el código para PASO 2"

COPILOT: [Siguiente código]
```

### PASO 4: Repite
```
Continúa así hasta completar todos los pasos del ticket
```

### PASO 5: Test
```
TÚ: "Dame los comandos de test para este ticket"

COPILOT: [Test commands]

TÚ: [Ejecutas en terminal]
```

### PASO 6: Commit
```bash
git add .
git commit -m "feat: [nombre del ticket]"
```

---

## 💡 Tips Específicos para Copilot

### Maximizar Contexto

**Abre archivos relacionados en tabs:**
```
Antes de empezar un ticket, abre en VS Code:
- Archivos que vas a modificar
- Archivos relacionados
- El Sprint Plan mismo (como referencia)

Copilot ve todos los archivos abiertos → mejor contexto
```

### Usa comandos @

```
@workspace "muestra archivos en /lib/engine/"
@workspace "busca función calculateFGOS"
#file "explica este archivo"
```

### Pide explicaciones

```
Si no entiendes algo:
"Explica qué hace esta función línea por línea"
"¿Por qué usamos esta estructura de datos?"
```

### Itera en el código

```
Si el código que Copilot da tiene un bug:
"Este código tiene un error en línea 15. La variable 'x' no está definida. Corrígelo"
```

---

## ⚠️ Limitaciones y Workarounds

### Limitación 1: Copilot no ejecuta SQL

**Workaround:**
```
1. Copilot te da SQL
2. Tú abres Supabase Dashboard (pestaña nueva en browser)
3. SQL Editor → Pega → Ejecuta
4. Vuelves a VS Code
```

**Tiempo extra:** ~2 min por migration

### Limitación 2: Copilot no crea archivos

**Workaround:**
```
1. Copilot te da código
2. Tú: Cmd+N (nuevo archivo)
3. Pegas código
4. Cmd+S → Pones nombre del archivo
```

**Tiempo extra:** ~1 min por archivo

### Limitación 3: Copilot no ejecuta comandos

**Workaround:**
```
1. Copilot te da comando (ej: npm install x)
2. Tú abres terminal en VS Code (Ctrl+`)
3. Ejecutas el comando
```

**Tiempo extra:** ~30 seg por comando

---

## 📊 Estimación de Tiempo

### Con Claude Code (autónomo)
- Ticket #1: **5-6 horas** (Claude hace 80%)

### Con GitHub Copilot (manual)
- Ticket #1: **6-8 horas** (tú haces 40% del trabajo)

**Diferencia:** +20-30% más tiempo con Copilot
**Trade-off:** Pero trabajas en tu editor familiar

---

## ✅ Checklist Antes de Empezar

- [ ] GitHub Copilot instalado y funcionando
- [ ] Modelo Claude 3.5 Sonnet seleccionado
- [ ] Proyecto Fintra abierto en VS Code
- [ ] Acceso a Supabase Dashboard
- [ ] Sprint Plan descargado y disponible
- [ ] Git branch creado: `sprint-1-transparency`

---

## 🚀 Comando de Inicio

**Cuando estés listo, pega esto en Copilot Chat:**

```
[Template de Contexto Inicial]

Primer ticket: TICKET #1 - Sistema de Versioning de Benchmarks

[Pega Ticket #1 del Sprint Plan]

INSTRUCCIONES:
Dame el código para PASO 1: Crear migration SQL
Solo el SQL, yo lo ejecutaré en Supabase.
```

---

## 🎯 Resumen

**GitHub Copilot funciona perfectamente para este proyecto.**

**Ventajas:**
- Mismo modelo (Sonnet 4.5)
- Integrado en tu editor
- Autocompletado en tiempo real

**Requiere:**
- Más copy/paste manual
- Ejecutar comandos tú mismo
- Crear archivos manualmente

**Estimación:**
- Sprint 1 con Copilot: **~80 horas** (vs 60h con Claude Code)
- Pero trabajas en entorno familiar

**Recomendación:** 
Si ya tienes Copilot, úsalo. La diferencia de tiempo es manejable y evitas aprender nueva herramienta.

---

¿Listo para empezar? Abre Copilot Chat y pega el contexto inicial! 🚀

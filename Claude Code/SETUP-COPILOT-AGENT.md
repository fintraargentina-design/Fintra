# Setup: Agente Personalizado de GitHub Copilot para Fintra

## 🎯 Qué es esto

GitHub Copilot puede leer un archivo especial llamado `.github/copilot-instructions.md` que le dice cómo comportarse específicamente para tu proyecto.

Este archivo actúa como un "cerebro personalizado" que hace que Copilot entienda las reglas de Fintra automáticamente.

---

## 📁 Estructura de Archivos a Crear

Crea esta estructura en tu repositorio Fintra:

```
fintra/
├── .github/
│   └── copilot-instructions.md    # ← Instrucciones principales (YA CREADO)
│
└── docs/
    └── reglas/                     # ← Archivos de reglas (CREAR ESTOS)
        ├── 00-INDEX.md             # Índice de todas las reglas
        ├── principiofundamental.md # "Fintra no inventa datos"
        ├── pendingnoeserror.md     # "Pending no es error"
        ├── cronjobs.md             # Tolerancia a fallos en crons
        ├── fgos.md                 # Reglas de FGOS
        ├── sectorbenchmarks.md     # Reglas de benchmarks
        ├── manejodeapidefmp.md     # Reglas de ingesta FMP
        ├── separacionderesponsabilidades.md  # Supabase client separation
        ├── snapshot.md             # Reglas de snapshots
        ├── typescript.md           # Convenciones de código
        └── filosofiadelproducto.md # Filosofía general
```

---

## 🚀 Paso a Paso: Instalación

### PASO 1: Crear el archivo principal de Copilot

```bash
# En la raíz de tu proyecto Fintra
cd /path/to/fintra

# Crear carpeta .github si no existe
mkdir -p .github

# Copiar el archivo copilot-instructions.md
# (Ya lo tienes en los archivos que te di)
```

**Archivo:** `.github/copilot-instructions.md`  
**Contenido:** El archivo largo que acabo de crear

### PASO 2: Crear carpeta de reglas

```bash
# Crear carpeta docs/reglas
mkdir -p docs/reglas
```

### PASO 3: Copiar archivos de reglas

Tienes que copiar los 12 archivos `.md` que me subiste a `docs/reglas/`:

```bash
# Ejemplo (ajusta rutas según tu sistema)
cp /path/to/uploaded/principiofundamental.md docs/reglas/
cp /path/to/uploaded/pendingnoeserror.md docs/reglas/
cp /path/to/uploaded/cronjobs.md docs/reglas/
# ... etc para los 12 archivos
```

**Lista completa de archivos a copiar:**
1. `principiofundamental.md`
2. `pendingnoeserror.md`
3. `cronjobs.md`
4. `fgos.md`
5. `sectorbenchmarks.md`
6. `manejodeapidefmp.md`
7. `separacionderesponsabilidades.md`
8. `snapshot.md`
9. `typescript.md`
10. `filosofiadelproducto.md`
11. `api.md`
12. `estrategia-cliente-nativo.md`

### PASO 4: Crear índice de reglas

Crea `docs/reglas/00-INDEX.md`:

```markdown
# Índice de Reglas de Fintra

Esta carpeta contiene las reglas fundamentales del proyecto Fintra.
GitHub Copilot las lee automáticamente vía `.github/copilot-instructions.md`.

## Reglas por Categoría

### Principios Fundamentales
- `principiofundamental.md` - "Fintra no inventa datos"
- `filosofiadelproducto.md` - Filosofía general del producto
- `pendingnoeserror.md` - Datos faltantes no son errores

### Cálculos Financieros
- `fgos.md` - Reglas de cálculo de FGOS
- `sectorbenchmarks.md` - Uso de benchmarks sectoriales
- `manejodeapidefmp.md` - Ingesta correcta de FMP API

### Arquitectura y Datos
- `cronjobs.md` - Tolerancia a fallos en cron jobs
- `snapshot.md` - Reglas de snapshots
- `separacionderesponsabilidades.md` - Supabase client separation
- `api.md` - Reglas de APIs

### Código
- `typescript.md` - Convenciones de TypeScript
- `estrategia-cliente-nativo.md` - Arquitectura Dual Head

## Cómo Usar

Estas reglas son **obligatorias** para todo código generado por Copilot.
Si Copilot sugiere código que viola estas reglas, rechaza la sugerencia.
```

### PASO 5: Commit a Git

```bash
git add .github/copilot-instructions.md
git add docs/reglas/

git commit -m "feat: add GitHub Copilot custom agent configuration"
git push
```

---

## ✅ Verificar que Funciona

### Test 1: Autocomplete en TypeScript

Abre un archivo TypeScript y empieza a escribir:

```typescript
// En /lib/engine/test.ts
async function calculateTTM(ticker: string) {
  const quarters = await getLastQuarters(ticker, 3);
  
  // Copilot debería sugerir algo como:
  if (quarters.length < 4) {
    return null; // ← Copilot debe saber que NO aproximar
  }
```

**Esperado:** Copilot sugiere `return null` cuando hay < 4 quarters  
**Incorrecto:** Copilot sugiere calcular promedio o aproximar

---

### Test 2: Manejo de Errores

```typescript
// En /app/api/cron/snapshot/route.ts
export async function GET() {
  const tickers = await getTickers();
  
  for (const ticker of tickers) {
    // Copilot debería sugerir try-catch aquí
```

**Esperado:** Copilot sugiere `try-catch` dentro del loop  
**Incorrecto:** Copilot NO sugiere error handling

---

### Test 3: Supabase Client

```typescript
// En /app/api/cron/snapshot/route.ts
import { supabase } from '@/lib/supabase'; // ← Copilot debería señalar error
```

**Esperado:** Copilot sugiere cambiar a `'@/lib/supabase/admin'`  
**Incorrecto:** Copilot acepta el import incorrecto

---

## 🛠️ Troubleshooting

### Problema: Copilot no lee las instrucciones

**Solución:**
1. Verifica que el archivo esté en `.github/copilot-instructions.md` (exacto)
2. Reinicia VS Code
3. Verifica extensión de Copilot actualizada
4. En Settings → GitHub Copilot → "Use Copilot Instructions" → ✅ Enabled

---

### Problema: Copilot sigue sugiriendo código incorrecto

**Solución:**
1. Rechaza la sugerencia (Esc)
2. Abre Copilot Chat (Cmd+Shift+I)
3. Dile: "Lee las instrucciones del proyecto en .github/copilot-instructions.md"
4. Pídele que genere código siguiendo esas reglas

---

### Problema: Copilot no ve los archivos de docs/reglas

**Solución:**

Los archivos en `docs/reglas/` NO se leen automáticamente.
Solo `.github/copilot-instructions.md` se lee automáticamente.

**Workflow correcto:**
1. `.github/copilot-instructions.md` contiene las reglas principales (consolidadas)
2. `docs/reglas/` son archivos de referencia para humanos
3. Si necesitas que Copilot lea un archivo específico:
   ```
   # En Copilot Chat
   @workspace /docs/reglas/fgos.md
   ```

---

## 📖 Cómo Usar el Agente Personalizado

### Workflow Diario

**1. Abre VS Code**
```bash
cd /path/to/fintra
code .
```

**2. Copilot ya conoce las reglas**
- No necesitas recordarle cada vez
- El archivo `.github/copilot-instructions.md` se carga automáticamente

**3. Escribe código**
```typescript
// Empieza a escribir, Copilot autocompleta siguiendo reglas
```

**4. Si dudas de una sugerencia**
```
# En Copilot Chat
"¿Esta sugerencia cumple con las reglas de Fintra?"
```

---

### Con Sprint Plan

**Combina el agente personalizado con el Sprint Plan:**

```
# En Copilot Chat
Contexto: Estoy trabajando en Fintra. 
Ya conoces las reglas del proyecto (.github/copilot-instructions.md).

Aquí está el Ticket #1 del Sprint Plan:

[Pega el ticket]

Implementa siguiendo las reglas de Fintra.
```

**Ventaja:** Copilot ya sabe:
- No inventar datos
- Usar `status: 'pending'`
- Fault tolerance en crons
- No usar `any` en lógica financiera
- Etc.

---

## 🎓 Educando a Copilot

### Cuando Copilot se equivoca

**Paso 1: Corrígelo explícitamente**
```
# En Copilot Chat
Esta sugerencia es incorrecta.

Según .github/copilot-instructions.md, cuando hay < 4 quarters,
debemos retornar null, NO aproximar.

Corrige el código siguiendo esa regla.
```

**Paso 2: Refuerza la regla**
```
# En el mismo chat
Recuerda: "Fintra no inventa datos".
Si faltan quarters, siempre return null.
```

**Paso 3: Verifica la corrección**
```
# En el mismo chat
Explica por qué este código ahora es correcto según las reglas de Fintra.
```

---

## 📊 Comparación: Con vs Sin Agente Personalizado

### SIN Agente Personalizado

```
TÚ: "Calcula TTM con los quarters disponibles"

COPILOT: 
const ttmRevenue = quarters.reduce(...) / quarters.length;
// ❌ Promedia (incorrecto)

TÚ: "No, no promedies. Suma los últimos 4 quarters"

COPILOT: [Corrige]
```

**Problema:** Tienes que corregir CADA VEZ

---

### CON Agente Personalizado

```
TÚ: "Calcula TTM con los quarters disponibles"

COPILOT:
if (quarters.length < 4) return null;
const ttmRevenue = quarters.reduce((sum, q) => sum + q.revenue, 0);
// ✅ Correcto desde el inicio
```

**Beneficio:** Copilot ya sabe las reglas, menos correcciones

---

## 🎯 Resumen Ejecutivo

### Lo que acabas de conseguir:

✅ **Agente personalizado de Copilot** que conoce reglas de Fintra  
✅ **Autocompletado inteligente** que sigue principios financieros  
✅ **Menos correcciones manuales** (Copilot genera código correcto)  
✅ **Consistencia** (todo el código sigue mismas reglas)  

### Próximos pasos:

1. ✅ Copia `.github/copilot-instructions.md` a tu proyecto
2. ✅ Copia archivos de reglas a `docs/reglas/`
3. ✅ Commit y push
4. ✅ Reinicia VS Code
5. ✅ Empieza a usar Copilot (ya conoce las reglas)
6. ✅ Combina con Sprint Plan para implementar mejoras

---

**¿Listo para empezar?** 🚀

El agente personalizado está configurado.
Ahora cuando uses Copilot, automáticamente seguirá las reglas de Fintra.

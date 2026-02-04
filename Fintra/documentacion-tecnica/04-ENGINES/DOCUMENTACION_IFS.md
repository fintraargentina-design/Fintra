# IFS (Industrial Financial Score) - Documentación Técnica

**Fecha**: 2026-02-02  
**Sistema**: Fintra Engine  
**Componente**: Structural Profile Analysis

---

## 📋 ¿Qué es IFS?

**IFS** (Industrial Financial Score) es un sistema de clasificación de empresas que evalúa la **posición competitiva estructural** de una compañía dentro de su sector/industria.

### Propósito

- **Clasificar empresas** según su fortaleza operativa y financiera relativa
- **Identificar líderes y rezagados** en cada industria
- **Rastrear evolución temporal** de la posición competitiva
- **Complementar FGOS** (que mide calidad absoluta) con posición relativa

### Diferencia con FGOS

| Aspecto        | FGOS                              | IFS                                    |
| -------------- | --------------------------------- | -------------------------------------- |
| **Naturaleza** | Score absoluto (0-100)            | Posición relativa                      |
| **Referencia** | Benchmarks objetivos              | Competidores del sector                |
| **Pregunta**   | "¿Qué tan buena es esta empresa?" | "¿Quién está ganando en su industria?" |
| **Temporal**   | Estado actual con historia        | Modelo de memoria de 5 años            |

---

## 🎯 Estructura de Datos IFS

### Campo Principal: `ifs`

```typescript
interface IFSData {
  position: "leader" | "follower" | "laggard";
  pressure?: number; // 0-3 (opcional)
  confidence?: number; // 0-100 (opcional)
  interpretation?: string; // Descripción textual
  confidence_label?: "High" | "Medium" | "Low";
}
```

#### Posiciones IFS

| Posición     | Significado       | Interpretación                                        |
| ------------ | ----------------- | ----------------------------------------------------- |
| **leader**   | Líder competitivo | Empresa dominante en métricas clave de su sector      |
| **follower** | Seguidor medio    | Empresa en rango medio, competitiva pero no dominante |
| **laggard**  | Rezagado          | Empresa por debajo del promedio sectorial             |

#### Pressure (Presión Competitiva)

**Rango**: 0-3  
**Significado**: Número de "bloques" o pilares que sostienen la clasificación

- **0**: Sin soporte (clasificación débil)
- **1**: 1/3 bloques soportan la posición
- **2**: 2/3 bloques soportan la posición
- **3**: 3/3 bloques soportan la posición (clasificación fuerte)

**Ejemplo AAPL**:

```json
{
  "position": "laggard",
  "pressure": 2,
  "interpretation": "Laggard with 2/3 blocks supporting (High confidence)"
}
```

→ Apple clasificada como laggard con 2 de 3 pilares confirmando esta posición.

#### Confidence (Confianza)

**Rango**: 0-100  
**Significado**: Nivel de certeza estadística en la clasificación

- **80-100**: High confidence
- **60-79**: Medium confidence
- **0-59**: Low confidence

---

## 🧠 IFS Memory (Memoria Temporal)

### Campo: `ifs_memory`

El IFS implementa un **modelo de memoria temporal retrospectiva** de 5 años.

```typescript
interface IFSMemory {
  window_years: number; // Ventana máxima (5 años)
  observed_years: number; // Años realmente observados (1-5)
  distribution: {
    leader: number; // Cantidad de snapshots como leader
    follower: number; // Cantidad de snapshots como follower
    laggard: number; // Cantidad de snapshots como laggard
  };
  timeline?: ("leader" | "follower" | "laggard")[]; // Evolución cronológica
  current_streak: {
    position: "leader" | "follower" | "laggard" | null;
    years: number; // Cuántos años consecutivos en esta posición
  };
}
```

### Ejemplo Real (MSFT)

```json
{
  "window_years": 5,
  "observed_years": 1,
  "distribution": {
    "leader": 1,
    "follower": 0,
    "laggard": 0
  },
  "timeline": ["leader"],
  "current_streak": {
    "position": "leader",
    "years": 1
  }
}
```

**Interpretación**: Microsoft tiene solo 1 año de datos históricos IFS, y en ese año está clasificado como leader. Mantiene streak de 1 año como leader.

### Principios del Modelo Temporal

1. **Retrospectivo, no prospectivo**: Se basa en snapshots históricos reales, nunca proyecta
2. **window_years es MÁXIMO**: No es requisito tener 5 años completos
3. **Timeline cronológico**: Orden oldest → newest (izquierda a derecha)
4. **Distribución cuenta frecuencia**: Cuántas veces estuvo en cada posición
5. **Current streak desde el final**: Racha actual se cuenta desde el snapshot más reciente hacia atrás

---

## 🎨 Representación en UI

### Componente: `IFSRadial.tsx`

**Ubicación**: `components/visuals/IFSRadial.tsx`  
**Tipo**: Pure view component (sin lógica de negocio)

#### Renderizado Visual

**Forma**: Círculo radial segmentado (estilo "pie chart")

**Características**:

- **Segmentos**: Cantidad = `ifs_memory.observed_years` (máx 5)
- **Colores por posición**:
  - 🟢 Leader: `#10b981` (emerald-500)
  - 🟡 Follower: `#f59e0b` (amber-500)
  - 🔴 Laggard: `#ef4444` (red-500)
  - ⚫ Empty: `#27272a` (zinc-800) - cuando no hay datos
- **Orden**: Cronológico clockwise (último segmento = estado actual)
- **Gap**: 10° entre segmentos para separación visual

#### Ejemplo Visual

```
Empresa con timeline: ["laggard", "follower", "leader"]
(3 años de historia)

      12 o'clock
          🟢
       ┌──────┐
    🟡 │      │
       │      │
       └──────┘
          🔴

Interpretación:
- Segmento 🔴 (izquierda): Año más antiguo (laggard)
- Segmento 🟡 (abajo): Año intermedio (follower)
- Segmento 🟢 (derecha): Año actual (leader)
```

#### Estados de Renderizado

| Caso               | Visualización              | Código                           |
| ------------------ | -------------------------- | -------------------------------- |
| **Con timeline**   | Radial segmentado          | `ifs_memory.timeline.length > 0` |
| **Sin timeline**   | Círculo vacío (borde gris) | `!ifs_memory.timeline`           |
| **Sin ifs_memory** | Círculo vacío              | `!ifs_memory`                    |

#### Regla Crítica: CERO Inferencia

El componente **NUNCA** genera datos sintéticos:

- ❌ NO inventa segmentos si faltan datos
- ❌ NO usa fallbacks arbitrarios
- ❌ NO calcula posiciones desde otros campos
- ✅ Solo renderiza `ifs_memory.timeline` tal cual existe

Si no hay timeline → círculo vacío (correcto según arquitectura).

---

## ⚙️ Cálculo de IFS

### Engine: `lib/engine/ifs.ts` (no verificado en esta sesión)

Aunque no se auditó el código del calculador IFS, basándose en el contexto:

#### Inputs Probables

1. **Métricas financieras** del ticker
2. **Sector/Industry** de la empresa
3. **Benchmarks sectoriales** (percentiles de competidores)
4. **Métricas comparativas**:
   - ROIC relativo
   - Márgenes vs sector
   - Crecimiento vs sector
   - Retorno accionista vs sector

#### Lógica Probable

```
Para cada empresa:
  1. Obtener métricas clave (ROIC, margins, growth, returns)
  2. Comparar con distribución sectorial
  3. Calcular percentiles relativos
  4. Clasificar según umbrales:
     - Top 33% → leader
     - Middle 34% → follower
     - Bottom 33% → laggard
  5. Calcular pressure (cuántos pilares confirman)
  6. Calcular confidence (calidad de datos disponibles)
```

#### Output

El engine genera el objeto `ifs` que se persiste en `fintra_snapshots`:

```json
{
  "position": "leader",
  "pressure": 3,
  "confidence": 92,
  "interpretation": "Leader with 3/3 blocks supporting (High confidence)",
  "confidence_label": "High"
}
```

---

## 🔄 Pipeline de Datos IFS

### Flujo Completo

```
1. FMP API
   └─> Financial Statements (quarterly/annual)

2. Fintra Engine (IFS Calculator)
   └─> Calcula position, pressure, confidence
   └─> Persiste en fintra_snapshots.ifs

3. IFS Memory Aggregator (scripts/pipeline/ifs-memory-aggregator.ts)
   └─> Lee snapshots históricos (últimos 5)
   └─> Genera ifs_memory.timeline
   └─> Actualiza fintra_snapshots.ifs_memory

4. Server Actions (lib/actions/*.ts)
   └─> Fetch ifs + ifs_memory desde DB
   └─> Sin transformaciones ni cálculos

5. UI Components
   └─> IFSRadial.tsx renderiza timeline
   └─> TablaIFS.tsx muestra position + pressure
   └─> ResumenCard.tsx integra con otros scores
```

### Persistencia

**Tabla**: `fintra_snapshots`  
**Campos**:

- `ifs` (JSONB): Posición actual y metadata
- `ifs_memory` (JSONB): Memoria temporal (agregado post-cálculo)

### Frecuencia de Actualización

- **IFS calculation**: Diaria (cron nocturno)
- **IFS memory aggregation**: Post-calculation (después del cron principal)
- **UI refresh**: En tiempo real desde snapshots persistidos

---

## 📊 Uso en Dashboards

### TablaIFS.tsx

**Muestra**: Lista de tickers con IFS

| Columna      | Origen                                    | Visualización    |
| ------------ | ----------------------------------------- | ---------------- |
| **Ticker**   | `row.ticker`                              | Texto            |
| **Posición** | `ifs.position`                            | Badge coloreado  |
| **Presión**  | `ifs.pressure`                            | Número 0-3       |
| **Radial**   | `<IFSRadial ifs={...} ifsMemory={...} />` | Gráfico circular |

### SectorAnalysisPanel.tsx

Usa IFS para:

- Identificar líderes sectoriales
- Mostrar distribución competitiva
- Comparar empresas del mismo sector

### ResumenCard.tsx

Integra IFS con:

- FGOS (calidad absoluta)
- Valuation (precio relativo)
- Life Cycle (madurez)

Objetivo: Vista 360° de la empresa.

---

## 🎯 Casos de Uso

### 1. Identificar Ganadores Sectoriales

**Pregunta**: "¿Quién domina la industria de semiconductores?"

**Query**:

```sql
SELECT ticker, ifs->>'position' as position, ifs->>'confidence' as confidence
FROM fintra_snapshots
WHERE profile_structural->'classification'->>'industry' = 'Semiconductors'
  AND ifs->>'position' = 'leader'
ORDER BY (ifs->>'confidence')::int DESC;
```

### 2. Detectar Transiciones Competitivas

**Pregunta**: "¿Qué empresas pasaron de laggard a leader?"

**Lógica**:

```typescript
const timeline = ifs_memory.timeline;
if (timeline[0] === "laggard" && timeline[timeline.length - 1] === "leader") {
  // Empresa en recuperación competitiva
}
```

### 3. Validar Consistencia Competitiva

**Pregunta**: "¿Cuántos años lleva Apple como leader?"

**Respuesta**:

```typescript
const streak = ifs_memory.current_streak;
if (streak.position === "leader") {
  console.log(`AAPL lleva ${streak.years} años como leader`);
}
```

---

## ⚠️ Limitaciones Conocidas

### 1. Dependencia de Datos Históricos

**Problema**: IFS memory requiere snapshots de múltiples años.

**Estado Actual** (2026-02-02):

- Solo existen snapshots de 2026
- `observed_years = 1` para todos los tickers
- Timeline tiene solo 1 elemento

**Solución**: Ejecutar backfill de snapshots históricos (2021-2025).

### 2. Sensibilidad a Ventana Temporal

**Problema**: El modelo usa window_years = 5 fijo.

**Implicaciones**:

- Empresa nueva (<5 años) siempre tendrá timeline incompleto
- No hay ajuste por disponibilidad de datos históricos
- Período de 5 años puede ser insuficiente para ciclos largos

**Mitigación**: `observed_years` indica cuántos años reales hay disponibles.

### 3. Granularidad Anual vs Trimestral

**Problema**: El agregador toma snapshots sin discriminar frecuencia.

**Estado Actual**: Toma últimos 5 snapshots (puede ser diario, semanal, etc.).

**Consideración**: Si hay snapshots diarios, timeline puede mostrar solo últimos 5 días en vez de 5 años.

---

## 🔧 Mantenimiento y Debugging

### Scripts de Auditoría

1. **audit-ifs-memory-coverage.ts**
   - Verifica cobertura de `ifs_memory`
   - Reporta % de tickers con timeline válido
   - Identifica gaps de datos

2. **verify-ifs-timeline.ts**
   - Valida timeline de tickers específicos
   - Confirma orden cronológico
   - Detecta inconsistencias

3. **inspect-aapl.ts**
   - Inspector detallado de un ticker
   - Muestra estructura completa de IFS

### Comandos Útiles

```bash
# Verificar cobertura IFS
pnpm tsx scripts/audit-ifs-memory-coverage.ts

# Re-generar ifs_memory
pnpm tsx scripts/pipeline/ifs-memory-aggregator.ts

# Inspeccionar ticker individual
pnpm tsx scripts/inspect-aapl.ts
```

### Logs Relevantes

```
✅ Loaded 51040 valid snapshots.
📊 Processing 27052 tickers...
💾 Persisting ifs_memory for 27052 tickers...
✅ IFS Memory Aggregation Complete.
```

---

## 📚 Referencias

### Archivos Relacionados

- **Engine**: `lib/engine/ifs.ts` (cálculo IFS)
- **Types**: `lib/engine/types.ts` (IFSData, IFSMemory interfaces)
- **Aggregator**: `scripts/pipeline/ifs-memory-aggregator.ts` (genera timeline)
- **UI Component**: `components/visuals/IFSRadial.tsx` (visualización)
- **Mapping**: `components/dashboard/TablaIFS.tsx` (mapeo de datos)
- **Server Actions**: `lib/actions/sector-analysis.ts`, `lib/actions/resumen.ts`

### Documentación

- **Copilot Instructions**: `.github/copilot-instructions.md`
  - Sección: "Fintra Never Invents Data"
  - Principio: "Pending is Not an Error"
- **Auditoría IFS Radial**: `AUDITORIA_IFS_RADIAL.md` (este documento)

---

## 🎓 Preguntas Frecuentes

### ¿Por qué algunos tickers tienen ifs pero no ifs_memory?

**R**: El `ifs` se calcula en el snapshot principal (cron diario). El `ifs_memory` se genera en un paso posterior (agregador). Si el agregador no se ejecutó, `ifs_memory` será null.

### ¿Por qué todos tienen observed_years = 1?

**R**: La base de datos solo tiene snapshots de 2026-02-02 (un día). Para tener 5 años de historia, necesitas snapshots de 2021-2025.

### ¿Puede un ticker cambiar de position diariamente?

**R**: Técnicamente sí (si las métricas sectoriales cambian mucho), pero en práctica la posición IFS es relativamente estable (cambios trimestrales o anuales).

### ¿Qué pasa si una empresa cambia de sector?

**R**: El IFS se recalcula con el nuevo sector. El timeline histórico mantiene las clasificaciones pasadas (que pueden haber usado otro sector).

### ¿IFS considera tamaño de empresa?

**R**: Depende del engine (no auditado). Idealmente, IFS debería comparar peers de tamaño similar (large-cap vs large-cap) dentro del sector.

---

## ✍️ Metadata

**Autor**: GitHub Copilot (basado en auditoría técnica)  
**Fecha Creación**: 2026-02-02  
**Versión**: 1.0  
**Alcance**: Documentación técnica basada en código fuente auditado  
**Audiencia**: Desarrolladores, analistas financieros, equipo de producto

---

**Última Actualización**: 2026-02-02 18:30 UTC

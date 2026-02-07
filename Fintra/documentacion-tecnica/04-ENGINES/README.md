# 04-ENGINES - Documentación de Motores de Análisis

**Última actualización:** 6 de febrero de 2026

---

## 📋 Índice de Documentos

### 🌟 Documento Maestro

**[DOCUMENTACION_ENGINES_MASTER.md](./DOCUMENTACION_ENGINES_MASTER.md)** - Documentación completa y unificada de todos los engines de Fintra v2.0.

**Contenido:**

- Visión general de la arquitectura de engines
- FGOS (Fintra Growth & Operations Score)
- IFS Live (Industry Fit Score) - v1.2 con Industry Awareness
- IQS (Industry Quality Score) - Scoring fiscal estructural
- Valuation (Valoración Relativa)
- Moat (Foso Competitivo)
- Competitive Advantage (Ventaja Competitiva)
- Quality Brakes (Frenos de Calidad)
- Fundamentals Maturity (Madurez de Datos)
- Pipeline de cálculo completo
- Interacciones entre engines
- Escenarios de análisis integrados

---

## 📚 Documentos Especializados

### [DOCUMENTACION_IFS.md](./DOCUMENTACION_IFS.md)

**Tema:** IFS (Industry Fit Score) - Posición competitiva relativa diaria

**Audiencia:** Desarrolladores que trabajan con momentum de mercado

**Contenido clave:**

- IFS Memory (modelo de memoria retrospectiva de 5 años)
- Block voting system (Short, Mid, Long)
- Pressure score (0-3)
- Confidence calculation
- Diferencias vs IQS

**Cuándo consultar:**

- Implementando features de posición competitiva
- Debugging IFS Live calculations
- Analizando momentum vs fundamentals divergence

---

### [IQS_INFORME.md](./IQS_INFORME.md)

**Tema:** IQS (Industry Quality Score) - Posición competitiva estructural anual

**Audiencia:** Desarrolladores y analistas financieros

**Contenido clave:**

- Arquitectura conceptual (IFS Live vs IQS)
- Percentile-based ranking relativo a industria
- Explicit fiscal year mapping
- Algoritmo de cálculo paso a paso
- Reglas de negocio (no invent data, explicit FY, industry not sector)

**Cuándo consultar:**

- Implementando scoring fiscal year
- Entendiendo separación temporal IFS/IQS
- Debugging percentile calculations

---

### [IQS_REFACTORING_COMPLETE.md](./IQS_REFACTORING_COMPLETE.md)

**Tema:** Refactoring técnico de IQS (historial de cambios)

**Audiencia:** Desarrolladores manteniendo IQS

**Contenido clave:**

- Migración de implementación inicial a producción
- Decisiones técnicas y trade-offs
- Optimizaciones de performance
- Testing strategy

**Cuándo consultar:**

- Entendiendo decisiones de arquitectura pasadas
- Planeando nuevos refactorings
- Debugging issues relacionados con cambios históricos

---

### [QUALITY_BRAKES_GUIDE.md](./QUALITY_BRAKES_GUIDE.md)

**Tema:** Quality Brakes - Sistema de alertas de riesgo financiero

**Audiencia:** Analistas financieros y desarrolladores de UI

**Contenido clave:**

- Altman Z-Score (zonas de distress)
- Piotroski F-Score (9 criterios de calidad)
- Dimensiones a analizar cuando se activan frenos
- Ejemplos de casos reales
- Guía práctica para analistas

**Cuándo consultar:**

- Implementando UI de alertas de riesgo
- Analizando empresas con Quality Brakes activados
- Educando usuarios sobre señales de riesgo

---

### [TTM_V2_REFACTORING_SUMMARY.md](./TTM_V2_REFACTORING_SUMMARY.md)

**Tema:** TTM (Trailing Twelve Months) - Construcción y validación

**Audiencia:** Desarrolladores trabajando con métricas TTM

**Contenido clave:**

- Construcción correcta de TTM (suma vs promedio)
- Validación de 4 quarters
- Temporal consistency (no look-ahead bias)
- Migración de TTM v1 a v2

**Cuándo consultar:**

- Implementando cálculos de métricas TTM
- Debugging discrepancias en datos TTM
- Entendiendo reglas de agregación temporal

---

## 🔄 Flujo de Navegación Recomendado

### Para Desarrolladores Nuevos:

1. **[DOCUMENTACION_ENGINES_MASTER.md](./DOCUMENTACION_ENGINES_MASTER.md)** → Visión completa del sistema
2. **[TTM_V2_REFACTORING_SUMMARY.md](./TTM_V2_REFACTORING_SUMMARY.md)** → Entender construcción de métricas base
3. **[QUALITY_BRAKES_GUIDE.md](./QUALITY_BRAKES_GUIDE.md)** → Sistema de alertas crítico
4. Documentos especializados según feature asignado

### Para Analistas Financieros:

1. **[DOCUMENTACION_ENGINES_MASTER.md](./DOCUMENTACION_ENGINES_MASTER.md)** → Sección "Interacciones entre Engines"
2. **[QUALITY_BRAKES_GUIDE.md](./QUALITY_BRAKES_GUIDE.md)** → Cómo interpretar alertas
3. **[DOCUMENTACION_IFS.md](./DOCUMENTACION_IFS.md)** → IFS Memory y momentum analysis

### Para Debugging Específico:

- **FGOS issues** → DOCUMENTACION_ENGINES_MASTER.md, sección FGOS
- **IFS Live null** → DOCUMENTACION_IFS.md
- **IQS pending** → IQS_INFORME.md
- **Valuation divergence** → DOCUMENTACION_ENGINES_MASTER.md, sección Valuation
- **TTM construction** → TTM_V2_REFACTORING_SUMMARY.md
- **Quality Brakes logic** → QUALITY_BRAKES_GUIDE.md

---

## 📊 Estado de la Documentación

| Documento                           | Estado      | Última Actualización | Prioridad de Lectura |
| ----------------------------------- | ----------- | -------------------- | -------------------- |
| **DOCUMENTACION_ENGINES_MASTER.md** | ✅ Completo | 2026-02-06           | 🔴 Alta              |
| **DOCUMENTACION_IFS.md**            | ✅ Completo | 2026-02-02           | 🟡 Media             |
| **IQS_INFORME.md**                  | ✅ Completo | 2026-02-02           | 🟡 Media             |
| **IQS_REFACTORING_COMPLETE.md**     | ✅ Completo | 2026-02-02           | 🟢 Baja              |
| **QUALITY_BRAKES_GUIDE.md**         | ✅ Completo | 2026-02-04           | 🔴 Alta              |
| **TTM_V2_REFACTORING_SUMMARY.md**   | ✅ Completo | 2026-01-15           | 🟡 Media             |

---

## 🎯 Principios de Diseño (Resumen)

Todos los engines siguen estos principios arquitectónicos de Fintra:

### 1. **Fintra No Inventa Datos**

```typescript
// ✅ CORRECTO
if (!sector) {
  return { status: "pending", reason: "Sector missing" };
}

// ❌ PROHIBIDO
if (!sector) {
  sector = "Technology"; // NUNCA inferir
}
```

### 2. **Pending No Es Error**

```typescript
// Estado 'pending' es VÁLIDO y ESPERADO
{
  fgos_status: 'pending',
  fgos_score: null,
  reason: 'Insufficient metrics'
}
```

### 3. **Fault Tolerance**

```typescript
// Un engine fallido NO debe abortar el snapshot completo
try {
  const moat = calculateMoat(history);
} catch (error) {
  console.error(`Moat failed:`, error);
  moat = null; // Continuar con null
}
```

### 4. **Separación Temporal**

- **Diarios:** FGOS, IFS Live, Valuation, Quality Brakes → Tácticos
- **Anuales:** IQS, Moat, Competitive Advantage → Estratégicos
- **NUNCA mezclar contextos temporales**

### 5. **Null Propagation**

```typescript
// Si métrica crítica es null → componente es null
if (roic === null) {
  efficiency_score = null; // NO usar default
}
```

---

## 📞 Contacto y Contribuciones

**Mantenedor:** Sistema de auditoría técnica Fintra  
**Ubicación del código:** `d:\FintraDeploy\Fintra\lib\engine\`  
**Tests:** `d:\FintraDeploy\Fintra\lib\engine\*.test.ts`

**Para reportar issues:**

1. Verificar en documento maestro si es comportamiento esperado
2. Revisar sección de Troubleshooting
3. Consultar logs de cron jobs relevantes
4. Documentar contexto completo (ticker, fecha, valores inputs/outputs)

**Para proponer mejoras:**

1. Consultar roadmap en documento maestro (sección final)
2. Validar que no exista engine propuesto similar
3. Documentar caso de uso y métricas propuestas
4. Incluir ejemplos de empresas donde aplica

---

**Última revisión:** 6 de febrero de 2026  
**Versión de engines:** v2.0  
**Cobertura:** 8 engines activos + 6 engines en roadmap

# 04-ENGINES - Documentación de Motores de Análisis

**Última actualización:** 7 de febrero de 2026  
**Consolidación:** 10 documentos → 4 documentos activos + archive

---

## 📋 Índice de Documentos

### ⭐ Documento Maestro Principal

**[FINTRA_SCORES_EXPLICACION.md](./FINTRA_SCORES_EXPLICACION.md)** - Documentación técnica completa de todos los scores de Fintra (2,315 líneas).

**Contenido (11 scores completos):**

- FGOS (Fintra Growth & Operations Score)
- IFS (Industry Fit Score) - Momentum diario
- IQS (Industry Quality Score) - Posición estructural anual
- Competitive Advantage Score
- Moat Score (Foso Competitivo)
- Sentiment Score
- Valuation Score (Relative)
- Dividend Quality Score
- Relative Return Score
- Fintra Verdict (Integrador)
- Quality Brakes (Frenos de Calidad)
- Arquitectura del sistema de scoring
- Principios de diseño (Fintra no inventa datos, Pending no es error, etc.)
- Pipeline de cálculo y validación

**📌 Este es el documento técnico de referencia principal.**

---

## 📚 Documentos Complementarios

### [INFORME_CONCEPTOS_FUNDAMENTALES.md](./INFORME_CONCEPTOS_FUNDAMENTALES.md)

**Tema:** Resumen ejecutivo de conceptos para audiencia externa

**Audiencia:** No técnica, divulgación, contexto de análisis

**Contenido clave:**

- Valoración Relativa
- Competitive Position (IFS/IQS)
- Calidad Fundamental (Quality Brakes, FGOS, Competitive Advantage, Moat, Sentiment)
- Cash Flow Quality (Dividend Quality, Relative Return)
- Síntesis Integradora (Fintra Verdict)
- Lenguaje simplificado para audiencia no técnica

**Cuándo consultar:**

- Presentando Fintra a externos
- Onboarding de analistas no técnicos
- Documentación de alto nivel

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

---

## 🔄 Flujo de Navegación Recomendado

### Para Desarrolladores Nuevos:

1. **[FINTRA_SCORES_EXPLICACION.md](./FINTRA_SCORES_EXPLICACION.md)** → Visión completa del sistema (11 scores)
2. **[QUALITY_BRAKES_GUIDE.md](./QUALITY_BRAKES_GUIDE.md)** → Sistema de alertas crítico
3. Consultar [archive/](./archive/) para contexto histórico si es necesario

### Para Analistas Financieros:

1. **[INFORME_CONCEPTOS_FUNDAMENTALES.md](./INFORME_CONCEPTOS_FUNDAMENTALES.md)** → Resumen ejecutivo
2. **[QUALITY_BRAKES_GUIDE.md](./QUALITY_BRAKES_GUIDE.md)** → Cómo interpretar alertas
3. **[FINTRA_SCORES_EXPLICACION.md](./FINTRA_SCORES_EXPLICACION.md)** → Profundizar en scores específicos

### Para Debugging Específico:

- **FGOS issues** → FINTRA_SCORES_EXPLICACION.md, sección FGOS
- **IFS Live null** → FINTRA_SCORES_EXPLICACION.md, sección IFS
- **IQS pending** → FINTRA_SCORES_EXPLICACION.md, sección IQS
- **Valuation divergence** → FINTRA_SCORES_EXPLICACION.md, sección Valuation
- **Quality Brakes logic** → QUALITY_BRAKES_GUIDE.md
- **Contexto histórico** → [archive/](./archive/) o [archive/history/](./archive/history/)

---

## 📊 Estado de la Documentación

### Documentos Activos

| Documento                              | Estado      | Última Actualización | Prioridad de Lectura |
| -------------------------------------- | ----------- | -------------------- | -------------------- |
| **FINTRA_SCORES_EXPLICACION.md** ⭐    | ✅ Completo | 2026-02-07           | 🔴 Alta              |
| **INFORME_CONCEPTOS_FUNDAMENTALES.md** | ✅ Completo | 2026-02-07           | 🟡 Media             |
| **QUALITY_BRAKES_GUIDE.md**            | ✅ Completo | 2026-02-04           | 🔴 Alta              |

### Documentación Archivada

Documentos históricos y versiones obsoletas disponibles en:

- **[archive/](./archive/)** - Documentos técnicos obsoletos/redundantes:
  - `DOCUMENTACION_ENGINES_MASTER.md` (obsoleto, superado por FINTRA_SCORES_EXPLICACION.md)
  - `DOCUMENTACION_IFS.md` (redundante, incluido en FINTRA_SCORES)
  - `IQS_INFORME.md` (redundante, incluido en FINTRA_SCORES)

- **[archive/history/](./archive/history/)** - Changelogs y refactorings:
  - `ACTUALIZACION_DOCUMENTACION_2026-02-06.md`
  - `IQS_REFACTORING_COMPLETE.md`
  - `TTM_V2_REFACTORING_SUMMARY.md`

**Nota:** La documentación archivada se preserva para contexto histórico y no debe usarse para desarrollo activo

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

## 📦 Consolidación Completada

**Fecha:** 7 de febrero de 2026  
**Cambios:**

- ✅ Consolidación de 10 documentos → 4 documentos activos
- ✅ Eliminación de redundancias (IFS, IQS docs específicos)
- ✅ Archivo de versiones obsoletas (DOCUMENTACION_ENGINES_MASTER.md)
- ✅ Organización de historia en `/archive/history/`
- ✅ Documento maestro actualizado: FINTRA_SCORES_EXPLICACION.md (11 scores)

**Beneficios:**

- Fuente única de verdad (Single Source of Truth)
- Reducción de 60% en documentos activos
- Eliminación de contenido duplicado
- Estructura más clara y mantenible

---

**Última revisión:** 7 de febrero de 2026  
**Versión de engines:** v4.0  
**Cobertura:** 11 scores completos documentados

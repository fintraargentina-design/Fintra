# 🚦 Quality Brakes - Guía para Analistas

**Última actualización:** 2026-02-04  
**Motor:** `applyQualityBrakes` (lib/engine/fintra-brain.ts)  
**Campo:** `fintra_snapshots.quality_brakes`

---

## 📋 ¿Qué son los Quality Brakes?

Los **Quality Brakes** son señales automáticas de **riesgo financiero estructural** que Fintra activa cuando detecta:

1. **Estrés financiero agudo** (Altman Z-Score)
2. **Deterioro fundamental o baja calidad de datos** (Piotroski F-Score)

**Principio fundamental:**
> Los Quality Brakes NO son una recomendación. Son una ALERTA para enfocar análisis en dimensiones de riesgo específicas.

---

## 🔍 ¿Cómo Funciona?

### Estructura en `fintra_snapshots`

```typescript
quality_brakes: {
  applied: boolean,         // ¿Se activó algún freno?
  reasons: string[],        // Lista de motivos
  altman_z?: number,       // Z-Score calculado
  piotroski?: number       // F-Score calculado
}
```

**Ejemplo de freno activado:**
```json
{
  "applied": true,
  "reasons": ["Altman Z < 1.8 (distress zone)"],
  "altman_z": 1.45,
  "piotroski": 6
}
```

**Ejemplo sin frenos:**
```json
{
  "applied": false,
  "reasons": [],
  "altman_z": 3.2,
  "piotroski": 7
}
```

---

## 🚨 FRENO 1: Altman Z-Score < 1.8

### ¿Qué es el Altman Z-Score?

Modelo predictivo de quiebra desarrollado por Edward Altman (1968). Combina 5 ratios financieros ponderados:

**Fórmula:**
```
Z = 1.2×(WC/TA) + 1.4×(RE/TA) + 3.3×(EBIT/TA) + 0.6×(MVE/TL) + 1.0×(Sales/TA)
```

Donde:
- **WC/TA:** Working Capital / Total Assets (liquidez)
- **RE/TA:** Retained Earnings / Total Assets (rentabilidad acumulada)
- **EBIT/TA:** Earnings Before Interest & Tax / Total Assets (eficiencia operativa)
- **MVE/TL:** Market Value Equity / Total Liabilities (solvencia)
- **Sales/TA:** Sales / Total Assets (rotación de activos)

### Interpretación de Zonas

| Z-Score | Zona | Significado |
|---------|------|-------------|
| **< 1.8** | 🔴 **Distress** | Alto riesgo de quiebra (72% probabilidad en 2 años) |
| **1.8 - 2.99** | 🟡 **Grey** | Zona gris - monitoreo requerido |
| **≥ 3.0** | 🟢 **Safe** | Zona segura - bajo riesgo financiero |

### ¿Cuándo se activa el freno?

**Condición:** `altman_z < 1.8`

```typescript
if (altmanZ !== null && altmanZ < 1.8) {
  reasons.push('Altman Z < 1.8 (distress zone)');
}
```

### Miradas sugeridas si se activa

1. **Liquidez inmediata:**
   - Revisar ratio corriente (current ratio)
   - Evaluar vencimientos de deuda corto plazo
   - Verificar disponibilidad de líneas de crédito

2. **Estructura de capital:**
   - Debt-to-Equity ratio
   - Cobertura de intereses (EBIT / Interest Expense)
   - Tendencia de deuda últimos 4 quarters

3. **Operaciones:**
   - ¿Los márgenes están comprimidos?
   - ¿Hay plan de reestructuración anunciado?
   - ¿La empresa generó FCF positivo últimos 12 meses?

4. **Contexto sectorial:**
   - ¿Es un problema específico de la empresa o del sector completo?
   - Comparar Z-Score con pares directos

---

## 📊 FRENO 2: Piotroski F-Score ≤ 3

### ¿Qué es el Piotroski F-Score?

Sistema de scoring financiero desarrollado por Joseph Piotroski (2000). Evalúa la **salud fundamental** en 9 dimensiones binarias (0 o 1).

**Objetivo:** Identificar empresas con deterioro operativo o datos de baja calidad.

### Las 9 Dimensiones

#### A. PROFITABILIDAD (4 puntos)
1. **ROA Positivo:** ¿Net Income > 0?
2. **OCF Positivo:** ¿Operating Cash Flow > 0?
3. **ROA Creciente:** ¿ROA este año > ROA año anterior?
4. **Quality of Earnings:** ¿OCF > Net Income? (accruals bajos)

#### B. LEVERAGE, LIQUIDEZ Y FUENTE DE FONDOS (3 puntos)
5. **Deuda Decreciente:** ¿Long-term Debt bajó vs año anterior?
6. **Liquidez Creciente:** ¿Current Ratio mejoró?
7. **No Dilución:** ¿Shares outstanding NO aumentaron?

#### C. EFICIENCIA OPERATIVA (2 puntos)
8. **Margen Creciente:** ¿Gross Margin mejoró?
9. **Asset Turnover Creciente:** ¿Sales/Assets mejoró?

### Interpretación de Scores

| F-Score | Categoría | Significado |
|---------|-----------|-------------|
| **0-3** | 🔴 **Débil** | Deterioro fundamental o datos incompletos |
| **4-6** | 🟡 **Promedio** | Fundamentales mixtos |
| **7-9** | 🟢 **Fuerte** | Salud fundamental sólida |

### ¿Cuándo se activa el freno?

**Condición:** `piotroski <= 3`

```typescript
if (piotroski !== null && piotroski <= 3) {
  reasons.push('Piotroski F-Score ≤ 3 (weak fundamentals or data quality)');
}
```

### Miradas sugeridas si se activa

1. **Calidad de datos:**
   - ¿Están todos los campos financieros poblados?
   - ¿Hay gaps significativos en historical data?
   - ¿La empresa reportó a tiempo sus últimos quarters?

2. **Tendencia operativa:**
   - ¿ROA está cayendo consistentemente?
   - ¿Operating Cash Flow es negativo recurrentemente?
   - ¿Hay desconexión entre utilidad contable y caja generada?

3. **Estructura de balance:**
   - ¿Deuda aumentó significativamente?
   - ¿Liquidez deteriorada (current ratio < 1)?
   - ¿Hubo dilución de accionistas (emisión de acciones)?

4. **Márgenes y eficiencia:**
   - ¿Gross margin está comprimido?
   - ¿Asset turnover cayó (menos ventas por dólar invertido)?

---

## 🔍 Casos de Uso Prácticos

### Caso 1: Empresa con Altman Z activado, Piotroski OK

```json
{
  "applied": true,
  "reasons": ["Altman Z < 1.8 (distress zone)"],
  "altman_z": 1.5,
  "piotroski": 7
}
```

**Interpretación:**
- Fundamentales operativos sólidos (F-Score 7)
- Pero estructura de capital estresada (Z-Score 1.5)

**Foco analítico:**
- Revisar **vencimientos de deuda** inmediatos
- Evaluar capacidad de **refinanciamiento**
- ¿Es temporal (reestructuración) o permanente?

---

### Caso 2: Empresa con Piotroski activado, Altman Z OK

```json
{
  "applied": true,
  "reasons": ["Piotroski F-Score ≤ 3 (weak fundamentals or data quality)"],
  "altman_z": 2.8,
  "piotroski": 3
}
```

**Interpretación:**
- Solvencia aceptable (Z-Score 2.8)
- Pero deterioro operativo o datos incompletos (F-Score 3)

**Foco analítico:**
- Verificar **completitud de datos financieros**
- Revisar si márgenes están comprimidos
- ¿Hay tendencia de recuperación o empeora?

---

### Caso 3: Ambos frenos activados (🚨 CRÍTICO)

```json
{
  "applied": true,
  "reasons": [
    "Altman Z < 1.8 (distress zone)",
    "Piotroski F-Score ≤ 3 (weak fundamentals or data quality)"
  ],
  "altman_z": 1.2,
  "piotroski": 2
}
```

**Interpretación:**
- **Alto riesgo estructural** en múltiples dimensiones
- Combina estrés financiero + deterioro operativo

**Foco analítico:**
- ⚠️ **Máxima precaución**
- Revisar anuncios de reestructuración
- Evaluar viabilidad de continuidad operativa
- Comparar con pares (¿es problema de sector o específico?)

---

### Caso 4: Sin frenos activados

```json
{
  "applied": false,
  "reasons": [],
  "altman_z": 4.5,
  "piotroski": 8
}
```

**Interpretación:**
- Salud financiera sólida
- Fundamentales operativos fuertes

**Foco analítico:**
- No hay alertas estructurales
- Análisis normal de valuación y crecimiento

---

## 📊 Estadísticas del Universo Fintra

**Snapshot:** 2026-02-03  
**Universo:** 29,924 empresas activas

| Estado | Cantidad | % |
|--------|----------|---|
| **Sin frenos** (`applied: false`) | 15,469 | 51.7% |
| **Con frenos** (`applied: true`) | 14,455 | 48.3% |

**Desglose por región (empresas CON frenos):**
- US: 2,494 empresas
- China: ~3,500 empresas
- Otros: ~8,461 empresas

**Interpretación:**
- ~50% del universo tiene algún freno activado
- Es COMÚN ver empresas con frenos (NO es excepcional)
- Priorizar análisis manual en empresas con ambos frenos

---

## 🛠️ Consultas SQL Útiles

### Ver empresas con frenos activados
```sql
SELECT 
  ticker,
  (quality_brakes->>'applied')::boolean as brakes_active,
  quality_brakes->>'reasons' as reasons,
  (quality_brakes->>'altman_z')::numeric as altman_z,
  (quality_brakes->>'piotroski')::integer as piotroski
FROM fintra_snapshots
WHERE (quality_brakes->>'applied')::boolean = true
ORDER BY (quality_brakes->>'altman_z')::numeric ASC
LIMIT 20;
```

### Ver distribución de Z-Scores
```sql
SELECT 
  CASE 
    WHEN (quality_brakes->>'altman_z')::numeric < 1.8 THEN 'Distress (<1.8)'
    WHEN (quality_brakes->>'altman_z')::numeric < 3.0 THEN 'Grey (1.8-2.99)'
    ELSE 'Safe (≥3.0)'
  END as z_zone,
  COUNT(*) as companies
FROM fintra_snapshots
WHERE quality_brakes->>'altman_z' IS NOT NULL
GROUP BY z_zone
ORDER BY z_zone;
```

### Ver empresas con ambos frenos
```sql
SELECT ticker, quality_brakes
FROM fintra_snapshots
WHERE (quality_brakes->>'applied')::boolean = true
  AND (quality_brakes->>'altman_z')::numeric < 1.8
  AND (quality_brakes->>'piotroski')::integer <= 3;
```

---

## 🎯 Resumen Ejecutivo

| Aspecto | Altman Z-Score | Piotroski F-Score |
|---------|----------------|-------------------|
| **Qué mide** | Riesgo de quiebra | Salud operativa |
| **Umbral freno** | < 1.8 | ≤ 3 |
| **Dimensión** | Estructura de capital | Calidad de earnings |
| **Alerta sobre** | Solvencia, liquidez | Deterioro operativo |
| **Acción sugerida** | Revisar balance | Revisar P&L y cash flow |

---

## 🔗 Referencias

- Motor: [lib/engine/fintra-brain.ts](../lib/engine/fintra-brain.ts) (línea ~350)
- Catálogo de Escenarios: [CATALOGO_ANALISIS_USUARIO.md](CATALOGO_ANALISIS_USUARIO.md) (Sección 8)
- Paper Altman (1968): ["Financial Ratios, Discriminant Analysis and the Prediction of Corporate Bankruptcy"](https://www.jstor.org/stable/2490171)
- Paper Piotroski (2000): ["Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers"](https://www.jstor.org/stable/2672906)

---

**Última revisión:** 2026-02-04  
**Validado contra código:** ✅ lib/engine/fintra-brain.ts (versión actual)

# Catálogo de Escenarios y Focos Analíticos del Usuario

Este documento define todos los **escenarios de análisis**, focos analíticos y mensajes generados automáticamente por Fintra para orientar la atención del usuario.

PRINCIPIOS FUNDAMENTALES:
- Fintra NO emite conclusiones, recomendaciones ni juicios.
- Fintra NO predice resultados ni sugiere decisiones.
- Cada mensaje describe un ESCENARIO DE ANÁLISIS.
- Todo escenario debe indicar QUÉ DIMENSIONES requieren mayor atención.

Regla madre:
> Fintra no dice qué pensar. Fintra indica dónde analizar con mayor cuidado.

FORMATO OBLIGATORIO PARA TODAS LAS SECCIONES:
Cada módulo debe describirse usando la estructura definida a continuación.

---

## 1. Escenario Narrativo
*Módulo: `narrativeRisk.ts`*

### Escenario que describe
La narrativa informativa reciente presenta baja persistencia, direccionalidad poco confiable o dependencia de contenido opinativo.

### Qué significa este escenario
La narrativa no domina el análisis actual y debe ponderarse con cautela frente a señales financieras y estructurales.

### Miradas sugeridas
- Priorizar métricas financieras sobre titulares recientes.
- Observar si la narrativa se traduce en resultados operativos.
- Contrastar sentimiento narrativo con márgenes y flujo de caja.

### Señales que activan este escenario
- Weak Evidence (Summary Only)
- Strong Direction / Low Confidence
- Opinion-Based Content
- Hype/Momentum without Persistence
- Low Narrative Persistence

---

## 2. Consistencia Cruzada (Cross-Domain Consistency)
*Módulo: `crossDomainConsistency.ts`*

### Escenario que describe
La relación lógica entre diferentes dimensiones financieras (ej. Ganancias vs. Flujo de Caja, Crecimiento vs. Distribución).

### Qué significa este escenario
Identifica tensiones o confirmaciones entre la contabilidad (devengado) y la realidad de caja, o entre las expectativas de crecimiento y la capacidad real de financiarlo.

### Miradas sugeridas
- **Si hay divergencia**: Investigar si las ganancias contables se convierten en caja real.
- **Si hay alineación**: Contrastar la solidez del modelo de negocio.
- **En crecimiento**: Revisar si la expansión se financia orgánicamente o con deuda/emisión.

### Señales que activan este escenario
- 🟢 **Positivo**: "Capital generation and distribution appear aligned." (Caja y dividendos coherentes).
- 🟡 **Neutral**: "Profitability is present but lacks structural persistence." (Rentabilidad presente, persistencia por confirmar).
- 🔴 **Negativo**: "Income expansion relies on elevated capital distribution." (Crecimiento depende de distribución elevada).

---

## 3. Señales de Dividendos (Dividend Signals)
*Módulo: `dividendSignals.ts`*

### Escenario que describe
La política de retorno de capital al accionista y su sostenibilidad financiera.

### Qué significa este escenario
Evalúa si el pago de dividendos compite con la capacidad de reinversión de la empresa o si genera tensión financiera.

### Miradas sugeridas
- Analizar el Payout Ratio sobre Flujo de Caja Libre (FCF), no solo sobre EPS.
- Observar la tendencia histórica: ¿Es un patrón estable o variable?
- Evaluar si el dividendo limita la capacidad de la empresa para mantener su posición competitiva.

### Señales que activan este escenario
- 🟢 "Consistent historical pattern": Patrón histórico estable.
- ⚠️ "High earnings payout limits reinvestment": El pago elevado limita la reinversión.
- 🔴 "Dividend sustainability appears fragile": Sostenibilidad del dividendo bajo presión.

---

## 4. Señales de Flujo de Caja (Cash Flow Signals)
*Módulo: `cashFlowSignals.ts`*

### Escenario que describe
La dinámica de generación de efectivo operativo y libre.

### Qué significa este escenario
Revela la capacidad de autofinanciación del negocio, complementando las métricas contables.

### Miradas sugeridas
- Distinguir entre volatilidad normal del sector y problemas estructurales de cobro/pago.
- Identificar si la empresa está en fase de fuerte inversión (Capex alto) o de retornos estables.
- Vigilar la dependencia de financiación externa.

### Señales que activan este escenario
- `cashflow_consistent`: Generación predecible y robusta.
- `cashflow_volatile`: Flujos variables que dificultan la proyección.
- `reinvestment_heavy`: Alto consumo de caja para sostener operaciones.
- `cashflow_pressure`: Tensión para cubrir obligaciones operativas.

---

## 5. Consistencia Estructural (Structural Consistency)
*Módulo: `structuralConsistency.ts`*

### Escenario que describe
La estabilidad del desempeño financiero a través de múltiples años fiscales.

### Qué significa este escenario
Distingue entre empresas con ventajas competitivas persistentes y aquellas con desempeño cíclico o episódico.

### Miradas sugeridas
- Buscar patrones de variabilidad en márgenes y retornos.
- Observar si los periodos de bajo desempeño son excepciones o recurrentes.
- Contrastar si la empresa ajusta precios a condiciones del mercado.

### Señales que activan este escenario
- `structural_profitability`: Rentabilidad base sólida.
- `structural_fragility`: Alternancia frecuente entre resultados positivos y negativos.
- `episodic_performance`: Resultados dependen de eventos aislados.

---

## 6. Anclas de Decisión (Decision Anchors)
*Módulo: `decisionAnchors.ts`*

### Escenario que describe
La síntesis del perfil actual, combinando calidad y momento.

### Qué significa este escenario
Define las características principales de la situación actual: ¿Es un perfil de calidad, una situación de valor, o un escenario complejo?

### Miradas sugeridas
- Si es "Candidato de calidad": Examinar la sensibilidad de la valoración.
- Si es "Precaución financiera": Monitorizar riesgos de balance y solvencia.
- Si es "Señales mixtas": Identificar el factor determinante que resuelva la incertidumbre.

### Señales que activan este escenario
- 🟢 "Candidato de calidad a largo plazo".
- ⚠️ "Entrada sensible a valoración" (Empresa sólida, valoración exigente).
- ⚠️ "Requiere precaución financiera" (Riesgos estructurales presentes).
- ⚖️ "Señales mixtas — caso de monitoreo".

---

## 7. Sesgo Narrativo (Narrative Bias)
*Módulo: `narrativeBias.ts`*

### Escenario que describe
El sentimiento emocional agregado del mercado hacia el activo.

### Qué significa este escenario
Indica si el precio actual puede estar influenciado por optimismo elevado o pesimismo marcado.

### Miradas sugeridas
- **Contrarian**: ¿Existe pesimismo ante una empresa con fundamentales estables?
- **Momentum**: ¿El mercado ignora riesgos debido a un sentimiento positivo fuerte?
- **Validación**: ¿El sentimiento se alinea con los fundamentales?

### Señales que activan este escenario
- `Positivo`: Optimismo dominante.
- `Neutro`: Equilibrio o indiferencia.
- `Negativo`: Pesimismo dominante.

---

## 8. Frenos de Calidad (Quality Brakes)
*Módulo: `applyQualityBrakes.ts`*

### Escenario que describe
Alertas de estrés financiero o calidad de datos.

### Qué significa este escenario
Señala riesgos estructurales críticos o preocupaciones sobre la integridad de los datos que requieren validación prioritaria.

### Miradas sugeridas
- **Solvencia**: ¿Existen presiones de liquidez a corto plazo? (Altman Z).
- **Integridad**: ¿Son consistentes los reportes financieros? (Piotroski F).
- Revisar notas a los estados financieros si se activan estas señales.

### Señales que activan este escenario
- **Altman Z < 1.8**: Indicadores de estrés financiero agudo.
- **Piotroski <= 3**: Deterioro fundamental significativo o baja calidad de datos.

---

## 9. Análisis de Coherencia (Growth Quality)
*Módulo: `moat.ts`*

### Escenario que describe
La calidad del crecimiento: relación entre expansión de ingresos y márgenes.

### Qué significa este escenario
Permite observar si la empresa mantiene poder de precios (crece y mantiene margen) o si crece con deterioro de margen.

### Miradas sugeridas
- **High Quality**: Observar persistencia de la ventaja competitiva.
- **Inefficient Growth**: Evaluar si es una estrategia temporal o debilidad estructural.
- **Neutral**: Crecimiento orgánico estándar.

### Señales que activan este escenario
- **High Quality Growth**: Revenue ↑ + Margin ↑.
- **Inefficient Growth**: Revenue ↑ + Margin ↓.
- **Neutral**: Otros casos.

---

## 10. Veredicto Final Fintra
*Módulo: `fintra-verdict.ts`*

### Escenario que describe
La configuración global del activo integrando Calidad (FGOS), Ventaja (Moat), Sentimiento y Valoración.

### Qué significa este escenario
Ofrece una visión integrada de las tensiones y fortalezas del caso.

### Miradas sugeridas
- **Exceptional/Strong**: Contrastar expectativas con riesgos potenciales.
- **Fragile**: Identificar el origen de la fragilidad (negocio, dividendo o retorno).
- **Speculative**: Evaluar si el optimismo del mercado tiene soporte fundamental.

### Señales que activan este escenario
- **Exceptional**: Configuración positiva alineada.
- **Strong**: Solidez fundamental.
- **Balanced**: Sin riesgos graves, sentimiento neutral.
- **Fragile**: Debilidades fundamentales presentes.
- **Speculative**: Debilidad fundamental con optimismo de mercado.

---

## 11. Disciplina de Capital (Capital Allocation)
*Módulo: `moat.ts`*

### Escenario que describe
La relación entre la reinversión de utilidades y el retorno obtenido.

### Qué significa este escenario
Distingue entre crecimiento que genera valor y expansión de activos con retornos decrecientes.

### Miradas sugeridas
- Comparar el crecimiento del Capital Invertido vs. la evolución del ROIC.
- Si hay crecimiento de capital y ROIC cae: Posible ineficiencia en asignación.
- Si hay estancamiento de capital: Observar si responde a conservadurismo o falta de oportunidades.

### Señales que activan este escenario
- **Value Creation**: Capital ↑ + ROIC ↑/Estable.
- **Value Destruction**: Capital ↑ + ROIC ↓.
- **Stagnation**: Capital estable.

---

## 12. Industry Fit Score (IFS) - Posicionamiento
*Módulo: `ifs.ts`*

### Escenario que describe
El desempeño relativo del activo frente a sus pares sectoriales en múltiples horizontes temporales.

### Qué significa este escenario
Indica la tendencia de relevancia de la empresa dentro de su industria.

### Miradas sugeridas
- **Leader**: ¿Es sostenible este desempeño relativo?
- **Laggard**: ¿Existe posibilidad de reversión a la media o es un problema estructural?
- **Follower**: ¿Sigue la tendencia general del sector?

### Señales que activan este escenario
- **Leader**: Desempeño superior en mayoría de plazos.
- **Laggard**: Desempeño inferior sistemático.
- **Follower**: Comportamiento promedio o mixto.

---

## 13. Deriva Narrativa (Narrative Drift)
*Módulo: `narrativeDrift.ts`*

### Escenario que describe
La estabilidad o cambio en los temas dominantes asociados al activo.

### Qué significa este escenario
Alerta sobre cambios en el enfoque principal de la información pública (ej. de Crecimiento a Reestructuración).

### Miradas sugeridas
- Identificar qué nueva temática está emergiendo.
- Evaluar si el cambio de temática sugiere una revisión del contexto.

### Señales que activan este escenario
- **Shift detected**: "Narrative emphasis has recently shifted".

---

## 14. Ejes de Ventaja Competitiva
*Módulo: `competitive-advantage.ts`*

### Escenario que describe
La descomposición de la ventaja competitiva en factores observables.

### Qué significa este escenario
Permite identificar el origen de la fortaleza: eficiencia operativa, persistencia de retornos o disciplina financiera.

### Miradas sugeridas
- **Return Persistence**: Observar barreras de entrada.
- **Operating Stability**: Observar eficiencia y control de costos.
- **Capital Discipline**: Observar gestión de recursos.

### Señales que activan este escenario
- Puntuaciones en los ejes de Persistencia, Estabilidad y Disciplina.

---

## 15. Contraste con Pares (Peer Contrast)
*Módulo: `structuralPeerContrast.ts`, `decisionPeerContrast.ts`*

### Escenario que describe
La comparación de características estructurales contra un referente relevante.

### Qué significa este escenario
Contextualiza la calidad del activo en términos relativos.

### Miradas sugeridas
- Si "Higher risk than peer": ¿El retorno potencial justifica el riesgo relativo?
- Si "Stronger quality than peer": ¿La valoración refleja esta diferencia de calidad?

### Señales que activan este escenario
- "Main profile shows stronger structural persistence".
- "Peer exhibits higher structural instability".
- "Higher financial risk relative to peer".

---

## 16. Posición de Mercado
*Módulo: `market-position.ts`*

### Escenario que describe
La ubicación estadística de la empresa en métricas clave frente al universo sectorial.

### Qué significa este escenario
Ubica a la empresa en la jerarquía sectorial basada en datos.

### Miradas sugeridas
- **Leader (Percentil > 75)**: Empresa en cuartil superior. Observar el margen potencial de expansión.
- **Weak (Percentil < 25)**: Empresa en cuartil inferior. Observar viabilidad o potencial de consolidación.

### Señales que activan este escenario
- Clasificación en percentiles (P10 a P90) y resumen (Leader, Strong, Average, Weak).

---

## 17. Anclas Narrativas Base (Core Narrative Anchors)
*Módulo: `narrativeAnchors.ts`*

### Escenario que describe
Señales fundamentales directas derivadas de ratios básicos, métricas de crecimiento y estructura de capital.

### Qué significa este escenario
Establece la "línea base" de la narrativa financiera antes de aplicar modelos más complejos. Identifica fortalezas o debilidades obvias en los estados financieros.

### Miradas sugeridas
- **Profitability**: Si es "Sólida", verificar sostenibilidad.
- **Leverage**: Si es "Elevado", revisar vencimientos y cobertura de intereses.
- **Valuation**: Si es "Exigente", contrastar con las tasas de crecimiento esperadas.
- **Financial Risk**: Si está activo, priorizar análisis de liquidez y solvencia.

### Señales que activan este escenario
- **Rentabilidad sólida y consistente**: Altos retornos (ROE/ROIC) y márgenes positivos.
- **Apalancamiento elevado**: Deuda significativa respecto al patrimonio (D/E > 2.0).
- **Valoración alineada al sector**: Múltiplos en rangos estándar (PE 15-25).
- **Valoración exigente**: Múltiplos elevados que requieren alto crecimiento futuro (PE > 35).
- **Riesgo financiero latente**: Baja liquidez o cobertura de intereses débil.
- **Crecimiento acelerado**: Expansión rápida de ventas y beneficios (>15% CAGR).

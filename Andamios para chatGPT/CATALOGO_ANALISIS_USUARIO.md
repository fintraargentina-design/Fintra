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
Identifica tensiones o confirmaciones entre la contabilidad (devengado) y la realidad de caja, o entre las promesas de crecimiento y la capacidad real de financiarlo.

### Miradas sugeridas
- **Si hay divergencia**: Investigar si las ganancias contables se están convirtiendo en caja real.
- **Si hay alineación**: Confirmar la solidez del modelo de negocio.
- **En crecimiento**: Revisar si la expansión se financia orgánicamente o con deuda/emisión.

### Señales que activan este escenario
- 🟢 **Positivo**: "Capital generation and distribution appear aligned." (Caja y dividendos coherentes).
- 🟡 **Neutral**: "Profitability is present but lacks structural persistence." (Rentable hoy, dudoso mañana).
- 🔴 **Negativo**: "Income expansion relies on elevated capital distribution." (Crecimiento forzado via payout insostenible).

---

## 3. Señales de Dividendos (Dividend Signals)
*Módulo: `dividendSignals.ts`*

### Escenario que describe
La política de retorno de capital al accionista y su sostenibilidad financiera.

### Qué significa este escenario
Evalúa si el pago de dividendos compite con la capacidad de reinversión de la empresa o si pone en riesgo la salud financiera.

### Miradas sugeridas
- Analizar el Payout Ratio sobre Flujo de Caja Libre (FCF), no solo sobre EPS.
- Observar la tendencia histórica: ¿Es un compromiso estable o errático?
- Evaluar si el dividendo limita la capacidad de la empresa para defender su posición competitiva.

### Señales que activan este escenario
- 🟢 "Consistent historical pattern": Compromiso gerencial probado.
- ⚠️ "High earnings payout limits reinvestment": El dividendo asfixia el crecimiento.
- 🔴 "Dividend sustainability appears fragile": Riesgo inminente de corte.

---

## 4. Señales de Flujo de Caja (Cash Flow Signals)
*Módulo: `cashFlowSignals.ts`*

### Escenario que describe
La dinámica de generación de efectivo operativo y libre.

### Qué significa este escenario
Revela la verdadera capacidad de autofinanciación del negocio, más allá de las métricas contables.

### Miradas sugeridas
- Distinguir entre volatilidad normal del sector y problemas estructurales de cobro/pago.
- Identificar si la empresa está en fase de fuerte inversión (Capex alto) o de cosecha ("Vaca lechera").
- Vigilar la dependencia de financiación externa.

### Señales que activan este escenario
- `cashflow_consistent`: Generación predecible y robusta.
- `cashflow_volatile`: Flujos erráticos que dificultan la planificación.
- `reinvestment_heavy`: Alto consumo de caja para sostener crecimiento.
- `cashflow_pressure`: Dificultad para cubrir obligaciones operativas.

---

## 5. Consistencia Estructural (Structural Consistency)
*Módulo: `structuralConsistency.ts`*

### Escenario que describe
La estabilidad del desempeño financiero a través de múltiples años fiscales.

### Qué significa este escenario
Distingue entre empresas con ventajas competitivas duraderas y aquellas que dependen de ciclos favorables o eventos episódicos.

### Miradas sugeridas
- Buscar patrones de "dientes de sierra" en márgenes y retornos.
- Evaluar si los años malos son excepciones o la norma.
- Determinar si la empresa tiene control sobre su destino o es "tomadora de precios".

### Señales que activan este escenario
- `structural_profitability`: Rentabilidad base sólida.
- `structural_fragility`: Alternancia frecuente entre pérdidas y ganancias.
- `episodic_performance`: Resultados dependen de eventos aislados.

---

## 6. Anclas de Decisión (Decision Anchors)
*Módulo: `decisionAnchors.ts`*

### Escenario que describe
La síntesis del perfil de inversión actual, combinando calidad y momento.

### Qué significa este escenario
Define el "carácter" de la oportunidad: ¿Es una inversión de calidad a precio justo, una apuesta de valor, o una trampa de valor?

### Miradas sugeridas
- Si es "Candidato de calidad": Centrarse en no sobrepagar.
- Si es "Precaución financiera": Centrarse en riesgos de balance y solvencia.
- Si es "Señales mixtas": Buscar el catalizador que resuelva la incertidumbre.

### Señales que activan este escenario
- 🟢 "Candidato de calidad a largo plazo".
- ⚠️ "Entrada sensible a valoración" (Buena empresa, precio exigente).
- ⚠️ "Requiere precaución financiera" (Riesgos estructurales).
- ⚖️ "Señales mixtas — caso de monitoreo".

---

## 7. Sesgo Narrativo (Narrative Bias)
*Módulo: `narrativeBias.ts`*

### Escenario que describe
El sentimiento emocional agregado del mercado hacia el activo.

### Qué significa este escenario
Indica si el precio actual puede estar influenciado por optimismo excesivo (euforia) o pesimismo exagerado (miedo).

### Miradas sugeridas
- **Contrarian**: ¿Está el mercado demasiado negativo ante una empresa sólida?
- **Momentum**: ¿Está el mercado ignorando riesgos por pura euforia?
- **Validación**: ¿El sentimiento coincide con los fundamentales?

### Señales que activan este escenario
- `Positivo`: Optimismo dominante.
- `Neutro`: Equilibrio o indiferencia.
- `Negativo`: Pesimismo dominante.

---

## 8. Frenos de Calidad (Quality Brakes)
*Módulo: `applyQualityBrakes.ts`*

### Escenario que describe
Alertas de riesgo financiero (quiebra) y calidad contable (manipulación o deterioro).

### Qué significa este escenario
Señala riesgos existenciales o de integridad de datos que invalidan cualquier tesis de crecimiento o valoración. Son "semáforos rojos".

### Miradas sugeridas
- **Solvencia**: ¿Puede la empresa sobrevivir a corto plazo? (Altman Z).
- **Integridad**: ¿Son creíbles los números reportados? (Piotroski F).
- Revisar notas a los estados financieros si se activan estas señales.

### Señales que activan este escenario
- **Altman Z < 1.8**: Alto riesgo de quiebra/insolvencia.
- **Piotroski <= 3**: Deterioro fundamental severo o baja calidad contable.

---

## 9. Análisis de Coherencia (Growth Quality)
*Módulo: `moat.ts`*

### Escenario que describe
La calidad del crecimiento: relación entre expansión de ingresos y márgenes.

### Qué significa este escenario
Determina si la empresa tiene poder de fijación de precios (crece y gana más margen) o si está "comprando ventas" (crece sacrificando margen).

### Miradas sugeridas
- **High Quality**: Buscar sostenibilidad de la ventaja competitiva.
- **Inefficient Growth**: Evaluar si es una estrategia temporal de captura de mercado o debilidad estructural.
- **Neutral**: Crecimiento orgánico estándar.

### Señales que activan este escenario
- **High Quality Growth**: Revenue ↑ + Margin ↑.
- **Inefficient Growth**: Revenue ↑ + Margin ↓↓↓.
- **Neutral**: Otros casos.

---

## 10. Veredicto Final Fintra
*Módulo: `fintra-verdict.ts`*

### Escenario que describe
La configuración global del activo integrando Calidad (FGOS), Ventaja (Moat), Sentimiento y Valoración.

### Qué significa este escenario
Ofrece una visión holística de las tensiones y fortalezas del caso de inversión.

### Miradas sugeridas
- **Exceptional/Strong**: Buscar razones para NO invertir (abogado del diablo).
- **Fragile**: Entender exactamente dónde está la grieta (¿negocio, dividendo o retorno?).
- **Speculative**: Evaluar si el optimismo del mercado tiene base real.

### Señales que activan este escenario
- **Exceptional**: Todo alineado positivamente.
- **Strong**: Solidez fundamental.
- **Balanced**: Sin riesgos graves, sentimiento neutral.
- **Fragile**: Fallas fundamentales críticas.
- **Speculative**: Mala calidad fundamental + Euforia de mercado.

---

## 11. Disciplina de Capital (Capital Allocation)
*Módulo: `moat.ts`*

### Escenario que describe
La eficacia de la gerencia al reinvertir las utilidades en el negocio.

### Qué significa este escenario
Distingue entre crecimiento que crea valor y "construcción de imperios" que destruye valor para el accionista.

### Miradas sugeridas
- Comparar el crecimiento del Capital Invertido vs. la evolución del ROIC.
- Si hay crecimiento de capital y ROIC cae: Alerta de mala asignación.
- Si hay estancamiento de capital: ¿Falta de ideas o disciplina extrema?

### Señales que activan este escenario
- **Value Creation**: Capital ↑ + ROIC ↑/Estable.
- **Value Destruction**: Capital ↑ + ROIC ↓.
- **Stagnation**: Capital plano (Gerencia conservadora o sin oportunidades).

---

## 12. Industry Fit Score (IFS) - Posicionamiento
*Módulo: `ifs.ts`*

### Escenario que describe
El momentum y desempeño relativo del activo frente a sus pares sectoriales en múltiples horizontes temporales.

### Qué significa este escenario
Indica si la empresa está ganando o perdiendo relevancia dentro de su industria.

### Miradas sugeridas
- **Leader**: ¿Es sostenible este liderazgo? ¿Está sobrecomprado?
- **Laggard**: ¿Es una oportunidad de reversión a la media o hay un problema estructural?
- **Follower**: ¿Se mueve simplemente con la marea del sector?

### Señales que activan este escenario
- **Leader**: Desempeño superior en mayoría de plazos (Corto, Medio, Largo).
- **Laggard**: Desempeño inferior sistemático.
- **Follower**: Comportamiento promedio o mixto.

---

## 13. Deriva Narrativa (Narrative Drift)
*Módulo: `narrativeDrift.ts`*

### Escenario que describe
La estabilidad o cambio en los temas dominantes que el mercado discute sobre el activo.

### Qué significa este escenario
Alerta sobre cambios en la tesis de inversión percibida por el mercado (ej. de "Historia de Crecimiento" a "Historia de Reestructuración").

### Miradas sugeridas
- Identificar qué nueva narrativa está emergiendo.
- Evaluar si el cambio de narrativa justifica una reevaluación de la valoración.

### Señales que activan este escenario
- **Shift detected**: "Narrative emphasis has recently shifted".

---

## 14. Ejes de Ventaja Competitiva
*Módulo: `competitive-advantage.ts`*

### Escenario que describe
La descomposición de la ventaja competitiva en pilares cuantificables.

### Qué significa este escenario
Permite entender el *origen* de la ventaja: ¿Es eficiencia operativa, marca/pricing power, o disciplina financiera?

### Miradas sugeridas
- **Return Persistence**: Mirar barreras de entrada.
- **Operating Stability**: Mirar eficiencia operativa y control de costos.
- **Capital Discipline**: Mirar calidad del equipo directivo (Management).

### Señales que activan este escenario
- Puntuaciones en los ejes de Persistencia, Estabilidad y Disciplina.

---

## 15. Contraste con Pares (Peer Contrast)
*Módulo: `structuralPeerContrast.ts`, `decisionPeerContrast.ts`*

### Escenario que describe
La comparación directa de fortalezas y debilidades estructurales contra un competidor relevante.

### Qué significa este escenario
Contextualiza la calidad del activo: ¿Es bueno en absoluto o solo "el menos malo" del sector?

### Miradas sugeridas
- Si "Higher risk than peer": ¿Compensa el retorno potencial este riesgo extra?
- Si "Stronger quality than peer": ¿Refleja la valoración esta prima de calidad?

### Señales que activan este escenario
- "Main profile shows stronger structural persistence".
- "Peer exhibits higher structural instability".
- "Higher financial risk relative to peer".

---

## 16. Posición de Mercado
*Módulo: `market-position.ts`*

### Escenario que describe
El ranking estadístico de la empresa en métricas clave (Tamaño, Rentabilidad, Crecimiento) frente al universo sectorial.

### Qué significa este escenario
Ubica objetivamente a la empresa en la "cadena alimenticia" del sector.

### Miradas sugeridas
- **Leader (Percentil > 75)**: Empresa dominante. Verificar si ya no tiene espacio para crecer.
- **Weak (Percentil < 25)**: Empresa marginal. Verificar si es viable o target de adquisición.

### Señales que activan este escenario
- Clasificación en percentiles (P10 a P90) y resumen (Leader, Strong, Average, Weak).

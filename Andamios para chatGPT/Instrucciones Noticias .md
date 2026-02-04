Bien. Con todo lo que ya está definido, el plan de implementación se puede plantear **de forma incremental, auditable y sin contaminar el motor financiero**. Te lo dejo como **plan maestro**, pensado para ejecución real (equipo) y para poder explicarlo sin vergüenza (inversores).

---

## Plan de Implementación – Sección Escenarios Fintra

### Fase 0 – Congelamiento conceptual (check de coherencia)

Objetivo: asegurar que nadie “reinterprete” la sección más adelante.

* Declarar formalmente que **Escenarios no afectan FGOS, IFS, Valuation ni Life Cycle**.
* Documentar que Escenarios es una **capa de contexto narrativo**, no predictiva.
* Fijar como regla que toda métrica de escenario debe ser:

  * determinística
  * reproducible
  * basada solo en datos persistidos

Esta fase no produce código, pero evita deuda conceptual futura.

---

### Fase 1 – Sensor de mercado (NoticiasTicker)

Objetivo: capturar y etiquetar correctamente el flujo informativo.

Estado: **parcialmente implementado**, se completa y se consolida.

Tareas:

* Consolidar el pipeline de ingestión de noticias con:

  * news_type
  * direction
  * confidence
  * evidence_level
  * narrative_vector
  * is_eligible_for_history (derivado, no editable)
* Garantizar que **todas las noticias se guardan**, incluso las no elegibles.
* Asegurar logging explícito de:

  * noticia procesada
  * noticia descartada para histórico
  * razón del descarte

Resultado de la fase:
Un histórico confiable de “lo que el mercado dijo”, no solo de lo que fue útil.

---

### Fase 2 – Memoria narrativa (histórico de 30 días)

Objetivo: construir la base temporal sobre la cual se agregan escenarios.

Tareas:

* Implementar lógica de ventana móvil estricta de 30 días.
* Usar exclusivamente noticias con is_eligible_for_history = true para agregaciones.
* Mantener acceso a noticias no elegibles solo para inspección/debug, no para scoring.
* Validar que no haya mezcla de ventanas (no rolling implícito mal definido).

Resultado:
Una memoria narrativa limpia, coherente con los principios del documento.

---

### Fase 3 – Modelos determinísticos de escenario (backend)

Objetivo: transformar datos crudos en métricas de contexto.

Implementar y consolidar:

NarrativeRisk

* Inputs: evidence_level, confidence, direction.
* Salida: nivel de riesgo narrativo (bajo / medio / alto o escala equivalente).
* Regla clave: riesgo alto ≠ noticia negativa.
  Riesgo alto = narrativa frágil o ruidosa.

NarrativeBias

* Inputs: direction, confidence.
* Salida: sesgo agregado del clima narrativo.
* Ponderación explícita por confianza.
* No se muestra como “recomendación”, sino como “clima”.

DominantNarratives

* Inputs: narrative_vector.
* Agrupación temática.
* Filtro por recurrencia y confianza.
* Salida: temas que realmente están sosteniendo la narrativa.

Todos estos cálculos:

* viven en backend
* son versionables
* se pueden recalcular históricamente

---

### Fase 4 – Estado de escenario (orquestación)

Objetivo: definir “qué escenario está activo”.

Tareas:

* Introducir el concepto de:

  * escenario activo
  * escenario inexistente (estado válido)
* Asociar cada snapshot de escenario a:

  * fecha
  * ventana analizada
  * métricas agregadas
* Permitir que un escenario sea:

  * puramente informativo
  * marcado como “sin señales relevantes”

Resultado:
La UI nunca “inventa” contexto; o hay escenario, o se declara que no lo hay.

---

### Fase 5 – ScenariosTab (visualización pasiva)

Objetivo: mostrar contexto sin editorializar.

Principios de implementación:

* El frontend no calcula nada.
* El frontend no interpreta.
* El frontend no infiere.

Contenido mínimo:

* Estado del escenario (activo / sin señales).
* Riesgo Narrativo.
* Sesgo Narrativo.
* Narrativas Dominantes.
* Disclaimer visible de alcance y límites.

Nada de:

* flechas de precio
* colores tipo buy/sell
* frases predictivas

---

### Fase 6 – Observabilidad y auditoría

Objetivo: poder explicar el sistema bajo presión.

Tareas:

* Logs claros de:

  * cómo se construyó cada escenario
  * cuántas noticias entraron
  * cuántas quedaron fuera y por qué
* Capacidad de reconstruir un escenario pasado.
* Tests determinísticos de:

  * ventanas temporales
  * umbrales
  * reglas de elegibilidad

Resultado:
Escenarios defendibles frente a usuarios sofisticados.

---

### Fase 7 – Extensiones controladas (opcional, futura)

Solo cuando todo lo anterior esté estable.

Posibles extensiones:

* Insights humanos (analista / trader).
* Etiquetas de restricción externa (regulatorio, macro).
* Comparación entre narrativa y fundamentals (sin mezclar cálculos).

Nunca:

* feedback loop automático hacia scores financieros.
* aprendizaje online no auditable.

---

## Resultado final esperado

Al finalizar este plan, Fintra tiene:

* Un **sensor confiable del relato del mercado**.
* Una **memoria narrativa disciplinada**.
* Un **sistema de escenarios explicable, no mágico**.
* Una UI que informa sin sugerir.

Esto posiciona a Escenarios como una ventaja estructural: no promete alpha, promete **claridad**, que en mercados saturados suele ser más valiosa.

El próximo punto natural, cuando quieras seguir, es priorizar **qué fases entran en el próximo sprint y cuáles se congelan** para evitar scope creep.

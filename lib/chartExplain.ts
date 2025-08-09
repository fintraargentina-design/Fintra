export const CHART_EXPLAIN: Record<
  "precioLog" | "drawdown" | "rolling" | "volRealizada" | "relativa",
  { titulo: string; descripcion: string; casoPractico: string }
> = {
  precioLog: {
    titulo: "Log-scale en precio",
    descripcion:
      "Muestra el precio en escala logarítmica. En horizontes largos evita la distorsión de la escala lineal: un +100% luce igual en 2005 y en 2025. Es estándar institucional para comparar tendencias y detectar rupturas estructurales.",
    casoPractico:
      "Un gestor valida si la acción mantiene una tasa compuesta estable dentro de su canal de largo plazo o si lo quebró, para decidir mantener, subir o recortar exposición."
  },

  drawdown: {
    titulo: "Drawdown desde máximos",
    descripcion:
      "Mide la caída porcentual desde el máximo histórico al mínimo posterior. Captura severidad y duración de pérdidas; clave para control de riesgo y comparabilidad entre activos.",
    casoPractico:
      "Un inversor institucional compara el drawdown de Intel vs. S&P 500 en 2008 y 2022 para evaluar si el riesgo específico es aceptable dentro de su mandato."
  },

  rolling: {
    titulo: "Rolling returns 1/3/5 años",
    descripcion:
      "Rendimientos anualizados en ventanas móviles de 1, 3 y 5 años. Evalúa consistencia de performance y permite identificar regímenes (alcista, bajista, estancado).",
    casoPractico:
      "Un LP verifica que el 3Y rolling haya sido positivo en >80% de los períodos móviles; si cae por debajo, reduce la posición al perderse la consistencia histórica."
  },

  volRealizada: {
    titulo: "Volatilidad realizada 30/90 días",
    descripcion:
      "Desviación estándar de retornos diarios en ventanas de 30 y 90 días, anualizada. 30d refleja riesgo táctico; 90d, régimen de fondo. Útil para risk budgeting.",
    casoPractico:
      "Si la vol. 30d se dispara muy por encima de 90d, el gestor baja tamaño y amplía márgenes (stop/target) para mantener el riesgo del portafolio dentro de límites."
  },

  relativa: {
    titulo: "Performance relativa vs. benchmark",
    descripcion:
      "Rendimiento acumulado de la acción frente a su índice/peer desde un inicio común. Identifica sobre/infra performance persistente para decisiones de sobre/infraponderación.",
    casoPractico:
      "Una aseguradora compara Intel vs. Nasdaq 100; tras 3 años de -12% relativo, rota parte de la posición hacia un peer con mejor momentum y métricas."
  }
};
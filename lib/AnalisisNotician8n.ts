export interface NewsAnalysisData {
  title: string;
  summary: string;
  date: string;
  source: string;
  symbol: string;
  sentiment: string;
  relevance: number;
}

export interface AnalysisResponse {
  impacto: string;
  analisis: string;
}

export interface AnalysisState {
  isOpen: boolean;
  isLoading: boolean;
  data: AnalysisResponse | null;
  error: string | null;
}

/**
 * Envía una noticia al webhook de n8n para análisis con IA
 * @param newsData - Datos de la noticia a analizar
 * @returns Promise con la respuesta del análisis
 */
export async function analyzeNewsWithAI(data: NewsAnalysisData): Promise<AnalysisResponse> {
  const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  
  if (!webhookUrl) {
    throw new Error('URL del webhook no configurada');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Error en la solicitud: ${response.status}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Obtiene el color CSS para el impacto del análisis
 * @param impacto - Tipo de impacto (Positivo, Neutro, Negativo)
 * @returns Clase CSS de Tailwind para el color
 */
export function getImpactColor(impacto: string): string {
  switch (impacto) {
    case 'Positivo':
      return 'text-green-400';
    case 'Neutro':
      return 'text-yellow-400';
    case 'Negativo':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * Estado inicial para el modal de análisis
 */
export const initialAnalysisState: AnalysisState = {
  isOpen: false,
  isLoading: false,
  data: null,
  error: null
};
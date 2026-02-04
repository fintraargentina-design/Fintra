export interface NewsAnalysisData {
  title: string;
  summary: string;
  date: string;
  source: string;
  symbol: string;
  sentiment: string;
  relevance: number;
  url: string;
}

export interface AnalysisResponse {
  news_type: "Hecho" | "Anuncio" | "Opinión" | "Análisis";
  direction: "Positiva" | "Neutra" | "Negativa";
  narrative_vector: string[];
  confidence: "Alta" | "Media" | "Baja";
  explanation: string;
}

export interface AnalysisState {
  isOpen: boolean;
  isLoading: boolean;
  data: AnalysisResponse | null;
  error: string | null;
}

/**
 * Envía una noticia a la API interna para análisis con IA
 * @param newsData - Datos de la noticia a analizar
 * @param useTestMode - (Opcional) Si es true, usa el webhook de test de n8n
 * @returns Promise con la respuesta del análisis
 */
export async function analyzeNewsWithAI(data: NewsAnalysisData, useTestMode: boolean = false): Promise<AnalysisResponse> {
  const apiUrl = '/api/news/analyze';
  
  // Construct payload with minimal data required by backend
  const payload = {
    title: data.title,
    summary: data.summary,
    date: data.date,
    source: data.source,
    symbol: data.symbol,
    url: data.url,
    useTestMode
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = `Error en la solicitud: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
        if (errorData.details) {
          errorMessage += `\n\nDetails: ${errorData.details}`;
        }
        if (errorData.tip) {
          errorMessage += `\n\nTip: ${errorData.tip}`;
        }
      }
    } catch (e) {
      // Ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  return result;
}

export function getDirectionColor(direction: string): string {
  switch (direction) {
    case 'Positiva':
      return 'text-green-400';
    case 'Neutra':
      return 'text-yellow-400';
    case 'Negativa':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'Alta':
      return 'text-green-400';
    case 'Media':
      return 'text-yellow-400';
    case 'Baja':
      return 'text-zinc-400';
    default:
      return 'text-zinc-400';
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

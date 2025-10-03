import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { ExternalLink, TrendingUp, TrendingDown, Minus, Brain, X } from "lucide-react";
import { 
  analyzeNewsWithAI, 
  getImpactColor, 
  initialAnalysisState,
  type NewsAnalysisData,
  type AnalysisState 
} from "@/lib/AnalisisNotician8n";

interface NewsItem {
  title: string;
  url: string;
  time_published: string;
  authors: string[];
  summary: string;
  banner_image?: string;
  source: string;
  category_within_source: string;
  source_domain: string;
  topics: Array<{
    topic: string;
    relevance_score: string;
  }>;
  overall_sentiment_score: number;
  overall_sentiment_label: string;
  ticker_sentiment: Array<{
    ticker: string;
    relevance_score: string;
    ticker_sentiment_score: string;
    ticker_sentiment_label: string;
  }>;
}

interface NewsResponse {
  items: string;
  sentiment_score_definition: string;
  relevance_score_definition: string;
  feed: NewsItem[];
}

interface NoticiasTabProps {
  symbol?: string;
  stockBasicData?: any;
  stockAnalysis?: any;
  selectedStock?: any;
}

export default function NoticiasTab({ 
  symbol = "AAPL", 
  stockBasicData, 
  stockAnalysis, 
  selectedStock 
}: NoticiasTabProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Mover este useState aquí, al inicio del componente
  const [analysisModal, setAnalysisModal] = useState<AnalysisState>(initialAnalysisState);

  useEffect(() => {
    fetchNews();
  }, [symbol]);

  const fetchNews = async () => {
    // Validar que el símbolo sea válido
    if (!symbol || symbol === "N/A" || symbol.length === 0) {
      setError('No hay símbolo seleccionado');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Usar la API de AlphaVantage NEWS_SENTIMENT
      const response = await fetch(
        `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY}&limit=10`
      );
      
      if (!response.ok) {
        throw new Error('Error al obtener las noticias');
      }
      
      const data: NewsResponse = await response.json();
      
      if (data.feed && Array.isArray(data.feed)) {
        setNews(data.feed);
      } else {
        throw new Error('Formato de datos inválido');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: string, score: number) => {
    if (sentiment === 'Bullish' || score > 0.1) {
      return <TrendingUp className="w-4 h-4 text-green-400" />;
    } else if (sentiment === 'Bearish' || score < -0.1) {
      return <TrendingDown className="w-4 h-4 text-red-400" />;
    } else {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSentimentColor = (sentiment: string, score: number) => {
    if (sentiment === 'Bullish' || score > 0.1) {
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    } else if (sentiment === 'Bearish' || score < -0.1) {
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    } else {
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      // Formato: YYYYMMDDTHHMMSS
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const hour = dateString.substring(9, 11);
      const minute = dateString.substring(11, 13);
      
      const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getTickerSentiment = (newsItem: NewsItem) => {
    const tickerSentiment = newsItem.ticker_sentiment?.find(
      (ts) => ts.ticker === symbol
    );
    return tickerSentiment;
  };

  if (loading) {
    return (
      <Card className="bg-tarjetas bg-tarjetas border-none h-[400px]">

        <CardHeader>
          <CardTitle className="text-orange-400 text-lg flex items-center gap-2">
            Noticias {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400"></div>
            <span className="ml-3 text-gray-400">Cargando noticias...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-tarjetas bg-tarjetas border-none h-[360px]">
        <CardHeader>
          <CardTitle className="text-orange-400 text-lg flex items-center gap-2">
            Noticias {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">Error: {error}</p>
            <button
              onClick={fetchNews}
              className="px-4 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/30 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Función para analizar noticia con IA
  const handleAnalyzeNews = async (newsItem: NewsItem) => {
    const tickerSentiment = getTickerSentiment(newsItem);
    const sentimentScore = tickerSentiment 
      ? parseFloat(tickerSentiment.ticker_sentiment_score)
      : newsItem.overall_sentiment_score;
    const sentimentLabel = tickerSentiment 
      ? tickerSentiment.ticker_sentiment_label
      : newsItem.overall_sentiment_label;
    const relevanceScore = tickerSentiment 
      ? parseFloat(tickerSentiment.relevance_score)
      : 0;

    // Preparar datos para el análisis
    const analysisData: NewsAnalysisData = {
      title: newsItem.title,
      summary: newsItem.summary,
      date: newsItem.time_published,
      source: newsItem.source,
      symbol: symbol,
      sentiment: sentimentLabel,
      relevance: relevanceScore
    };

    // Abrir modal en estado de carga
    setAnalysisModal({
      isOpen: true,
      isLoading: true,
      data: null,
      error: null
    });

    try {
      const result = await analyzeNewsWithAI(analysisData);
      
      setAnalysisModal({
        isOpen: true,
        isLoading: false,
        data: result,
        error: null
      });
    } catch (error) {
      setAnalysisModal({
        isOpen: true,
        isLoading: false,
        data: null,
        error: 'No se pudo analizar la noticia'
      });
    }
  };

  // Función para cerrar modal
  const closeModal = () => {
    setAnalysisModal(initialAnalysisState);
  };

  return (
    <>
      <Card className="flex-1 bg-tarjetas bg-tarjetas border-none h-[calc(100vh-200px)]">
        <CardHeader>
          <CardTitle className="text-orange-400 text-lg flex items-center gap-2">
          <div className="text-gray-400">
           Noticias
          </div>
           {symbol}
            <Badge variant="outline" className="text-xs border-none">
              - {news.length} artículos
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 h-[calc(100vh-280px)] overflow-y-auto space-y-4">
          {news.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No hay noticias disponibles para {symbol}
            </p>
          ) : (
            news.map((newsItem, index) => {
              const tickerSentiment = getTickerSentiment(newsItem);
              const sentimentScore = tickerSentiment 
                ? parseFloat(tickerSentiment.ticker_sentiment_score)
                : newsItem.overall_sentiment_score;
              const sentimentLabel = tickerSentiment 
                ? tickerSentiment.ticker_sentiment_label
                : newsItem.overall_sentiment_label;

              return (
                <div
                  key={index}
                  className="bg-fondoDeTarjetas border-none p-4 rounded-lg"
                >
                  {/* Header con título y sentimiento */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-white font-medium text-sm leading-tight flex-1">
                      {newsItem.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getSentimentIcon(sentimentLabel, sentimentScore)}
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getSentimentColor(sentimentLabel, sentimentScore)}`}
                      >
                        {sentimentLabel}
                      </Badge>
                    </div>
                  </div>

                  {/* Resumen */}
                  <p className="text-gray-300 text-sm mb-3 line-clamp-3">
                    {newsItem.summary}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-orange-400">
                        {newsItem.source}
                      </span>
                      <span>{formatDate(newsItem.time_published)}</span>
                      {newsItem.authors && newsItem.authors.length > 0 && (
                        <span>por {newsItem.authors[0]}</span>
                      )}
                    </div>
                  </div>

                  {/* Topics y relevancia */}
                  {newsItem.topics && newsItem.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {newsItem.topics.slice(0, 3).map((topic, topicIndex) => (
                        <Badge 
                          key={topicIndex} 
                          variant="secondary" 
                          className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30"
                        >
                          {topic.topic}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Sentimiento específico del ticker */}
                  {tickerSentiment && (
                    <div className="text-xs text-gray-400 mb-3">
                      <span className="text-orange-400">Relevancia para {symbol}:</span>
                      <span className="ml-2">
                        {(parseFloat(tickerSentiment.relevance_score) * 100).toFixed(1)}%
                      </span>
                      <span className="ml-3 text-orange-400">Score:</span>
                      <span className="ml-1">
                        {parseFloat(tickerSentiment.ticker_sentiment_score).toFixed(3)}
                      </span>
                    </div>
                  )}

                  {/* Link al artículo y botón de análisis */}
                  <div className="flex items-center justify-between">
                    {/* Botón Analizar con IA */}
                    <button
                      onClick={() => handleAnalyzeNews(newsItem)}
                      disabled={analysisModal.isLoading}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 hover:border-blue-500/50 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >  {/* text-xs bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30 hover:border-blue-500/50 disabled:opacity-50 */}
                      {/* <Brain className="w-3 h-3" /> */}
                      {analysisModal.isLoading ? 'Analizando...' : 'Analizar con IA'}
                    </button>

                    {/* Link al artículo */}
                    <a
                      href={newsItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 text-xs transition-colors"
                    >
                      Leer más
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Modal de Análisis de IA */}
      {analysisModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              {/* Header del modal */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {analysisModal.error ? 'Error' : 'Interpretación de la IA'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido del modal */}
              {analysisModal.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                  <span className="ml-3 text-gray-400">Analizando...</span>
                </div>
              ) : analysisModal.error ? (
                <div className="text-center py-8">
                  <p className="text-red-400 mb-4">{analysisModal.error}</p>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              ) : analysisModal.data ? (
                <div className="space-y-6">
                  {/* Impacto */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Impacto</h3>
                    <p className={`text-2xl font-bold ${getImpactColor(analysisModal.data.impacto)}`}>
                      {analysisModal.data.impacto}
                    </p>
                  </div>

                  {/* Análisis */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Análisis</h3>
                    <p className="text-gray-300 leading-relaxed">
                      {analysisModal.data.analisis}
                    </p>
                  </div>

                  {/* Botón cerrar */}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
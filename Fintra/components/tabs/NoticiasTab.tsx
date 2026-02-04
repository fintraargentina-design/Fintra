import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  X,
  Clock,
  Share2,
  MessageSquare,
  Filter,
} from "lucide-react";
import { FintraLoader } from '@/components/ui/FintraLoader';
import {
  analyzeNewsWithAI,
  getDirectionColor,
  getConfidenceColor,
  initialAnalysisState,
  type NewsAnalysisData,
  type AnalysisState,
} from "@/lib/AnalisisNotician8n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import DraggableWidget from "@/components/ui/draggable-widget";
import { fmp } from "@/lib/fmp/public";

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

interface NoticiasTabProps {
  symbol?: string;
  stockBasicData?: any;
  stockAnalysis?: any;
  selectedStock?: any;
  title?: string;
}

export default function NoticiasTab({
  symbol = "AAPL",
  stockBasicData,
  stockAnalysis,
  selectedStock,
  title,
}: NoticiasTabProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisModal, setAnalysisModal] =
    useState<AnalysisState>(initialAnalysisState);
  const [selectedNewsTitle, setSelectedNewsTitle] = useState<string | null>(
    null,
  );

  // Filter State
  const [activeCategory, setActiveCategory] = useState("Stock News");

  const [viewNewsModal, setViewNewsModal] = useState<{
    isOpen: boolean;
    url: string | null;
    title: string | null;
    summary: string | null;
  }>({
    isOpen: false,
    url: null,
    title: null,
    summary: null,
  });
  const [iframeAllowed, setIframeAllowed] = useState<boolean | null>(null);

  const categories = [
    "Stock News",
    "General",
    "Press Releases",
    "FMP Articles",
    "Crypto",
    "Forex",
  ];

  const fetchNews = useCallback(async () => {
    if (!symbol || symbol === "N/A" || symbol.length === 0) {
      setError("No hay símbolo seleccionado");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let data: any[] = [];
      const limit = 20;

      switch (activeCategory) {
        case "Stock News":
          // Prioritize symbol specific news if available
          if (symbol) {
            try {
              data = await fmp.stockNews({ tickers: symbol, limit });
            } catch (err) {
              console.warn(
                `[NoticiasTab] Failed to fetch specific news for ${symbol}, falling back to general stock news.`,
                err,
              );
              try {
                data = await fmp.stockNews({ limit });
              } catch (err2) {
                console.warn(
                  `[NoticiasTab] Failed to fetch general stock news, falling back to general news.`,
                  err2,
                );
                data = await fmp.generalNews({ limit });
              }
            }
          } else {
            try {
              data = await fmp.stockNews({ limit });
            } catch (err) {
              console.warn(
                `[NoticiasTab] Failed to fetch stock news, falling back to general news.`,
                err,
              );
              data = await fmp.generalNews({ limit });
            }
          }
          break;
        case "General":
          data = await fmp.generalNews({ limit });
          break;
        case "Press Releases":
          data = await fmp.pressReleases({ limit });
          break;
        case "FMP Articles":
          data = await fmp.fmpArticles({ limit });
          break;
        case "Crypto":
          data = await fmp.cryptoNews({ limit });
          break;
        case "Forex":
          data = await fmp.forexNews({ limit });
          break;
        default:
          data = await fmp.generalNews({ limit });
      }

      // Map FMP data to NewsItem structure
      const mappedNews: NewsItem[] = data.map((item: any) => ({
        title: item.title,
        url: item.url || item.link,
        time_published: item.publishedDate || item.date,
        authors: item.author ? [item.author] : [],
        summary: item.text || item.content || "",
        banner_image: item.image,
        source: item.site || "FMP",
        category_within_source: activeCategory,
        source_domain: item.site || "financialmodelingprep.com",
        topics: item.tickers
          ? [{ topic: item.tickers, relevance_score: "1.0" }]
          : [],
        overall_sentiment_score: 0,
        overall_sentiment_label: "Neutral", // FMP doesn't provide sentiment in these endpoints
        ticker_sentiment: [],
      }));

      setNews(mappedNews);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [symbol, activeCategory]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const getSentimentIcon = (sentiment: string, score: number) => {
    // Force colors with !important and use standard colors as fallback
    if (sentiment.includes("Bullish") || score > 0.1) {
      return <TrendingUp className="w-4 h-4 !text-green-500" />;
    } else if (sentiment.includes("Bearish") || score < -0.1) {
      return <TrendingDown className="w-4 h-4 !text-red-500" />;
    } else {
      return <Minus className="w-4 h-4 !text-white" />;
    }
  };

  const getSentimentColor = (sentiment: string, score: number) => {
    if (sentiment === "Bullish" || score > 0.1) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    } else if (sentiment === "Bearish" || score < -0.1) {
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    } else {
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  const getDateGroup = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Unknown Date";
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Unknown Date";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }

      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return dateString;
    }
  };

  const filteredNews = useMemo(() => {
    return [...news].sort((a, b) => {
      return (
        new Date(b.time_published).getTime() -
        new Date(a.time_published).getTime()
      );
    });
  }, [news]);

  const handleAnalyzeNews = async (newsItem: NewsItem) => {
    const analysisData: NewsAnalysisData = {
      title: newsItem.title,
      summary: newsItem.summary,
      date: newsItem.time_published,
      source: newsItem.source,
      symbol: symbol,
      sentiment: newsItem.overall_sentiment_label || "Neutral",
      relevance: 0,
      url: newsItem.url,
    };
    setSelectedNewsTitle(newsItem.title);

    setAnalysisModal({
      isOpen: true,
      isLoading: true,
      data: null,
      error: null,
    });

    try {
      const result = await analyzeNewsWithAI(analysisData);
      setAnalysisModal({
        isOpen: true,
        isLoading: false,
        data: result,
        error: null,
      });
    } catch (error) {
      setAnalysisModal({
        isOpen: true,
        isLoading: false,
        data: null,
        error: "No se pudo analizar la noticia",
      });
    }
  };

  const closeModal = () => {
    setAnalysisModal(initialAnalysisState);
  };

  const openNewsModal = (url: string, title: string, summary: string) => {
    setViewNewsModal({ isOpen: true, url, title, summary });
    setIframeAllowed(null); // Reset state to loading

    // Check if the URL allows framing
    fetch(`/api/check-iframe?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((data) => {
        setIframeAllowed(data.allowed);
      })
      .catch((err) => {
        console.error("Error checking iframe compatibility", err);
        // On error, assume allowed so we at least try, or could set to false to be safe.
        // Setting to true to mimic default behavior but allow fallback if it fails later?
        // Actually, if the check fails, we probably shouldn't block it proactively.
        setIframeAllowed(true);
      });
  };

  const closeNewsModal = () => {
    setViewNewsModal({ isOpen: false, url: null, title: null, summary: null });
  };

  const resetFilters = () => {
    setActiveCategory("General");
  };

  if (loading) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-transparent border border-zinc-800">
        <FintraLoader size={32} />
        <span className="mt-4 text-zinc-400 text-sm">
          Cargando feed de noticias...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center bg-transparent border border-zinc-800 p-6 text-center">
        <p className="text-rose-400 mb-4 text-sm">Error: {error}</p>
        <button
          onClick={fetchNews}
          className="px-4 py-2 bg-[#FFA028]/10 text-[#FFA028] border border-[#FFA028]/20 rounded-lg hover:bg-[#FFA028]/20 transition-all text-sm font-medium"
        >
          Reintentar conexión
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full bg-[#0e0e0e] overflow-hidden">
        {/* Header */}
        <div className="h-[32px] border-b border-[#222] bg-[#0e0e0e] flex items-center justify-center shrink-0 relative">
          <span className="text-[11px] font-medium text-[#888] tracking-wide uppercase">
            {title ? (
              title
            ) : (
              <>
                Noticias ·{" "}
                <span className="text-white font-semibold">
                  {activeCategory}
                </span>
              </>
            )}
          </span>

          <div className="absolute right-2 flex items-center gap-2">
            {/* Filter Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:bg-[#222] text-[#888] hover:text-white transition-colors"
                >
                  <Filter className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-auto bg-[#0e0e0e] border-[#222] text-[#ccc] rounded-md p-0 shadow-xl"
              >
                <div className="flex flex-col p-1">
                  <DropdownMenuLabel className="text-xs font-normal text-zinc-500 px-2 py-1">
                    Categoría
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={activeCategory}
                    onValueChange={setActiveCategory}
                  >
                    {categories.map((cat) => (
                      <DropdownMenuRadioItem
                        key={cat}
                        value={cat}
                        className="pl-2 [&>span]:hidden data-[state=checked]:bg-[#0056FF] data-[state=checked]:text-white focus:data-[state=checked]:bg-[#0056FF] focus:data-[state=checked]:text-white focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer py-0.5 text-xs"
                      >
                        {cat}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>

                  <div className="pt-1 mt-1 border-t border-zinc-800">
                    <DropdownMenuItem
                      onClick={resetFilters}
                      className="text-rose-400 focus:text-rose-300 focus:bg-rose-500/10 cursor-pointer py-0.5 text-xs"
                    >
                      Limpiar filtros
                    </DropdownMenuItem>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* News List */}
        <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
          {filteredNews.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#666] space-y-2">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <p className="text-xs uppercase tracking-wider">
                No hay noticias en esta categoría
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredNews.map((item, idx) => {
                const dateGroup = getDateGroup(item.time_published);
                const prevDateGroup =
                  idx > 0
                    ? getDateGroup(filteredNews[idx - 1].time_published)
                    : null;
                const showHeader = idx === 0 || dateGroup !== prevDateGroup;

                return (
                  <div key={idx}>
                    {showHeader && (
                      <div className="bg-[#111] px-3 py-1.5 text-[11px] font-semibold text-zinc-500 border-y border-[#FFA028] sticky top-0 z-10">
                        {dateGroup}
                      </div>
                    )}
                    <div className="group px-3 py-2 border-b border-[#1A1A1A] hover:bg-[#1A1A1A] transition-colors flex items-start gap-1.5">
                      <span className="text-zinc-300 font-medium text-[11px] shrink-0 w-[35px] pt-1">
                        {formatDate(item.time_published)}
                      </span>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <span
                          className="text-white font-medium text-[13px] leading-snug truncate cursor-pointer transition-colors"
                          onClick={() =>
                            openNewsModal(item.url, item.title, item.summary)
                          }
                        >
                          {item.title}
                        </span>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis Modal - Dark Theme Redesign */}
      {analysisModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl relative">
            {/* Modal Header */}
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                  <Brain className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  AI Market Insight
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {analysisModal.isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <FintraLoader size={48} />
                  <p className="text-zinc-400 text-sm animate-pulse">
                    Analyzing market impact...
                  </p>
                </div>
              ) : analysisModal.error ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-6 h-6 text-rose-500" />
                  </div>
                  <p className="text-rose-400 mb-6">{analysisModal.error}</p>
                  <button
                    onClick={closeModal}
                    className="px-6 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-sm"
                  >
                    Close
                  </button>
                </div>
              ) : analysisModal.data ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-zinc-100 truncate">
                      {selectedNewsTitle ?? ""}
                    </h3>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-md">
                        {analysisModal.data?.news_type ?? "—"}
                      </span>
                      <span
                        className={`text-sm font-semibold ${getDirectionColor(analysisModal.data?.direction ?? "")}`}
                      >
                        {analysisModal.data?.direction ?? "—"}
                      </span>
                      <span
                        className={`${getConfidenceColor(analysisModal.data?.confidence ?? "")}`}
                      >
                        {analysisModal.data?.confidence ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(analysisModal.data?.narrative_vector ?? [])
                        .slice(0, 2)
                        .map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-md text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                    <div className="text-zinc-300 text-sm leading-relaxed space-y-4">
                      {(analysisModal.data?.explanation ?? "")
                        .split("\n")
                        .map((paragraph, idx) => (
                          <p key={idx}>{paragraph}</p>
                        ))}
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="pt-4 border-t border-zinc-800">
                    <p className="text-[10px] text-zinc-600 text-center">
                      AI-generated analysis. Not financial advice. Always do
                      your own research.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* News Viewer Draggable Widget */}
      {viewNewsModal.isOpen && viewNewsModal.url && (
        <DraggableWidget
          isOpen={viewNewsModal.isOpen}
          onClose={closeNewsModal}
          title={viewNewsModal.title || "Noticia"}
          initialPosition={{ x: 150, y: 100 }}
          width={900}
          height={700}
        >
          <div className="flex flex-col h-full bg-zinc-900 relative">
            <div className="flex justify-end p-1 bg-zinc-900 border-b border-zinc-800">
              <a
                href={viewNewsModal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white px-2 py-0.5 hover:bg-zinc-800 rounded transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir en navegador
              </a>
            </div>

            <div className="flex-1 bg-zinc-950 relative overflow-hidden group">
              {iframeAllowed === null ? (
                /* Loading State */
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-zinc-900 z-20">
                  <div className="mb-4">
                    <FintraLoader size={32} />
                  </div>
                  <p className="text-zinc-400 text-sm">
                    Verificando compatibilidad de visualización...
                  </p>
                </div>
              ) : !iframeAllowed ? (
                /* Blocked State - Show message explicitly */
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-zinc-900 z-20">
                  <div className="max-w-xl w-full flex flex-col items-center">
                    <h2 className="text-xl font-semibold text-zinc-100 mb-4 line-clamp-2 leading-tight">
                      {viewNewsModal.title}
                    </h2>
                    <p className="text-zinc-400 text-sm mb-8 line-clamp-4 leading-relaxed">
                      {viewNewsModal.summary}
                    </p>

                    <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6">
                      <ExternalLink className="w-8 h-8 text-zinc-500" />
                    </div>
                    <p className="text-zinc-300 font-medium mb-2 text-lg">
                      Visualización no disponible aquí
                    </p>
                    <p className="text-zinc-500 text-sm max-w-md mb-8 leading-relaxed">
                      El sitio de noticias (
                      {new URL(viewNewsModal.url).hostname}) no permite ser
                      incrustado en otras aplicaciones por políticas de
                      seguridad.
                    </p>
                    <a
                      href={viewNewsModal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-[#103765] hover:bg-[#0d2b4e] text-white rounded-lg transition-all text-sm font-medium flex items-center gap-2 shadow-lg hover:shadow-xl hover:translate-y-[-1px]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Leer noticia en fuente original
                    </a>
                  </div>
                </div>
              ) : (
                /* Allowed State - Show Iframe */
                <>
                  <iframe
                    src={viewNewsModal.url}
                    className="w-full h-full border-none relative z-10 bg-white"
                    title="News Preview"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />

                  {/* Banner flotante de ayuda */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur text-zinc-300 text-xs py-2 px-4 rounded-full border border-zinc-700 shadow-xl z-20 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span>¿Problemas de visualización?</span>
                    <a
                      href={viewNewsModal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-[#FFA028] font-medium underline underline-offset-2 flex items-center gap-1"
                    >
                      Abrir externamente <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </DraggableWidget>
      )}
    </>
  );
}

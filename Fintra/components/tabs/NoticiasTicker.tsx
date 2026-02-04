import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  RefreshCw,
} from "lucide-react";
import { FintraLoader } from '@/components/ui/FintraLoader';
import DraggableWidget from "@/components/ui/draggable-widget";
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

interface NoticiasTickerProps {
  symbol?: string;
  stockBasicData?: any;
  stockAnalysis?: any;
  selectedStock?: any;
  title?: string;
}

export default function NoticiasTicker({
  symbol = "AAPL",
  stockBasicData,
  stockAnalysis,
  selectedStock,
  title,
}: NoticiasTickerProps) {
  const STORAGE_KEY = "fintra_ticker_news_filters";
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisModal, setAnalysisModal] =
    useState<AnalysisState>(initialAnalysisState);
  const [selectedNewsTitle, setSelectedNewsTitle] = useState<string | null>(
    null,
  );

  // Filter States
  const [activeCategory, setActiveCategory] = useState("General");
  const [activeSentiment, setActiveSentiment] = useState("Any");
  const [sortBy, setSortBy] = useState("Latest");

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
  const [isTestMode, setIsTestMode] = useState(false);

  const categories = [
    "General",
    "Press Release",
    "Stock News",
    "Earnings",
    "Technology",
    "Finance",
    "Crypto",
    "IPO",
    "Mergers",
  ];
  const sentiments = [
    "Bullish",
    "Somewhat-Bullish",
    "Neutral",
    "Somewhat-Bearish",
    "Bearish",
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        activeCategory?: string;
        activeSentiment?: string;
        sortBy?: string;
      };
      if (parsed.activeCategory) setActiveCategory(parsed.activeCategory);
      if (parsed.activeSentiment) setActiveSentiment(parsed.activeSentiment);
      if (parsed.sortBy) setSortBy(parsed.sortBy);
    } catch (e) {
      console.error("Failed to load news filters from storage", e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ activeCategory, activeSentiment, sortBy }),
      );
    } catch (e) {
      console.error("Failed to save news filters to storage", e);
    }
  }, [activeCategory, activeSentiment, sortBy]);

  const fetchNews = useCallback(async (silent = false) => {
    if (!symbol || symbol === "N/A" || symbol.length === 0) {
      setError("No hay símbolo seleccionado");
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      setError(null);

      const response = await fetch(`/api/proxy/ticker-news?symbol=${symbol}`);

      if (!response.ok) {
        throw new Error("Error al obtener las noticias");
      }

      const data: NewsResponse = await response.json();

      if (data.feed && Array.isArray(data.feed)) {
        setNews(data.feed);
      } else {
        if ((data as any)["Information"]) {
          console.warn(
            "Alpha Vantage Limit Reached:",
            (data as any)["Information"],
          );
        }
        // Fail gracefully instead of throwing error to UI
        console.warn("News data missing feed:", data);
        setNews([]);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchNews();

    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchNews(true);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
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
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}T00:00:00`);
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
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const hour = dateString.substring(9, 11);
      const minute = dateString.substring(11, 13);

      return `${hour}:${minute}`;
    } catch {
      return dateString;
    }
  };

  const getTickerSentiment = useCallback(
    (newsItem: NewsItem) => {
      const tickerSentiment = newsItem.ticker_sentiment?.find(
        (ts) => ts.ticker === symbol,
      );
      return tickerSentiment;
    },
    [symbol],
  );

  const filteredNews = useMemo(() => {
    let result = [...news];

    // 1. Filter by Category
    if (activeCategory !== "General") {
      const lowerCategory = activeCategory.toLowerCase();
      result = result.filter((item) => {
        if (
          activeCategory === "Press Release" ||
          activeCategory === "Stock News"
        ) {
          return item.category_within_source === activeCategory;
        }

        const text = (item.title + " " + item.summary).toLowerCase();
        const hasTopic = item.topics?.some((t) =>
          t.topic.toLowerCase().includes(lowerCategory),
        );

        if (lowerCategory === "earnings")
          return (
            text.includes("earnings") ||
            text.includes("quarter") ||
            text.includes("report") ||
            text.includes("revenue")
          );
        if (lowerCategory === "technology")
          return (
            text.includes("tech") ||
            text.includes("ai") ||
            text.includes("soft") ||
            hasTopic
          );
        if (lowerCategory === "finance")
          return (
            text.includes("stock") ||
            text.includes("market") ||
            text.includes("trade") ||
            hasTopic
          );
        if (lowerCategory === "crypto")
          return (
            text.includes("crypto") ||
            text.includes("bitcoin") ||
            text.includes("coin") ||
            text.includes("blockchain")
          );

        return text.includes(lowerCategory) || hasTopic;
      });
    }

    // 2. Filter by Sentiment
    if (activeSentiment !== "Any") {
      result = result.filter((item) => {
        const tickerSentiment = getTickerSentiment(item);
        const label = tickerSentiment
          ? tickerSentiment.ticker_sentiment_label
          : item.overall_sentiment_label;
        return label === activeSentiment;
      });
    }

    // 3. Sort
    if (sortBy === "Top Stories") {
      // Sort by relevance score to the ticker, then by sentiment score magnitude
      result.sort((a, b) => {
        const sentimentA = getTickerSentiment(a);
        const sentimentB = getTickerSentiment(b);
        const relevanceA = sentimentA
          ? parseFloat(sentimentA.relevance_score)
          : 0;
        const relevanceB = sentimentB
          ? parseFloat(sentimentB.relevance_score)
          : 0;
        return relevanceB - relevanceA;
      });
    } else {
      // Latest (Default) - Alpha Vantage usually returns sorted by date, but ensuring it here
      result.sort((a, b) => {
        return b.time_published.localeCompare(a.time_published);
      });
    }

    return result;
  }, [news, activeCategory, activeSentiment, sortBy, getTickerSentiment]);

  const handleAnalyzeNews = async (newsItem: NewsItem) => {
    const tickerSentiment = getTickerSentiment(newsItem);
    const sentimentLabel = tickerSentiment
      ? tickerSentiment.ticker_sentiment_label
      : newsItem.overall_sentiment_label;
    const relevanceScore = tickerSentiment
      ? parseFloat(tickerSentiment.relevance_score)
      : 0;

    const analysisData: NewsAnalysisData = {
      title: newsItem.title,
      summary: newsItem.summary,
      date: newsItem.time_published,
      source: newsItem.source,
      symbol: symbol,
      sentiment: sentimentLabel,
      relevance: relevanceScore,
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
      const result = await analyzeNewsWithAI(analysisData, isTestMode);
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
        error:
          error instanceof Error
            ? error.message
            : "No se pudo analizar la noticia",
      });
    }
  };

  const closeModal = () => {
    setAnalysisModal(initialAnalysisState);
  };

  const openNewsModal = (url: string, title: string, summary: string) => {
    setViewNewsModal({ isOpen: true, url, title, summary });
    setIframeAllowed(null);

    // Check compatibility
    fetch(`/api/check-iframe?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((data) => {
        setIframeAllowed(data.allowed);
      })
      .catch((err) => {
        console.error("Error checking iframe compatibility", err);
        setIframeAllowed(true); // Fallback to allowed
      });
  };

  const closeNewsModal = () => {
    setViewNewsModal({ isOpen: false, url: null, title: null, summary: null });
  };

  const resetFilters = () => {
    setActiveCategory("General");
    setActiveSentiment("Any");
    setSortBy("Latest");
  };

  if (loading) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-transparent border border-zinc-800">
        <FintraLoader size={32} className="mb-4" />
        <span className="text-zinc-400 text-sm">
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
          onClick={() => fetchNews()}
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
            Noticias de ·{" "}
            <span className="text-white font-semibold">{symbol}</span>
          </span>

          <div className="absolute right-2 flex items-center gap-2">
            {/* <div className="flex items-center gap-1.5 mr-2">
              <span className={`text-[10px] font-medium ${isTestMode ? 'text-red-400' : 'text-zinc-500'}`}>
                {isTestMode ? 'TEST' : 'PROD'}
              </span>
              <Switch 
                checked={isTestMode}
                onCheckedChange={setIsTestMode}
                className={`scale-[0.65] data-[state=checked]:bg-red-500 rounded-full`}
              />
            </div> */}

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-[#222] text-[#888] hover:text-white transition-colors"
              onClick={() => fetchNews()}
              title="Actualizar noticias"
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>

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
                <div className="flex divide-x divide-zinc-800">
                  {/* Column 1: Categoría */}
                  <div className="w-32 p-1">
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
                  </div>

                  {/* Column 2: Tendencia */}
                  <div className="w-40 p-1">
                    <DropdownMenuLabel className="text-xs font-normal text-zinc-500 px-2 py-1">
                      Tendencia
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={activeSentiment}
                      onValueChange={setActiveSentiment}
                    >
                      <DropdownMenuRadioItem
                        value="Any"
                        className="pl-2 [&>span]:hidden data-[state=checked]:bg-[#0056FF] data-[state=checked]:text-white focus:data-[state=checked]:bg-[#0056FF] focus:data-[state=checked]:text-white focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer py-0.5 text-xs"
                      >
                        Todas
                      </DropdownMenuRadioItem>
                      {sentiments.map((sent) => (
                        <DropdownMenuRadioItem
                          key={sent}
                          value={sent}
                          className="pl-2 [&>span]:hidden data-[state=checked]:bg-[#0056FF] data-[state=checked]:text-white focus:data-[state=checked]:bg-[#0056FF] focus:data-[state=checked]:text-white focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer py-0.5 text-xs"
                        >
                          {sent}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </div>

                  {/* Column 3: Ordenar */}
                  <div className="w-32 p-1 flex flex-col">
                    <div className="flex-1">
                      <DropdownMenuLabel className="text-xs font-normal text-zinc-500 px-2 py-1">
                        Ordenar
                      </DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={sortBy}
                        onValueChange={setSortBy}
                      >
                        <DropdownMenuRadioItem
                          value="Latest"
                          className="pl-2 [&>span]:hidden data-[state=checked]:bg-[#0056FF] data-[state=checked]:text-white focus:data-[state=checked]:bg-[#0056FF] focus:data-[state=checked]:text-white focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer py-0.5 text-xs"
                        >
                          Latest
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem
                          value="Top Stories"
                          className="pl-2 [&>span]:hidden data-[state=checked]:bg-[#0056FF] data-[state=checked]:text-white focus:data-[state=checked]:bg-[#0056FF] focus:data-[state=checked]:text-white focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer py-0.5 text-xs"
                        >
                          Top Stories
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </div>

                    <div className="pt-1 mt-1 border-t border-zinc-800">
                      <DropdownMenuItem
                        onClick={resetFilters}
                        className="text-rose-400 focus:text-rose-300 focus:bg-rose-500/10 cursor-pointer py-0.5 text-xs"
                      >
                        Limpiar filtros
                      </DropdownMenuItem>
                    </div>
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
                      <div className="bg-[#111] px-3 py-1.5 text-[11px] font-semibold text-zinc-500 border-y border-[#222] sticky top-0 z-10">
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
                        <div className="flex items-center gap-2">
                          <span className="text-[#666] text-[10px] uppercase tracking-wider">
                            {item.source}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnalyzeNews(item);
                        }}
                        className="flex items-center font-medium gap-1.5 px-2 py-0.5 bg-[#222] text-[#888] hover:text-white hover:bg-[#333] rounded-full text-[10px] transition-all shrink-0 border border-[#333]"
                      >
                        AI Insight
                      </button>
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xs max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl relative">
            {/* Modal Header */}
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                {/* <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                  <Brain className="w-5 h-5 text-indigo-400" />
                </div> */}
                <h2 className="text-lg font-semibold text-zinc-100">
                  Fintra AI Market Insight
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-xs transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {analysisModal.isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="relative flex items-center justify-center">
                    <FintraLoader size={48} />
                   {/*  <div className="absolute inset-0 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-[#00C8FF] animate-pulse" />
                    </div> */}
                  </div>
                  <p className="text-zinc-400 text-sm animate-pulse">
                    Analyzing market impact...
                  </p>
                </div>
              ) : analysisModal.error ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-xs flex items-center justify-center mx-auto mb-4">
                    <X className="w-6 h-6 text-rose-500" />
                  </div>
                  <p className="text-rose-400 mb-6">{analysisModal.error}</p>
                  <button
                    onClick={closeModal}
                    className="px-6 py-2 bg-zinc-800 text-white rounded-xs hover:bg-zinc-700 transition-colors text-sm"
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
                      <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xs">
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
                            className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xs text-xs"
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
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white px-2 py-0.5 hover:bg-zinc-800 rounded-xs transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir en navegador
              </a>
            </div>
            <div className="flex-1 bg-zinc-950 relative overflow-hidden group">
              {/* Loading State */}
              {iframeAllowed === null && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-zinc-900 z-20">
                  <div className="mb-4">
                    <FintraLoader size={32} />
                  </div>
                  <p className="text-zinc-400 text-sm">
                    Verificando compatibilidad de visualización...
                  </p>
                </div>
              )}

              {/* Blocked State */}
              {iframeAllowed === false && (
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
                      className="px-6 py-3 bg-[#103765] hover:bg-[#0d2b4e] text-white rounded-xs  transition-all text-sm font-medium flex items-center gap-2 shadow-lg hover:shadow-xl hover:translate-y-[-1px]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Leer noticia en fuente original
                    </a>
                  </div>
                </div>
              )}

              {/* Allowed State (Iframe) */}
              {iframeAllowed === true && (
                <>
                  <iframe
                    src={viewNewsModal.url}
                    className="w-full h-full border-none relative z-10 bg-white"
                    title="News Preview"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />

                  {/* Banner flotante de ayuda */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur text-zinc-300 text-xs py-2 px-4 rounded-2xs border border-zinc-700 shadow-xl z-20 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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

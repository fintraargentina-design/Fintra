import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { ExternalLink, TrendingUp, TrendingDown, Minus, Brain, X, Clock, Share2, MessageSquare, Filter } from "lucide-react";
import { 
  analyzeNewsWithAI, 
  getImpactColor, 
  initialAnalysisState,
  type NewsAnalysisData,
  type AnalysisState 
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
  title
}: NoticiasTickerProps) {
  const STORAGE_KEY = "fintra_ticker_news_filters";
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisModal, setAnalysisModal] = useState<AnalysisState>(initialAnalysisState);
  
  // Filter States
  const [activeCategory, setActiveCategory] = useState("General");
  const [activeSentiment, setActiveSentiment] = useState("Any");
  const [sortBy, setSortBy] = useState("Latest");
  
  const [viewNewsModal, setViewNewsModal] = useState<{ isOpen: boolean; url: string | null; title: string | null }>({
    isOpen: false,
    url: null,
    title: null
  });

  const categories = ["General", "Press Release", "Stock News", "Earnings", "Technology", "Finance", "Crypto", "IPO", "Mergers"];
  const sentiments = ["Bullish", "Somewhat-Bullish", "Neutral", "Somewhat-Bearish", "Bearish"];

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
        JSON.stringify({ activeCategory, activeSentiment, sortBy })
      );
    } catch (e) {
      console.error("Failed to save news filters to storage", e);
    }
  }, [activeCategory, activeSentiment, sortBy]);

  useEffect(() => {
    fetchNews();
  }, [symbol]);

  const fetchNews = async () => {
    if (!symbol || symbol === "N/A" || symbol.length === 0) {
      setError('No hay símbolo seleccionado');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/proxy/ticker-news?symbol=${symbol}`
      );
      
      if (!response.ok) {
        throw new Error('Error al obtener las noticias');
      }
      
      const data: NewsResponse = await response.json();
      
      if (data.feed && Array.isArray(data.feed)) {
        setNews(data.feed);
      } else {
        if ((data as any)["Information"]) {
             console.warn("Alpha Vantage Limit Reached:", (data as any)["Information"]);
        }
        // Fail gracefully instead of throwing error to UI
        console.warn('News data missing feed:', data);
        setNews([]);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: string, score: number) => {
    // Force colors with !important and use standard colors as fallback
    if (sentiment.includes('Bullish') || score > 0.1) {
      return <TrendingUp className="w-4 h-4 text-green-500 !text-green-500" />;
    } else if (sentiment.includes('Bearish') || score < -0.1) {
      return <TrendingDown className="w-4 h-4 text-red-500 !text-red-500" />;
    } else {
      return <Minus className="w-4 h-4 text-white !text-white" />;
    }
  };

  const getSentimentColor = (sentiment: string, score: number) => {
    if (sentiment === 'Bullish' || score > 0.1) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    } else if (sentiment === 'Bearish' || score < -0.1) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    } else {
      return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const hour = dateString.substring(9, 11);
      const minute = dateString.substring(11, 13);
      
      const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
      
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        if (diffInHours < 1) {
            const minutes = Math.floor(diffInHours * 60);
            return `${minutes}m ago`;
        }
        return `${Math.floor(diffInHours)}h`;
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
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

  const filteredNews = useMemo(() => {
    let result = [...news];

    // 1. Filter by Category
    if (activeCategory !== "General") {
      const lowerCategory = activeCategory.toLowerCase();
      result = result.filter(item => {
        if (activeCategory === "Press Release" || activeCategory === "Stock News") {
             return item.category_within_source === activeCategory;
        }

        const text = (item.title + " " + item.summary).toLowerCase();
        const hasTopic = item.topics?.some(t => t.topic.toLowerCase().includes(lowerCategory));
        
        if (lowerCategory === "earnings") return text.includes("earnings") || text.includes("quarter") || text.includes("report") || text.includes("revenue");
        if (lowerCategory === "technology") return text.includes("tech") || text.includes("ai") || text.includes("soft") || hasTopic;
        if (lowerCategory === "finance") return text.includes("stock") || text.includes("market") || text.includes("trade") || hasTopic;
        if (lowerCategory === "crypto") return text.includes("crypto") || text.includes("bitcoin") || text.includes("coin") || text.includes("blockchain");
        
        return text.includes(lowerCategory) || hasTopic;
      });
    }

    // 2. Filter by Sentiment
    if (activeSentiment !== "Any") {
      result = result.filter(item => {
        const tickerSentiment = getTickerSentiment(item);
        const label = tickerSentiment ? tickerSentiment.ticker_sentiment_label : item.overall_sentiment_label;
        return label === activeSentiment;
      });
    }

    // 3. Sort
    if (sortBy === "Top Stories") {
       // Sort by relevance score to the ticker, then by sentiment score magnitude
       result.sort((a, b) => {
         const sentimentA = getTickerSentiment(a);
         const sentimentB = getTickerSentiment(b);
         const relevanceA = sentimentA ? parseFloat(sentimentA.relevance_score) : 0;
         const relevanceB = sentimentB ? parseFloat(sentimentB.relevance_score) : 0;
         return relevanceB - relevanceA;
       });
    } else {
       // Latest (Default) - Alpha Vantage usually returns sorted by date, but ensuring it here
       result.sort((a, b) => {
         return b.time_published.localeCompare(a.time_published);
       });
    }

    return result;
  }, [news, activeCategory, activeSentiment, sortBy]);

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
      relevance: relevanceScore
    };

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

  const closeModal = () => {
    setAnalysisModal(initialAnalysisState);
  };

  const openNewsModal = (url: string, title: string) => {
    setViewNewsModal({ isOpen: true, url, title });
  };

  const closeNewsModal = () => {
    setViewNewsModal({ isOpen: false, url: null, title: null });
  };

  const resetFilters = () => {
    setActiveCategory("General");
    setActiveSentiment("Any");
    setSortBy("Latest");
  };

  if (loading) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-transparent border border-zinc-800">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFA028]"></div>
        <span className="mt-4 text-zinc-400 text-sm">Cargando feed de noticias...</span>
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
      <div className="flex flex-col h-full bg-tarjetas overflow-hidden">
        {/* Header */}
        <div className="relative flex items-center justify-center px-1 py-1 border-b border-zinc-800 bg-white/[0.02] shrink-0">
          <h4 className="text-xs font-medium text-gray-400 text-center">
              Noticias de · <span className="text-[#FFA028]">{symbol}</span>
          </h4>
          
          <div className="absolute right-1 flex items-center gap-2">
            {/* Filter Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 hover:bg-transparent focus:bg-transparent active:bg-transparent data-[state=open]:bg-transparent border-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-400 hover:text-zinc-100"
                >
                  <Filter className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto bg-black border-zinc-800 text-zinc-300 rounded-none p-0">
                <div className="flex divide-x divide-zinc-800">
                    {/* Column 1: Categoría */}
                    <div className="w-32 p-1">
                        <DropdownMenuLabel className="text-xs font-normal text-zinc-500 px-2 py-1">Categoría</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={activeCategory} onValueChange={setActiveCategory}>
                            {categories.map(cat => (
                                <DropdownMenuRadioItem key={cat} value={cat} className="pl-2 [&>span]:hidden data-[state=checked]:bg-[#0056FF] data-[state=checked]:text-white focus:data-[state=checked]:bg-[#0056FF] focus:data-[state=checked]:text-white focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer py-0.5 text-xs">
                                    {cat}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </div>
                    
                    {/* Column 2: Tendencia */}
                    <div className="w-40 p-1">
                        <DropdownMenuLabel className="text-xs font-normal text-zinc-500 px-2 py-1">Tendencia</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={activeSentiment} onValueChange={setActiveSentiment}>
                            <DropdownMenuRadioItem value="Any" className="pl-2 [&>span]:hidden data-[state=checked]:bg-[#0056FF] data-[state=checked]:text-white focus:data-[state=checked]:bg-[#0056FF] focus:data-[state=checked]:text-white focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer py-0.5 text-xs">Todas</DropdownMenuRadioItem>
                            {sentiments.map(sent => (
                                <DropdownMenuRadioItem key={sent} value={sent} className="pl-2 [&>span]:hidden data-[state=checked]:bg-[#0056FF] data-[state=checked]:text-white focus:data-[state=checked]:bg-[#0056FF] focus:data-[state=checked]:text-white focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer py-0.5 text-xs">
                                    {sent}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </div>

                    {/* Column 3: Ordenar */}
                    <div className="w-32 p-1 flex flex-col">
                        <div className="flex-1">
                            <DropdownMenuLabel className="text-xs font-normal text-zinc-500 px-2 py-1">Ordenar</DropdownMenuLabel>
                            <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                                <DropdownMenuRadioItem value="Latest" className="pl-2 [&>span]:hidden data-[state=checked]:bg-[#0056FF] data-[state=checked]:text-white focus:data-[state=checked]:bg-[#0056FF] focus:data-[state=checked]:text-white focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer py-0.5 text-xs">Latest</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="Top Stories" className="pl-2 [&>span]:hidden data-[state=checked]:bg-[#0056FF] data-[state=checked]:text-white focus:data-[state=checked]:bg-[#0056FF] focus:data-[state=checked]:text-white focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer py-0.5 text-xs">Top Stories</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </div>
                        
                        <div className="pt-1 mt-1 border-t border-zinc-800">
                            <DropdownMenuItem onClick={resetFilters} className="text-rose-400 focus:text-rose-300 focus:bg-rose-500/10 cursor-pointer py-0.5 text-xs">
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
			<div className="flex-1 overflow-y-auto p-0 ">
          {filteredNews.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <p className="text-sm">No hay noticias en esta categoría</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredNews.map((item, idx) => {
                const tickerSentiment = getTickerSentiment(item);
                const sentimentScore = tickerSentiment 
                    ? parseFloat(tickerSentiment.ticker_sentiment_score)
                    : item.overall_sentiment_score;
                const sentimentLabel = tickerSentiment 
                    ? tickerSentiment.ticker_sentiment_label
                    : item.overall_sentiment_label;

                return (
                  <div key={idx} className="group p-1 hover:bg-zinc-800/30 transition-colors cursor-default">
                    <div className="flex gap-4">
                       
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start mb-1">
                                <div className="flex w-full items-start justify-between gap-2 text-xs text-zinc-400"> 
                                  <div>                                   
                                    <h3 className="text-zinc-100 font-light text-[11px] leading-snug mb-2 transition-colors line-clamp-2">
                                      <button 
                                        onClick={(e) => { e.preventDefault(); openNewsModal(item.url, item.title); }} 
                                        className="text-left hover:underline hover:text-[#FFA028] focus:outline-none"
                                      >
                                        {item.title}
                                      </button>
                                    </h3>
                                    </div>
                                    <div className="flex items-end gap-1">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDate(item.time_published)}
                                      </span>
                                    </div>
                                    <div>
                                    <button 
                                        onClick={() => handleAnalyzeNews(item)}
                                        className="flex items-center font-light uppercase gap-1.5 px-3 py-1 bg-[#0056FF]/50 text-[#FFFFFF] hover:bg-[#0056FF] text-[10px] transition-all"
                                    >                                        
                                        Analizar
                                    </button>
                                    </div> 
                                </div>
                            </div>                                             
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 p-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                        <Brain className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-zinc-100">AI Market Insight</h2>
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
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-zinc-800 border-t-indigo-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-indigo-500 animate-pulse" />
                    </div>
                  </div>
                  <p className="text-zinc-400 text-sm animate-pulse">Analyzing market impact...</p>
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
                  {/* Impact Score */}
                  <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Market Impact</h3>
                    <div className="flex items-center gap-3">
                        <div className={`text-3xl font-bold ${getImpactColor(analysisModal.data.impacto)}`}>
                            {analysisModal.data.impacto}
                        </div>
                        <div className="h-8 w-[1px] bg-zinc-700"></div>
                        <div className="text-xs text-zinc-400 max-w-[200px]">
                            Based on sentiment analysis and historical market correlation.
                        </div>
                    </div>
                  </div>

                  {/* Analysis Text */}
                  <div>
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Strategic Analysis</h3>
                    <div className="text-zinc-300 text-sm leading-relaxed space-y-4">
                      {analysisModal.data.analisis.split('\n').map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="pt-4 border-t border-zinc-800">
                    <p className="text-[10px] text-zinc-600 text-center">
                        AI-generated analysis. Not financial advice. Always do your own research.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* News Viewer Modal */}
      {viewNewsModal.isOpen && viewNewsModal.url && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl relative">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur rounded-t-xl">
               <h2 className="text-sm font-medium text-zinc-100 truncate flex-1 mr-4">{viewNewsModal.title}</h2>
               <div className="flex items-center gap-2">
                 <a href={viewNewsModal.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Abrir en nueva pestaña">
                   <ExternalLink className="w-4 h-4" />
                 </a>
                 <button onClick={closeNewsModal} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                   <X className="w-5 h-5" />
                 </button>
               </div>
            </div>
            {/* Content */}
            <div className="flex-1 bg-white relative overflow-hidden">
                <iframe 
                  src={viewNewsModal.url} 
                  className="w-full h-full border-none" 
                  title="News Preview"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp, Target, FileText, BookOpen } from "lucide-react"
import AIAnalysisButton from "@/components/AIAnalysisButton"
import type { TabKey } from "@/app/page"

interface NavigationBarProps {
  orientation?: 'horizontal' | 'vertical';
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  // Props para el análisis global
  symbol?: string;
  fundamentalData?: any;
  valoracionData?: any;
  financialScoresData?: any;
  overviewData?: any;
  estimacionData?: any;
  dividendosData?: any;
  desempenoData?: any;
}

const tabs = [
  { id: 'datos', label: 'Resultados', icon: BarChart3 },
  { id: 'estimacion', label: 'Analistas' },
  { id: 'chart', label: 'Charts', icon: TrendingUp }
]

export default function NavigationBar({ 
  activeTab, 
  setActiveTab,
  symbol,
  fundamentalData,
  valoracionData,
  financialScoresData,
  overviewData,
  estimacionData,
  dividendosData,
  desempenoData,
  orientation = 'horizontal'
}: NavigationBarProps) {
  const tabs = [
    /* { key: 'chart', label: 'Gráficos' }, */
    { key: 'datos', label: 'Datos' },
    { key: 'estimacion', label: 'Estimación' },
    { key: 'noticias', label: 'Noticias' },
    { key: 'metodologia', label: 'Metodología' },
  ];

  if (orientation === 'vertical') {
    return (
      <div className="hidden xl:flex flex-col items-center gap-2 w-8 overflow-visible">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`
              relative group flex items-center justify-center w-8 h-8 rounded-md transition-colors
              ${activeTab === tab.key ? 'bg-white text-black shadow-sm' : 'text-gray-300 hover:bg-gray-700'}
            `}
          >
            <span className="text-[10px]">{tab.label.substring(0, 2)}</span>
            <span className="pointer-events-none absolute top-1/2 right-full -translate-y-1/2 mr-2 px-2 py-1 rounded-md bg-gray-800 text-gray-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-lg z-20">
              {tab.label}
            </span>
          </button>
        ))}
        {symbol && (
          <div className="relative group flex-shrink-0">
            <AIAnalysisButton
              symbol={symbol}
              fundamentalData={fundamentalData}
              valoracionData={valoracionData}
              financialScoresData={financialScoresData}
              overviewData={overviewData}
              estimacionData={estimacionData}
              dividendosData={dividendosData}
              desempenoData={desempenoData}
            />
            <span className="pointer-events-none absolute top-1/2 right-full -translate-y-1/2 mr-2 px-2 py-1 rounded-md bg-gray-800 text-gray-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-lg z-20">
              Análisis IA
            </span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="w-full border-b border-white/10">
      {/* Desktop Navigation */}
      <div className="hidden md:flex flex-wrap items-center justify-start">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`
                rounded-none border-b-2 border-transparent px-4 py-2 text-xs font-medium transition-colors
                ${
                  activeTab === tab.key
                    ? 'border-orange-400 text-orange-400'
                    : 'text-gray-400 hover:text-gray-200'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Botón de Análisis Global - Solo en Desktop */}
        {symbol && (
          <div className="relative group flex-shrink-0 ml-2">
            <AIAnalysisButton
              symbol={symbol}
              fundamentalData={fundamentalData}
              valoracionData={valoracionData}
              financialScoresData={financialScoresData}
              overviewData={overviewData}
              estimacionData={estimacionData}
              dividendosData={dividendosData}
              desempenoData={desempenoData}
            />
             <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded-md bg-gray-800 text-gray-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-lg z-20">
              Análisis IA
            </span>
          </div>
        )}
      </div>

      {/* Mobile Navigation - Horizontal Scroll */}
      <div className="md:hidden">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`
                flex items-center justify-center px-3 py-2 
                text-xs font-medium rounded-md 
                transition-all duration-200 whitespace-nowrap flex-shrink-0
                ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
            >
              <span>{tab.label}</span>
            </button>
          ))}
          {/* Tab: Metodología (interno) */}
          
          {/* Botón de Análisis Global - También en Mobile */}
          {symbol && (
            <div className="flex-shrink-0">
              <AIAnalysisButton
                symbol={symbol}
                fundamentalData={fundamentalData}
                valoracionData={valoracionData}
                financialScoresData={financialScoresData}
                overviewData={overviewData}
                estimacionData={estimacionData}
                dividendosData={dividendosData}
                desempenoData={desempenoData}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
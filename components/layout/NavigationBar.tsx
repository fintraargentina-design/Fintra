import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp, Target, FileText } from "lucide-react"
import AIAnalysisButton from "@/components/AIAnalysisButton"
import type { TabKey } from "@/app/page"

interface NavigationBarProps {
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
  desempenoData
}: NavigationBarProps) {
  const tabs = [
    { key: 'chart', label: 'Gráficos', icon: TrendingUp },
    { key: 'datos', label: 'Datos', icon: BarChart3 },
    { key: 'estimacion', label: 'Estimación', icon: Target },
    { key: 'noticias', label: 'Noticias', icon: FileText },
  ];

  return (
    <div className="w-full">
      {/* Desktop Navigation */}
      <div className="hidden md:flex flex-wrap gap-2 items-center justify-start">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`
                relative group flex items-center justify-center w-8 h-8 rounded-md 
                transition-colors duration-200
                ${
                  activeTab === tab.key
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-300 hover:bg-gray-700'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              <span
                className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded-md bg-gray-800 text-gray-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-lg"
              >
                {tab.label}
              </span>
            </button>
          ))}
        </div>
        
        {/* Botón de Análisis Global - Solo en Desktop */}
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
            <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded-md bg-gray-800 text-gray-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-lg">
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
                flex flex-col items-center gap-1 px-3 py-2 
                text-xs font-medium rounded-md 
                transition-all duration-200 whitespace-nowrap flex-shrink-0
                min-w-[70px]
                ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
          
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
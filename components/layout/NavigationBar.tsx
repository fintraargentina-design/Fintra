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
    { key: 'datos', label: 'Datos', icon: BarChart3 },
    { key: 'chart', label: 'Gráficos', icon: TrendingUp },
    { key: 'estimacion', label: 'Estimación', icon: Target },
  ];

  return (
    <div className="w-full">
      {/* Desktop Navigation */}
      <div className="hidden md:flex flex-wrap gap-1 lg:gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1 lg:gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`
                flex items-center gap-2 px-3 lg:px-4 py-2 
                text-sm lg:text-base font-medium rounded-md 
                transition-all duration-200 whitespace-nowrap
                ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden lg:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        
        {/* Botón de Análisis Global - Solo en Desktop */}
        {symbol && (
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
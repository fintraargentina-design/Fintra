import { Button } from "@/components/ui/button"
import type { TabKey } from "@/app/page"

interface NavigationBarProps {
  orientation?: 'horizontal' | 'vertical';
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  symbol?: string;
}

export default function NavigationBar({ 
  activeTab, 
  setActiveTab,
  symbol,
  orientation = 'horizontal'
}: NavigationBarProps) {
  const tabs = [
    { key: 'ecosistema', label: 'Ecosistema' },
    { key: 'datos', label: 'Datos' },
    { key: 'estimacion', label: 'Estimación y Análisis IA' },
    { key: 'mercados', label: 'Mercados' },
  ];

  if (orientation === 'vertical') {
    return (
      <div className="hidden xl:flex flex-col items-center gap-2 w-8 overflow-visible ">
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
            {/* AI Analysis Button removed */}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="w-full border-b border-zinc-800 bg-transparent z-10 border-white/10 shrink-0">
      <div className="w-full overflow-x-auto scrollbar-thin whitespace-nowrap">
        {/* Desktop Navigation */}
        <div className="hidden md:flex flex-nowrap items-center justify-start h-auto p-0 w-max">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`
                  rounded-none border-b-2 border-transparent px-2 py-1 text-xs transition-colors font-medium
                  ${
                    activeTab === tab.key
                      ? 'bg-[#0056FF] text-white border-[#0056FF]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Botón de Análisis Global - Solo en Desktop */}
        </div>
      </div>

      {/* Mobile Navigation - Horizontal Scroll */}
      <div className="md:hidden">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`
                rounded-none border-b-2 border-white/10 px-2 py-1 
                text-xs transition-colors whitespace-nowrap flex-shrink-0
                ${
                  activeTab === tab.key
                    ? 'bg-[#0056FF] text-white border-[#0056FF]'
                    : 'text-gray-400 hover:text-gray-200'
                }
              `}
            >
              <span>{tab.label}</span>
            </button>
          ))}
          {/* Tab: Metodología (interno) */}
        </div>
      </div>
    </div>
  );
}
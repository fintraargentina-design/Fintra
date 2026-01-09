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
    { key: 'empresa', label: 'Snapshot' },
    /* { key: 'competidores', label: 'Competidores' }, */
    { key: 'datos', label: 'Datos' },
    { key: 'ecosistema', label: 'Ecosistema' },
    { key: 'estimacion', label: 'Estimación y Análisis IA' },
  ];

  if (orientation === 'vertical') {
    return (
      <div className="hidden xl:flex flex-col items-center gap-2 w-8 overflow-visible ">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            data-state={activeTab === tab.key ? 'active' : 'inactive'}
            className={`
              relative group flex items-center justify-center w-8 h-8 rounded-none transition-colors
              ${activeTab === tab.key ? 'bg-[#0056FF] text-white' : 'bg-zinc-900 text-gray-400 hover:text-gray-200 hover:bg-white/5'}
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
    <div className="w-full border-b border-zinc-800 bg-transparent z-10 shrink-0">
      <div className="w-full overflow-x-auto scrollbar-thin whitespace-nowrap">
        {/* Desktop Navigation */}
        <div className="hidden md:flex bg-transparent h-auto p-0 flex-nowrap items-center justify-start min-w-full w-max gap-0.5 border-b-2 border-black">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              data-state={activeTab === tab.key ? 'active' : 'inactive'}
              className={`
                bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#0056FF] data-[state=active]:text-white text-xs px-2 py-0 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors font-medium
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Navigation - Horizontal Scroll */}
      <div className="md:hidden">
        <div className="flex gap-0.5 overflow-x-auto scrollbar-thin whitespace-nowrap border-b-2 border-black">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              data-state={activeTab === tab.key ? 'active' : 'inactive'}
              className={`
                bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#0056FF] data-[state=active]:text-white text-xs px-2 py-0 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors whitespace-nowrap flex-shrink-0 font-medium
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

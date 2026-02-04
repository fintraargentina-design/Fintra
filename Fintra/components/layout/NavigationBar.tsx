import { Button } from "@/components/ui/button"
import type { TabKey } from "@/components/dashboard/StockTerminal"

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
   
    /* { key: 'competidores', label: 'Competidores' }, */
    { key: 'snapshot', label: 'Alpha Market' },
    { key: 'datos', label: 'Financial Data' },
    { key: 'ecosistema', label: 'Ecosystem' },
    { key: 'escenarios', label: 'Scenarios' },
    { key: 'conclusion', label: 'Fintra Insights' },
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
              relative group flex items-center justify-center w-8 h-8 rounded transition-colors
              ${activeTab === tab.key ? 'bg-[#222] text-white' : 'bg-transparent text-gray-500 hover:text-gray-200 hover:bg-[#111]'}
            `}
          >
            <span className="text-[10px]">{tab.label.substring(0, 2)}</span>
            <span className="pointer-events-none absolute top-1/2 right-full -translate-y-1/2 mr-2 px-2 py-1 rounded-md bg-[#222] border border-[#333] text-gray-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-lg z-20">
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
    <div className="w-full border-b border-[#222] bg-[#0e0e0e] z-10 shrink-0">
      <div className="w-full">
        {/* Desktop Navigation */}
        <div className="hidden md:flex bg-[#0e0e0e] p-0 flex-nowrap items-center w-full gap-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              data-state={activeTab === tab.key ? 'active' : 'inactive'}
              className={`
                flex-1 h-[44px] flex items-center justify-center text-[14px] transition-all duration-200 border-b-2
                ${activeTab === tab.key 
                  ? 'bg-[#0e0e0e] text-white border-white font-medium' 
                  : 'bg-[#0e0e0e] text-[#666] border-transparent hover:text-zinc-300 hover:bg-[#111]'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Navigation - Horizontal Scroll */}
      <div className="md:hidden">
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap border-b border-[#222] px-2 py-1 bg-[#0e0e0e]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              data-state={activeTab === tab.key ? 'active' : 'inactive'}
              className={`
                rounded-full text-xs px-3 py-1.5 transition-colors whitespace-nowrap flex-shrink-0 font-medium
                ${activeTab === tab.key 
                  ? 'bg-[#333] text-white' 
                  : 'bg-transparent text-[#666] hover:text-zinc-300 hover:bg-[#111]'
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

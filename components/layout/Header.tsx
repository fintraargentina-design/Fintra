"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Newspaper, BarChart3, Search, PieChart, List, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MercadosTab from "@/components/tabs/MercadosTab";
import NoticiasTab from "@/components/tabs/NoticiasTab";
import DraggableWidget from "@/components/ui/draggable-widget";
import GlobalSearchInput from "@/components/dashboard/GlobalSearchInput";
import { useTabContext } from "@/components/providers/TabProvider";
import { cn } from "@/lib/utils";

function FilterSelect({ icon: Icon, placeholder, options, value, onChange }: any) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-[22px] bg-[#530C0C] border-none text-white text-[11px] font-medium px-2 gap-2 rounded hover:bg-[#4f1f1f] focus:ring-0 focus:ring-offset-0 min-w-[110px]">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 shrink-0 text-zinc-300" />
          <span className="truncate">{value || placeholder}</span>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-[#530C0C] border-zinc-800">
        {options.map((opt: string) => (
          <SelectItem key={opt} value={opt} className="text-zinc-300 focus:bg-[#400808] focus:text-white text-[11px]">
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function Header({
  sectors = [],
  selectedSector,
  onSectorChange,
  industries = [],
  selectedIndustry,
  onIndustryChange,
  selectedExchange,
  onExchangeChange,
  onStockSelect
}: {
  sectors?: string[];
  selectedSector?: string;
  onSectorChange?: (val: string) => void;
  industries?: string[];
  selectedIndustry?: string;
  onIndustryChange?: (val: string) => void;
  selectedExchange?: string;
  onExchangeChange?: (val: string) => void;
  onStockSelect?: (ticker: string) => void;
}) {
  const [showMarkets, setShowMarkets] = useState(false);
  const [showNews, setShowNews] = useState(false);
  
  const { openTickers, activeTicker, openOrActivateTicker, closeTab } = useTabContext();

  return (
    <>
      <header className="w-full h-[30px] border-b border-zinc-800 bg-[#0A0A0A] flex items-center px-3 gap-4">
        {/* Logo Section */}
        <div className="flex items-center gap-2">
          <div className="relative w-5 h-5">
            <Image 
              src="/fav.webp" 
              alt="Fintra Logo" 
              fill
              className="object-contain"
            />
          </div>
          <span className="text-sm font-bold text-zinc-200 hidden sm:inline-block">Fintra</span>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-2 h-full py-0.5">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-full text-[11px] px-2 gap-1.5 font-medium ${showMarkets ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setShowMarkets(!showMarkets)}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Markets
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-full text-[11px] px-2 gap-1.5 font-medium ${showNews ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setShowNews(!showNews)}
          >
            <Newspaper className="w-3.5 h-3.5" />
            News
          </Button>

          {/* Filters */}
          <div className="flex items-center gap-2 ml-2">
            <FilterSelect 
              icon={Search} 
              placeholder="Exchange" 
              options={["NYSE", "NASDAQ", "AMEX", "EURONEXT"]} 
              value={selectedExchange}
              onChange={onExchangeChange}
            />
            <FilterSelect 
              icon={PieChart} 
              placeholder="Sector" 
              options={sectors} 
              value={selectedSector}
              onChange={onSectorChange}
            />
            <FilterSelect 
              icon={List} 
              placeholder="Industry" 
              options={industries} 
              value={selectedIndustry}
              onChange={onIndustryChange}
            />
          </div>
          
          <div className="flex items-center ml-2">
            <GlobalSearchInput 
              onSelect={onStockSelect} 
              className="w-[180px]"
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center h-full ml-2 gap-1 overflow-x-auto no-scrollbar">
            {Array.from(new Set(openTickers)).map(ticker => {
              const isActive = ticker === activeTicker;
              return (
                <div
                  key={ticker}
                  onClick={() => openOrActivateTicker(ticker)}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-0.5 text-[10px] font-medium border rounded-sm cursor-pointer select-none transition-colors min-w-[80px] justify-between h-[22px]",
                    isActive
                      ? "bg-[#002D72] text-white border-[#002D72]"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200"
                  )}
                >
                  <span>{ticker}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(ticker);
                    }}
                    className={cn(
                      "p-0 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity",
                      isActive ? "hover:bg-white/20 text-white" : "hover:bg-white/10 text-zinc-400"
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Spacer */}
        <div className="flex-1" />
      </header>

      {/* Widgets */}
      <DraggableWidget
        title="Global Markets"
        isOpen={showMarkets}
        onClose={() => setShowMarkets(false)}
        initialPosition={{ x: 100, y: 80 }}
        width={1000}
        height={600}
      >
        <MercadosTab />
      </DraggableWidget>

      <DraggableWidget
        title="Latest News"
        isOpen={showNews}
        onClose={() => setShowNews(false)}
        initialPosition={{ x: 150, y: 120 }}
        width={800}
        height={600}
      >
        <NoticiasTab />
      </DraggableWidget>
    </>
  );
}

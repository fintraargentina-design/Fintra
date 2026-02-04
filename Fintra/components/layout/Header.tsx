"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Newspaper, BarChart3, Search, PieChart, List, X, Globe } from "lucide-react";
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
      <SelectTrigger className="h-8 bg-[#0A0A0A] border border-[#333] text-[#EDEDED] text-xs font-medium px-2.5 gap-2 rounded-md hover:bg-[#1A1A1A] hover:border-[#444] transition-all focus:ring-0 focus:ring-offset-0 w-[140px] shadow-sm">
        <div className="flex items-center gap-2 w-full overflow-hidden">
          <Icon className="w-3.5 h-3.5 shrink-0 text-[#888]" />
          <span className="truncate text-left flex-1">
             {options.find((opt: any) => (typeof opt === 'object' ? opt.value : opt) === value)?.label || value || placeholder}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-[#0A0A0A] border-[#333] shadow-xl">
        {options.map((opt: any) => {
          const optValue = typeof opt === 'object' ? opt.value : opt;
          const optLabel = typeof opt === 'object' ? opt.label : opt;
          return (
            <SelectItem key={optValue} value={optValue} className="text-[#888] focus:bg-[#1A1A1A] focus:text-[#EDEDED] text-xs cursor-pointer py-1.5">
              {optLabel}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export default function Header({
  countries = [],
  sectors = [],
  selectedSector,
  onSectorChange,
  industries = [],
  selectedIndustry,
  onIndustryChange,
  selectedCountry,
  onCountryChange,
  onStockSelect
}: {
  countries?: any[];
  sectors?: any[];
  selectedSector?: string;
  onSectorChange?: (val: string) => void;
  industries?: any[];
  selectedIndustry?: string;
  onIndustryChange?: (val: string) => void;
  selectedCountry?: string;
  onCountryChange?: (val: string) => void;
  onStockSelect?: (ticker: string) => void;
}) {
  const [showMarkets, setShowMarkets] = useState(false);
  const [showNews, setShowNews] = useState(false);
  
  const { openTickers, activeTicker, openOrActivateTicker, closeTab } = useTabContext();

  return (
    <>
      <header className="w-full h-[52px] border-b border-[#222] bg-[#050505]/80 backdrop-blur-md flex items-center px-4 gap-5 sticky top-0 z-50">
        {/* Logo Section */}
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 transition-all">
            <Image 
              src="/fav.webp" 
              alt="Fintra Logo" 
              fill
              className="object-contain"
            />
          </div>
          <span className="text-xl font-semibold tracking-tight text-[#EDEDED] hidden sm:inline-block">Fintra</span>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 h-full py-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 text-m px-3 gap-2 font-medium rounded-md transition-all ${showMarkets ? 'bg-[#1A1A1A] text-[#EDEDED]' : 'text-[#888] hover:text-[#EDEDED] hover:bg-[#111]'}`}
            onClick={() => setShowMarkets(!showMarkets)}
          >
            Markets
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 text-m px-3 gap-2 font-medium rounded-md transition-all ${showNews ? 'bg-[#1A1A1A] text-[#EDEDED]' : 'text-[#888] hover:text-[#EDEDED] hover:bg-[#111]'}`}
            onClick={() => setShowNews(!showNews)}
          >          
            News
          </Button>

          {/* Filter Section */}
        <div className="flex items-center gap-2 border-l border-[#222] pl-4 ml-2">
          <FilterSelect 
            icon={Globe} 
            placeholder="Country" 
            options={countries} 
            value={selectedCountry}
            onChange={onCountryChange}
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
            options={industries.filter((i: any) => {
              const val = typeof i === 'object' ? i.value : i;
              return val !== 'All Industries';
            })} 
            value={selectedIndustry}
            onChange={onIndustryChange}
          />
        </div>
          
          <div className="flex items-center ml-4">
            <GlobalSearchInput 
              onSelect={onStockSelect} 
              className="w-[240px]"
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center h-full ml-4 gap-1.5 overflow-x-auto no-scrollbar mask-linear-fade">
            {Array.from(new Set(openTickers)).map(ticker => {
              const isActive = ticker === activeTicker;
              return (
                <div
                  key={ticker}
                  onClick={() => openOrActivateTicker(ticker)}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium border rounded-md cursor-pointer select-none transition-all min-w-[90px] justify-between h-8 shadow-sm",
                    isActive
                      ? "bg-[#111] text-[#EDEDED] border-[#333] shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                      : "bg-transparent text-[#666] border-transparent hover:bg-[#111] hover:text-[#EDEDED] hover:border-[#222]"
                  )}
                >
                  <span className="tracking-wide">{ticker}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(ticker);
                    }}
                    className={cn(
                      "p-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity",
                      isActive ? "hover:bg-[#333] text-[#888] hover:text-[#EDEDED]" : "hover:bg-[#222] text-[#666]"
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

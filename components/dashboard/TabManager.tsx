'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import TickerDetailView from '@/components/dashboard/TickerDetailView';
import { useTabContext } from '@/components/providers/TabProvider';

// We keep the props interface for compatibility, but mark them optional/deprecated
interface TabManagerProps {
  requestedTicker?: string;
  onActiveTickerChange?: (ticker: string) => void;
}

export default function TabManager({ requestedTicker, onActiveTickerChange }: TabManagerProps) {
  const { openTickers, activeTicker, openOrActivateTicker, closeTab } = useTabContext();

  // Sync requestedTicker from parent (StockTerminal) to Context
  useEffect(() => {
    if (!requestedTicker) return;
    if (requestedTicker === activeTicker) return;
    openOrActivateTicker(requestedTicker);
  }, [requestedTicker, activeTicker, openOrActivateTicker]);

  // Sync Context changes (e.g. from back/forward nav) to Parent
  useEffect(() => {
    if (activeTicker && activeTicker !== requestedTicker) {
      onActiveTickerChange?.(activeTicker);
    }
  }, [activeTicker, requestedTicker, onActiveTickerChange]);

  // Handle local interactions via context
  const handleTickerChange = (newTicker: string) => {
    openOrActivateTicker(newTicker);
    onActiveTickerChange?.(newTicker);
  };

  const activateTab = (ticker: string) => {
    openOrActivateTicker(ticker);
    onActiveTickerChange?.(ticker);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-transparent">
      {/* Custom Tab Bar */}
			<div className="h-[27px] flex w-full overflow-x-auto border-b border-zinc-800 bg-transparent ">
        {Array.from(new Set(openTickers)).map(ticker => {
          const isActive = ticker === activeTicker;
          return (
            <div
              key={ticker}
              onClick={() => activateTab(ticker)}
              className={cn(
                "group flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#0A0A0A] border-zinc-800 cursor-pointer select-none transition-colors min-w-[100px] justify-between",
                isActive
                  ? "bg-[#002D72] text-white border-black mb-0.5"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
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
                  isActive ? "hover:bg-black/20 text-white" : "hover:bg-white/10 text-zinc-400"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Content Area - Render ALL open tickers with display toggle */}
      <div className="flex-1 w-full h-full overflow-hidden relative bg-black/40">
        {openTickers.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
            No active tickers
          </div>
        ) : (
          Array.from(new Set(openTickers)).map(ticker => {
            const isActive = ticker === activeTicker;
            return (
              <div
                key={ticker}
                className="w-full h-full"
                style={{ display: isActive ? 'block' : 'none' }}
              >
                <TickerDetailView
                  ticker={ticker}
                  isActive={isActive}
                  onTickerChange={handleTickerChange}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

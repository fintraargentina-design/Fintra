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
      {/* Content Area - Render ALL open tickers with display toggle */}
      <div className="flex-1 w-full h-full overflow-hidden relative bg-[#0e0e0e]">
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

'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import TickerDetailView from '@/components/dashboard/TickerDetailView';

interface TabManagerProps {
  requestedTicker: string;
  onActiveTickerChange?: (ticker: string) => void;
}

export default function TabManager({ requestedTicker, onActiveTickerChange }: TabManagerProps) {
  // Constants
  const MAX_OPEN_TABS = 6;

  // Initialize with the passed ticker if available
  const [openTickers, setOpenTickers] = useState<string[]>(() => 
    requestedTicker ? [requestedTicker] : []
  );
  
  // LRU Tracking: Index 0 = Least Recently Used, Index N = Most Recently Used
  // Must be kept in sync with openTickers
  const [lruOrder, setLruOrder] = useState<string[]>(() => 
    requestedTicker ? [requestedTicker] : []
  );

  const [activeTicker, setActiveTicker] = useState<string>(requestedTicker || '');

  // --- CORE CONTRACT: Open or Activate Ticker ---
  const openOrActivateTicker = (ticker: string) => {
    if (!ticker || ticker === 'N/A') return;
    const normalizedTicker = ticker.toUpperCase();

    // 1. Check if already open
    if (openTickers.includes(normalizedTicker)) {
      // Update Recency: Move to end
      setLruOrder(prev => {
        const filtered = prev.filter(t => t !== normalizedTicker);
        return [...filtered, normalizedTicker];
      });
      
      // Activate if needed
      if (activeTicker !== normalizedTicker) {
        setActiveTicker(normalizedTicker);
        onActiveTickerChange?.(normalizedTicker);
      }
      return;
    }

    // 2. New Ticker: Check limits and evict if necessary
    if (openTickers.length < MAX_OPEN_TABS) {
      // Case A: Space available
      setOpenTickers(prev => [...prev, normalizedTicker]);
      setLruOrder(prev => [...prev, normalizedTicker]); // Simple append since it wasn't there
      setActiveTicker(normalizedTicker);
      onActiveTickerChange?.(normalizedTicker);
    } else {
      // Case B: Eviction needed
      // Identify victim from current LRU state
      let victim = lruOrder[0];
      
      // SAFETY: The ACTIVE tab must NEVER be evicted.
      // If the LRU tab is somehow the active one, pick the next one.
      if (victim === activeTicker) {
        const candidate = lruOrder.find(t => t !== activeTicker);
        if (candidate) victim = candidate;
      }

      // Execute Eviction and Addition
      if (victim) {
        setOpenTickers(prev => prev.filter(t => t !== victim).concat(normalizedTicker));
        setLruOrder(prev => prev.filter(t => t !== victim && t !== normalizedTicker).concat(normalizedTicker));
        setActiveTicker(normalizedTicker);
        onActiveTickerChange?.(normalizedTicker);
      }
    }
  };

  // --- URL Synchronization (STEP 7) ---
  const pathname = usePathname();
  const router = useRouter();

  // 1. URL -> State (Initial Load & PopState)
  useEffect(() => {
    if (pathname && pathname !== '/') {
      const parts = pathname.split('/').filter(Boolean);
      const urlTicker = parts.length > 0 ? parts[0] : null;
      
      if (urlTicker && urlTicker.toUpperCase() !== activeTicker) {
        openOrActivateTicker(urlTicker);
      }
    }
  }, [pathname]); // activeTicker excluded to prevent revert loops

  // 2. State -> URL (Active Tab Change)
  useEffect(() => {
    if (activeTicker) {
      const targetPath = `/${activeTicker}`;
      // Prevent redundant updates or loops
      if (pathname !== targetPath) {
        router.push(targetPath, { scroll: false });
      }
    }
  }, [activeTicker]);

  // --- External Request Handling ---
  useEffect(() => {
    if (requestedTicker) {
      openOrActivateTicker(requestedTicker);
    }
  }, [requestedTicker]);

  // --- Interaction Handlers ---

  const closeTab = (tickerToClose: string) => {
    // 1. Calculate new list
    const newTickers = openTickers.filter(t => t !== tickerToClose);
    
    // 2. Determine next active ticker if we are closing the active one
    let nextActive = activeTicker;
    if (tickerToClose === activeTicker) {
      if (newTickers.length > 0) {
        const closedIndex = openTickers.indexOf(tickerToClose);
        // Try to go left (previous), otherwise stay at 0
        const newActiveIndex = Math.max(0, closedIndex - 1);
        nextActive = newTickers[Math.min(newActiveIndex, newTickers.length - 1)];
      } else {
        nextActive = '';
      }
    }

    // 3. Update state
    setOpenTickers(newTickers);
    // Important: Remove from LRU tracking as well
    setLruOrder(prev => prev.filter(t => t !== tickerToClose));

    // 4. Activate the fallback ticker (using the contract)
    if (nextActive) {
      // openOrActivateTicker will handle the activation and LRU update for the fallback
      // Note: nextActive is already in newTickers, so it hits the "already open" path.
      openOrActivateTicker(nextActive);
    } else {
      // No tabs left
      setActiveTicker('');
      onActiveTickerChange?.('');
    }
  };

  const handleTickerChange = (newTicker: string) => {
    openOrActivateTicker(newTicker);
  };

  const activateTab = (ticker: string) => {
    openOrActivateTicker(ticker);
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-transparent">
      {/* Custom Tab Bar */}
      <div className="h-[26px] flex w-full overflow-x-auto border-b border-zinc-800 bg-transparent scrollbar-thin">
        {openTickers.map(ticker => {
          const isActive = ticker === activeTicker;
          return (
            <div
              key={ticker}
              onClick={() => activateTab(ticker)}
              className={cn(
                "group flex items-center gap-2 px-4 py-2 text-xs font-medium border-zinc-800 cursor-pointer select-none transition-colors min-w-[100px] justify-between",
                isActive
                  ? "border-t-2 border-[#0056FF] text-white"
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
          openTickers.map(ticker => {
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

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface TabContextType {
  openTickers: string[];
  activeTicker: string;
  openOrActivateTicker: (ticker: string) => void;
  closeTab: (ticker: string) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const MAX_OPEN_TABS = 6;
  const STORAGE_KEY = 'fintra_tabs_state';

  const [openTickers, setOpenTickers] = useState<string[]>([]);
  const [lruOrder, setLruOrder] = useState<string[]>([]);
  const [activeTicker, setActiveTicker] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  const openTickersRef = useRef<string[]>(openTickers);
  const lruOrderRef = useRef<string[]>(lruOrder);
  const activeTickerRef = useRef<string>(activeTicker);

  const pathname = usePathname();
  const router = useRouter();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { openTickers: storedTickers, lruOrder: storedLru, activeTicker: storedActive } = JSON.parse(stored);
        if (Array.isArray(storedTickers)) setOpenTickers(Array.from(new Set(storedTickers)));
        if (Array.isArray(storedLru)) setLruOrder(Array.from(new Set(storedLru)));
        if (storedActive) setActiveTicker(storedActive);
      }
    } catch (e) {
      console.error('Failed to load tabs from storage', e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        openTickers,
        lruOrder,
        activeTicker
      }));
    } catch (e) {
      console.error('Failed to save tabs to storage', e);
    }
  }, [openTickers, lruOrder, activeTicker, isInitialized]);

  useEffect(() => { openTickersRef.current = openTickers; }, [openTickers]);
  useEffect(() => { lruOrderRef.current = lruOrder; }, [lruOrder]);
  useEffect(() => { activeTickerRef.current = activeTicker; }, [activeTicker]);

  const openOrActivateTicker = useCallback((ticker: string) => {
    if (!ticker || ticker === 'N/A') return;
    const normalizedTicker = ticker.toUpperCase();

    // 1. Check if already open
    if (openTickersRef.current.includes(normalizedTicker)) {
      setLruOrder(prev => {
        const filtered = prev.filter(t => t !== normalizedTicker);
        return [...filtered, normalizedTicker];
      });
      
      if (activeTickerRef.current !== normalizedTicker) {
        setActiveTicker(normalizedTicker);
      }
      return;
    }

    // 2. New Ticker
    if (openTickersRef.current.length < MAX_OPEN_TABS) {
      setOpenTickers(prev => (prev.includes(normalizedTicker) ? prev : [...prev, normalizedTicker]));
      setLruOrder(prev => {
        const filtered = prev.filter(t => t !== normalizedTicker);
        return [...filtered, normalizedTicker];
      });
      setActiveTicker(normalizedTicker);
    } else {
      // Eviction
      let victim = lruOrderRef.current[0];
      if (victim === activeTickerRef.current) {
        const candidate = lruOrderRef.current.find(t => t !== activeTickerRef.current);
        if (candidate) victim = candidate;
      }

      if (victim) {
        setOpenTickers(prev => prev.filter(t => t !== victim && t !== normalizedTicker).concat(normalizedTicker));
        setLruOrder(prev => prev.filter(t => t !== victim && t !== normalizedTicker).concat(normalizedTicker));
        setActiveTicker(normalizedTicker);
      }
    }
  }, []);

  const closeTab = useCallback((tickerToClose: string) => {
    const newTickers = openTickers.filter(t => t !== tickerToClose);
    
    let nextActive = activeTicker;
    if (tickerToClose === activeTicker) {
      if (newTickers.length > 0) {
        const closedIndex = openTickers.indexOf(tickerToClose);
        const newActiveIndex = Math.max(0, closedIndex - 1);
        nextActive = newTickers[Math.min(newActiveIndex, newTickers.length - 1)];
      } else {
        nextActive = '';
      }
    }

    setOpenTickers(newTickers);
    setLruOrder(prev => prev.filter(t => t !== tickerToClose));

    if (nextActive) {
      setActiveTicker(nextActive);
      setLruOrder(prev => {
        const filtered = prev.filter(t => t !== nextActive);
        return [...filtered, nextActive];
      });
    } else {
      setActiveTicker('');
    }
  }, [openTickers, activeTicker]);

  // URL -> State Sync
  useEffect(() => {
    if (pathname && pathname !== '/') {
      const parts = pathname.split('/').filter(Boolean);
      const urlTicker = parts.length > 0 ? parts[0].toUpperCase() : null;
      
      if (urlTicker && urlTicker !== activeTicker) {
        openOrActivateTicker(urlTicker);
      }
    }
  }, [pathname]);

  // State -> URL Sync
  useEffect(() => {
    if (activeTicker) {
      const targetPath = `/${activeTicker}`;
      if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  }, [activeTicker]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const urlTicker = parts.length > 0 ? parts[0].toUpperCase() : '';
      if (urlTicker) {
        openOrActivateTicker(urlTicker);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [openOrActivateTicker]);

  return (
    <TabContext.Provider value={{ openTickers, activeTicker, openOrActivateTicker, closeTab }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabContext() {
  const context = useContext(TabContext);
  if (context === undefined) {
    throw new Error('useTabContext must be used within a TabProvider');
  }
  return context;
}

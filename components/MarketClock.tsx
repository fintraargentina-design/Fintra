'use client';

import { useState, useEffect } from 'react';

interface MarketClockProps {
  className?: string;
  showMarketStatus?: boolean;
}

export default function MarketClock({ className = '', showMarketStatus = true }: MarketClockProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now);
      setMarketOpen(checkMarketOpen(now));
    };

    updateClock(); // Inicializa al montar
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, []);

  const checkMarketOpen = (time: Date) => {
    const nyTime = new Date(time.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = nyTime.getDay(); // 0 = Domingo, 6 = Sábado
    const hour = nyTime.getHours();
    const minute = nyTime.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    if (day === 0 || day === 6) return false; // Cerrado fines de semana

    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM
    return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
  };

  const formatLocalTime = () => {
    if (!currentTime) return '--:--:--';
    return currentTime.toLocaleTimeString('es-ES', { 
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  };

  const formatNYTime = () => {
    if (!currentTime) return '--:--:--';
    return currentTime.toLocaleTimeString('en-US', { 
      timeZone: 'America/New_York',
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  };

  const formatDate = () => {
    if (!currentTime) return '--/--/--';
    return currentTime.toLocaleDateString('es-ES', { 
      day: '2-digit', month: '2-digit', year: '2-digit' 
    });
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
  <span className="text-sm text-gray-400">{formatDate()} -</span>
  <svg
    className={`w-4 h-4 ${marketOpen ? 'text-green-100' : 'text-red-400'}`}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
      clipRule="evenodd"
    />
  </svg>
  <span className={`text-sm font-mono ${marketOpen ? 'text-green-100' : 'text-red-400'}`}>
    {formatLocalTime()}, NY {formatNYTime()}
  </span>
  {showMarketStatus && (
    <span className={`text-sm ${marketOpen ? 'text-green-400' : 'text-red-400'}`}>
      {marketOpen ? '🟢 Market Open' : '🔴 Market Close'}
    </span>
  )}
</div>
  );
}

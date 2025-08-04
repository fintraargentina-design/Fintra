'use client';

import { useState, useEffect } from 'react';

interface MarketClockProps {
  className?: string;
  showMarketStatus?: boolean;
}

export default function MarketClock({ className = '', showMarketStatus = true }: MarketClockProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setCurrentTime(new Date());
    
    // Actualizar el tiempo cada segundo
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const isMarketOpen = () => {
    if (!currentTime) return false; // Valor por defecto durante SSR
    
    const nyTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const day = nyTime.getDay(); // 0 = Domingo, 6 = Sábado
    const hour = nyTime.getHours();
    const minute = nyTime.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    // Mercado cerrado los fines de semana
    if (day === 0 || day === 6) {
      return false;
    }
    
    // Horario del mercado: 9:30 AM - 4:00 PM EST/EDT
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM
    
    return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
  };

  const formatLocalTime = () => {
    if (!isClient || !currentTime) return '--:--:--';
    return currentTime.toLocaleTimeString('es-ES', { 
      hour12: false,
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatNYTime = () => {
    if (!isClient || !currentTime) return '--:--:--';
    return currentTime.toLocaleTimeString('en-US', { 
      timeZone: 'America/New_York',
      hour12: false,
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDate = () => {
    if (!isClient || !currentTime) return '--/--/--';
    return currentTime.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    });
  };

  const getMarketStatus = () => {
    if (!isClient) return '🔴 Close Market'; // Valor por defecto durante SSR
    return isMarketOpen() ? '🟢 Open Market' : '🔴 Close Market';
  };

  return (
    <div className={`flex items-center space-x-2 text-gray-400 ${className}`}>
      <span className="text-sm">
        {formatDate()} - 
      </span>
      <svg className="w-4 h-4" fill="gray" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
      </svg>
      <span className={`text-sm font-mono ${
        isClient && isMarketOpen() 
          ? 'text-green-400' 
          : 'text-red-400'
      }`}>
        {formatLocalTime()}, NY {formatNYTime()}
      </span>
      {showMarketStatus && (
        <span className="text-sm">
          {getMarketStatus()}
        </span>
      )}
    </div>
  );
}
import { Settings, Flame, ChevronDown, Clock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useResponsive } from '@/hooks/use-responsive';
import { Card } from '@/components/ui/card';
import NavigationBar from '@/components/layout/NavigationBar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  user?: any;
  onAuth?: () => void;
  onSelectSymbol: (symbol: string) => void;
  showTimes?: boolean;
  activeTab: any;
  setActiveTab: (tab: any) => void;
  symbol: string;
}

export default function Header({ user, onAuth, onSelectSymbol, showTimes = true, activeTab, setActiveTab, symbol }: HeaderProps) {
  const { isMobile } = useResponsive();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [showTimesEnabled, setShowTimesEnabled] = useState(showTimes);

  useEffect(() => {
    setCurrentTime(new Date());
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isMarketOpen = () => {
    if (!currentTime) return false;
    const nyTime = new Date(currentTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = nyTime.getDay();
    const minutes = nyTime.getHours() * 60 + nyTime.getMinutes();
    if (day === 0 || day === 6) return false;
    return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
  };

  const toggleTimeDisplay = () => {
    setShowTimesEnabled((prev) => !prev);
  };

  return (
    <header className="w-full">
      <div className="w-full flex flex-wrap items-center justify-between gap-2 md:gap-3 px-3 py-1 md:py-1">
        {/* Izquierda: vacía para mantener estructura si es necesario */}
        <div className="flex-[1_1_220px] min-w-0" />

        {/* Centro: Espacio vacío para mantener balance si es necesario, o eliminado */}
        <div className="flex items-center justify-center gap-2 flex-[2_1_420px] min-w-0">
          <div className="hidden">
            <Card className="flex justify-end bg-transparent border-none">
              <div className="p-2">
                <NavigationBar 
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  symbol={symbol}
                />
              </div>
            </Card>
          </div>
        </div>

        {/* Derecha: tiempos y estado del mercado */}
        {/* <div className="flex items-center gap-4 flex-[1_1_240px] justify-end min-w-0">
          {showTimesEnabled && (
            <>
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className={`font-mono ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {currentTime
                    ? currentTime.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--:--'}
                </span>
                <svg className="w-4 h-4 text-[#FFA028]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className={`font-mono ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {currentTime
                    ? currentTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--:--'}
                </span>
                <span className="text-[#FFA028] font-semibold">NY</span>
              </div>
            </>
          )}

          <div 
            className="flex items-center gap-2 text-xs cursor-pointer hover:opacity-80 transition-opacity"
            onClick={toggleTimeDisplay}
          >
            <span className={`font-medium ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
              {isMarketOpen() ? 'Market Open' : 'Market Close'}
            </span>
          </div>
        </div> */}
      </div>
    </header>
  );
}
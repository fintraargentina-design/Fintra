import { Bell, Settings, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

interface HeaderProps {
  user?: any;
  onAuth?: () => void;
}

export default function Header({ user, onAuth }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

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

  return (
    <header className="bg-fondoTarjeta w-full border-gray-800 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Lado izquierdo - Título */}
        <div className="flex items-center space-x-2">
          <h1 className="text-lg font-medium text-white">
            Dashboard - Bienvenido a Fintra
          </h1>
        </div>

        {/* Lado derecho - Controles */}
        <div className="flex items-center space-x-6">
          
          {/* Tiempo Local */}
          <div className="flex items-center space-x-2 text-sm">
            <span className={`font-mono ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
              {currentTime
                ? currentTime.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '--:--:--'}
            </span>
            <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          </div>

          {/* Separador vertical */}
          {/* <div className="h-5 w-px bg-gray-700"></div> */}

          {/* Tiempo NY */}
          <div className="flex items-center space-x-2 text-sm">
            <span className={`font-mono ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
              {currentTime
                ? currentTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '--:--:--'}
            </span>
            <span className="text-orange-400 font-semibold">NY</span>

          </div>

          {/* Separador vertical */}
          {/* <div className="h-5 w-px bg-gray-700"></div> */}

          {/* Estado del Mercado */}
          <div className="flex items-center space-x-2 text-sm">
            <span className={`font-medium ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
              {isMarketOpen() ? 'Market Open' : 'Market Close'}
            </span>
          </div>

          {/* Separador vertical */}
          <div className="h-5 w-px bg-gray-700"></div>

          {/* Configuración */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-gray-400 hover:text-white hover:bg-gray-800 p-2"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
"use client";

import { useEffect, useState } from "react";
import { fmp } from "@/lib/fmp/client";
import { MarketHoursResponse } from '@/lib/fmp/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Globe } from "lucide-react";

export default function MercadosTab() {
  const [data, setData] = useState<MarketHoursResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHours() {
      try {
        const data = await fmp.marketHours();
        if (data) setData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchHours();
  }, []);

  if (loading) {
    return <div className="p-4 text-center text-xs text-gray-500">Cargando horarios de mercado...</div>;
  }

  if (!data) {
    return <div className="p-4 text-center text-xs text-gray-500">No se pudo cargar la información de mercados.</div>;
  }

  // Convert object to array for mapping
  const markets = Object.entries(data).map(([key, value]) => ({
    name: key.replace(/_/g, " ").toUpperCase(), // Some keys might have underscores
    ...value
  }));

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {markets.map((market) => (
          <Card key={market.name} className="bg-tarjetas border-white/5 shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium flex items-center justify-between text-gray-200">
                <span className="flex items-center gap-2 truncate" title={market.name}>
                  <Globe className="w-3 h-3 text-gray-500" />
                  {market.name}
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 h-5 border ${
                    market.isTheStockMarketOpen 
                      ? "text-green-400 border-green-500/20 bg-green-500/10" 
                      : "text-red-400 border-red-500/20 bg-red-500/10"
                  }`}
                >
                  {market.isTheStockMarketOpen ? "OPEN" : "CLOSED"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                <Clock className="w-3 h-3" />
                <span>{market.openingHour} - {market.closingHour}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

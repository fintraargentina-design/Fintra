"use client"; 
 
import { useState, useEffect } from "react"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; 
import { Badge } from "@/components/ui/badge"; 
import { fmp } from "@/lib/fmp/client"; 
import { Gauge } from "lucide-react"; 

export default function ValuationThermometer({ symbol }: { symbol: string }) { 
  const [score, setScore] = useState<number | null>(null); 
  const [loading, setLoading] = useState(true); 
  const [metrics, setMetrics] = useState<any[]>([]); 

  useEffect(() => { 
    let mounted = true; 
    const load = async () => { 
      try { 
        setLoading(true); 
        // Intentamos buscar ratios en tiempo real 
        const data = await fmp.ratios(symbol, { limit: 1 }); 
        const r = data?.[0]; 

        // Lógica de Fallback para Demo (Si no hay datos o es AAPL Demo simulada) 
        if (!r && symbol === 'AAPL') { 
           // Datos simulados para que el termómetro se vea en la Demo 
           if(mounted) { 
             setScore(25); // Sobrevalorada 
             setMetrics([ 
               { label: "P/E", val: "32.5x" }, 
               { label: "P/B", val: "45.2x" }, 
               { label: "PEG", val: "2.1" } 
             ]); 
           } 
           return; 
        } 

        if (!r) return; 

        // Lógica simple de Scoring para el Termómetro (0 = Cara, 100 = Barata) 
        // P/E base: 15. Si PE > 35 -> Score 0. Si PE < 10 -> Score 100. 
        const pe = r.priceEarningsRatio || 0; 
        let calcScore = 50; 
        
        if (pe > 0) { 
          // Fórmula lineal inversa: Entre más alto el PE, menos puntaje 
          calcScore = Math.max(0, Math.min(100, 100 - (pe - 10) * 3)); 
        } 

        if (mounted) { 
          setScore(Math.round(calcScore)); 
          setMetrics([ 
            { label: "P/E", val: pe.toFixed(1) + "x" }, 
            { label: "P/B", val: (r.priceToBookRatio || 0).toFixed(1) + "x" }, 
            { label: "PEG", val: (r.priceEarningsToGrowthRatio || 0).toFixed(2) } 
          ]); 
        } 
      } catch (e) { 
        console.error(e); 
      } finally { 
        if (mounted) setLoading(false); 
      } 
    }; 
    load(); 
    return () => { mounted = false }; 
  }, [symbol]); 

  const getStatus = (s: number) => s > 70 ? "Infravalorada" : s > 40 ? "Justa" : "Sobrevalorada"; 
  const getGradient = () => "linear-gradient(90deg, #ef4444 0%, #eab308 50%, #22c55e 100%)"; 

  if (loading) return <div className="h-32 bg-tarjetas animate-pulse rounded-lg border border-gray-800" />; 

  return ( 
    <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col justify-center"> 
      <CardHeader className="pb-2 pt-4"> 
        <div className="flex justify-between items-center"> 
          <CardTitle className="text-orange-400 text-base flex gap-2 items-center"> 
            <Gauge className="w-4 h-4" /> Termómetro de Valuación 
          </CardTitle> 
          {score !== null && ( 
            <Badge variant="outline" className={`${score > 40 ? 'text-white' : 'text-red-300 border-red-900 bg-red-900/20'}`}> 
              {getStatus(score)} 
            </Badge> 
          )} 
        </div> 
      </CardHeader> 
      <CardContent> 
        <div className="space-y-4"> 
          {/* Barra Visual */} 
          <div className="relative pt-2"> 
            <div className="h-3 w-full rounded-full" style={{ background: getGradient() }} /> 
            {/* Indicador Triangular */} 
            <div 
              className="absolute top-0 -mt-1 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white shadow-sm transition-all duration-1000" 
              style={{ left: `${score}%`, transform: 'translateX(-50%)' }} 
            /> 
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-semibold"> 
              <span>Cara</span> 
              <span>Justa</span> 
              <span>Barata</span> 
            </div> 
          </div> 

          {/* Métricas Resumidas */} 
          <div className="flex justify-between border-t border-gray-800 pt-3"> 
            {metrics.map((m, i) => ( 
              <div key={i} className="text-center px-2"> 
                <div className="text-[10px] text-gray-500">{m.label}</div> 
                <div className="text-sm font-bold text-gray-200">{m.val}</div> 
              </div> 
            ))} 
          </div> 
        </div> 
      </CardContent> 
    </Card> 
  ); 
}
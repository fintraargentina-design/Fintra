"use client"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; 
import { Badge } from "@/components/ui/badge"; 
import { Network, ArrowRight, Factory, Users, AlertTriangle } from "lucide-react"; 

export default function EcosystemCard({ symbol, data }: { symbol: string, data: any }) { 
  const safeData = data || { score: 0, summary: "Cargando...", suppliers: [], clients: [] }; 
  const getColor = (r: string) => r === "High" ? "text-red-400 bg-red-400/10" : r === "Medium" ? "text-yellow-400 bg-yellow-400/10" : "text-green-400 bg-green-400/10"; 

  return ( 
    <Card className="bg-tarjetas border-none h-full shadow-lg"> 
      <CardHeader className="pb-2 flex flex-row items-center justify-between"> 
        <CardTitle className="text-orange-400 text-lg flex gap-2"><Network className="w-5"/> Ecosistema</CardTitle> 
        <Badge variant="outline" className="text-lg">{safeData.score}/100</Badge> 
      </CardHeader> 
      <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4"> 
        {/* Proveedores */} 
        <div className="flex-1 space-y-2"> 
          <div className="text-xs text-gray-400 uppercase"><Factory className="w-3 inline"/> Proveedores</div> 
          {safeData.suppliers?.map((n: any, i: number) => ( 
            <div key={i} className="flex justify-between p-2 bg-gray-800/40 rounded border border-gray-700"> 
              <span className="text-xs text-gray-200">{n.name}</span> 
              <Badge className={getColor(n.risk)}>{n.risk}</Badge> 
            </div> 
          ))} 
        </div> 
        {/* Centro */} 
        <div className="flex flex-col items-center"><span className="font-bold text-white mb-1">{symbol}</span><ArrowRight className="text-gray-500"/></div> 
        {/* Clientes */} 
        <div className="flex-1 space-y-2"> 
          <div className="text-xs text-right text-gray-400 uppercase">Clientes <Users className="w-3 inline"/></div> 
          {safeData.clients?.map((n: any, i: number) => ( 
            <div key={i} className="flex justify-between p-2 bg-gray-800/40 rounded border border-gray-700"> 
              <Badge className={getColor(n.risk)}>{n.risk}</Badge> 
              <span className="text-xs text-gray-200">{n.name}</span> 
            </div> 
          ))} 
        </div> 
      </CardContent> 
    </Card> 
  ); 
}
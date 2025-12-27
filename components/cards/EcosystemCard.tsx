"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrendingUp } from "lucide-react";

// DATA DEMO
const MOCK = {
  prov: [
    { id: "TSM", n: "Taiwan Semi", dep: 92, val: 40, ehs: 88, fgos: 92, txt: "Crítico" },
    { id: "FOX", n: "Foxconn", dep: 85, val: 78, ehs: 55, fgos: 58, txt: "Riesgo Op." },
    { id: "GLW", n: "Corning", dep: 40, val: 30, ehs: 72, fgos: 65, txt: "Estable" }
  ],
  cli: [
    { id: "BBY", n: "Best Buy", dep: 18, val: 62, ehs: 45, fgos: 42, txt: "Volátil" },
    { id: "VZ", n: "Verizon", dep: 14, val: 55, ehs: 60, fgos: 58, txt: "Cash Flow" },
    { id: "JD", n: "JD.com", dep: 22, val: 25, ehs: 40, fgos: 35, txt: "Riesgo Geo" }
  ]
};


export interface EcoItem {
  id: string;
  n: string;
  dep: number;
  val: number;
  ehs: number;
  fgos: number;
  txt: string;
}

interface EcosystemCardProps {
  suppliers?: EcoItem[];
  clients?: EcoItem[];
}

export default function EcosystemCard({ suppliers = MOCK.prov, clients = MOCK.cli }: EcosystemCardProps) {
  const getValBadge = (v: number) => {
    if (v >= 70) return <Badge className="text-green-400 bg-green-400/10 border-green-400 px-2 py-0.5 text-[9px] h-5" variant="outline">Infravalorada</Badge>;
    if (v >= 40) return <Badge className="text-yellow-400 bg-yellow-400/10 border-yellow-400 px-2 py-0.5 text-[9px] h-5" variant="outline">Justa</Badge>;
    return <Badge className="text-red-400 bg-red-400/10 border-red-400 px-2 py-0.5 text-[9px] h-5" variant="outline">Sobrevalorada</Badge>;
  };

  const renderT = (data: EcoItem[], t: string) => (
    <div className="mb-1 last:mb-0 pt-2">
      <div className="flex items-center justify-center mb-2 px-1 text-orange-400">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t}</span>
      </div>
      <div className="border border-white/5 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-600 sticky top-0 z-10"><TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="h-8 text-[10px] text-gray-300">Ticker</TableHead>
            <TableHead className="h-8 text-[10px] text-gray-300 w-20">Dependencia</TableHead>
            <TableHead className="h-8 text-[10px] text-gray-300 text-center">F.G.O.S.</TableHead>
            <TableHead className="h-8 text-[10px] text-gray-300 text-center">Valuación</TableHead>
            <TableHead className="h-8 text-[10px] text-gray-300 text-center">Ecosistema</TableHead>            
            <TableHead className="h-8 text-[10px] text-gray-300 text-right">Conclusión</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.map((i, k) => (
            <TableRow key={i.id} className="border-white/5 hover:bg-white/5 h-10 group">
              <TableCell className="py-0.5"><div className="flex items-center gap-1">
                {/* <Avatar className="h-8 w-8"><AvatarFallback className="text-[7px]">{i.id.substring(0,1)}</AvatarFallback></Avatar> */}
                <div><div className="font-bold text-[10px] text-gray-200 leading-none">{i.id}</div>{/* <div className="text-[8px] text-gray-500">{i.n}</div> */}</div>
              </div></TableCell>
              <TableCell className="py-0.5">
                <span className="text-[10px] text-gray-300 font-mono">{i.dep}%</span>
              </TableCell>
              <TableCell className="py-0.5 text-center">
                <Badge variant="outline" className={`text-[10px] border-0 px-1.5 py-0 h-5 font-bold ${
                    i.fgos >= 70 ? "bg-green-500/10 text-green-400" : 
                    i.fgos >= 50 ? "bg-yellow-500/10 text-yellow-400" : 
                    "bg-red-500/10 text-red-400"
                }`}>
                  {i.fgos}
                </Badge>
              </TableCell>
              <TableCell className="py-0.5 text-center">{getValBadge(i.val)}</TableCell>
              <TableCell className="py-0.5 text-center font-mono text-[10px] text-blue-400">{i.ehs}</TableCell>
              <TableCell className="py-0.5 text-right text-[9px] text-gray-400">{i.txt}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <Card className="bg-tarjetas border-none shadow-lg h-full">
      {/* <CardHeader className="pb-2 pt-3 px-4 border-b border-white/5">
        <CardTitle className="text-orange-400 text-sm flex gap-2"><TrendingUp className="w-4"/> Matriz de Riesgo</CardTitle>
      </CardHeader> */}
      <CardContent className="p-0">
        {renderT(suppliers, "Proveedores")}
        {renderT(clients, "Clientes")}
      </CardContent>
    </Card>
  );
}

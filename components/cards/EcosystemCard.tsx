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

const MicroTherm = ({ v }: { v: number }) => (
  <div className="w-16 mx-auto h-1.5 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 relative opacity-80">
    <div className="absolute -top-0.5 h-2.5 w-0.5 bg-white shadow-sm" style={{ left: `${v}%` }} />
  </div>
);

export default function EcosystemCard() {
  const renderT = (data: any[], t: string) => (
    <div className="mb-1 last:mb-0">
      <div className="flex items-center justify-center mb-2 px-1 text-orange-400">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t}</span>
      </div>
      <div className="border border-white/5 overflow-hidden">
        <Table>
          <TableHeader className="bg-[#111] sticky top-0 z-10"><TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="h-8 text-[10px] uppercase text-gray-500 font-bold">TICKER</TableHead>
            <TableHead className="h-8 text-[10px] uppercase text-gray-500 font-bold w-20">Dep.</TableHead>
            <TableHead className="h-8 text-[10px] uppercase text-gray-500 font-bold text-center">Valuación</TableHead>
            <TableHead className="h-8 text-[10px] uppercase text-gray-500 font-bold text-center">E.H.S.</TableHead>
            <TableHead className="h-8 text-[10px] uppercase text-gray-500 font-bold text-center">F.G.O.S.</TableHead>
            <TableHead className="h-8 text-[10px] uppercase text-gray-500 font-bold text-right">Conclusión</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.map((i, k) => (
            <TableRow key={i.id} className="border-white/5 hover:bg-white/5 h-10 group">
              <TableCell className="py-2"><div className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-[7px]">{i.id.substring(0,1)}</AvatarFallback></Avatar>
                <div><div className="font-bold text-[10px] text-gray-200 leading-none">{i.id}</div><div className="text-[8px] text-gray-500">{i.n}</div></div>
              </div></TableCell>
              <TableCell className="py-2"><div className="flex flex-col gap-0.5">
                <Progress value={i.dep} className="h-1 bg-gray-800" indicatorColor={i.dep>50?"bg-orange-500":"bg-blue-500"}/><span className="text-[8px] text-gray-500 text-right">{i.dep}%</span>
              </div></TableCell>
              <TableCell className="py-2"><MicroTherm v={i.val}/></TableCell>
              <TableCell className="py-2 text-center font-mono text-[10px] text-blue-400">{i.ehs}</TableCell>
              <TableCell className="py-2 text-center"><Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 border ${i.fgos>=70?"text-green-400 border-green-500/30":"text-red-400 border-red-500/30"}`}>{i.fgos}</Badge></TableCell>
              <TableCell className="py-2 text-right text-[9px] text-gray-400">{i.txt}</TableCell>
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
        {renderT(MOCK.prov, "Proveedores")}
        {renderT(MOCK.cli, "Clientes")}
      </CardContent>
    </Card>
  );
}

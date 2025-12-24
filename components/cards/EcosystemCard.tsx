"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Briefcase, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import type { InstitutionalHolder, InsiderTrading } from "@/lib/fmp/types";

interface EcosystemCardProps {
  symbol: string;
  holders: InstitutionalHolder[];
  insiders: InsiderTrading[];
}

export default function EcosystemCard({ symbol, holders = [], insiders = [] }: EcosystemCardProps) {
  
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      {/* Institutional Holders */}
      <Card className="bg-gray-800/30 border-none h-full shadow-lg overflow-hidden flex flex-col">
        <CardHeader className="pb-2 border-b border-white/5 bg-white/5">
          <CardTitle className="text-orange-400 text-lg flex gap-2 items-center">
            <Building2 className="w-5 h-5"/> 
            Instituciones (Top Holders)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-white/5 sticky top-0">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-gray-400">Institución</TableHead>
                <TableHead className="text-right text-gray-400">Acciones</TableHead>
                <TableHead className="text-right text-gray-400">Reportado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holders && holders.length > 0 ? (
                holders.slice(0, 10).map((holder, i) => (
                  <TableRow key={i} className="border-white/5 hover:bg-white/5">
                    <TableCell className="font-medium text-gray-200">{holder.holder}</TableCell>
                    <TableCell className="text-right text-gray-300">
                      <div className="flex flex-col items-end">
                        <span>{formatNumber(holder.shares)}</span>
                        {holder.change !== 0 && (
                          <span className={`text-xs ${holder.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {holder.change > 0 ? '+' : ''}{formatNumber(holder.change)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-gray-400 text-xs">{formatDate(holder.dateReported)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                    No hay datos de instituciones disponibles
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Insider Trading */}
      <Card className="bg-gray-800/30 border-none h-full shadow-lg overflow-hidden flex flex-col">
        <CardHeader className="pb-2 border-b border-white/5 bg-white/5">
          <CardTitle className="text-blue-400 text-lg flex gap-2 items-center">
            <Users className="w-5 h-5"/> 
            Transacciones de Insiders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-white/5 sticky top-0">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-gray-400">Insider</TableHead>
                <TableHead className="text-gray-400">Tipo</TableHead>
                <TableHead className="text-right text-gray-400">Monto</TableHead>
                <TableHead className="text-right text-gray-400">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insiders && insiders.length > 0 ? (
                insiders.slice(0, 10).map((trade, i) => {
                  const isBuy = trade.acquistionOrDisposition === 'A' || trade.transactionType?.toLowerCase().includes('buy') || trade.transactionType?.toLowerCase().includes('purchase');
                  const isSell = trade.acquistionOrDisposition === 'D' || trade.transactionType?.toLowerCase().includes('sell') || trade.transactionType?.toLowerCase().includes('sale');
                  
                  return (
                    <TableRow key={i} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-medium text-gray-200">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[120px]" title={trade.reportingName}>{trade.reportingName}</span>
                          <span className="text-xs text-gray-500 truncate max-w-[120px]" title={trade.typeOfOwner}>{trade.typeOfOwner}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <Badge variant="outline" className={`
                           ${isBuy ? 'text-green-400 border-green-400/30 bg-green-400/10' : 
                             isSell ? 'text-red-400 border-red-400/30 bg-red-400/10' : 
                             'text-gray-400 border-gray-400/30'}
                         `}>
                           {isBuy ? 'Compra' : isSell ? 'Venta' : 'Otro'}
                         </Badge>
                      </TableCell>
                      <TableCell className="text-right text-gray-300">
                        <div className="flex flex-col items-end">
                          <span>{formatNumber(trade.securitiesTransacted)} acc.</span>
                          <span className="text-xs text-gray-400">@ ${trade.price}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-gray-400 text-xs">{formatDate(trade.transactionDate)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                    No hay transacciones recientes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

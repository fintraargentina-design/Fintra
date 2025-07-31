import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

interface FundamentalCardProps {
  stockBasicData: any;
}

export default function FundamentalCard({ stockBasicData }: FundamentalCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Los datos fundamentales están directamente en stockBasicData
  // No en stockBasicData.fundamentales

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-green-500/30 cursor-pointer transition-all duration-300 hover:border-[#00FF00] hover:shadow-lg hover:shadow-[#00FF00]/20">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Fundamental</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">ROE:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.roe ? `${stockBasicData.roe}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">ROIC:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.roic ? `${stockBasicData.roic}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Net Margin:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.net_margin ? `${stockBasicData.net_margin}%` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Debt/Equity:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.debt_equity ? stockBasicData.debt_equity : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Free Cash Flow:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.free_cash_flow ? `$${(stockBasicData.free_cash_flow / 1000000).toFixed(1)}M` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Gross Margin:</span>
                  <span className="text-green-400 font-mono">
                    {stockBasicData?.gross_margin ? `${stockBasicData.gross_margin}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-gray-900 border-green-500/30">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-2xl">Análisis Fundamental Detallado</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="space-y-4">
            <h3 className="text-green-400 text-lg font-semibold">Rentabilidad</h3>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Return on Equity (ROE):</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockBasicData?.roe ? `${stockBasicData.roe}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Return on Invested Capital (ROIC):</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockBasicData?.roic ? `${stockBasicData.roic}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Net Profit Margin:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockBasicData?.net_margin ? `${stockBasicData.net_margin}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Gross Margin:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockBasicData?.gross_margin ? `${stockBasicData.gross_margin}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-green-400 text-lg font-semibold">Estructura Financiera</h3>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Debt to Equity Ratio:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockBasicData?.debt_equity ? stockBasicData.debt_equity : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Free Cash Flow:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockBasicData?.free_cash_flow ? `$${(stockBasicData.free_cash_flow / 1000000).toFixed(1)}M` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Current Ratio:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockBasicData?.current_ratio ? stockBasicData.current_ratio.toFixed(2) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-800/50 rounded">
                <span className="text-gray-300">Quick Ratio:</span>
                <span className="text-green-400 font-mono text-lg">
                  {stockBasicData?.quick_ratio ? stockBasicData.quick_ratio.toFixed(2) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
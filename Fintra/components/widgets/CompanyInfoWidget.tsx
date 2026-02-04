"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Globe, Phone, Activity } from "lucide-react";

interface CompanyInfoWidgetProps {
  data: any; // Using any for flexibility as requested, but ideally typed
}

export default function CompanyInfoWidget({ data }: CompanyInfoWidgetProps) {
    if (!data) return <div className="p-4 text-zinc-400">No data available</div>;

    const { identity, metrics, classification, financial_scores, last_updated } = data;

    // Helper to format large numbers
    const fmtLarge = (val: number | string) => {
         if (!val) return "-";
         const num = Number(val);
         if (isNaN(num)) return val;
         if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
         if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
         if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
         return num.toLocaleString();
    };

    return (
        <div className="w-full h-full bg-[#0A0A0A] text-zinc-200 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            
            {/* Header: Identity */}
            <div className="flex gap-4 items-start">
                <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center p-2 shrink-0 border border-zinc-800">
                    {identity?.logo ? (
                        <img src={identity.logo} alt={identity.ticker} className="w-full h-full object-contain" />
                    ) : (
                        <span className="text-xl font-bold">{identity?.ticker?.slice(0, 2)}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold text-white truncate">{identity?.name}</h2>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                         <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 font-mono">{identity?.ticker}</span>
                         <span>•</span>
                         <span>{identity?.exchange}</span>
                         <span>•</span>
                         <span>{identity?.country}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                        {identity?.website && (
                             <a href={identity.website.trim()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                                 <Globe className="w-3 h-3" /> Website
                             </a>
                        )}
                        {identity?.phone && (
                            <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {identity.phone}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="bg-zinc-900/50 p-3 rounded-md border border-zinc-800">
                <p className="text-xs text-zinc-400 leading-relaxed text-justify">
                    {identity?.description}
                </p>
            </div>

            {/* Grid: Classification & Key Info */}
            <div className="grid grid-cols-2 gap-4 rounded">
                 <div className="space-y-1 bg-zinc-900/30 p-3 rounded border border-zinc-800">
                     <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Classification</h3>
                     <div className="flex flex-col gap-2">
                         <div className="flex justify-between text-xs border-b border-zinc-800 pb-1">
                             <span className="text-zinc-400">Sector</span>
                             <span className="text-white text-right">{classification?.sector}</span>
                         </div>
                         <div className="flex justify-between text-xs border-b border-zinc-800 pb-1">
                             <span className="text-zinc-400">Industry</span>
                             <span className="text-white text-right">{classification?.industry}</span>
                         </div>
                         <div className="flex justify-between text-xs border-b border-zinc-800 pb-1">
                             <span className="text-zinc-400">CEO</span>
                             <span className="text-white text-right truncate max-w-[120px]">{identity?.ceo}</span>
                         </div>
                          <div className="flex justify-between text-xs border-b border-zinc-800 pb-1">
                             <span className="text-zinc-400">Employees</span>
                             <span className="text-white text-right">{Number(identity?.fullTimeEmployees || 0).toLocaleString()}</span>
                         </div>
                     </div>
                 </div>

                 <div className="space-y-1 bg-zinc-900/30 p-3 rounded border border-zinc-800">
                     <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Market Data</h3>
                     <div className="flex flex-col gap-2">
                         <div className="flex justify-between text-xs border-b border-zinc-800 pb-1">
                             <span className="text-zinc-400">Market Cap</span>
                             <span className="text-white font-mono text-right">{fmtLarge(metrics?.marketCap)}</span>
                         </div>
                         <div className="flex justify-between text-xs border-b border-zinc-800 pb-1">
                             <span className="text-zinc-400">Price</span>
                             <span className="text-white font-mono text-right">{metrics?.price}</span>
                         </div>
                         <div className="flex justify-between text-xs border-b border-zinc-800 pb-1">
                             <span className="text-zinc-400">Beta</span>
                             <span className="text-white font-mono text-right">{metrics?.beta}</span>
                         </div>
                         <div className="flex justify-between text-xs border-b border-zinc-800 pb-1">
                             <span className="text-zinc-400">Avg Volume</span>
                             <span className="text-white font-mono text-right">{fmtLarge(metrics?.averageVolume)}</span>
                         </div>
                     </div>
                 </div>
            </div>

            {/* Financial Scores */}
            <div>
                 <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="w-3 h-3" /> Financial Scores (Snapshot)
                 </h3>
                 <div className="grid grid-cols-3 gap-3">
                     <ScoreCard label="Altman Z-Score" value={financial_scores?.altman_z?.toFixed(2)} />
                     <ScoreCard label="Piotroski Score" value={financial_scores?.piotroski_score} />
                     <ScoreCard label="Working Capital" value={fmtLarge(financial_scores?.working_capital)} />
                     
                     <ScoreCard label="Revenue" value={fmtLarge(financial_scores?.revenue)} />
                     <ScoreCard label="EBIT" value={fmtLarge(financial_scores?.ebit)} />
                     <ScoreCard label="Retained Earnings" value={fmtLarge(financial_scores?.retainedEarnings)} />

                     <ScoreCard label="Total Assets" value={fmtLarge(financial_scores?.total_assets)} />
                     <ScoreCard label="Total Liabilities" value={fmtLarge(financial_scores?.total_liabilities)} />
                     <ScoreCard label="Last Updated" value={last_updated ? format(new Date(last_updated), 'MMM dd, yyyy') : '-'} />
                 </div>
            </div>
            
            <div className="text-[10px] text-zinc-600 text-center pt-4 border-t border-zinc-900 mt-4">
                ID: {identity?.isin || '-'} | CIK: {identity?.cik || '-'} | CUSIP: {identity?.cusip || '-'}
            </div>
        </div>
    );
}

function ScoreCard({ label, value }: { label: string, value: string | number }) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 p-2 rounded flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-zinc-500 mb-1">{label}</span>
            <span className="text-sm font-medium text-white font-mono">{value || "-"}</span>
        </div>
    )
}

"use client";
// SectorScatterChart.tsx
import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { supabase } from '@/lib/supabase';

const ACTIVE_WINDOW = '1Y';

// Define strict color palette
const COLORS = {
  leader: '#10b981',   // Green
  follower: '#f59e0b', // Amber
  laggard: '#ef4444',  // Red
  default: '#6b7280'   // Gray (fallback)
};

interface ScatterPoint {
  ticker: string;
  x: number; // Relative Performance vs Sector (1Y)
  y: number; // FGOS Score
  size: number; // Market Cap (scaled)
  color: string;
  ifsPosition: string;
  marketCap: number;
  sentiment?: {
    band: string;
    confidence: number | null;
    sampleSize?: number;
    horizon?: string;
  };
}

export default function SectorScatterChart({ 
  selectedSector,
  selectedIndustry,
  selectedCountry 
}: { 
  selectedSector?: string;
  selectedIndustry?: string;
  selectedCountry?: string;
}) {
  const [data, setData] = useState<ScatterPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedSector || selectedSector === 'All Sectors') {
      setData([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Step 1: Get tickers matching filters from market_state
        let tickerQuery = supabase
          .from('fintra_market_state')
          .select('ticker')
          .eq('sector', selectedSector);

        if (selectedIndustry && selectedIndustry !== 'All Industries' && selectedIndustry !== 'Todas') {
          tickerQuery = tickerQuery.eq('industry', selectedIndustry);
        }

        if (selectedCountry && selectedCountry !== 'All Countries') {
          tickerQuery = tickerQuery.eq('country', selectedCountry);
        }

        const { data: marketData, error: marketError } = await tickerQuery;

        if (marketError) throw marketError;

        if (!marketData || marketData.length === 0) {
          setData([]);
          return;
        }

        const tickers = marketData.map(d => d.ticker);

        // Step 2: Determine the latest snapshot date for this sector
        const { data: dateData, error: dateError } = await supabase
          .from('fintra_snapshots')
          .select('snapshot_date')
          .eq('sector', selectedSector)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .single();

        if (dateError) throw dateError;
        if (!dateData) {
          setData([]);
          return;
        }

        const targetDate = dateData.snapshot_date;

        // Step 3: Fetch snapshots for these tickers at the target date
        const { data: snapshots, error } = await supabase
          .from('fintra_snapshots')
          .select(`
            ticker,
            snapshot_date,
            relative_vs_sector_${ACTIVE_WINDOW.toLowerCase()},
            fgos_score,
            ifs,
            fgos_components,
            market_snapshot
          `)
          .in('ticker', tickers)
          .eq('snapshot_date', targetDate);

        if (error) throw error;

        if (!snapshots) {
          setData([]);
          return;
        }

        // Transform to scatter points
        const validPoints: ScatterPoint[] = [];
        
        // Calculate min/max log market cap for sizing
        let minLogCap = Infinity;
        let maxLogCap = -Infinity;

        snapshots.forEach((snap: any) => {
          // Strict data rules: skip if missing core metrics
          if (
            snap.fgos_score === null || 
            snap[`relative_vs_sector_${ACTIVE_WINDOW.toLowerCase()}`] === null || 
            !snap.ifs?.position
          ) {
            return;
          }

          const marketCap = snap.market_snapshot?.market_cap || 0;
          if (marketCap > 0) {
            const logCap = Math.log10(marketCap);
            if (logCap < minLogCap) minLogCap = logCap;
            if (logCap > maxLogCap) maxLogCap = logCap;
          }
        });

        // Avoid division by zero
        const capRange = maxLogCap - minLogCap || 1;

        snapshots.forEach((snap: any) => {
          // Re-check validity inside loop
          if (
            snap.fgos_score === null || 
            snap[`relative_vs_sector_${ACTIVE_WINDOW.toLowerCase()}`] === null || 
            !snap.ifs?.position
          ) {
            return;
          }

          const ifsPos = snap.ifs.position as keyof typeof COLORS;
          const color = COLORS[ifsPos] || COLORS.default;
          
          const marketCap = snap.market_snapshot?.market_cap || 0;
          let size = 10; // Default size
          
          if (marketCap > 0) {
            const logCap = Math.log10(marketCap);
            // Scale between 5 and 30
            size = 5 + ((logCap - minLogCap) / capRange) * 25;
          }

          // Extract sentiment from fgos_components
          const sentimentDetails = snap.fgos_components?.sentiment_details;
          let sentiment = undefined;
          
          if (sentimentDetails) {
            sentiment = {
              band: sentimentDetails.band || 'insufficient data',
              confidence: sentimentDetails.confidence,
              sampleSize: sentimentDetails.sample_size,
              horizon: sentimentDetails.horizon || sentimentDetails.time_horizon
            };
          }

          validPoints.push({
            ticker: snap.ticker,
            x: Number(snap[`relative_vs_sector_${ACTIVE_WINDOW.toLowerCase()}`].toFixed(2)),
            y: snap.fgos_score,
            size,
            color,
            ifsPosition: ifsPos,
            marketCap,
            sentiment
          });
        });

        setData(validPoints);

      } catch (err) {
        console.error('Error fetching scatter data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedSector, selectedIndustry, selectedCountry]);

  // ECharts Option
  const option = {
    backgroundColor: '#0A0A0A',
    grid: {
      left: '8%',
      right: '8%',
      top: '10%',
      bottom: '10%'
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(20, 20, 20, 0.95)',
      borderColor: '#333',
      textStyle: {
        color: '#eee',
        fontSize: 12
      },
      padding: 12,
      formatter: (params: any) => {
        const p = params.data as ScatterPoint & { value: any[] };
        // Value[0] = X, Value[1] = Y, Value[2] = Ticker (mapped below)
        
        // Find the point data from our state (or passed in data)
        // ECharts passes the data object if we structure it right
        const point = params.data as any; 
        
        const formatMoney = (val: number) => {
          if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
          if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
          if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
          return `$${val.toLocaleString()}`;
        };

        const sentimentInfo = point.sentiment 
          ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #333;">
              <div style="color: #888; font-size: 11px; margin-bottom: 2px;">NEWS SENTIMENT</div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <span style="color: ${
                  point.sentiment.band === 'optimistic' ? '#10b981' : 
                  point.sentiment.band === 'pessimistic' ? '#ef4444' : '#fbbf24'
                }">${point.sentiment.band.toUpperCase()}</span>
                ${point.sentiment.confidence ? `<span style="color: #666; font-size: 10px;">Conf: ${point.sentiment.confidence}%</span>` : ''}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #666; font-size: 10px;">Sample: ${point.sentiment.sampleSize ?? 'unavailable'}</span>
                <span style="color: #666; font-size: 10px;">Horizon: ${point.sentiment.horizon ?? 'unavailable'}</span>
              </div>
            </div>
          `
          : `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #333;">
              <span style="color: #666; font-style: italic; font-size: 11px;">News sentiment: insufficient data</span>
            </div>
          `;

        return `
          <div style="min-width: 180px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-weight: bold; font-size: 14px; color: #fff;">${point.name}</span>
              <span style="
                background-color: ${point.itemStyle.color}20; 
                color: ${point.itemStyle.color}; 
                padding: 2px 6px; 
                border-radius: 4px; 
                font-size: 10px; 
                text-transform: uppercase; 
                font-weight: 600;
              ">${point.ifsPosition}</span>
            </div>
            <div style="color: #888; font-size: 11px; margin-bottom: 8px;">${formatMoney(point.marketCap)}</div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="color: #aaa;">FGOS Score:</span>
              <span style="color: #fff; font-weight: 500;">${point.value[1]}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #aaa;">Rel. Perf (1Y):</span>
              <span style="color: ${point.value[0] >= 0 ? '#10b981' : '#ef4444'}; font-weight: 500;">
                ${point.value[0] > 0 ? '+' : ''}${point.value[0]}%
              </span>
            </div>

            ${sentimentInfo}
          </div>
        `;
      }
    },
    xAxis: {
      type: 'value',
      name: `Relative Performance vs Sector (${ACTIVE_WINDOW})`,
      nameLocation: 'middle',
      nameGap: 30,
      min: -50,
      max: 50,
      nameTextStyle: { color: '#666', fontSize: 11 },
      splitLine: {
        lineStyle: {
          color: '#222',
          type: 'dashed'
        }
      },
      axisLine: {
        lineStyle: { color: '#444' }
      },
      axisLabel: {
        color: '#666',
        formatter: '{value}%'
      },
      // Center line at 0
      axisPointer: {
        show: true,
        snap: true
      }
    },
    yAxis: {
      type: 'value',
      name: 'FGOS Score',
      min: 0,
      max: 100,
      nameTextStyle: { color: '#666', fontSize: 11 },
      splitLine: {
        lineStyle: {
          color: '#222'
        }
      },
      axisLine: {
        show: false
      },
      axisLabel: {
        color: '#666'
      }
    },
    series: [
      {
        name: 'Companies',
        type: 'scatter',
        // Map data to ECharts format: [x, y, ...extras]
        data: data.map(pt => ({
          name: pt.ticker,
          value: [pt.x, pt.y],
          symbolSize: pt.size,
          itemStyle: {
            color: pt.color,
            borderColor: '#000',
            borderWidth: 1,
            opacity: 0.8
          },
          // Pass custom data for tooltip
          ifsPosition: pt.ifsPosition,
          marketCap: pt.marketCap,
          sentiment: pt.sentiment
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: {
            color: '#333',
            type: 'solid',
            width: 1
          },
          data: [
            { yAxis: 50, label: { show: false } },
            { xAxis: 0, label: { show: false } }
          ]
        }
      }
    ]
  };

  if (!selectedSector) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0A0A0A] text-zinc-600 text-xs">
        Select a sector to view structural positioning
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0A0A0A] relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-zinc-400 text-xs animate-pulse">Loading sector structure...</div>
        </div>
      )}
      <ReactECharts 
        option={option} 
        style={{ height: '100%', width: '100%' }} 
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}

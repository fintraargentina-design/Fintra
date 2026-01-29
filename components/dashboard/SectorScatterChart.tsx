"use client";

import React from 'react';
import ReactECharts from 'echarts-for-react';

export default function SectorScatterChart({ selectedSector }: { selectedSector?: string }) {
  // Mock data generation similar to the example
  // In a real scenario, this would come from props
  const generateData = () => {
    const data = [];
    for (let i = 0; i < 50; i++) {
      data.push([
        (Math.random() * 100).toFixed(2), // X-axis (e.g. Valuation)
        (Math.random() * 100).toFixed(2), // Y-axis (e.g. FGOS Score)
        (Math.random() * 1000000000).toFixed(0) // Bubble size (e.g. Market Cap) - optional
      ]);
    }
    return data;
  };

  const data = generateData();

  const option = {
    backgroundColor: '#0A0A0A', // Dark background to match theme
    title: {
      text: selectedSector ? `${selectedSector} Analysis` : 'Sector Analysis Scatter',
      left: 'center',
      textStyle: {
        color: '#ccc',
        fontSize: 14
      }
    },
    grid: {
      left: '8%',
      right: '8%',
      top: '15%',
      bottom: '10%'
    },
    tooltip: {
      trigger: 'item',
      axisPointer: {
        type: 'cross'
      },
      backgroundColor: 'rgba(50,50,50,0.9)',
      borderColor: '#333',
      textStyle: {
        color: '#eee'
      }
    },
    xAxis: {
      type: 'value',
      name: 'Valuation',
      nameTextStyle: { color: '#888' },
      splitLine: {
        lineStyle: {
          color: '#333'
        }
      },
      axisLabel: {
        color: '#888'
      }
    },
    yAxis: {
      type: 'value',
      name: 'FGOS Score',
      nameTextStyle: { color: '#888' },
      splitLine: {
        lineStyle: {
          color: '#333'
        }
      },
      axisLabel: {
        color: '#888'
      }
    },
    series: [
      {
        name: 'Stocks',
        type: 'scatter',
        data: data,
        symbolSize: function (data: any) {
          // Simple sizing logic, or fixed size
          return 8; 
        },
        itemStyle: {
          color: '#002D72',
          borderColor: '#555',
          borderWidth: 1,
          opacity: 0.8
        }
      }
    ]
  };

  return (
    <div className="w-full h-full p-2 bg-[#0A0A0A] border-t border-zinc-800">
      <ReactECharts 
        option={option} 
        style={{ height: '100%', width: '100%' }} 
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}

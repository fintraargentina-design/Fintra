'use client';

import React, { memo } from 'react';
import SectorAnalysisPanel from '@/components/dashboard/SectorAnalysisPanel';
import SectorScatterChart from '@/components/dashboard/SectorScatterChart';

interface LeftPanelProps {
  onStockSelect: (symbol: string) => void;
  selectedTicker?: string;
  sectors?: any[];
  selectedSector?: string;
  industries?: any[];
  selectedIndustry?: string;
  selectedCountry?: string;
}

const LeftPanel = memo(({ 
  onStockSelect, 
  selectedTicker,
  sectors,
  selectedSector,
  industries,
  selectedIndustry,
  selectedCountry
}: LeftPanelProps) => {
  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-[#0A0A0A]">
      {/* Top 60%: Sector Analysis Panel */}
      <div className="h-[60%] w-full min-h-0 ">
        <SectorAnalysisPanel 
          onStockSelect={onStockSelect} 
          selectedTicker={selectedTicker}
          sectors={sectors}
          selectedSector={selectedSector}
          industries={industries}
          selectedIndustry={selectedIndustry}
          selectedCountry={selectedCountry}
        />
      </div>
      
      {/* Bottom 40%: Scatter Chart */}
      <div className="h-[40%] w-full min-h-0">
        <SectorScatterChart selectedSector={selectedSector} />
      </div>
    </div>
  );
});

LeftPanel.displayName = 'LeftPanel';

export default LeftPanel;

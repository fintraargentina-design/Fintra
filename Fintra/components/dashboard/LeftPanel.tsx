'use client';

import React, { memo } from 'react';
import SectorAnalysisPanel from '@/components/dashboard/SectorAnalysisPanel';

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
    <div className="w-full h-full flex flex-col min-h-0 bg-[#0e0e0e]">
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
  );
});

LeftPanel.displayName = 'LeftPanel';

export default LeftPanel;
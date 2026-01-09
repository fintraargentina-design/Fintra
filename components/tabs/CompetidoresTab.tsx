'use client';

import React from 'react';
import PeersAnalysisPanel from '@/components/dashboard/PeersAnalysisPanel';

interface CompetidoresTabProps {
  symbol?: string;
  onPeerSelect?: (ticker: string) => void;
  selectedPeer?: string | null;
}

export default function CompetidoresTab({ 
  symbol, 
  onPeerSelect,
  selectedPeer
}: CompetidoresTabProps) {
  return (
    <div className="w-full h-full border border-zinc-800 overflow-hidden">
      <PeersAnalysisPanel 
        symbol={symbol || ''} 
        onPeerSelect={onPeerSelect}
        selectedPeer={selectedPeer}
      />
    </div>
  );
}

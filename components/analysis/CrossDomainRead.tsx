
import React from 'react';
import { CrossDomainInsight } from '@/lib/analysis/crossDomainConsistency';

interface CrossDomainReadProps {
  insights: CrossDomainInsight[];
}

export default function CrossDomainRead({ insights }: CrossDomainReadProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <div className="px-3 py-1.5 flex flex-col gap-1">
      {insights.map((insight) => (
        <p key={insight.id} className="text-xs text-zinc-400 leading-tight">
          {insight.text}
        </p>
      ))}
    </div>
  );
}

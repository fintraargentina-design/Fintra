'use client';

import { useRef, useMemo, useState, useEffect } from "react";
import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosTableCard from "@/components/cards/DividendosTableCard";
import { useSyncedHorizontalScroll } from "@/lib/ui/useSyncedHorizontalScroll";
import QuickNarrative from "@/components/analysis/QuickNarrative";
import DecisionRead from "@/components/analysis/DecisionRead";
import DecisionPeerContrast from "@/components/analysis/DecisionPeerContrast";
import { evaluateNarrativeAnchors, AnchorContext } from "@/lib/analysis/narrativeAnchors";
import { evaluateDecisionAnchors, decisionAnchors, DecisionAnchor } from "@/lib/analysis/decisionAnchors";
import { evaluateDecisionPeerContrast, PeerContrast } from "@/lib/analysis/decisionPeerContrast";
import { evaluateDividendSignals, DividendDividendRow } from "@/lib/analysis/dividendSignals";
import { mapDividendSignalsToNarratives } from "@/lib/analysis/dividendNarrativeAdapter";
import { evaluateCashFlowSignals, parseTimelineResponse } from "@/lib/analysis/cashFlowSignals";
import { mapCashFlowSignalsToNarratives } from "@/lib/analysis/cashFlowNarrativeAdapter";
import { evaluateStructuralConsistency, StructuralSignal } from "@/lib/analysis/structuralConsistency";
import { mapStructuralSignalsToNarratives } from "@/lib/analysis/structuralNarrativeAdapter";
import { evaluateStructuralPeerContrast } from "@/lib/analysis/structuralPeerContrast";
import { compressNarrativeAnchors } from "@/lib/analysis/anchorCompression";
import { attachTemporalContext } from "@/lib/analysis/temporalContext";
import { applyNarrativePrecedence } from "@/lib/analysis/narrativePrecedence";
import { evaluateNarrativeDrift, NarrativeDrift } from "@/lib/analysis/narrativeDrift";
import { evaluateCrossDomainConsistency } from "@/lib/analysis/crossDomainConsistency";
import CrossDomainRead from "@/components/analysis/CrossDomainRead";
import { supabase } from "@/lib/supabase";

type PeriodSel = "ttm" | "FY" | "Q1" | "Q2" | "Q3" | "Q4" | "annual" | "quarter";

interface DatosTabProps {
  stockAnalysis: any;
  stockPerformance?: any;
  stockBasicData?: any;
  symbol: string;
  peerTicker?: string | null;
  period?: PeriodSel;
  ratios?: any;
  metrics?: any;
}

export default function DatosTab({
  stockAnalysis,
  stockPerformance,
  stockBasicData,
  symbol,
  peerTicker,
  ratios,
  metrics
}: DatosTabProps) {
  const [highlightMetrics, setHighlightMetrics] = useState<string[] | null>(null);
  const [anchors, setAnchors] = useState<any[]>([]);
  const [decisionResult, setDecisionResult] = useState<DecisionAnchor[]>([]);
  
  // Peer Analysis State (Placeholder for future injection)
  const [peerDecisionAnchors, setPeerDecisionAnchors] = useState<DecisionAnchor[]>([]);
  const [contrasts, setContrasts] = useState<PeerContrast[]>([]);
  const [dividendAnchors, setDividendAnchors] = useState<any[]>([]);
  const [peerDividendAnchors, setPeerDividendAnchors] = useState<any[]>([]);

  // Cash Flow & Timeline State
  const [timelineData, setTimelineData] = useState<any>(undefined);
  const [cashFlowAnchors, setCashFlowAnchors] = useState<any[]>([]);
  const [structuralAnchors, setStructuralAnchors] = useState<any[]>([]);
  const [structuralSignals, setStructuralSignals] = useState<StructuralSignal[]>([]);

  // Peer Structural State
  const [peerTimelineData, setPeerTimelineData] = useState<any>(undefined);
  const [peerStructuralSignals, setPeerStructuralSignals] = useState<StructuralSignal[]>([]);

  // Fetch timeline data (reused for signals + FundamentalCard)
  useEffect(() => {
    let alive = true;
    async function fetchTimeline() {
      try {
        const res = await fetch(`/api/analysis/fundamentals-timeline?ticker=${symbol}`);
        if (res.ok && alive) {
          const json = await res.json();
          setTimelineData(json);
        }
      } catch (e) {
        console.warn("Timeline fetch failed", e);
      }
    }
    if (symbol) fetchTimeline();
    return () => { alive = false; };
  }, [symbol]);

  // Fetch peer timeline data
  useEffect(() => {
    if (!peerTicker) {
        setPeerTimelineData(undefined);
        return;
    }
    
    let alive = true;
    async function fetchPeerTimeline() {
      try {
        const res = await fetch(`/api/analysis/fundamentals-timeline?ticker=${peerTicker}`);
        if (res.ok && alive) {
          const json = await res.json();
          setPeerTimelineData(json);
        }
      } catch (e) {
        console.warn("Peer Timeline fetch failed", e);
      }
    }
    fetchPeerTimeline();
    return () => { alive = false; };
  }, [peerTicker]);

  // Fetch dividend data and compute signals
  useEffect(() => {
    let alive = true;
    
    async function fetchDividends(ticker: string, setter: (data: any[]) => void) {
      try {
        const { data: rows, error } = await supabase
          .from('datos_dividendos')
          .select('*')
          .eq('ticker', ticker)
          .order('year', { ascending: true });

        if (error || !rows) return;

        if (alive) {
          const signals = evaluateDividendSignals(rows as DividendDividendRow[]);
          const mapped = mapDividendSignalsToNarratives(signals);
          setter(mapped);
        }
      } catch (e) {
        console.warn(`[DatosTab] Dividend fetch failed silently for ${ticker}`, e);
      }
    }

    if (symbol) fetchDividends(symbol, setDividendAnchors);
    if (peerTicker) fetchDividends(peerTicker, setPeerDividendAnchors);
    else if (alive) setPeerDividendAnchors([]); // Clear if no peer

    return () => { alive = false; };
  }, [symbol, peerTicker]);

  // Compute Cash Flow Anchors
  useEffect(() => {
    if (!timelineData) return;

    // Re-calculate context for signals (Growth narrative etc)
    const ctx: AnchorContext = {
      ticker: symbol,
      hasPeer: !!peerTicker,
      basicData: stockBasicData,
      ratios: ratios,
      metrics: metrics,
      analysis: stockAnalysis
    };
    
    const fundAnchors = evaluateNarrativeAnchors(ctx);
    const contextIds = [
      ...fundAnchors.map(a => a.id),
      ...dividendAnchors.map(a => a.id)
    ];

    const rows = parseTimelineResponse(timelineData);
    const signals = evaluateCashFlowSignals(rows, contextIds);
    const mapped = mapCashFlowSignalsToNarratives(signals);
    
    setCashFlowAnchors(mapped);
  }, [timelineData, stockBasicData, ratios, metrics, stockAnalysis, symbol, peerTicker, dividendAnchors]);

  // Compute Structural Anchors
  useEffect(() => {
    if (!timelineData) return;

    const signals = evaluateStructuralConsistency(timelineData);
    setStructuralSignals(signals);
    const mapped = mapStructuralSignalsToNarratives(signals);
    setStructuralAnchors(mapped);
  }, [timelineData]);

  // Compute Peer Structural Signals
  useEffect(() => {
    if (!peerTimelineData) {
        setPeerStructuralSignals([]);
        return;
    }
    const signals = evaluateStructuralConsistency(peerTimelineData);
    setPeerStructuralSignals(signals);
  }, [peerTimelineData]);

  // Calculate anchors when data changes
  useEffect(() => {
    const ctx: AnchorContext = {
      ticker: symbol,
      hasPeer: !!peerTicker,
      basicData: stockBasicData,
      ratios: ratios,
      metrics: metrics,
      analysis: stockAnalysis
    };
    
    const calculatedAnchors = evaluateNarrativeAnchors(ctx);
    
    // Merge fundamental anchors with dividend and cash flow anchors
    const allAnchors = [...calculatedAnchors];

    const mergeUnique = (source: any[]) => {
        source.forEach(a => {
            if (!allAnchors.find(existing => existing.id === a.id)) {
                allAnchors.push(a);
            }
        });
    };
    
    mergeUnique(dividendAnchors);
    mergeUnique(cashFlowAnchors);
    mergeUnique(structuralAnchors);

    // Apply Signal Fatigue Control (Compression)
    const compressedAnchors = compressNarrativeAnchors(allAnchors);

    // Apply Temporal Context
    const temporalAnchors = timelineData 
        ? attachTemporalContext(compressedAnchors, timelineData) 
        : compressedAnchors;

    // Apply Narrative Precedence (Step 14)
    const finalAnchors = applyNarrativePrecedence(temporalAnchors);

    setAnchors(finalAnchors);

    // Evaluate Decision Anchors
    // Consistency: Decision is based on the visible (compressed) signal set
    const activeNarrativeIds = finalAnchors.map(a => a.id);
    setDecisionResult(evaluateDecisionAnchors(decisionAnchors, activeNarrativeIds));
  }, [symbol, stockBasicData, ratios, metrics, stockAnalysis, peerTicker, dividendAnchors, cashFlowAnchors, structuralAnchors]);

  // Compare Peer vs Main
  useEffect(() => {
    // Only compute if peer exists
    if (!peerTicker) {
      setContrasts([]);
      return;
    }
    
    // Uses strictly interpretive logic (presence/absence of anchors)
    const comparison = evaluateDecisionPeerContrast(
      decisionResult,
      peerDecisionAnchors,
      anchors.map(a => a.id),
      peerDividendAnchors.map(a => a.id)
    );

    // Structural Contrast
    const structuralComparison = evaluateStructuralPeerContrast(
      structuralSignals,
      peerStructuralSignals
    );

    setContrasts([...comparison, ...structuralComparison]);
  }, [decisionResult, peerDecisionAnchors, peerTicker, anchors, peerDividendAnchors, structuralSignals, peerStructuralSignals]);

  // Refs for synchronized horizontal scrolling
  const fundamentalRef = useRef<HTMLDivElement>(null);
  const valoracionRef = useRef<HTMLDivElement>(null);
  const desempenoRef = useRef<HTMLDivElement>(null);
  const dividendosRef = useRef<HTMLDivElement>(null);

  // Group refs in a stable array
  const scrollRefs = useMemo(() => [
    fundamentalRef,
    valoracionRef,
    desempenoRef,
    dividendosRef
  ], []);

  // Activate the hook
  useSyncedHorizontalScroll(scrollRefs);

  // Cross-Domain Consistency
  const crossDomainInsights = useMemo(() => {
    return evaluateCrossDomainConsistency(anchors.map(a => a.id));
  }, [anchors]);

  return (
    <div className="w-full h-full flex flex-col gap-1 p-1 overflow-hidden">
      {/* Narrative Anchors Section */}
      <div className="shrink-0 bg-tarjetas border border-zinc-800">
          <QuickNarrative 
            anchors={anchors} 
            onHighlight={setHighlightMetrics} 
          />
          {decisionResult.length > 0 && (
            <div className="border-t border-zinc-800/50 pt-1">
              <DecisionRead anchors={decisionResult} />
              <CrossDomainRead insights={crossDomainInsights} />
              <DecisionPeerContrast contrasts={contrasts} peerTicker={peerTicker || ""} />
            </div>
          )}
      </div>

      <div className="flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
        <div className="bg-tarjetas border border-zinc-800">
          <FundamentalCard 
            symbol={symbol} 
            peerTicker={peerTicker}
            scrollRef={fundamentalRef}
            highlightedMetrics={highlightMetrics}
            timelineData={timelineData}
          />
        </div>
        <div className="bg-tarjetas border border-zinc-800">
          <ValoracionCard 
            symbol={symbol} 
            peerTicker={peerTicker}
            scrollRef={valoracionRef}
            highlightedMetrics={highlightMetrics}
          />
        </div>
        <div className="bg-tarjetas border border-zinc-800">
           <DesempenoCard 
             symbol={symbol} 
             peerTicker={peerTicker}
             scrollRef={desempenoRef}
             highlightedMetrics={highlightMetrics}
           />
        </div>
        <div className="bg-tarjetas border border-zinc-800">
           <DividendosTableCard 
             symbol={symbol}
             peerTicker={peerTicker}
             scrollRef={dividendosRef}
             highlightedMetrics={highlightMetrics}
           />
        </div>
      </div>
    </div>
  );
}

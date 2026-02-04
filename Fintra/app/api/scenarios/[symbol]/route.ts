import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { computeNarrativeRisk, type NewsInsight } from '@/lib/analysis/narrativeRisk';
import { computeDominantNarratives, type DominantNarrative } from '@/lib/analysis/dominantNarratives';
import { computeNarrativeBias } from '@/lib/analysis/narrativeBias';

export const runtime = 'nodejs';

// Scenario Context DTO
interface ScenarioContext {
  symbol: string;
  window_days: number;
  narrativeRisk: {
    level: 'Bajo' | 'Moderado' | 'Elevado';
    score: number;
    active_rules: string[];
  };
  dominantNarratives: {
    narratives: DominantNarrative[];
    total_insights: number;
  };
  narrativeBias: {
    bias: 'Positivo' | 'Neutro' | 'Negativo';
    score: number;
    breakdown: {
      positiva: number;
      neutra: number;
      negativa: number;
    };
  };
  sample_size: number;
  generated_at: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(req.url);
    const windowDaysParam = searchParams.get('window_days');
    
    // 1. Validate input
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // 2. Determine time window
    const windowDays = windowDaysParam ? parseInt(windowDaysParam, 10) : 14;
    const today = new Date();
    const startDate = new Date(today.getTime() - (windowDays * 24 * 60 * 60 * 1000));
    const startDateStr = startDate.toISOString().split('T')[0];

    // 3. Query Supabase (READ ONLY - Standard Client)
    const { data: snapshots, error } = await supabase
      .from('news_insight_snapshots')
      .select('news_type, direction, narrative_vector, confidence, evidence_level, published_date, explanation')
      .eq('symbol', symbol.toUpperCase())
      .eq('is_eligible_for_history', true)
      .gte('published_date', startDateStr)
      .order('published_date', { ascending: true });

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // 4. Handle no rows
    if (!snapshots || snapshots.length === 0) {
      const emptyContext: ScenarioContext = {
        symbol: symbol.toUpperCase(),
        window_days: windowDays,
        narrativeRisk: {
          level: 'Bajo',
          score: 0,
          active_rules: []
        },
        dominantNarratives: {
          narratives: [],
          total_insights: 0
        },
        sample_size: 0,
        generated_at: new Date().toISOString()
      };
      return NextResponse.json(emptyContext);
    }

    // 5. Compute Narrative Risk
    // Map Supabase rows to NewsInsight interface expected by the function
    const insights: NewsInsight[] = snapshots.map(s => ({
      news_type: s.news_type,
      direction: s.direction,
      narrative_vector: s.narrative_vector,
      confidence: s.confidence,
      evidence_level: s.evidence_level,
      explanation: s.explanation || '',
      published_date: s.published_date
    }));

    const riskResult = computeNarrativeRisk(insights);
    const dominantNarrativesResult = computeDominantNarratives(insights);
    const narrativeBiasResult = computeNarrativeBias(insights);

    // 6. Build Scenario Context DTO
    const context: ScenarioContext = {
      symbol: symbol.toUpperCase(),
      window_days: windowDays,
      narrativeRisk: {
        level: riskResult.level,
        score: riskResult.score,
        active_rules: riskResult.active_rules
      },
      dominantNarratives: dominantNarrativesResult,
      narrativeBias: narrativeBiasResult,
      sample_size: insights.length,
      generated_at: new Date().toISOString()
    };

    // 7. Return 200 with JSON
    return NextResponse.json(context);

  } catch (error) {
    console.error('Unexpected scenario engine error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

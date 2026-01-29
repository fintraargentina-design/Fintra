import { AnalysisResponse } from '../AnalisisNotician8n';

export type NarrativeRiskLevel = 'Bajo' | 'Moderado' | 'Elevado';

export interface NarrativeRiskResult {
  level: NarrativeRiskLevel;
  score: number;
  active_rules: string[];
}

export interface NewsInsight extends AnalysisResponse {
  published_date: string; // YYYY-MM-DD
  evidence_level: 'full' | 'summary';
}

/**
 * Calculates Narrative Risk based on deterministic rules from News Insight snapshots.
 * 
 * RISK LEVELS:
 * - 'Elevado': score >= 4
 * - 'Moderado': score >= 2
 * - 'Bajo': score < 2
 * 
 * @param insights Array of News Insights (must be eligible for history)
 * @returns NarrativeRiskResult with level, score, and active rules
 */
export function computeNarrativeRisk(insights: NewsInsight[]): NarrativeRiskResult {
  let riskScore = 0;
  const activeRules: string[] = [];
  const today = new Date();
  
  // Helper to parse date safely
  const parseDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // 14-day window calculation
  const dayInMillis = 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = new Date(today.getTime() - (14 * dayInMillis));

  // Filter insights within the last 14 days
  const recentInsights = insights.filter(insight => {
    const d = parseDate(insight.published_date);
    return d && d >= fourteenDaysAgo && d <= today;
  });

  // --- Rule 1: Weak Evidence ---
  // If evidence_level === 'summary', add +1 risk
  const hasWeakEvidence = insights.some(i => i.evidence_level === 'summary');
  if (hasWeakEvidence) {
    riskScore += 1;
    activeRules.push('Weak Evidence (Summary Only)');
  }

  // --- Rule 2: Strong Direction with Low Confidence ---
  // If direction !== 'Neutra' AND confidence === 'Baja', add +1 risk
  const hasLowConfidenceStrongDirection = insights.some(i => 
    i.direction !== 'Neutra' && i.confidence === 'Baja'
  );
  if (hasLowConfidenceStrongDirection) {
    riskScore += 1;
    activeRules.push('Strong Direction / Low Confidence');
  }

  // --- Rule 3: Opinion-Based Content ---
  // If news_type === 'Opinión', add +1 risk
  const hasOpinionContent = insights.some(i => i.news_type === 'Opinión');
  if (hasOpinionContent) {
    riskScore += 1;
    activeRules.push('Opinion-Based Content');
  }

  // --- Rule 4: Momentum / Hype without persistence ---
  // If narrative_vector contains 'Momentum' or 'Hype' 
  // AND this narrative appears fewer than 3 times in the last 14 days
  // Add +1 risk
  let momentumCount = 0;
  recentInsights.forEach(i => {
    if (i.narrative_vector.some(n => ['Momentum', 'Hype'].includes(n))) {
      momentumCount++;
    }
  });

  // Check if any *current* insight has Momentum/Hype
  const hasMomentumOrHype = insights.some(i => 
    i.narrative_vector.some(n => ['Momentum', 'Hype'].includes(n))
  );

  if (hasMomentumOrHype && momentumCount < 3) {
    riskScore += 1;
    activeRules.push('Hype/Momentum without Persistence');
  }

  // --- Rule 5: Low Narrative Persistence ---
  // If total number of eligible insights in the last 14 days is <= 2
  // Add +1 risk
  if (recentInsights.length <= 2) {
    riskScore += 1;
    activeRules.push('Low Narrative Persistence');
  }

  // --- Aggregation ---
  let level: NarrativeRiskLevel = 'Bajo';
  if (riskScore >= 4) {
    level = 'Elevado';
  } else if (riskScore >= 2) {
    level = 'Moderado';
  }

  return {
    level,
    score: riskScore,
    active_rules: activeRules
  };
}

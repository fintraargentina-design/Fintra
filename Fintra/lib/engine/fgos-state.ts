
import { FgosBreakdown } from './types';

/**
 * Derived FGOS State object for UI consumption.
 * Fully deterministic and based solely on existing computed fields.
 */
export interface FgosState {
  stage: 'pending' | 'partial' | 'computed';

  quality: {
    score: number | null;
    bucket: 'weak' | 'average' | 'strong' | 'elite' | 'unknown';
  };

  confidence: {
    label: 'Low' | 'Medium' | 'High';
    percent: number;
    reason: string;
  };

  coverage: {
    total_dimensions: number;
    computed: number;
    missing: string[];
  };

  context: {
    sentiment: 'supportive' | 'neutral' | 'hostile' | 'unknown';
    reason: string;
  };

  explanation: string;
}

/**
 * Input structure expected from fintra_snapshots or engine result.
 */
export interface FgosInput {
  fgos_score: number | null;
  fgos_components: FgosBreakdown | null;
  fgos_confidence_percent: number | null;
  fgos_confidence_label: string | null;
  fgos_status?: string | null;
  fgos_maturity?: string | null;
}

/**
 * Pure function to build the canonical FGOS State.
 * Does NOT fetch data. Does NOT recalculate metrics.
 */
export function buildFGOSState(input: FgosInput): FgosState {
  const {
    fgos_score,
    fgos_components,
    fgos_confidence_percent,
    fgos_confidence_label
  } = input;

  if (!fgos_components) {
    return {
      stage: 'pending',
      quality: { score: null, bucket: 'unknown' },
      confidence: { label: 'Low', percent: 0, reason: 'No analysis data available.' },
      coverage: { total_dimensions: 6, computed: 0, missing: ['All'] },
      context: { sentiment: 'unknown', reason: 'No data.' },
      explanation: 'Analysis is pending initialization.'
    };
  }

  // --- 1. Coverage Analysis ---
  // Dimensions: Growth, Profitability, Efficiency, Solvency, Moat, Sentiment
  const dimensions = [
    { key: 'Growth', status: getSimpleDimensionStatus(fgos_components.growth) },
    { key: 'Profitability', status: getSimpleDimensionStatus(fgos_components.profitability) },
    { key: 'Efficiency', status: getSimpleDimensionStatus(fgos_components.efficiency) },
    { key: 'Solvency', status: getSimpleDimensionStatus(fgos_components.solvency) },
    { key: 'Moat', status: getSimpleDimensionStatus(fgos_components.moat) },
    { key: 'Sentiment', status: getSimpleDimensionStatus(fgos_components.sentiment) },
  ];

  const total_dimensions = 6;
  const computedCount = dimensions.filter(d => d.status === 'computed').length;
  const missingDimensions = dimensions.filter(d => d.status !== 'computed').map(d => d.key);
  const pendingDimensions = dimensions.filter(d => d.status === 'pending').map(d => d.key);

  // --- 2. Stage Determination ---
  let stage: 'pending' | 'partial' | 'computed';
  if (computedCount < 3) {
    stage = 'pending';
  } else if (computedCount < 6) {
    stage = 'partial';
  } else {
    stage = 'computed';
  }

  // --- 3. Quality Bucket ---
  let qualityBucket: 'weak' | 'average' | 'strong' | 'elite' | 'unknown';
  if (fgos_score === null) {
    qualityBucket = 'unknown';
  } else if (fgos_score < 40) {
    qualityBucket = 'weak';
  } else if (fgos_score < 60) {
    qualityBucket = 'average';
  } else if (fgos_score < 75) {
    qualityBucket = 'strong';
  } else {
    qualityBucket = 'elite';
  }

  // --- 4. Confidence Reason ---
  const confPercent = fgos_confidence_percent ?? 0;
  let confLabel: 'Low' | 'Medium' | 'High' = 'Low';
  if (fgos_confidence_label === 'High' || fgos_confidence_label === 'Medium' || fgos_confidence_label === 'Low') {
    confLabel = fgos_confidence_label;
  } else {
    // Fallback based on percent if label is missing or invalid
    if (confPercent >= 80) confLabel = 'High';
    else if (confPercent >= 50) confLabel = 'Medium';
    else confLabel = 'Low';
  }

  let confidenceReason = '';
  if (missingDimensions.length === 0) {
    confidenceReason = 'All dimensions are fully computed.';
  } else if (missingDimensions.length === total_dimensions) {
    confidenceReason = 'Insufficient data for analysis.';
  } else {
    const parts = [];
    if (pendingDimensions.length > 0) {
      parts.push(`${pendingDimensions.join(', ')} data is missing.`);
    }
    confidenceReason = parts.join(' ');
  }
  
  // Clean up reason if empty
  if (!confidenceReason) confidenceReason = 'Analysis coverage is complete.';

  // --- 5. Context (Sentiment) ---
  const sentimentVal = fgos_components.sentiment;
  let sentimentContext: 'supportive' | 'neutral' | 'hostile' | 'unknown';
  let sentimentReason = '';

  if (sentimentVal === null || sentimentVal === undefined) {
    sentimentContext = 'unknown';
    sentimentReason = 'Market sentiment data is unavailable.';
  } else if (sentimentVal >= 65) {
    sentimentContext = 'supportive';
    sentimentReason = 'Market sentiment is supportive.';
  } else if (sentimentVal >= 45) {
    sentimentContext = 'neutral';
    sentimentReason = 'Market sentiment is neutral.';
  } else {
    sentimentContext = 'hostile';
    sentimentReason = 'Market sentiment is hostile.';
  }

  // --- 6. Explanation ---
  // "The company shows [quality] structural fundamentals, but the analysis remains [stage] due to [reason]. [Sentiment Context]."
  
  let explanation = '';
  
  // Part 1: Structural Quality
  if (qualityBucket === 'unknown') {
    explanation += 'Structural fundamentals could not be assessed';
  } else {
    explanation += `The company shows ${qualityBucket} structural fundamentals`;
  }

  // Part 2: Completeness/Stage
  if (stage === 'computed') {
    explanation += ', with a fully comprehensive analysis coverage.';
  } else {
    explanation += `, but the analysis remains ${stage}`;
    if (missingDimensions.length > 0) {
      explanation += ` due to incomplete ${missingDimensions[0]}${missingDimensions.length > 1 ? ' and others' : ''}.`;
    } else {
      explanation += '.';
    }
  }

  // Part 3: Market Context (if not supportive or if explicitly relevant)
  // Requirement: "Mentions market context if sentiment is not supportive"
  if (sentimentContext !== 'supportive' && sentimentContext !== 'unknown') {
     explanation += ` ${sentimentReason}`;
  } else if (sentimentContext === 'supportive') {
     // Optional: Mentions it if it adds value? 
     // "Never contradicts data". 
     // Let's add it for completeness if the user wants "Mentions structural quality, Mentions coverage, Mentions market context...".
     // The prompt says "Mentions market context if sentiment is not supportive". Implies we can skip if supportive?
     // But "Example style: ... incomplete market confirmation signals."
     // Let's include it if it's computed.
     explanation += ` ${sentimentReason}`;
  }

  // Refine explanation flow
  // Remove double spaces, fix punctuation
  explanation = explanation.replace(/\.\./g, '.').trim();

  return {
    stage,
    quality: {
      score: fgos_score,
      bucket: qualityBucket
    },
    confidence: {
      label: confLabel,
      percent: confPercent,
      reason: confidenceReason
    },
    coverage: {
      total_dimensions,
      computed: computedCount,
      missing: missingDimensions
    },
    context: {
      sentiment: sentimentContext,
      reason: sentimentReason
    },
    explanation
  };
}

// Helpers

function getSimpleDimensionStatus(value: number | null | undefined): 'computed' | 'pending' {
  return (value !== null && value !== undefined) ? 'computed' : 'pending';
}

function getComplexDimensionStatus(obj: { status?: string; value?: number | null } | undefined): 'computed' | 'partial' | 'pending' {
  if (!obj) return 'pending';
  if (obj.status === 'computed') return 'computed';
  if (obj.status === 'partial') return 'partial';
  // Fallback: if value is present but status is missing/pending (shouldn't happen with correct types but safety first)
  if (obj.value !== null && obj.value !== undefined && obj.status !== 'pending') return 'computed'; 
  return 'pending';
}

import { LayerStatusMap, LayerState } from './types';

export interface LayerStatusInputs {
  // Maturity
  fgos_maturity: string | null;

  // IFS
  ifs_result: any | null;
  industry_cadence: string;
  missing_horizons_count: number;

  // Growth
  growth_result: any | null;
  
  // Valuation
  valuation_result: any | null;
  sector_available: boolean;
  
  // Industry Performance
  industry_performance_status: string; // 'full' | 'partial' | 'missing'
}

export function buildLayerStatus(inputs: LayerStatusInputs): LayerStatusMap {
  const {
      fgos_maturity,
      ifs_result,
      industry_cadence,
      missing_horizons_count,
      growth_result,
      valuation_result,
      sector_available,
      industry_performance_status
  } = inputs;

  // 1. IFS
  let ifsState: LayerState = 'pending_recalculation';
  let ifsReason: string | undefined;

  if (ifs_result) {
      ifsState = 'computed';
  } else {
      if (!fgos_maturity || fgos_maturity === 'early' || fgos_maturity === 'incomplete') {
          ifsState = 'structurally_unavailable';
          ifsReason = `Maturity '${fgos_maturity || 'unknown'}' insufficient for IFS`;
      } else if (missing_horizons_count > 0) {
           ifsState = 'pending_recalculation';
           ifsReason = `Missing ${missing_horizons_count} required horizons for ${industry_cadence} cadence`;
      } else {
          ifsState = 'pending_recalculation'; // Default fallthrough
          ifsReason = 'Pending recalculation or missing inputs';
      }
  }

  // 2. Fundamentals Growth
  let growthState: LayerState = 'pending_recalculation';
  let growthReason: string | undefined;

  // Check if we have at least one computed CAGR
  const hasGrowth = growth_result && (
      typeof growth_result.revenue_cagr === 'number' || 
      typeof growth_result.earnings_cagr === 'number' || 
      typeof growth_result.fcf_cagr === 'number'
  );

  if (hasGrowth) {
      growthState = 'computed';
  } else {
       if (fgos_maturity === 'early') {
            growthState = 'structurally_unavailable';
            growthReason = 'Early maturity - insufficient history for growth calculation';
       } else {
            growthState = 'pending_recalculation';
            growthReason = 'Insufficient data for growth calculation';
       }
  }

  // 3. Valuation
  let valuationState: LayerState = 'pending_recalculation';
  let valuationReason: string | undefined;

  // Check if valuation is computed (not pending)
  const isValuationComputed = valuation_result && 
                              valuation_result.valuation_status !== 'pending' &&
                              valuation_result.stage !== 'pending';

  if (isValuationComputed) {
      valuationState = 'computed';
  } else {
      if (fgos_maturity === 'early') {
          valuationState = 'structurally_unavailable';
          valuationReason = 'Early maturity - valuation model not applicable';
      } else if (fgos_maturity === 'developing') {
          if (!sector_available) {
              valuationState = 'pending_recalculation';
              valuationReason = 'Missing sector assignment';
          } else {
              valuationState = 'pending_recalculation';
              valuationReason = 'Developing maturity - waiting for sufficient metrics';
          }
      } else {
           valuationState = 'pending_recalculation';
           valuationReason = 'Insufficient valid valuation metrics or missing sector';
      }
  }

  // 4. Industry Performance
  let indPerfState: LayerState = 'pending_recalculation';
  let indPerfReason: string | undefined;

  if (industry_performance_status === 'full') {
      indPerfState = 'computed';
  } else {
      indPerfState = 'pending_recalculation';
      indPerfReason = 'Legacy window set or missing industry data';
  }


  return {
      ifs: {
          state: ifsState,
          version: '1.2',
          blocking_reason: ifsReason
      },
      fundamentals_growth: {
          state: growthState,
          version: '2.0',
          blocking_reason: growthReason
      },
      valuation: {
          state: valuationState,
          blocking_reason: valuationReason
      },
      industry_performance: {
          state: indPerfState,
          blocking_reason: indPerfReason
      }
  };
}

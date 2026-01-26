import { StructuralCoverage } from './types';

export interface CoverageInputs {
  fgos_maturity: string | null;
  industry_cadence: string;
  valid_windows_count: number;
  required_windows_count: number;
  valid_metrics_count: number;
  required_metrics_count: number;
}

export function buildStructuralCoverage(inputs: CoverageInputs): StructuralCoverage {
  const {
    fgos_maturity,
    industry_cadence,
    valid_windows_count,
    required_windows_count,
    valid_metrics_count,
    required_metrics_count
  } = inputs;

  let limiting_factor = 'none';
  let confidence_level: 'low' | 'medium' | 'high' = 'high';

  // Logic to determine confidence and limiting factor

  // 1. Maturity Constraints (Top Priority)
  if (fgos_maturity === 'early') {
    limiting_factor = 'early_stage_maturity';
    confidence_level = 'low';
  }
  else {
      // 2. Metrics Coverage
      const metricsRatio = required_metrics_count > 0 ? valid_metrics_count / required_metrics_count : 1;
      
      // 3. Windows Coverage
      const windowsRatio = required_windows_count > 0 ? valid_windows_count / required_windows_count : 1;

      if (metricsRatio < 0.5) {
          confidence_level = 'low';
          limiting_factor = 'critical_metrics_missing';
      } else if (metricsRatio < 1.0) {
          confidence_level = 'medium';
          limiting_factor = 'partial_metrics_coverage';
      } else if (windowsRatio < 0.5) {
          confidence_level = 'low';
          limiting_factor = 'critical_history_missing';
      } else if (windowsRatio < 1.0) {
          confidence_level = 'medium';
          limiting_factor = 'partial_history_coverage';
      }

      // Developing Cap
      if (fgos_maturity === 'developing' && confidence_level === 'high') {
          confidence_level = 'medium';
          limiting_factor = 'developing_maturity_cap';
      }
  }

  return {
    confidence_level,
    coverage: {
      valid_windows: valid_windows_count,
      required_windows: required_windows_count,
      valid_metrics: valid_metrics_count,
      required_metrics: required_metrics_count
    },
    maturity: fgos_maturity || 'unknown',
    industry_cadence,
    limiting_factor
  };
}

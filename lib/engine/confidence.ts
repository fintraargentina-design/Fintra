
export interface ConfidenceInputs {
  financial_history_years: number;
  years_since_ipo: number;
  earnings_volatility_class: 'LOW' | 'MEDIUM' | 'HIGH';
  missing_core_metrics: number;
}

export interface ConfidenceResult {
  confidence_percent: number;
  confidence_label: 'High' | 'Medium' | 'Low';
  fgos_status: 'Mature' | 'Developing' | 'Early-stage' | 'Incomplete';
  details: {
    history_factor: number;
    ipo_factor: number;
    volatility_factor: number;
    completeness_factor: number;
  };
}

export function calculateConfidenceLayer(inputs: ConfidenceInputs): ConfidenceResult {
  const {
    financial_history_years,
    years_since_ipo,
    earnings_volatility_class,
    missing_core_metrics
  } = inputs;

  // 1. Financial History Factor
  let history_factor = 0.30;
  if (financial_history_years >= 10) history_factor = 1.00;
  else if (financial_history_years >= 7) history_factor = 0.90;
  else if (financial_history_years >= 5) history_factor = 0.75;
  else if (financial_history_years >= 3) history_factor = 0.55;

  // 2. IPO Factor
  let ipo_factor = 0.40;
  if (years_since_ipo >= 5) ipo_factor = 1.00;
  else if (years_since_ipo >= 3) ipo_factor = 0.85;
  else if (years_since_ipo >= 1) ipo_factor = 0.60;

  // 3. Volatility Factor
  let volatility_factor = 0.85; // Default Medium
  if (earnings_volatility_class === 'LOW') volatility_factor = 1.00;
  else if (earnings_volatility_class === 'HIGH') volatility_factor = 0.65;

  // 4. Completeness Factor
  let completeness_factor = 0.65;
  if (missing_core_metrics === 0) completeness_factor = 1.00;
  else if (missing_core_metrics === 1) completeness_factor = 0.85;

  // Calculate Raw Confidence
  const confidence_raw = history_factor * ipo_factor * volatility_factor * completeness_factor;
  const confidence_percent = Math.round(confidence_raw * 100);

  // Label
  let confidence_label: 'High' | 'Medium' | 'Low' = 'Low';
  if (confidence_percent >= 80) confidence_label = 'High';
  else if (confidence_percent >= 50) confidence_label = 'Medium';

  // Status
  let fgos_status: 'Mature' | 'Developing' | 'Early-stage' | 'Incomplete' = 'Early-stage';
  
  // Status Logic Precedence:
  // 1. Incomplete if missing metrics >= 2
  if (missing_core_metrics >= 2) {
    fgos_status = 'Incomplete';
  } else if (confidence_percent >= 80 && financial_history_years >= 7) {
    fgos_status = 'Mature';
  } else if (confidence_percent >= 50) {
    // Note: If confidence >= 80 but history < 7, it falls here (Developing)
    // Or if confidence 50-79
    fgos_status = 'Developing';
  } else {
    fgos_status = 'Early-stage';
  }

  return {
    confidence_percent,
    confidence_label,
    fgos_status,
    details: {
      history_factor,
      ipo_factor,
      volatility_factor,
      completeness_factor
    }
  };
}

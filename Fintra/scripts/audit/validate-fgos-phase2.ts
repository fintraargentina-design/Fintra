import { calculateConfidenceLayer, ConfidenceInputs } from '../lib/engine/confidence';

function runValidation() {
  console.log('🚀 Starting FGOS Phase 2 Validation...\n');

  // Case 1: AAPL-like (Mature, Stable)
  const aaplInputs: ConfidenceInputs = {
    financial_history_years: 10,
    years_since_ipo: 20,
    earnings_volatility_class: 'LOW',
    missing_core_metrics: 0
  };

  const aaplResult = calculateConfidenceLayer(aaplInputs);
  console.log('Case 1: AAPL-like Company');
  console.log('Inputs:', aaplInputs);
  console.log('Result:', aaplResult);
  
  const aaplPass = 
    aaplResult.confidence_percent >= 80 && 
    aaplResult.confidence_label === 'High' && 
    aaplResult.fgos_status === 'Mature';

  console.log('✅ Validation:', aaplPass ? 'PASSED' : 'FAILED');
  console.log('----------------------------------------\n');


  // Case 2: Recent IPO (Volatile, Limited History)
  const ipoInputs: ConfidenceInputs = {
    financial_history_years: 2,
    years_since_ipo: 0.5,
    earnings_volatility_class: 'HIGH',
    missing_core_metrics: 0
  };

  const ipoResult = calculateConfidenceLayer(ipoInputs);
  console.log('Case 2: Recent IPO');
  console.log('Inputs:', ipoInputs);
  console.log('Result:', ipoResult);

  const ipoPass = 
    ipoResult.confidence_percent < 50 && 
    ipoResult.confidence_label === 'Low' && 
    ipoResult.fgos_status === 'Early-stage';

  console.log('✅ Validation:', ipoPass ? 'PASSED' : 'FAILED');
  console.log('----------------------------------------\n');

  // Case 3: Incomplete Data
  const incompleteInputs: ConfidenceInputs = {
    financial_history_years: 5,
    years_since_ipo: 10,
    earnings_volatility_class: 'MEDIUM',
    missing_core_metrics: 2
  };

  const incompleteResult = calculateConfidenceLayer(incompleteInputs);
  console.log('Case 3: Incomplete Data (Missing Metrics)');
  console.log('Inputs:', incompleteInputs);
  console.log('Result:', incompleteResult);

  const incompletePass = incompleteResult.fgos_status === 'Incomplete';

  console.log('✅ Validation:', incompletePass ? 'PASSED' : 'FAILED');
  console.log('----------------------------------------\n');

  if (aaplPass && ipoPass && incompletePass) {
    console.log('🎉 ALL CHECKS PASSED: FGOS Phase 2 Confidence Logic is Sound.');
  } else {
    console.error('❌ SOME CHECKS FAILED.');
    process.exit(1);
  }
}

runValidation();

export type ValuationStatus = 'undervalued' | 'fair' | 'overvalued';

export interface InvestmentVerdict {
  verdict: string;
  category: 'High' | 'Medium' | 'Low';
  valuation: ValuationStatus;
  confidence: 'High' | 'Medium' | 'Low';
}

export function resolveInvestmentVerdict(
  fgosScore: number,
  valuationStatus: ValuationStatus
): InvestmentVerdict {

  let category: 'High' | 'Medium' | 'Low' = 'Medium';

  if (fgosScore >= 60) category = 'High';
  else if (fgosScore < 40) category = 'Low';

  let verdict = 'Neutral';

  if (category === 'High') {
    if (valuationStatus === 'undervalued') verdict = 'Oportunidad clara';
    else if (valuationStatus === 'fair') verdict = 'Buena empresa, esperar mejor precio';
    else verdict = 'Excelente empresa, expectativas exigentes';
  }

  if (category === 'Medium') {
    if (valuationStatus === 'undervalued') verdict = 'Potencial selectivo';
    else if (valuationStatus === 'fair') verdict = 'Neutral';
    else verdict = 'Precio exigente';
  }

  if (category === 'Low') {
    if (valuationStatus === 'undervalued') verdict = 'Barata por una razón';
    else verdict = 'Evitar';
  }

  const confidence =
    category === 'High' && valuationStatus === 'undervalued'
      ? 'High'
      : category === 'Low' && valuationStatus === 'overvalued'
      ? 'High'
      : 'Medium';

  return {
    verdict,
    category,
    valuation: valuationStatus,
    confidence
  };
}

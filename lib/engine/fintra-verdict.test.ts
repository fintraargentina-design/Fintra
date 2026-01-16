import { describe, it, expect } from 'vitest';
import { resolveFintraVerdict, type FintraVerdictInputs } from './fintra-verdict';

describe('resolveFintraVerdict (Fintra Verdict Engine)', () => {
  it('should classify strong business with pessimistic sentiment as exceptional and flag tension', () => {
    const baseInputs: FintraVerdictInputs = {
      fgos: {
        score: 85,
        band: 'strong',
        confidence: 90,
      },
      competitive_advantage: {
        score: 80,
        band: 'strong',
        confidence: 85,
      },
      sentiment: {
        score: null,
        band: 'neutral',
        confidence: 80,
      },
      dividend_quality: {
        score: 80,
        band: 'high',
        confidence: 80,
      },
      relative_return: {
        score: 80,
        band: 'outperformer',
        confidence: 80,
      },
    };

    const highConfidenceResult = resolveFintraVerdict(baseInputs);

    const inputsWithPessimisticSentiment: FintraVerdictInputs = {
      ...baseInputs,
      sentiment: {
        score: null,
        band: 'pessimistic',
        confidence: 80,
      },
    };

    const result = resolveFintraVerdict(inputsWithPessimisticSentiment);

    expect(result.verdict_label).toBe('exceptional');
    expect(result.drivers.positives).toContain('Strong business quality');
    expect(result.drivers.positives).toContain('Strong competitive advantage');
    expect(
      result.drivers.tensions.some((t) =>
        t.toLowerCase().includes('pessimistic sentiment')
      )
    ).toBe(true);

    expect(result.confidence).not.toBeNull();
    expect(highConfidenceResult.confidence).not.toBeNull();
    if (result.confidence !== null && highConfidenceResult.confidence !== null) {
      expect(result.confidence).toBeLessThan(highConfidenceResult.confidence);
    }
  });

  it('should classify weak business with optimistic sentiment as speculative', () => {
    const baseInputs: FintraVerdictInputs = {
      fgos: {
        score: 35,
        band: 'weak',
        confidence: 80,
      },
      sentiment: {
        score: null,
        band: 'neutral',
        confidence: 80,
      },
    };

    const highConfidenceResult = resolveFintraVerdict(baseInputs);

    const speculativeInputs: FintraVerdictInputs = {
      ...baseInputs,
      sentiment: {
        score: null,
        band: 'optimistic',
        confidence: 80,
      },
    };

    const result = resolveFintraVerdict(speculativeInputs);

    expect(result.verdict_label).toBe('speculative');
    expect(result.drivers.negatives).toContain('Weak business quality');
    expect(
      result.drivers.tensions.some((t) =>
        t.toLowerCase().includes('optimistic sentiment')
      )
    ).toBe(true);

    expect(result.confidence).not.toBeNull();
    expect(highConfidenceResult.confidence).not.toBeNull();
    if (result.confidence !== null && highConfidenceResult.confidence !== null) {
      expect(result.confidence).toBeLessThan(highConfidenceResult.confidence);
    }
  });

  it('should capture tension between strong dividends and underperforming returns', () => {
    const baseInputs: FintraVerdictInputs = {
      fgos: {
        score: 55,
        band: 'defendable',
        confidence: 85,
      },
      dividend_quality: {
        score: 80,
        band: 'high',
        confidence: 80,
      },
      relative_return: {
        score: 50,
        band: 'neutral',
        confidence: 80,
      },
      sentiment: {
        score: null,
        band: 'neutral',
        confidence: 80,
      },
    };

    const highConfidenceResult = resolveFintraVerdict(baseInputs);

    const inputsWithUnderperformance: FintraVerdictInputs = {
      ...baseInputs,
      relative_return: {
        score: 40,
        band: 'underperformer',
        confidence: 80,
      },
    };

    const result = resolveFintraVerdict(inputsWithUnderperformance);

    expect(['balanced', 'fragile']).toContain(result.verdict_label);
    expect(result.drivers.positives).toContain('High dividend quality');
    expect(result.drivers.negatives).toContain('Structural underperformance');
    expect(
      result.drivers.tensions.some((t) =>
        t.toLowerCase().includes('poor returns')
      )
    ).toBe(true);

    expect(result.confidence).not.toBeNull();
    expect(highConfidenceResult.confidence).not.toBeNull();
    if (result.confidence !== null && highConfidenceResult.confidence !== null) {
      expect(result.confidence).toBeLessThan(highConfidenceResult.confidence);
    }
  });

  it('should classify mixed average signals as balanced', () => {
    const inputs: FintraVerdictInputs = {
      fgos: {
        score: 60,
        band: 'defendable',
        confidence: 85,
      },
      competitive_advantage: {
        score: 50,
        band: 'weak',
        confidence: 70,
      },
      dividend_quality: {
        score: 60,
        band: 'acceptable',
        confidence: 75,
      },
      relative_return: {
        score: 55,
        band: 'neutral',
        confidence: 75,
      },
      sentiment: {
        score: null,
        band: 'neutral',
        confidence: 80,
      },
    };

    const result = resolveFintraVerdict(inputs);

    expect(result.verdict_label).toBe('balanced');
    expect(result.drivers.positives).toContain('Defendable business quality');
    expect(result.drivers.negatives).toContain('Weak competitive advantage');
    expect(result.drivers.tensions.length).toBe(0);
  });

  it('should return inconclusive when FGOS is missing', () => {
    const inputs: FintraVerdictInputs = {
      fgos: {
        score: null,
        band: null,
        confidence: null,
      },
      sentiment: {
        score: null,
        band: 'neutral',
        confidence: 80,
      },
    } as FintraVerdictInputs;

    const result = resolveFintraVerdict(inputs);

    expect(result.verdict_label).toBe('inconclusive');
    expect(result.verdict_score).toBeNull();
    expect(result.confidence).toBeNull();
    expect(result.drivers.negatives.length).toBeGreaterThan(0);
  });
});


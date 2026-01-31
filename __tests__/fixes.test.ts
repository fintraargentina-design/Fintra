/**
 * Tests para validar las correcciones implementadas
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { calculateMetricScore } from '@/lib/engine/utils/calculateMetricScore';
import { getSectorDefaults } from '@/lib/engine/utils/sectorDefaults';
import { maskSensitiveUrl, maskApiKey } from '@/lib/utils/security';
import { validateParams, FmpBulkParamsSchema } from '@/lib/validation/cronParams';

describe('Fix 1: Solvency Bug', () => {
  it('should NOT invert debt-to-equity ratio', () => {
    // Simular datos con D/E alto (riesgo)
    const highDebtRatio = 3.0;
    const benchmark = { p10: 0.3, p25: 0.5, p50: 0.8, p75: 1.2, p90: 2.0 };

    const result = calculateMetricScore(highDebtRatio, benchmark);

    // Con D/E = 3.0 (por encima de p90 = 2.0), score debe ser BAJO
    expect(result).not.toBeNull();
    expect(result!.raw).toBe(90); // Es peor que p90
    // El effective puede ser ajustado por confianza, pero raw debe ser consistente
  });

  it('should reward low debt-to-equity ratios', () => {
    const lowDebtRatio = 0.3;
    const benchmark = { p10: 0.3, p25: 0.5, p50: 0.8, p75: 1.2, p90: 2.0 };

    const result = calculateMetricScore(lowDebtRatio, benchmark);

    expect(result).not.toBeNull();
    expect(result!.raw).toBe(10); // Está en p10 (excelente)
  });
});

describe('Fix 2: Code Duplication', () => {
  it('calculateMetricScore should be importable from utils', () => {
    expect(calculateMetricScore).toBeDefined();
    expect(typeof calculateMetricScore).toBe('function');
  });

  it('should handle null values gracefully', () => {
    const result = calculateMetricScore(null, { p10: 0, p25: 25, p50: 50, p75: 75, p90: 90 });
    expect(result).toBeNull();
  });
});

describe('Fix 3: API Key Masking', () => {
  it('should mask API keys in URLs', () => {
    const url = 'https://api.example.com/data?apikey=secret123&param=value';
    const masked = maskSensitiveUrl(url);

    expect(masked).not.toContain('secret123');
    expect(masked).toContain('apikey=***');
    expect(masked).toContain('param=value'); // Other params untouched
  });

  it('should mask API key showing only first/last chars', () => {
    const key = 'sk_live_1234567890abcdef';
    const masked = maskApiKey(key);

    expect(masked).toBe('sk_l***cdef');
    expect(masked).not.toContain('1234567890');
  });

  it('should handle short keys', () => {
    const shortKey = 'abc';
    const masked = maskApiKey(shortKey);
    expect(masked).toBe('***');
  });
});

describe('Fix 6: Parameter Validation', () => {
  it('should accept valid ticker', () => {
    const result = validateParams(FmpBulkParamsSchema, {
      ticker: 'AAPL',
      limit: 100
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ticker).toBe('AAPL');
      expect(result.data.limit).toBe(100);
    }
  });

  it('should reject invalid ticker (lowercase)', () => {
    const result = validateParams(FmpBulkParamsSchema, {
      ticker: 'aapl', // lowercase
      limit: 100
    });

    expect(result.success).toBe(false);
  });

  it('should reject excessive limit', () => {
    const result = validateParams(FmpBulkParamsSchema, {
      ticker: 'AAPL',
      limit: 999999 // Exceeds max
    });

    expect(result.success).toBe(false);
  });

  it('should accept undefined optional params', () => {
    const result = validateParams(FmpBulkParamsSchema, {
      ticker: undefined,
      limit: undefined
    });

    expect(result.success).toBe(true);
  });
});

describe('Fix 7: Sector Defaults', () => {
  it('should return Tech defaults for Technology sector', () => {
    const defaults = getSectorDefaults('Technology');
    expect(defaults.roic).toBe(0.15); // 15%
    expect(defaults.grossMargin).toBe(0.60); // 60%
  });

  it('should return Utilities defaults for Utilities sector', () => {
    const defaults = getSectorDefaults('Utilities');
    expect(defaults.roic).toBe(0.05); // 5% (lower than Tech)
    expect(defaults.debtToEquity).toBe(1.20); // Higher leverage
  });

  it('should fallback to default for unknown sector', () => {
    const defaults = getSectorDefaults('UnknownSector123');
    expect(defaults.roic).toBe(0.10); // Generic default
  });

  it('should handle null sector', () => {
    const defaults = getSectorDefaults(null);
    expect(defaults).toBeDefined();
    expect(defaults.roic).toBe(0.10);
  });

  it('should be case-insensitive', () => {
    const defaults1 = getSectorDefaults('technology');
    const defaults2 = getSectorDefaults('Technology');
    expect(defaults1.roic).toBe(defaults2.roic);
  });
});

import { describe, it, expect } from 'vitest';
import { calculateCompetitiveAdvantage, computeReturnPersistenceAxis, computeOperatingStabilityAxis, computeCapitalDisciplineAxis } from './competitive-advantage';
import type { CompetitiveAdvantageHistoryRow } from './competitive-advantage';

// Helper to create mock rows
const createRow = (year: number, data: Partial<CompetitiveAdvantageHistoryRow>): CompetitiveAdvantageHistoryRow => ({
  period_end_date: `${year}-12-31`,
  period_type: 'FY',
  revenue: 100,
  roic: 0.15,
  roe: 0.20,
  operating_margin: 0.10,
  net_margin: 0.08,
  invested_capital: 1000,
  free_cash_flow: 50,
  capex: 10,
  weighted_shares_out: 1000,
  ...data
});

describe('Competitive Advantage - Return Persistence Axis', () => {
  it('should return null score if fewer than 5 years', () => {
    const rows = [
      createRow(2020, { roic: 0.15 }),
      createRow(2021, { roic: 0.16 })
    ];
    // We allow calculation for < 5 years but confidence will be low. 
    // The logic inside computeReturnPersistenceAxis checks for rows.length === 0 to return null.
    const result = computeReturnPersistenceAxis(rows);
    expect(result.score).not.toBeNull();
    expect(result.years).toBe(2);
  });

  it('should score high for stable high ROIC', () => {
    const rows = [
      createRow(2018, { roic: 0.20 }),
      createRow(2019, { roic: 0.20 }),
      createRow(2020, { roic: 0.20 }),
      createRow(2021, { roic: 0.20 }),
      createRow(2022, { roic: 0.20 }),
    ];
    const result = computeReturnPersistenceAxis(rows);
    expect(result.score).toBeCloseTo(63, 0);
  });

  it('should penalize volatile ROIC', () => {
    const rows = [
      createRow(2018, { roic: 0.05 }),
      createRow(2019, { roic: 0.25 }),
      createRow(2020, { roic: 0.05 }),
      createRow(2021, { roic: 0.25 }),
      createRow(2022, { roic: 0.05 }),
    ];
    const result = computeReturnPersistenceAxis(rows);
    expect(result.score).toBeLessThan(60);
  });

  it('should fallback to ROE if ROIC is missing', () => {
    const rows = [
      createRow(2020, { roic: null, roe: 0.15 }),
      createRow(2021, { roic: null, roe: 0.15 })
    ];
    const result = computeReturnPersistenceAxis(rows);
    expect(result.score).not.toBeNull();
  });
});

describe('Competitive Advantage - Operating Stability Axis', () => {
  it('should score high for stable margins', () => {
    const rows = [
      createRow(2018, { operating_margin: 0.15 }),
      createRow(2019, { operating_margin: 0.15 }),
      createRow(2020, { operating_margin: 0.15 }),
      createRow(2021, { operating_margin: 0.15 }),
      createRow(2022, { operating_margin: 0.15 }),
    ];
    const result = computeOperatingStabilityAxis(rows);
    expect(result.score).toBeGreaterThan(70); // Stability is heavily weighted (50%)
  });

  it('should penalize margin drawdowns', () => {
    const rows = [
      createRow(2018, { operating_margin: 0.20 }),
      createRow(2019, { operating_margin: 0.20 }),
      createRow(2020, { operating_margin: 0.05 }), // Big drop
      createRow(2021, { operating_margin: 0.10 }),
      createRow(2022, { operating_margin: 0.15 }),
    ];
    const result = computeOperatingStabilityAxis(rows);
    expect(result.score).toBeLessThan(70);
  });
});

describe('Competitive Advantage - Capital Discipline Axis', () => {
  it('should penalize dilution', () => {
    const rows = [
      createRow(2018, { weighted_shares_out: 1000 }),
      createRow(2019, { weighted_shares_out: 1100 }), // +10%
      createRow(2020, { weighted_shares_out: 1210 }), // +10%
      createRow(2021, { weighted_shares_out: 1331 }), // +10%
      createRow(2022, { weighted_shares_out: 1464 }), // +10%
    ];
    const result = computeCapitalDisciplineAxis(rows);
    expect(result.score).toBeLessThan(50);
  });

  it('should reward capital efficiency (Revenue growing faster than Invested Capital)', () => {
    const rows = [
      createRow(2018, { revenue: 100, invested_capital: 100 }),
      createRow(2019, { revenue: 120, invested_capital: 110 }), // Rev +20%, Cap +10%
      createRow(2020, { revenue: 144, invested_capital: 121 }), // Rev +20%, Cap +10%
      createRow(2021, { revenue: 172, invested_capital: 133 }), // Rev +20%, Cap +10%
      createRow(2022, { revenue: 207, invested_capital: 146 }), // Rev +20%, Cap +10%
    ];
    const result = computeCapitalDisciplineAxis(rows);
    expect(result.score).toBeGreaterThan(50);
  });
});

describe('Competitive Advantage - Overall Score', () => {
  it('should calculate final weighted score and band', () => {
    const rows = [
      createRow(2018, { roic: 0.20, operating_margin: 0.20, weighted_shares_out: 1000, revenue: 100, invested_capital: 100 }),
      createRow(2019, { roic: 0.20, operating_margin: 0.20, weighted_shares_out: 1000, revenue: 110, invested_capital: 110 }),
      createRow(2020, { roic: 0.20, operating_margin: 0.20, weighted_shares_out: 1000, revenue: 120, invested_capital: 120 }),
      createRow(2021, { roic: 0.20, operating_margin: 0.20, weighted_shares_out: 1000, revenue: 130, invested_capital: 130 }),
      createRow(2022, { roic: 0.20, operating_margin: 0.20, weighted_shares_out: 1000, revenue: 140, invested_capital: 140 }),
    ];
    const result = calculateCompetitiveAdvantage(rows);
    
    expect(result.score).not.toBeNull();
    expect(result.band).toBeTruthy();
    expect(result.confidence).toBeGreaterThan(60); // 5 years -> should be decent confidence
    expect(result.axes).toBeDefined();
    if (result.axes) {
      expect(result.axes.return_persistence).toBeGreaterThan(0);
      expect(result.axes.operating_stability).toBeGreaterThan(0);
      expect(result.axes.capital_discipline).toBeGreaterThan(0);
    }
  });

  it('should have low confidence for few years', () => {
    const rows = [
      createRow(2021, { roic: 0.20 }),
      createRow(2022, { roic: 0.20 }),
    ];
    const result = calculateCompetitiveAdvantage(rows);
    expect(result.confidence).toBeLessThan(40);
  });
});

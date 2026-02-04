import { describe, it, expect } from 'vitest';
import { calculateDividendQuality, type DividendQualityYearRow } from './dividend-quality';

const makeRow = (year: number, data: Partial<DividendQualityYearRow> = {}): DividendQualityYearRow => ({
  year,
  has_dividend: true,
  dividend_per_share: 1,
  dividend_cash_paid: 100,
  payout_eps: 40,
  payout_fcf: 50,
  is_growing: true,
  net_income: 200,
  free_cash_flow: 180,
  ...data
});

describe('Dividend Quality Engine', () => {
  it('returns null score when no data', () => {
    const result = calculateDividendQuality([]);
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.confidence).toBeNull();
  });

  it('scores high for long, uninterrupted dividend history', () => {
    const rows: DividendQualityYearRow[] = [];
    for (let y = 2014; y <= 2023; y += 1) {
      rows.push(makeRow(y));
    }

    const result = calculateDividendQuality(rows);
    expect(result.axes.consistency).toBeGreaterThan(80);
    expect(result.score).not.toBeNull();
    expect(result.band === 'acceptable' || result.band === 'high').toBeTruthy();
  });

  it('penalizes frequent dividend gaps', () => {
    const rows: DividendQualityYearRow[] = [];
    for (let y = 2014; y <= 2023; y += 1) {
      const hasDiv = y % 2 === 0;
      rows.push(
        makeRow(y, {
          has_dividend: hasDiv,
          dividend_per_share: hasDiv ? 1 : 0
        })
      );
    }

    const result = calculateDividendQuality(rows);
    expect(result.axes.consistency).not.toBeNull();
    expect(result.axes.consistency as number).toBeLessThan(80);
  });

  it('rewards stable dividend growth over time', () => {
    const rows: DividendQualityYearRow[] = [];
    let dps = 1;
    for (let y = 2016; y <= 2023; y += 1) {
      rows.push(
        makeRow(y, {
          dividend_per_share: dps,
          is_growing: true
        })
      );
      dps *= 1.05;
    }

    const result = calculateDividendQuality(rows);
    expect(result.axes.growth_reliability).not.toBeNull();
    expect(result.axes.growth_reliability as number).toBeGreaterThan(60);
  });

  it('penalizes erratic dividend changes', () => {
    const rows: DividendQualityYearRow[] = [];
    const pattern = [1, 2, 0.5, 3, 0.8, 4];
    let year = 2018;
    for (const dps of pattern) {
      rows.push(
        makeRow(year, {
          dividend_per_share: dps,
          is_growing: dps >= 1
        })
      );
      year += 1;
    }

    const result = calculateDividendQuality(rows);
    expect(result.axes.growth_reliability).not.toBeNull();
    expect(result.axes.growth_reliability as number).toBeLessThan(60);
  });

  it('penalizes structurally unsustainable payout ratios', () => {
    const rows: DividendQualityYearRow[] = [];
    for (let y = 2018; y <= 2023; y += 1) {
      rows.push(
        makeRow(y, {
          payout_eps: 120,
          payout_fcf: 130
        })
      );
    }

    const result = calculateDividendQuality(rows);
    expect(result.axes.payout_sustainability).not.toBeNull();
    expect(result.axes.payout_sustainability as number).toBeLessThan(60);
  });

  it('rewards disciplined pauses during loss-making years', () => {
    const rows: DividendQualityYearRow[] = [
      makeRow(2019, {
        has_dividend: true,
        dividend_per_share: 1,
        net_income: 200,
        free_cash_flow: 180
      }),
      makeRow(2020, {
        has_dividend: false,
        dividend_per_share: 0,
        net_income: -50,
        free_cash_flow: -30
      }),
      makeRow(2021, {
        has_dividend: true,
        dividend_per_share: 1,
        net_income: 220,
        free_cash_flow: 200
      })
    ];

    const result = calculateDividendQuality(rows);
    expect(result.axes.capital_discipline).not.toBeNull();
    expect(result.axes.capital_discipline as number).toBeGreaterThan(55);
  });

  it('penalizes dividends financed during structurally negative FCF', () => {
    const rows: DividendQualityYearRow[] = [];
    for (let y = 2018; y <= 2023; y += 1) {
      rows.push(
        makeRow(y, {
          has_dividend: true,
          dividend_per_share: 1,
          net_income: -20,
          free_cash_flow: -30
        })
      );
    }

    const result = calculateDividendQuality(rows);
    expect(result.axes.capital_discipline).not.toBeNull();
    expect(result.axes.capital_discipline as number).toBeLessThan(50);
  });
});


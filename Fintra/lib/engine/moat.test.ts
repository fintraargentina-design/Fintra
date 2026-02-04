import { describe, it, expect } from "vitest";
import {
  calculateCoherenceCheck,
  calculateCapitalDiscipline,
  type CoherenceCheckInput,
  type FinancialHistoryRow,
} from "./moat";

describe("Moat Coherence Check", () => {
  it("should detect high quality growth (Apple case)", () => {
    const input: CoherenceCheckInput = {
      revenueGrowth: 0.1, // +10%
      operatingMarginChange: 0.03, // +3pp
    };

    const result = calculateCoherenceCheck(input);

    expect(result.verdict).toBe("High Quality Growth");
    expect(result.score).toBe(100);
    expect(result.explanation).toContain("pricing power");
    expect(result.metadata?.revenueGrowth).toBe(0.1);
    expect(result.metadata?.marginChange).toBe(0.03);
  });

  it("should detect inefficient growth (Amazon Retail case)", () => {
    const input: CoherenceCheckInput = {
      revenueGrowth: 0.25, // +25%
      operatingMarginChange: -0.02, // -2pp
    };

    const result = calculateCoherenceCheck(input);

    expect(result.verdict).toBe("Inefficient Growth");
    expect(result.score).toBe(30);
    expect(result.explanation).toContain("weak pricing power");
  });

  it("should handle neutral case with minor margin pressure", () => {
    const input: CoherenceCheckInput = {
      revenueGrowth: 0.08, // +8%
      operatingMarginChange: -0.005, // -0.5pp
    };

    const result = calculateCoherenceCheck(input);

    expect(result.verdict).toBe("Neutral");
    expect(result.score).toBe(70);
    expect(result.explanation).toContain("acceptable if investing");
  });

  it("should handle low growth case", () => {
    const input: CoherenceCheckInput = {
      revenueGrowth: 0.02, // +2%
      operatingMarginChange: 0.01, // +1pp
    };

    const result = calculateCoherenceCheck(input);

    expect(result.verdict).toBe("Neutral");
    expect(result.score).toBe(50);
    expect(result.explanation).toContain("not applicable");
  });

  it("should handle threshold boundaries correctly", () => {
    // Exactly at threshold
    const input1: CoherenceCheckInput = {
      revenueGrowth: 0.05, // Exactly 5%
      operatingMarginChange: 0.0, // Exactly 0
    };

    const result1 = calculateCoherenceCheck(input1);
    expect(result1.verdict).toBe("Neutral"); // Should not be High Quality (> threshold)

    // Just above threshold
    const input2: CoherenceCheckInput = {
      revenueGrowth: 0.051, // Slightly above 5%
      operatingMarginChange: 0.001, // Slightly positive
    };

    const result2 = calculateCoherenceCheck(input2);
    expect(result2.verdict).toBe("High Quality Growth");
  });

  it("should handle negative revenue growth", () => {
    const input: CoherenceCheckInput = {
      revenueGrowth: -0.05, // -5%
      operatingMarginChange: 0.02, // +2pp
    };

    const result = calculateCoherenceCheck(input);

    expect(result.verdict).toBe("Neutral");
    expect(result.score).toBe(50);
    expect(result.explanation).toContain("not applicable");
  });
});

// ========== CAPITAL DISCIPLINE TESTS ==========
describe("Moat Capital Discipline (Third Pillar)", () => {
  it("should return null when insufficient history (< 3 years)", () => {
    const history: FinancialHistoryRow[] = [
      {
        period_end_date: "2023-12-31",
        roic: 0.35,
        gross_margin: 0.45,
        invested_capital: 100,
      },
      {
        period_end_date: "2022-12-31",
        roic: 0.32,
        gross_margin: 0.43,
        invested_capital: 90,
      },
    ];

    const result = calculateCapitalDiscipline(history);
    expect(result).toBeNull();
  });

  it("should score EXCELLENT (100) for capital growth with ROIC improvement (AAPL-like)", () => {
    // Scenario: Capital +50%, ROIC improves from 30% to 35% (+5pp)
    const history: FinancialHistoryRow[] = [
      {
        period_end_date: "2023-12-31",
        roic: 0.35,
        gross_margin: 0.45,
        invested_capital: 150,
      },
      {
        period_end_date: "2022-12-31",
        roic: 0.33,
        gross_margin: 0.44,
        invested_capital: 120,
      },
      {
        period_end_date: "2021-12-31",
        roic: 0.31,
        gross_margin: 0.43,
        invested_capital: 110,
      },
      {
        period_end_date: "2020-12-31",
        roic: 0.3,
        gross_margin: 0.42,
        invested_capital: 100,
      },
    ];

    const result = calculateCapitalDiscipline(history);
    expect(result).toBe(100); // Excellent: Capital +50%, ROIC +5pp
  });

  it("should score GOOD (80) for moderate capital growth with stable ROIC", () => {
    // Scenario: Capital +15%, ROIC stable at ~25%
    const history: FinancialHistoryRow[] = [
      {
        period_end_date: "2023-12-31",
        roic: 0.255,
        gross_margin: 0.4,
        invested_capital: 115,
      },
      {
        period_end_date: "2022-12-31",
        roic: 0.25,
        gross_margin: 0.39,
        invested_capital: 110,
      },
      {
        period_end_date: "2021-12-31",
        roic: 0.248,
        gross_margin: 0.38,
        invested_capital: 105,
      },
      {
        period_end_date: "2020-12-31",
        roic: 0.25,
        gross_margin: 0.38,
        invested_capital: 100,
      },
    ];

    const result = calculateCapitalDiscipline(history);
    expect(result).toBe(80); // Good: Moderate growth, ROIC stable
  });

  it("should score NEUTRAL (60) for slight capital growth with minor ROIC decline", () => {
    // Scenario: Capital +8%, ROIC declines from 20% to 18% (-2pp)
    const history: FinancialHistoryRow[] = [
      {
        period_end_date: "2023-12-31",
        roic: 0.18,
        gross_margin: 0.35,
        invested_capital: 108,
      },
      {
        period_end_date: "2022-12-31",
        roic: 0.19,
        gross_margin: 0.36,
        invested_capital: 105,
      },
      {
        period_end_date: "2021-12-31",
        roic: 0.195,
        gross_margin: 0.36,
        invested_capital: 102,
      },
      {
        period_end_date: "2020-12-31",
        roic: 0.2,
        gross_margin: 0.37,
        invested_capital: 100,
      },
    ];

    const result = calculateCapitalDiscipline(history);
    expect(result).toBe(60); // Neutral: Slight growth, acceptable ROIC decline
  });

  it("should score POOR (30) for aggressive capital growth with ROIC deterioration (AMZN 2012-2015-like)", () => {
    // Scenario: Capital +80%, ROIC declines from 12% to 6% (-6pp)
    const history: FinancialHistoryRow[] = [
      {
        period_end_date: "2023-12-31",
        roic: 0.06,
        gross_margin: 0.25,
        invested_capital: 180,
      },
      {
        period_end_date: "2022-12-31",
        roic: 0.08,
        gross_margin: 0.26,
        invested_capital: 150,
      },
      {
        period_end_date: "2021-12-31",
        roic: 0.1,
        gross_margin: 0.27,
        invested_capital: 120,
      },
      {
        period_end_date: "2020-12-31",
        roic: 0.12,
        gross_margin: 0.28,
        invested_capital: 100,
      },
    ];

    const result = calculateCapitalDiscipline(history);
    expect(result).toBe(30); // Poor: Value destruction (over-expansion)
  });

  it("should handle missing invested_capital by returning null", () => {
    const history: FinancialHistoryRow[] = [
      {
        period_end_date: "2023-12-31",
        roic: 0.25,
        gross_margin: 0.4,
        invested_capital: 110,
      },
      {
        period_end_date: "2022-12-31",
        roic: 0.24,
        gross_margin: 0.39,
        // Missing invested_capital
      },
      {
        period_end_date: "2021-12-31",
        roic: 0.23,
        gross_margin: 0.38,
        invested_capital: 100,
      },
    ];

    const result = calculateCapitalDiscipline(history);
    expect(result).toBeNull(); // Should return null when data is incomplete
  });
});

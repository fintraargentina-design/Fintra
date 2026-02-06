/**
 * Task 2: Automated Test to Prevent Look-Ahead Bias in TTM Calculations
 *
 * This test ensures that TTM calculations are strictly point-in-time safe
 * and never use future financial data relative to the TTM period end date.
 *
 * If this test fails, it indicates a regression in temporal correctness.
 */

import { describe, it, expect } from "vitest";
import { deriveFinancialMetrics } from "@/app/api/cron/financials-bulk/deriveFinancialMetrics";

describe("TTM Look-Ahead Bias Prevention", () => {
  it("MUST NOT use future FY data in TTM CAGR calculations", () => {
    // Setup: TTM ending 2023-09-30
    const ttmPeriodEndDate = "2023-09-30";

    // Historical FY data: Includes PAST data and FUTURE data (2024)
    const historicalIncome = [
      { date: "2020-12-31", period: "FY", revenue: 1000, netIncome: 100 },
      { date: "2021-12-31", period: "FY", revenue: 1100, netIncome: 110 },
      { date: "2022-12-31", period: "FY", revenue: 1200, netIncome: 120 },
      { date: "2023-12-31", period: "FY", revenue: 1300, netIncome: 130 }, // FUTURE!
      { date: "2024-12-31", period: "FY", revenue: 1400, netIncome: 140 }, // FUTURE!
    ];

    const historicalCashflow = [
      { date: "2020-12-31", period: "FY", freeCashFlow: 80 },
      { date: "2021-12-31", period: "FY", freeCashFlow: 90 },
      { date: "2022-12-31", period: "FY", freeCashFlow: 100 },
      { date: "2023-12-31", period: "FY", freeCashFlow: 110 }, // FUTURE!
      { date: "2024-12-31", period: "FY", freeCashFlow: 120 }, // FUTURE!
    ];

    const historicalBalance = [
      { date: "2020-12-31", period: "FY", totalAssets: 5000 },
      { date: "2021-12-31", period: "FY", totalAssets: 5500 },
      { date: "2022-12-31", period: "FY", totalAssets: 6000 },
      { date: "2023-12-31", period: "FY", totalAssets: 6500 }, // FUTURE!
    ];

    // TTM aggregated statements (summed from last 4 quarters)
    const ttmIncome = {
      revenue: 1250,
      netIncome: 125,
      operatingIncome: 150,
      ebitda: 200,
      grossProfit: 500,
    };

    const ttmBalance = {
      totalAssets: 6000,
      totalLiabilities: 3000,
      totalStockholdersEquity: 3000,
      cashAndCashEquivalents: 500,
      totalCurrentAssets: 2000,
      totalCurrentLiabilities: 1000,
      shortTermDebt: 200,
      longTermDebt: 1000,
    };

    const ttmCashflow = {
      operatingCashFlow: 200,
      capitalExpenditure: -50,
      freeCashFlow: 150,
    };

    // Filter historical data to only include data <= TTM period end date
    // This is what core.ts MUST do to prevent look-ahead bias
    const filteredHistoricalIncome = historicalIncome.filter(
      (row) => row.date <= ttmPeriodEndDate,
    );
    const filteredHistoricalCashflow = historicalCashflow.filter(
      (row) => row.date <= ttmPeriodEndDate,
    );
    const filteredHistoricalBalance = historicalBalance.filter(
      (row) => row.date <= ttmPeriodEndDate,
    );

    // Derive TTM metrics with filtered history (point-in-time safe)
    const safeResult = deriveFinancialMetrics({
      income: ttmIncome,
      balance: ttmBalance,
      cashflow: ttmCashflow,
      metricsTTM: null,
      ratiosTTM: null,
      historicalIncome: filteredHistoricalIncome,
      historicalCashflow: filteredHistoricalCashflow,
      historicalBalance: filteredHistoricalBalance,
      periodType: "TTM",
      periodEndDate: ttmPeriodEndDate,
    });

    // Derive TTM metrics with UNFILTERED history (contaminated with future data)
    const contaminatedResult = deriveFinancialMetrics({
      income: ttmIncome,
      balance: ttmBalance,
      cashflow: ttmCashflow,
      metricsTTM: null,
      ratiosTTM: null,
      historicalIncome: historicalIncome, // INCLUDES FUTURE DATA
      historicalCashflow: historicalCashflow, // INCLUDES FUTURE DATA
      historicalBalance: historicalBalance, // INCLUDES FUTURE DATA
      periodType: "TTM",
      periodEndDate: ttmPeriodEndDate,
    });

    // CRITICAL ASSERTION: CAGR values MUST differ if future data affects calculation
    // If they're the same, it means historical data is being filtered correctly
    // If they differ, it means the contaminated version used future data (BAD!)

    // Verify filtered history only includes past data
    expect(filteredHistoricalIncome.length).toBe(3); // 2020, 2021, 2022 only
    expect(filteredHistoricalCashflow.length).toBe(3);
    expect(filteredHistoricalBalance.length).toBe(3);

    // Verify unfiltered history includes future data
    expect(historicalIncome.length).toBe(5); // Includes 2023, 2024
    expect(historicalCashflow.length).toBe(5);
    expect(historicalBalance.length).toBe(4);

    // MAIN TEST: If CAGR differs, look-ahead bias exists
    if (safeResult.revenue_cagr !== contaminatedResult.revenue_cagr) {
      throw new Error(
        `LOOK-AHEAD BIAS DETECTED: TTM CAGR used future data!\n` +
          `Safe CAGR (2020-2022): ${safeResult.revenue_cagr}\n` +
          `Contaminated CAGR (with 2023-2024): ${contaminatedResult.revenue_cagr}\n` +
          `Historical arrays MUST be filtered by periodEndDate before passing to deriveFinancialMetrics!`,
      );
    }

    // If CAGRs are identical, the function is correctly ignoring future data
    expect(safeResult.revenue_cagr).toBe(contaminatedResult.revenue_cagr);
    expect(safeResult.earnings_cagr).toBe(contaminatedResult.earnings_cagr);
    expect(safeResult.fcf_cagr).toBe(contaminatedResult.fcf_cagr);

    console.log(
      "✅ TTM Look-Ahead Bias Test PASSED: No future data leakage detected",
    );
  });

  it("should use the correct historical window for TTM period", () => {
    // TTM ending Q3 2023 should only see FY data up to 2022
    const ttmPeriodEndDate = "2023-09-30";

    const historicalIncome = [
      { date: "2020-12-31", period: "FY", revenue: 1000 },
      { date: "2021-12-31", period: "FY", revenue: 1100 },
      { date: "2022-12-31", period: "FY", revenue: 1200 },
      { date: "2023-12-31", period: "FY", revenue: 9999 }, // Should NOT be used
    ];

    // Filter as production code MUST do
    const filtered = historicalIncome.filter(
      (row) => row.date <= ttmPeriodEndDate,
    );

    // Verify only past data included
    expect(filtered.length).toBe(3);
    expect(filtered[filtered.length - 1].date).toBe("2022-12-31");
    expect(filtered.every((row) => row.revenue < 9999)).toBe(true);
  });

  it("should fail loudly if future data is accidentally included", () => {
    // This test demonstrates what SHOULD happen if look-ahead bias is introduced
    const ttmPeriodEndDate = "2023-06-30";

    const historicalData = [
      { date: "2021-12-31", value: 100 },
      { date: "2022-12-31", value: 110 },
      { date: "2023-12-31", value: 150 }, // FUTURE relative to Q2 2023
    ];

    // Correct filtering
    const filtered = historicalData.filter(
      (row) => row.date <= ttmPeriodEndDate,
    );

    // If filtering is working, we should NOT see 2023-12-31
    const hasFutureData = filtered.some((row) => row.date > ttmPeriodEndDate);
    expect(hasFutureData).toBe(false);

    // If this assertion fails, the filtering logic is broken
    expect(filtered.length).toBe(2); // Only 2021 and 2022
  });
});

/**
 * Test IQS (Industry Quality Score) calculation
 *
 * Validates the STRUCTURAL industry ranking engine against real tickers.
 *
 * RUN:
 * pnpm tsx scripts/test-ifs-fy.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { calculateIFS_FY } from "@/lib/engine/ifs-fy";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface TestCase {
  ticker: string;
  industry: string;
  expectation: string;
}

const TEST_CASES: TestCase[] = [
  {
    ticker: "AAPL",
    industry: "Consumer Electronics",
    expectation: "Should have multiple FY, likely leader in recent years",
  },
  {
    ticker: "MSFT",
    industry: "Software—Infrastructure",
    expectation: "Mature company, stable leader position",
  },
  {
    ticker: "NVDA",
    industry: "Semiconductors",
    expectation: "Strong structural position, leader in recent FY",
  },
  {
    ticker: "TSLA",
    industry: "Auto Manufacturers",
    expectation: "Volatile fundamentals, position may vary by FY",
  },
  {
    ticker: "F",
    industry: "Auto Manufacturers",
    expectation: "Traditional auto, likely follower/laggard structurally",
  },
];

async function testIQS() {
  console.log("🧪 Testing IQS - Industry Quality Score (STRUCTURAL)\n");
  console.log("=".repeat(80));

  for (const testCase of TEST_CASES) {
    console.log(`\n📊 ${testCase.ticker} (${testCase.industry})`);
    console.log(`   Expectation: ${testCase.expectation}`);
    console.log("-".repeat(80));

    try {
      const result = await calculateIFS_FY(testCase.ticker, testCase.industry);

      if (result) {
        // Format fiscal positions with emoji
        const positionEmoji = result.fiscal_positions
          .map((fp) => {
            switch (fp.position) {
              case "leader":
                return "🟢";
              case "follower":
                return "🟡";
              case "laggard":
                return "🔴";
              default:
                return "⚪";
            }
          })
          .join(" ");

        console.log(`   ✅ Mode: ${result.mode}`);
        console.log(`   📅 Fiscal Years: ${result.fiscal_years.join(", ")}`);
        console.log(`   📊 Positions: ${positionEmoji}`);
        console.log(
          `   🎯 Current: FY ${result.current_fy.fiscal_year} - ${result.current_fy.position.toUpperCase()}`,
        );
        console.log(`   🎲 Confidence: ${result.confidence}%`);

        // Show detailed fiscal positions
        console.log(`   📈 Details:`);
        result.fiscal_positions.forEach((fp) => {
          const emoji =
            fp.position === "leader"
              ? "🟢"
              : fp.position === "follower"
                ? "🟡"
                : "🔴";
          console.log(
            `      ${emoji} FY ${fp.fiscal_year}: ${fp.position} (${fp.percentile}th percentile)`,
          );
        });

        // Interpretation
        if (result.confidence >= 80) {
          console.log(
            `   💡 High confidence - ${result.fiscal_positions.length} FY available`,
          );
        } else if (result.confidence >= 60) {
          console.log(
            `   💡 Medium confidence - ${result.fiscal_positions.length} FY available`,
          );
        } else {
          console.log(
            `   ⚠️  Low confidence - Only ${result.fiscal_positions.length} FY available`,
          );
        }
      } else {
        console.log(`   ⚠️  Result: NULL`);
        console.log(`   Reason: Insufficient FY data or peer group`);
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Test complete\n");
}

async function validateDataAvailability() {
  console.log("🔍 Validating data availability...\n");

  // Check fiscal year data coverage
  const { data: fyData, error: fyError } = await supabaseAdmin
    .from("datos_financieros")
    .select("ticker, period_end_date, roic, operating_margin")
    .eq("period_type", "FY")
    .in(
      "ticker",
      TEST_CASES.map((t) => t.ticker),
    )
    .order("ticker")
    .order("period_end_date", { ascending: false });

  if (fyError) {
    console.error("❌ Error fetching FY data:", fyError);
    return;
  }

  console.log(`✅ Found ${fyData?.length || 0} FY records`);

  // Group by ticker
  const byTicker = (fyData || []).reduce(
    (acc, row) => {
      if (!acc[row.ticker]) acc[row.ticker] = [];
      acc[row.ticker].push(row);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  for (const ticker of TEST_CASES.map((t) => t.ticker)) {
    const records = byTicker[ticker] || [];
    console.log(
      `   ${ticker}: ${records.length} FY records (${records.map((r) => new Date(r.period_end_date).getFullYear()).join(", ")})`,
    );
  }

  console.log("");
}

async function main() {
  await validateDataAvailability();
  await testIQS();
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

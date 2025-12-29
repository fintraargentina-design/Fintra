
import { fmp } from "../lib/fmp/client";

async function checkData() {
  const symbol = "AAPL";
  console.log(`Checking data for ${symbol}...`);

  try {
    console.log("--- Ratios TTM (Parent) ---");
    const ratios = await fmp.ratiosTTM(symbol);
    const r = ratios?.[0];
    if (r) {
        console.log("PE:", r.priceEarningsRatioTTM ?? r.priceEarningsRatio);
        console.log("PEG:", r.pegRatioTTM ?? r.pegRatio);
        console.log("Forward PE present?:", "forwardPE" in r || "forwardPe" in r);
        console.log("EV/Sales present?:", "enterpriseValueMultipleTTM" in r); // This is EV/EBITDA usually
    } else {
        console.log("No ratios TTM found");
    }

    console.log("\n--- Key Metrics TTM (Parent) ---");
    const metrics = await fmp.keyMetricsTTM(symbol);
    const k = metrics?.[0];
    if (k) {
        console.log("Revenue Per Share:", k.revenuePerShareTTM);
        console.log("FCF Per Share:", k.freeCashFlowPerShareTTM);
    } else {
        console.log("No metrics TTM found");
    }

    console.log("\n--- Valuation Endpoint (Internal Card) ---");
    // Check what fmp.valuation does. It might be a custom function in lib/fmp/client or just an endpoint wrapper.
    // I need to check lib/fmp/client.ts first to see if it exists and what it does.
    // Assuming it exists based on ValoracionCard.tsx
    try {
        const valuation = await fmp.valuation(symbol, { period: "ttm" });
        console.log("Valuation Result Keys:", Object.keys(valuation));
        console.log("Forward PE:", valuation.forwardPe);
        console.log("EV/Sales:", valuation.evSales);
        console.log("Implied Growth:", valuation.impliedGrowth);
    } catch (e) {
        console.log("Error fetching valuation:", e);
    }

    console.log("\n--- Growth & Cashflow (Fundamental Card Internal) ---");
    const incomeGrowth = await fmp.incomeStatementGrowth(symbol, { period: "annual", limit: 3 });
    console.log("Income Growth Length:", Array.isArray(incomeGrowth) ? incomeGrowth.length : "Not array");
    if (Array.isArray(incomeGrowth) && incomeGrowth.length > 0) {
        console.log("Sample Growth Revenue:", incomeGrowth[0].growthRevenue);
    }

  } catch (err) {
    console.error("Script error:", err);
  }
}

checkData();

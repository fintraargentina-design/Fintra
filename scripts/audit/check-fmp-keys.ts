
import { fmp } from "../lib/fmp/client";

async function checkKeys() {
  const symbol = "AAPL";
  console.log(`Checking keys for ${symbol}...`);

  try {
    const ratios = await fmp.ratios(symbol, { limit: 1 });
    if (ratios && ratios.length > 0) {
        const r = ratios[0];
        console.log("--- Ratios Keys ---");
        console.log("pegRatio:", "pegRatio" in r);
        console.log("priceEarningsToGrowthRatio:", "priceEarningsToGrowthRatio" in r);
        console.log("priceToFreeCashFlowRatio:", "priceToFreeCashFlowRatio" in r);
        console.log("priceToFreeCashFlowsRatio:", "priceToFreeCashFlowsRatio" in r);
        console.log("priceToSalesRatio:", "priceToSalesRatio" in r);
    } else {
        console.log("No ratios found");
    }

    const metrics = await fmp.keyMetrics(symbol, { limit: 1 });
    if (metrics && metrics.length > 0) {
        const m = metrics[0];
        console.log("--- Key Metrics Keys ---");
        console.log("enterpriseValueOverEBITDA:", "enterpriseValueOverEBITDA" in m);
        console.log("evToSales:", "evToSales" in m);
        console.log("enterpriseValueToSales:", "enterpriseValueToSales" in m);
    } else {
        console.log("No metrics found");
    }

  } catch (e) {
    console.error(e);
  }
}

checkKeys();

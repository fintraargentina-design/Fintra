const Papa = require("papaparse");
const fs = require("fs");

const stream = fs.createReadStream("data/fmp-bulk/balance_2023_FY.csv");
let found = false;

Papa.parse(stream, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: true,
  quoteChar: '"',
  transformHeader: (h) => h.replace(/^"|"$/g, ""),
  step: (results) => {
    const row = results.data;
    if (!found && row.symbol && row.symbol.toString().includes("AAPL")) {
      console.log("=== FOUND AAPL ===");
      console.log("Symbol value:", row.symbol);
      console.log("Symbol type:", typeof row.symbol);
      console.log("First 5 keys:", Object.keys(row).slice(0, 5));
      console.log("cashAndCashEquivalents:", row.cashAndCashEquivalents);
      found = true;
    }
  },
  complete: () => {
    console.log("Parse complete. Found AAPL:", found);
  },
});

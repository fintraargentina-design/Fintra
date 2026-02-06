const fs = require("fs");
const readline = require("readline");

const fileStream = fs.createReadStream("data/fmp-bulk/balance_2023_FY.csv");
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity,
});

let lineNumber = 0;
let found = false;

rl.on("line", (line) => {
  lineNumber++;
  if (!found && line.includes("AAPL")) {
    console.log(`Found AAPL at line ${lineNumber}`);
    console.log(`Content: ${line.substring(0, 200)}`);
    found = true;
    rl.close();
  }
});

rl.on("close", () => {
  if (!found) {
    console.log("AAPL not found in file");
  }
  console.log(`Total lines scanned: ${lineNumber}`);
});

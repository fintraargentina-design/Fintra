import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function testFMPHistorical() {
  const API_KEY = process.env.FMP_API_KEY;
  const url = `https://financialmodelingprep.com/api/v3/historical-sectors-performance?limit=2000&apikey=${API_KEY}`;

  console.log("🔍 Testing FMP Historical Sectors Performance API");
  console.log("URL:", url);

  try {
    const response = await fetch(url);

    console.log("\n📊 Response Status:", response.status, response.statusText);

    if (!response.ok) {
      console.error("❌ API Error");
      return;
    }

    const data = await response.json();

    console.log("\n✅ Data received!");
    console.log("Type:", Array.isArray(data) ? "Array" : typeof data);
    console.log("Length:", Array.isArray(data) ? data.length : "N/A");

    if (Array.isArray(data) && data.length > 0) {
      console.log("\n📋 First 3 entries:");
      console.log(JSON.stringify(data.slice(0, 3), null, 2));

      console.log("\n📅 Date range:");
      console.log("First:", data[0]?.date || data[0]);
      console.log(
        "Last:",
        data[data.length - 1]?.date || data[data.length - 1],
      );

      console.log("\n🔑 Keys in first entry:", Object.keys(data[0]));
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

testFMPHistorical().catch(console.error);

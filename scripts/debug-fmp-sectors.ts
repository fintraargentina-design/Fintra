
import 'dotenv/config';

async function main() {
  const apiKey = process.env.FMP_API_KEY;
  console.log('--- Stable Endpoints Probe ---');
  
  const endpoints = [
    'https://financialmodelingprep.com/stable/historical-price-full/XLK',
    'https://financialmodelingprep.com/stable/sector-performance',
    'https://financialmodelingprep.com/stable/sectors-performance',
    'https://financialmodelingprep.com/stable/stock-market-performance',
    'https://financialmodelingprep.com/api/v3/historical-chart/1day/XLK'
  ];

  for (const ep of endpoints) {
    console.log(`Trying ${ep}...`);
    try {
      const res = await fetch(`${ep}?apikey=${apiKey}`);
      const txt = await res.text();
      console.log(`Status: ${res.status}`);
      if (res.status !== 200) {
        console.log('Error:', txt.slice(0, 200));
      } else {
        console.log('Success! Length:', txt.length);
        console.log('Sample:', txt.slice(0, 100));
      }
    } catch (e) { console.error(e); }
  }
}

main();


import 'dotenv/config';

async function main() {
  const apiKey = process.env.FMP_API_KEY;
  console.log('--- FMP Basic Probe ---');
  
  const endpoints = [
    'https://financialmodelingprep.com/api/v3/quote/AAPL',
    'https://financialmodelingprep.com/api/v3/profile/AAPL'
  ];

  for (const ep of endpoints) {
    console.log(`Trying ${ep}...`);
    try {
      const url = `${ep}?apikey=${apiKey}`;
      const res = await fetch(url);
      const txt = await res.text();
      console.log(`Status: ${res.status}`);
      if (res.status !== 200) {
        console.log('Error:', txt.slice(0, 200)); 
      } else {
        console.log('Success! Length:', txt.length);
        console.log('Sample:', txt.slice(0, 200));
      }
    } catch (e) { console.error(e); }
  }
}

main();

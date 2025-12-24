
import { fmpGet } from '@/lib/fmp/server';

async function main() {
  const ticker = 'AAPL';
  console.log(`Probing FMP endpoints for ${ticker}...`);

  const paths = [
    `/api/v3/profile/${ticker}`,
    `/stable/profile?symbol=${ticker}`,
    `/api/v4/profile?symbol=${ticker}`,
    `/api/v4/profile/${ticker}`,
    `/api/v4/company-profile?symbol=${ticker}`
  ];

  for (const path of paths) {
    try {
      console.log(`Trying ${path}...`);
      // fmpGet handles the base URL and API key
      // If path has query params, fmpGet might append apikey correctly if we use the helper correctly.
      // fmpGet(path, query) -> builds url.
      // If path already has ?, fmpGet's buildUrl might be confused?
      // buildUrl: const url = new URL(`${BASE}${ensureLeadingSlash(path)}`);
      // If path is "/stable/profile?symbol=...", new URL(...) works?
      // Yes, usually.
      
      const res = await fmpGet(path);
      console.log(`SUCCESS: ${path}`);
      console.log(JSON.stringify(res).slice(0, 100));
      return; // Found one!
    } catch (e: any) {
      console.log(`FAILED: ${path} - ${e.message}`);
    }
  }
}

main();

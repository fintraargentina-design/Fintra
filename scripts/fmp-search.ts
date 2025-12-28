const apikey = process.env.FMP_API_KEY;
const url = `https://financialmodelingprep.com/api/v3/search?query=NVDA&limit=5&apikey=${apikey}`;
const res = await fetch(url);
const results = await res.json();
console.log(results);
const apikey = process.env.FMP_API_KEY;
const url = `https://financialmodelingprep.com/api/v3/search-name?query=NVIDIA&limit=10&exchange=NASDAQ&apikey=${apikey}`;

(async () => {
    const res = await fetch(url);
    const results = await res.json();
    console.log(results);
})();

export {};

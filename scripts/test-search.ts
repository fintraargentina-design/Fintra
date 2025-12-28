const key = "TaILcO3kt6PWo2VCwbdwIyitPqQ9TxWR";
const symbol = 'AAPL';

async function testEndpoint(name: string, url: string) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.log(`${name} failed: ${res.status}`);
            console.log(await res.text().then(t => t.substring(0, 100)));
        } else {
            console.log(`${name} success!`);
        }
    } catch (e: unknown) {
        console.log(`${name} error:`, (e as Error).message);
    }
}

(async () => {
    await testEndpoint('Search', `https://financialmodelingprep.com/api/v3/search?query=Apple&limit=1&apikey=${key}`);
    await testEndpoint('Profile', `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${key}`);
})();

export {};

const apikey = "TaILcO3kt6PWo2VCwbdwIyitPqQ9TxWR";
const symbol = 'AAPL';

console.log('Testing endpoints for', symbol);

async function testEndpoint(name: string, url: string) {
    try {
        console.log(`Fetching ${name}...`);
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`${name} failed: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error(text.substring(0, 200));
        } else {
            const data = await res.json();
            console.log(`${name} success! Records:`, Array.isArray(data) ? data.length : 'obj');
            if (Array.isArray(data) && data.length > 0) {
                console.log('Sample:', JSON.stringify(data[0]).substring(0, 100));
            }
        }
    } catch (e: unknown) {
        console.error(`${name} error:`, (e as Error).message);
    }
}

(async () => {
    await testEndpoint('Quote', `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${apikey}`);
    await testEndpoint('Quote Short', `https://financialmodelingprep.com/api/v3/quote-short/${symbol}?apikey=${apikey}`);
    await testEndpoint('Profile', `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${apikey}`);
})();

export {};

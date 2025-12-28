const keys = [
    "TaILcO3kt6PWo2VCwbdwIyitPqQ9TxWR",
    "XSxwZjPPBdDM1bYBFWjVPuOLAh8UnSsl",
    "7koziqrXrO2ZxzFxC1nQ6Z4OyTeZ3zPX",
    "CoxPU7bKfCKHpDpSE1pxpVVQ2jGKjZzK"
];
const symbol = 'AAPL';

async function testEndpoint(name: string, url: string) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            // console.error(`${name} failed: ${res.status}`);
            return false;
        } else {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) return true;
            return false;
        }
    } catch (e) {
        return false;
    }
}

(async () => {
    console.log('Testing keys...');
    for (const key of keys) {
        const url = `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${key}`;
        const success = await testEndpoint('Profile', url);
        if (success) {
            console.log(`Key ${key.substring(0, 5)}... works!`);
        } else {
            console.log(`Key ${key.substring(0, 5)}... failed.`);
        }
    }
})();

export {};


import { createFmpClient } from '../lib/fmp/factory';

const apiKey = 'XSxwZjPPBdDM1bYBFWjVPuOLAh8UnSsl';
const baseUrl = 'https://financialmodelingprep.com/api';

const fetcher = async (path: string, opts: any) => {
    const url = `${baseUrl}${path}?apikey=${apiKey}&${new URLSearchParams(opts?.params).toString()}`;
    console.log('Fetching:', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
};

const fmp = createFmpClient(fetcher as any);

async function main() {
    try {
        const tests = [
            { base: 'https://financialmodelingprep.com/api', path: '/v4/stock_peers?symbol=AAPL' },
            { base: 'https://financialmodelingprep.com/api', path: '/v3/profile/AAPL' },
            { base: 'https://financialmodelingprep.com', path: '/stable/stock-peers?symbol=AAPL' }, // Correct stable path?
            { base: 'https://financialmodelingprep.com', path: '/api/v4/stock_peers?symbol=AAPL' },
        ];

        for (const t of tests) {
            console.log(`--- Testing ${t.base}${t.path} ---`);
            const url = `${t.base}${t.path}&apikey=${apiKey}`;
            try {
                const res = await fetch(url);
                if (!res.ok) {
                    console.log(`Failed: ${res.status}`);
                    const txt = await res.text();
                    console.log('Body:', txt.slice(0, 100));
                    continue;
                }
                const json = await res.json();
                console.log('Success:', JSON.stringify(json, null, 2).slice(0, 500));
            } catch (e) {
                console.error('Error:', e);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

main();

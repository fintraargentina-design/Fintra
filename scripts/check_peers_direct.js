const https = require('https');

const API_KEY = 'scYafUs9cEq4PzLVbZ8SPlmMh8r9Jm8V';
const BASE_URL = 'financialmodelingprep.com';
const SYMBOL = 'AAPL';

const endpoints = [
    { path: `/stable/stock-peers?symbol=${SYMBOL}&apikey=${API_KEY}`, label: 'Stable' },
    { path: `/api/v4/stock_peers?symbol=${SYMBOL}&apikey=${API_KEY}`, label: 'V4' },
    { path: `/api/v3/stock_peers?symbol=${SYMBOL}&apikey=${API_KEY}`, label: 'V3' }
];

function fetchUrl(path, label) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: path,
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log(`\n--- ${label} Response (${res.statusCode}) ---`);
                console.log(data.substring(0, 500)); // Print first 500 chars
                resolve(data);
            });
        });

        req.on('error', (error) => {
            console.error(`Error fetching ${label}:`, error);
            resolve(null);
        });

        req.end();
    });
}

async function run() {
    console.log(`Checking peers for ${SYMBOL}...`);
    for (const ep of endpoints) {
        await fetchUrl(ep.path, ep.label);
    }
}

run();

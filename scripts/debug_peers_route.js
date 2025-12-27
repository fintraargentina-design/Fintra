
const https = require('https');

const API_KEY = 'scYafUs9cEq4PzLVbZ8SPlmMh8r9Jm8V';
const BASE_URL = 'financialmodelingprep.com';
const SYMBOL = 'AAPL';

function fetchUrl(path) {
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
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    console.error('JSON parse error', e);
                    resolve(data);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`Error fetching ${path}:`, error);
            resolve(null);
        });

        req.end();
    });
}

// Mimic extractPeers
function extractPeers(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    // v4: [{ peersList: [...] }]
    if (raw.length && Array.isArray(raw[0]?.peersList)) {
      return raw[0].peersList.filter((p) => typeof p === "string");
    }
    // a veces devuelven array de strings
    if (raw.every((x) => typeof x === "string")) {
      return raw;
    }
    
    // NUEVO: Manejar array de objetos con propiedad 'symbol'
    if (raw.length && typeof raw[0] === 'object' && 'symbol' in raw[0]) {
      const result = raw
        .map((obj) => obj.symbol)
        .filter((symbol) => typeof symbol === "string" && symbol.trim().length > 0);
      return result;
    }
    
    // objetos con peersList/peer
    const fromObjs = raw
      .flatMap((o) =>
        Array.isArray(o?.peersList)
          ? o.peersList
          : typeof o?.peer === "string"
          ? [o.peer]
          : []
      )
      .filter((p) => typeof p === "string");
    if (fromObjs.length) return fromObjs;
  } else if (typeof raw === "object") {
    if (Array.isArray(raw.peersList)) {
      return raw.peersList.filter((p) => typeof p === "string");
    }
  }

  return [];
}

async function run() {
    console.log(`Checking peers for ${SYMBOL}...`);
    
    const attempts = [
      { path: `/stable/stock-peers?symbol=${SYMBOL}&apikey=${API_KEY}`, note: "stable/stock-peers" },
      { path: `/api/v4/stock_peers?symbol=${SYMBOL}&apikey=${API_KEY}`, note: "v4/stock_peers" },
      { path: `/api/v3/stock_peers?symbol=${SYMBOL}&apikey=${API_KEY}`, note: "v3/stock_peers" },
    ];

    for (const a of attempts) {
        console.log(`\n--- Trying ${a.note} ---`);
        const raw = await fetchUrl(a.path);
        console.log('Raw response type:', typeof raw);
        console.log('Raw response isArray:', Array.isArray(raw));
        if (Array.isArray(raw) && raw.length > 0) {
            console.log('First item:', JSON.stringify(raw[0]).substring(0, 100));
        } else {
             console.log('Raw response:', JSON.stringify(raw).substring(0, 200));
        }

        const extracted = extractPeers(raw);
        console.log('Extracted peers:', extracted);
    }
}

run();

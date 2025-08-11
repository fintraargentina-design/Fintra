import { API_KEY } from './fmpConfig.js';
import { getMultipleCompanyProfiles, getCompanyProfile } from './fmpCompanyProfiles.js';

export async function getStockPeers(symbol) {
  const url = `https://financialmodelingprep.com/api/v4/stock_peers?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error HTTP peers: ${res.status}`);
  const data = await res.json();
  const peersList = data?.peersList ?? data?.[0]?.peersList ?? [];
  if (!Array.isArray(peersList) || !peersList.length) throw new Error('No se encontraron competidores para el símbolo');
  return peersList.map((s) => ({ symbol: s }));
}

export async function getDetailedStockPeers(symbol, includeProfiles = false) {
  const peers = await getStockPeers(symbol);
  if (!includeProfiles) return { mainSymbol: symbol, peers, totalPeers: peers.length };
  const peerSymbols = peers.map((p) => p.symbol);
  const profiles = await getMultipleCompanyProfiles(peerSymbols);
  const detailedPeers = peers.map((p) => ({ ...p, profile: profiles[p.symbol] ?? null }));
  return { mainSymbol: symbol, peers: detailedPeers, totalPeers: detailedPeers.length, profilesIncluded: true };
}

export async function compareWithPeers(symbol) {
  const mainProfile = await getCompanyProfile(symbol);
  const peersData = await getDetailedStockPeers(symbol, true);
  const validPeers = peersData.peers.filter((p) => p.profile && !p.profile.error);

  if (!validPeers.length) {
    return { mainCompany: mainProfile, peers: [], comparison: null, message: 'No se pudieron obtener datos de competidores' };
  }

  const getNums = (arr, key) =>
    arr.map((x) => Number(x?.profile?.[key])).filter((n) => Number.isFinite(n) && n > 0);

  const mcaps = getNums(validPeers, 'mktCap').concat(getNums(validPeers, 'marketCap'));
  const prices = getNums(validPeers, 'price');
  const betas = validPeers.map((x) => Number(x?.profile?.beta)).filter((n) => Number.isFinite(n));

  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const comparison = {
    marketCap: {
      main: mainProfile.mktCap ?? mainProfile.marketCap ?? 0,
      peerAverage: avg(mcaps),
      peerMax: mcaps.length ? Math.max(...mcaps) : 0,
      peerMin: mcaps.length ? Math.min(...mcaps) : 0,
      ranking: mcaps.filter((cap) => cap > (mainProfile.mktCap ?? mainProfile.marketCap ?? 0)).length + 1,
    },
    price: {
      main: Number(mainProfile.price) || 0,
      peerAverage: avg(prices),
      peerMax: prices.length ? Math.max(...prices) : 0,
      peerMin: prices.length ? Math.min(...prices) : 0,
    },
    beta: {
      main: Number(mainProfile.beta) || 0,
      peerAverage: avg(betas),
      peerMax: betas.length ? Math.max(...betas) : 0,
      peerMin: betas.length ? Math.min(...betas) : 0,
    },
  };

  return { mainCompany: mainProfile, peers: validPeers, comparison, totalPeersAnalyzed: validPeers.length };
}

export function formatPeersForDisplay(peers) {
  return peers.map((peer) => {
    const mcap = peer.mktCap ?? peer.marketCap ?? peer?.profile?.mktCap ?? peer?.profile?.marketCap;
    const price = peer.price ?? peer?.profile?.price;
    return {
      symbol: peer.symbol,
      companyName: peer.companyName ?? peer?.profile?.companyName ?? peer.symbol,
      price,
      marketCap: mcap,
      marketCapFormatted: formatMarketCap(mcap),
      priceFormatted: typeof price === 'number' ? `$${price.toFixed(2)}` : 'N/A',
    };
  });
}

function formatMarketCap(marketCap) {
  if (!Number.isFinite(Number(marketCap)) || !marketCap) return 'N/A';
  const n = Number(marketCap);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
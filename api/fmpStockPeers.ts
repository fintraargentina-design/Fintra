import { API_KEY } from './fmpConfig';
import { getMultipleCompanyProfiles, getCompanyProfile, CompanyProfile } from './fmpCompanyProfiles';

// Interface definitions
interface StockPeer {
  symbol: string;
}

interface DetailedStockPeer extends StockPeer {
  profile?: CompanyProfile | null;
}

interface PeersResponse {
  mainSymbol: string;
  peers: StockPeer[] | DetailedStockPeer[];
  totalPeers: number;
  profilesIncluded?: boolean;
}

interface ComparisonMetric {
  main: number;
  peerAverage: number;
  peerMax: number;
  peerMin: number;
  ranking?: number;
}

interface PeerComparison {
  marketCap: ComparisonMetric;
  price: Omit<ComparisonMetric, 'ranking'>;
  beta: Omit<ComparisonMetric, 'ranking'>;
}

interface CompareWithPeersResult {
  mainCompany: CompanyProfile;
  peers: DetailedStockPeer[];
  comparison: PeerComparison | null;
  totalPeersAnalyzed?: number;
  message?: string;
}

interface FormattedPeer {
  symbol: string;
  companyName: string;
  price: number | undefined;
  marketCap: number | undefined;
  marketCapFormatted: string;
  priceFormatted: string;
}

/**
 * Fetches stock peers for a given symbol
 * @param symbol - The stock symbol to get peers for
 * @returns Promise<StockPeer[]> - Array of peer symbols
 * @throws Error if no peers found or API request fails
 */
export async function getStockPeers(symbol: string): Promise<StockPeer[]> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol must be a non-empty string');
  }

  const url = `https://financialmodelingprep.com/api/v4/stock_peers?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error HTTP peers: ${res.status}`);
    }
    
    const data = await res.json();
    const peersList = data?.peersList ?? data?.[0]?.peersList ?? [];
    
    if (!Array.isArray(peersList) || !peersList.length) {
      throw new Error('No se encontraron competidores para el símbolo');
    }
    
    return peersList.map((s: string) => ({ symbol: s }));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch stock peers');
  }
}

/**
 * Fetches detailed stock peers with optional company profiles
 * @param symbol - The stock symbol to get peers for
 * @param includeProfiles - Whether to include company profiles for peers
 * @returns Promise<PeersResponse> - Detailed peers data
 */
export async function getDetailedStockPeers(
  symbol: string, 
  includeProfiles: boolean = false
): Promise<PeersResponse> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol must be a non-empty string');
  }

  try {
    const peers = await getStockPeers(symbol);
    
    if (!includeProfiles) {
      return {
        mainSymbol: symbol,
        peers,
        totalPeers: peers.length
      };
    }

    const peerSymbols = peers.map((p) => p.symbol);
    const profiles = await getMultipleCompanyProfiles(peerSymbols);
    const detailedPeers: DetailedStockPeer[] = peers.map((p) => ({
      ...p,
      profile: profiles[p.symbol] ?? null
    }));

    return {
      mainSymbol: symbol,
      peers: detailedPeers,
      totalPeers: detailedPeers.length,
      profilesIncluded: true
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch detailed stock peers');
  }
}

/**
 * Compares a company with its peers across various metrics
 * @param symbol - The stock symbol to compare
 * @returns Promise<CompareWithPeersResult> - Comparison results
 */
export async function compareWithPeers(symbol: string): Promise<CompareWithPeersResult> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol must be a non-empty string');
  }

  try {
    const mainProfile = await getCompanyProfile(symbol);
    const peersData = await getDetailedStockPeers(symbol, true);
    const validPeers = (peersData.peers as DetailedStockPeer[]).filter(
      (p) => p.profile && !('error' in p.profile)
    );

    if (!validPeers.length) {
      return {
        mainCompany: mainProfile,
        peers: [],
        comparison: null,
        message: 'No se pudieron obtener datos de competidores'
      };
    }

    const getNums = (arr: DetailedStockPeer[], key: keyof CompanyProfile): number[] =>
      arr.map((x) => Number(x?.profile?.[key]))
         .filter((n) => Number.isFinite(n) && n > 0);

    const mcaps = getNums(validPeers, 'mktCap').concat(getNums(validPeers, 'marketCap'));
    const prices = getNums(validPeers, 'price');
    const betas = validPeers
      .map((x) => Number(x?.profile?.beta))
      .filter((n) => Number.isFinite(n));

    const avg = (xs: number[]): number => 
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

    const mainMarketCap = mainProfile.mktCap ?? mainProfile.marketCap ?? 0;
    
    const comparison: PeerComparison = {
      marketCap: {
        main: mainMarketCap,
        peerAverage: avg(mcaps),
        peerMax: mcaps.length ? Math.max(...mcaps) : 0,
        peerMin: mcaps.length ? Math.min(...mcaps) : 0,
        ranking: mcaps.filter((cap) => cap > mainMarketCap).length + 1,
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

    return {
      mainCompany: mainProfile,
      peers: validPeers,
      comparison,
      totalPeersAnalyzed: validPeers.length
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to compare with peers');
  }
}

/**
 * Formats peers data for display purposes
 * @param peers - Array of peers to format
 * @returns FormattedPeer[] - Formatted peers data
 */
export function formatPeersForDisplay(peers: (StockPeer | DetailedStockPeer)[]): FormattedPeer[] {
  if (!Array.isArray(peers)) {
    throw new Error('Peers must be an array');
  }

  return peers.map((peer) => {
    const detailedPeer = peer as DetailedStockPeer;
    const mcap = detailedPeer.profile?.mktCap ?? 
                 detailedPeer.profile?.marketCap ?? 
                 (peer as any).mktCap ?? 
                 (peer as any).marketCap;
    const price = detailedPeer.profile?.price ?? (peer as any).price;
    
    return {
      symbol: peer.symbol,
      companyName: detailedPeer.profile?.companyName ?? 
                   (peer as any).companyName ?? 
                   peer.symbol,
      price,
      marketCap: mcap,
      marketCapFormatted: formatMarketCap(mcap),
      priceFormatted: typeof price === 'number' ? `$${price.toFixed(2)}` : 'N/A',
    };
  });
}

/**
 * Formats market cap value for display
 * @param marketCap - Market cap value to format
 * @returns string - Formatted market cap string
 */
function formatMarketCap(marketCap: number | undefined): string {
  if (!Number.isFinite(Number(marketCap)) || !marketCap) {
    return 'N/A';
  }
  
  const n = Number(marketCap);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
import { fmpGet } from '@/lib/fmp/server';

// --- Types ---

interface LivePriceData {
  ticker: string;
  price: number;
  as_of: string;
  interval: string;
  source: string;
  stale: boolean;
}

interface CacheEntry {
  data: LivePriceData;
  fetchedAt: number;
  expiresAt: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// --- Configuration ---

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_IP = 60;

// --- In-Memory Stores (Global Singleton Pattern) ---

// We use a global variable to ensure persistence across hot reloads in dev
// In serverless/production, this persists per instance.
const globalStore = global as unknown as {
  _livePriceCache: Map<string, CacheEntry>;
  _livePriceInflight: Map<string, Promise<LivePriceData | null>>;
  _ipRateLimit: Map<string, RateLimitEntry>;
};

if (!globalStore._livePriceCache) {
  globalStore._livePriceCache = new Map();
  globalStore._livePriceInflight = new Map();
  globalStore._ipRateLimit = new Map();
}

const cache = globalStore._livePriceCache;
const inflight = globalStore._livePriceInflight;
const ipLimit = globalStore._ipRateLimit;

// --- Rate Limiting Logic ---

export function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipLimit.get(ip);

  if (!entry) {
    ipLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Reset window
    ipLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_IP) {
    return false;
  }

  entry.count++;
  return true;
}

// --- Data Fetching Logic ---

async function fetchFromFMP(ticker: string): Promise<LivePriceData | null> {
  try {
    // URL: https://financialmodelingprep.com/stable/historical-chart/30min?symbol=XXXX
    // Using fmpGet wrapper
    const data = await fmpGet<any[]>('/stable/historical-chart/30min', { symbol: ticker });

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[LivePrice] Empty response for ${ticker}`);
      return null;
    }

    // Select most recent candle
    const candle = data[0];
    
    // Validate required fields
    if (!candle.date || typeof candle.close !== 'number') {
        console.warn(`[LivePrice] Invalid candle format for ${ticker}`, candle);
        return null;
    }

    return {
      ticker: ticker,
      price: candle.close,
      as_of: candle.date, // already in ISO-like format typically "2025-01-13 14:30:00"
      interval: '30min',
      source: 'fmp_30min',
      stale: false,
    };
  } catch (error) {
    console.error(`[LivePrice] FMP Fetch Error for ${ticker}:`, error);
    return null;
  }
}

// --- Main Service Function ---

export async function getLivePrice(ticker: string): Promise<{ data: LivePriceData | null; error?: string }> {
  const now = Date.now();
  const normalizedTicker = ticker.toUpperCase();

  // 1. Check Cache
  const cached = cache.get(normalizedTicker);

  // If valid cache, return immediately
  if (cached && now < cached.expiresAt) {
    return { data: { ...cached.data, stale: false } };
  }

  // 2. Cache Miss or Expired -> Need Fetch
  // Check if already in flight (deduplication)
  let promise = inflight.get(normalizedTicker);

  if (!promise) {
    promise = fetchFromFMP(normalizedTicker);
    inflight.set(normalizedTicker, promise);
    
    // Cleanup inflight after completion
    promise.finally(() => {
      inflight.delete(normalizedTicker);
    });
  }

  const result = await promise;

  // 3. Handle Result
  if (result) {
    // Success: Update Cache
    cache.set(normalizedTicker, {
      data: result,
      fetchedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    });
    return { data: result };
  } else {
    // Failure: Fallback to stale cache if exists
    if (cached) {
      return { data: { ...cached.data, stale: true } };
    }
    // Failure: No fallback
    return { data: null, error: 'Live price temporarily unavailable' };
  }
}

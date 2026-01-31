import { EnrichedStockData, IFSData } from "./TablaIFS";

const WATCHLIST_MVP = [
  'AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'ADBE', 
  'GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'TMUS', 'VZ', 
  'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'LOW', 
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'PM', 'MO', 
  'JPM', 'BAC', 'V', 'MA', 'BRKC', 'GS', 'MS', 
  'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'PFE', 'TMO', 
  'CAT', 'GE', 'HON', 'UNP', 'UPS', 'BA', 'DE', 
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'OXY', 'MPC', 
  'LIN', 'SHW', 'FCX', 'SCCO', 'NEM', 'DOW', 'APD', 
  'PLD', 'AMT', 'EQIX', 'CCI', 'O', 'SPG', 'PSA', 
  'NEE', 'SO', 'DUK', 'SRE', 'AEP', 'D', 'PEG', 
];

// Helper helpers to generate random data
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min: number, max: number) => Math.random() * (max - min) + min;
const getRandomItem = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const SECTOR_VALUATION_STATUSES = [
  "undervalued", "cheap_sector", 
  "fairly_valued", "fair_sector", 
  "overvalued", "expensive_sector"
];

const FGOS_BANDS = ["strong", "defendable", "weak"];
const FGOS_STATUSES = ["Mature", "Developing", "Incomplete"];
const SENTIMENT_BANDS = ["optimistic", "neutral", "pessimistic"];
const IFS_POSITIONS: IFSData['position'][] = ["leader", "follower", "laggard"];
const STRATEGY_STATES = ["balanced", "speculative", "fragile", "exceptional", "strong"];

export const MOCK_DATA: EnrichedStockData[] = WATCHLIST_MVP.map((ticker) => {
  const fgosScore = getRandomInt(30, 99);
  
  // Correlate band with score somewhat
  let fgosBand = "weak";
  if (fgosScore > 75) fgosBand = "strong";
  else if (fgosScore > 50) fgosBand = "defendable";

  const sectorRankTotal = getRandomInt(20, 100);
  const sectorRank = getRandomInt(1, sectorRankTotal);

  return {
    ticker,
    sectorRank,
    sectorRankTotal,
    sectorValuationStatus: getRandomItem(SECTOR_VALUATION_STATUSES),
    fgosBand,
    fgosScore,
    fgosStatus: getRandomItem(FGOS_STATUSES),
    sentimentBand: getRandomItem(SENTIMENT_BANDS),
    ifs: {
      position: getRandomItem(IFS_POSITIONS),
      yearsInState: getRandomInt(0, 5),
      totalYearsAvailable: 5,
    },
    strategyState: getRandomItem(STRATEGY_STATES),
    priceEod: getRandomFloat(10, 1000),
    ytdReturn: getRandomFloat(-30, 80),
    marketCap: getRandomFloat(10_000_000_000, 3_000_000_000_000), // 10B to 3T
  };
});

// --- Mock Data for BalanceBarChart ---
export const MOCK_BALANCE_HISTORY = {
  years: ['2020', '2021', '2022', '2023', '2024'],
  revenue: [274515000000, 365817000000, 394328000000, 383285000000, 391037000000], // Example (Apple-ish)
  debt: [112436000000, 124719000000, 119927000000, 111088000000, 106229000000],
  netIncome: [55200000000, 64600000000, 68000000000, 66200000000, 67000000000],
};

// --- Mock Data for ChartsTabHistoricos (Price History) ---
const generateMockHistory = (days: number, startPrice: number) => {
  const data = [];
  let currentPrice = startPrice;
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const change = (Math.random() - 0.5) * (currentPrice * 0.05); // +/- 2.5% daily volatility
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * (currentPrice * 0.01);
    const low = Math.min(open, close) - Math.random() * (currentPrice * 0.01);
    const volume = Math.floor(Math.random() * 10000000) + 5000000;
    
    data.push({
      date: date.toISOString().split('T')[0],
      open,
      high,
      low,
      close,
      adjClose: close,
      volume,
      unadjustedVolume: volume,
      change,
      changePercent: (change / open) * 100,
      vwap: (high + low + close) / 3,
      label: date.toISOString().split('T')[0],
      changeOverTime: 0
    });
    
    currentPrice = close;
  }
  return data;
};

export const MOCK_PRICE_HISTORY = generateMockHistory(365 * 2, 150); // 2 years of data

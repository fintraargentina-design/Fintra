import { EnrichedStockData } from "./TablaIFS";

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
const IFS_POSITIONS = ["leader", "follower", "laggard"] as const;
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
      pressure: getRandomInt(0, 9),
    },
    strategyState: getRandomItem(STRATEGY_STATES),
    priceEod: getRandomFloat(10, 1000),
    ytdReturn: getRandomFloat(-30, 80),
    marketCap: getRandomFloat(10_000_000_000, 3_000_000_000_000), // 10B to 3T
  };
});

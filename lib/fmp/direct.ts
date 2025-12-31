// /lib/fmp/direct.ts
import { fmpGet } from "./server";
import { createFmpClient, type GetOpts } from "./factory";

async function directFetcher<T>(path: string, { params = {}, cache }: GetOpts = {}): Promise<T> {
  const { symbol, ...otherParams } = params;

  // Most FMP endpoints require a symbol.
  // For 'Stable' API, symbol is passed as a query parameter usually.
  
  let fmpPath = "";
  let query = { ...otherParams } as Record<string, any>;

  // Helper: require symbol
  const requireSymbol = () => {
    if (!symbol) throw new Error(`Symbol required for direct fetch of ${path}`);
    return symbol;
  };

  switch (path) {
    case "/profile":
      fmpPath = `/stable/profile`;
      query.symbol = requireSymbol();
      break;
      
    case "/ratios-ttm":
      fmpPath = `/stable/ratios-ttm`;
      query.symbol = requireSymbol();
      break;
      
    case "/ratios":
      fmpPath = `/stable/ratios`;
      query.symbol = requireSymbol();
      break;

    case "/key-metrics":
      // Handle scope logic (default to ttm if specified or implied)
      if (query.scope === 'ttm') {
         fmpPath = `/stable/key-metrics-ttm`;
         delete query.scope; 
      } else {
         fmpPath = `/stable/key-metrics`;
      }
      query.symbol = requireSymbol();
      break;

    case "/growth":
      fmpPath = `/stable/financial-growth`;
      query.symbol = requireSymbol();
      break;

    case "/quote":
      fmpPath = `/stable/quote`;
      query.symbol = requireSymbol();
      break;

    case "/cashflow":
      fmpPath = `/stable/cash-flow-statement`;
      query.symbol = requireSymbol();
      break;
      
    case "/balance-sheet-growth":
      fmpPath = `/stable/balance-sheet-statement-growth`;
      query.symbol = requireSymbol();
      break;

    case "/peers":
      // Peers typically uses v4 or stable?
      // Probe showed v4/stable logic in docs.
      // Let's try /stable/stock_peers first, fallback to v4 if needed.
      // Or just stick to v4 if we know it works? Probe didn't test peers.
      // Assuming /stable/stock_peers exists.
      fmpPath = `/stable/stock_peers`;
      query.symbol = requireSymbol();
      break;
      
    case "/peers/detailed":
      console.warn("[fmpDirect] /peers/detailed not fully supported in direct mode yet.");
      fmpPath = `/stable/stock_peers`;
      query.symbol = requireSymbol();
      break;

    case "/price-target-consensus":
      fmpPath = `/v4/price-target-consensus`;
      query.symbol = requireSymbol();
      break;

    default:
      // Fallback generic mapping
      console.warn(`[fmpDirect] Unhandled path mapping: ${path}, trying generic /stable.`);
      if (symbol) {
          fmpPath = `/stable${path}`;
          query.symbol = symbol;
      } else {
          fmpPath = `/stable${path}`;
      }
      break;
  }

  return fmpGet<T>(fmpPath, query);
}

export const fmpDirect = createFmpClient(directFetcher);

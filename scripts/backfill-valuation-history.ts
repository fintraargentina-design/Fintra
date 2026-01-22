
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrBefore);

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

async function backfillValuationHistory(ticker: string) {
  console.log(`\n🚀 Starting valuation backfill for ${ticker}...`);

  // 1. Fetch Profile (for Sector)
  const { data: profile, error: profileError } = await supabase
    .from('fintra_universe')
    .select('sector')
    .eq('ticker', ticker)
    .single();

  if (profileError || !profile) {
    console.error('❌ Error fetching profile/sector:', profileError);
    return;
  }

  const sector = profile.sector;
  if (!sector) {
    console.error('❌ Sector is missing for ticker:', ticker);
    return;
  }

  // 2. Fetch Prices (Daily) - Last 5 years + buffer
  const startDate = dayjs().subtract(6, 'year').format('YYYY-MM-DD');
  
  let allPrices: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: prices, error: priceError } = await supabase
      .from('prices_daily')
      .select('price_date, close, adj_close')
      .eq('ticker', ticker)
      .gte('price_date', startDate)
      .order('price_date', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (priceError) {
      console.error('❌ Error fetching prices:', priceError);
      return;
    }

    if (prices && prices.length > 0) {
      allPrices = allPrices.concat(prices);
      if (prices.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  
  const prices = allPrices; // Alias for compatibility

  if (prices.length === 0) {
    console.warn(`⚠️ No prices found for ${ticker} since ${startDate}`);
    return;
  }

  // 2. Fetch Financials (All types to find shares)
  const { data: financials, error: finError } = await supabase
    .from('datos_financieros')
    .select('*')
    .eq('ticker', ticker)
    .in('period_type', ['TTM', 'FY', 'Q'])
    .order('period_end_date', { ascending: true });

  if (finError) {
    console.error('❌ Error fetching financials:', finError);
    return;
  }

  if (!financials || financials.length === 0) {
    console.warn(`⚠️ No financials found for ${ticker}`);
    return;
  }

  console.log(`Found ${prices.length} prices (from ${prices[0].price_date} to ${prices[prices.length-1].price_date})`);
  console.log(`Found ${financials.length} financials`);

  // Build Shares Timeline (prefer Q/FY, ignore TTM if suspicious)
  // We want a map of date -> shares to interpolate/nearest
  const sharesPoints: { date: string, shares: number }[] = [];
  
  financials.forEach(f => {
    if (f.weighted_shares_out && f.weighted_shares_out > 0) {
      // Crude filter for the TTM sum bug: 
      // If we have other points, and this one is > 3x average, skip?
      // Better: Just prefer Q and FY.
      if (f.period_type === 'Q' || f.period_type === 'FY') {
        sharesPoints.push({ date: f.period_end_date, shares: f.weighted_shares_out });
      }
    }
  });

  // If no Q/FY shares, try TTM but warn
  if (sharesPoints.length === 0) {
    financials.forEach(f => {
      if (f.weighted_shares_out && f.weighted_shares_out > 0) {
        sharesPoints.push({ date: f.period_end_date, shares: f.weighted_shares_out });
      }
    });
  }

  // Sort shares points
  sharesPoints.sort((a, b) => a.date.localeCompare(b.date));

  if (sharesPoints.length > 0) {
    console.log(`Found ${sharesPoints.length} valid share count points. Range: ${sharesPoints[0].shares} - ${sharesPoints[sharesPoints.length-1].shares}`);
  } else {
    console.warn('⚠️ No valid share counts found! Market Cap will be null.');
  }

  // Helper to get shares for a date (nearest)
  const getShares = (date: string): number | null => {
    if (sharesPoints.length === 0) return null;
    // Find closest
    let closest = sharesPoints[0];
    let minDiff = Math.abs(dayjs(date).diff(dayjs(closest.date), 'day'));

    for (let i = 1; i < sharesPoints.length; i++) {
      const diff = Math.abs(dayjs(date).diff(dayjs(sharesPoints[i].date), 'day'));
      if (diff < minDiff) {
        minDiff = diff;
        closest = sharesPoints[i];
      }
    }
    return closest.shares;
  };

  // Find fallback shares (latest available) - Removed as we have timeline now

  // 3. Generate Monthly Snapshots
  // We want to generate a valuation point for the end of every month in the last 5 years
  const snapshots: any[] = [];
  let currentDate = dayjs().subtract(5, 'year').endOf('month');
  const now = dayjs();

  while (currentDate.isSameOrBefore(now)) {
    const dateStr = currentDate.format('YYYY-MM-DD');
    
    // Find Price (latest on or before date)
    // Prices are sorted ascending
    let priceRow = null;
    for (let i = prices.length - 1; i >= 0; i--) {
      if (prices[i].price_date <= dateStr) {
        priceRow = prices[i];
        break;
      }
    }

    // Find Financials (latest report on or before date)
    // Financials are sorted ascending
    let finRow = null;
    // Prefer TTM or FY for denominator
    const validFinancials = financials.filter(f => f.period_end_date <= dateStr && (f.period_type === 'TTM' || f.period_type === 'FY'));
    
    if (validFinancials.length > 0) {
      finRow = validFinancials[validFinancials.length - 1]; // Latest
    }

    if (priceRow && finRow) {
      // Calculate Multiples
      const price = priceRow.adj_close || priceRow.close;
      
      // Safety checks
      if (!price || price <= 0) {
        currentDate = currentDate.add(1, 'month').endOf('month');
        continue;
      }

      // Determine Shares (Use Timeline lookup)
      const shares = getShares(dateStr);

      // MarketCap = Price * Shares
      const marketCap = shares ? price * shares : null;
      
      // Basic Multiples
      // PE = MarketCap / NetIncome (TTM)
      const pe = safeDiv(marketCap, finRow.net_income);
      
      // EV Calculation approximation
      // EV = MarketCap + TotalDebt - Cash
      let ev = null;
      if (marketCap && finRow.total_debt !== undefined && finRow.cash_and_equivalents !== undefined) {
        ev = marketCap + finRow.total_debt - finRow.cash_and_equivalents;
      }

      const evEbitda = (ev && finRow.ebitda) ? ev / finRow.ebitda : null;
      
      // Price to FCF
      // P/FCF = MarketCap / FCF
      const pfcf = (marketCap && finRow.free_cash_flow) ? marketCap / finRow.free_cash_flow : null;
      
      // Price to Sales
      const ps = (marketCap && finRow.revenue) ? marketCap / finRow.revenue : null;

      if (pe || evEbitda || pfcf || ps) {
        snapshots.push({
                  ticker,
                  valuation_date: dateStr,
                  denominator_type: finRow.period_type,
                  denominator_period: finRow.period_label,
                  sector,
                  price,
                  market_cap: marketCap,
          pe_ratio: pe,
          ev_ebitda: evEbitda,
          price_to_fcf: pfcf,
          price_to_sales: ps,
          source: 'backfill_history_calc'
        });
      }
    }

    currentDate = currentDate.add(1, 'month').endOf('month');
  }

  // 4. Upsert
  if (snapshots.length > 0) {
    console.log(`💾 Upserting ${snapshots.length} valuation snapshots for ${ticker}...`);
    
    // Split into chunks of 100
    for (let i = 0; i < snapshots.length; i += 100) {
      const chunk = snapshots.slice(i, i + 100);
      const { error } = await supabase
        .from('datos_valuacion')
        .upsert(chunk, { onConflict: 'ticker,valuation_date,denominator_type,denominator_period' });
      
      if (error) {
        console.error('❌ Error upserting chunk:', error);
      }
    }
    console.log('✅ Done.');
  } else {
    console.log('⚠️ No snapshots generated (missing price or financial overlap).');
  }
}

function safeDiv(num: number | null | undefined, den: number | null | undefined): number | null {
  if (num === null || num === undefined || !den || den === 0) return null;
  return num / den;
}

// CLI Entry point
const targetTicker = process.argv.find(arg => arg.startsWith('--ticker='))?.split('=')[1];
const runAll = process.argv.includes('--all');

async function run() {
  if (targetTicker) {
    await backfillValuationHistory(targetTicker);
  } else if (runAll) {
    console.log('🚀 Starting bulk backfill for ALL active tickers...');
    
    // 1. Fetch all active tickers (with pagination)
    let allTickers: { ticker: string }[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: tickers, error } = await supabase
        .from('fintra_universe')
        .select('ticker')
        .eq('is_active', true)
        .order('ticker')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error fetching universe:', error);
        process.exit(1);
      }

      if (tickers && tickers.length > 0) {
        allTickers = allTickers.concat(tickers);
        if (tickers.length < pageSize) hasMore = false;
        else page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allTickers.length} active tickers.`);

    // 2. Iterate sequentially
    for (let i = 0; i < allTickers.length; i++) {
      const t = allTickers[i];
      console.log(`\n[${i + 1}/${allTickers.length}] Processing ${t.ticker}...`);
      try {
        await backfillValuationHistory(t.ticker);
      } catch (err) {
        console.error(`❌ Unexpected error processing ${t.ticker}:`, err);
        // Continue to next ticker
      }
    }
  } else {
    console.log('Usage:');
    console.log('  Single ticker: npx tsx scripts/backfill-valuation-history.ts --ticker=MSFT');
    console.log('  All tickers:   npx tsx scripts/backfill-valuation-history.ts --all');
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

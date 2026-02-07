import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeFGOS } from "@/lib/engine/fgos-recompute";
import { getBenchmarksForSector } from "@/lib/engine/benchmarks";
import { calculateIFS, type RelativePerformanceInputs } from "@/lib/engine/ifs";
import { fetchFinancialHistory, fetchValuationHistory } from "../fmp-bulk/fetchGrowthData";

const BATCH_SIZE = 50;

interface RecomputeResult {
  ticker: string;
  status: 'computed' | 'pending' | 'error';
  reason?: string;
  fgos_score?: number | null;
}

export async function runRecomputeFGOSBulk(tickers: string[], snapshotDate?: string): Promise<RecomputeResult[]> {
  const date = snapshotDate || new Date().toISOString().slice(0, 10);
  
  if (!tickers.length) return [];

  console.log(`🚀 [FGOS Bulk] Processing ${tickers.length} tickers for ${date}...`);

  // 1. Fetch Snapshots (Vectorized)
  const { data: snapshots, error: snapError } = await supabaseAdmin
    .from("fintra_snapshots")
    .select(`
      ticker,
      snapshot_date,
      sector,
      profile_structural,
      valuation,
      fundamentals_growth,
      relative_vs_sector_1m,
      relative_vs_sector_3m,
      relative_vs_sector_6m,
      relative_vs_sector_1y,
      relative_vs_sector_2y,
      relative_vs_sector_3y,
      relative_vs_sector_5y
    `)
    .in("ticker", tickers)
    .eq("snapshot_date", date);

  if (snapError || !snapshots) {
    console.error("❌ Error fetching snapshots:", snapError);
    return tickers.map(t => ({ ticker: t, status: 'error', reason: 'snapshot_fetch_error' }));
  }

  const snapshotMap = new Map(snapshots.map(s => [s.ticker, s]));

  // 2. Fetch Financial History (Vectorized)
  const historyMap = await fetchFinancialHistory(supabaseAdmin, tickers);

  // 3. Fetch Valuation History (Vectorized)
  const valuationMap = await fetchValuationHistory(supabaseAdmin, tickers);

  // 4. Processing Loop
  const results: RecomputeResult[] = [];
  const updates: any[] = [];

  for (const ticker of tickers) {
    const snap = snapshotMap.get(ticker);
    
    if (!snap) {
      results.push({ ticker, status: 'pending', reason: 'snapshot_not_found' });
      continue;
    }

    // Resolve Sector & Benchmarks
    const sector = (snap as any).sector || (snap as any).profile_structural?.classification?.sector;
    if (!sector) {
      results.push({ ticker, status: 'pending', reason: 'missing_sector' });
      continue;
    }

    // Benchmarks (Cached internally)
    const benchmarks = await getBenchmarksForSector(sector, date, false);
    if (!benchmarks) {
      results.push({ ticker, status: 'pending', reason: 'insufficient_sector_benchmarks' });
      continue;
    }

    // Resolve Financials (In-Memory Filtering)
    const tickerHistory = historyMap.get(ticker) || [];
    
    // Sort descending by date for "Latest" finding
    const sortedHistory = [...tickerHistory].sort((a, b) => 
      new Date(b.period_end_date).getTime() - new Date(a.period_end_date).getTime()
    );

    // Find latest valid financial record (TTM preferred, then FY)
    const financials = sortedHistory.find(row => 
      row.period_end_date <= date && (row.period_type === 'TTM' || row.period_type === 'FY')
    );

    if (!financials) {
      results.push({ ticker, status: 'pending', reason: 'missing_financials_data' });
      continue;
    }

    // Map to Engine Interfaces
    const ratios = {
      symbol: ticker,
      date: date,
      period: "TTM",
      operatingProfitMarginTTM: financials.operating_margin,
      netProfitMarginTTM: financials.net_margin,
      debtEquityRatioTTM: financials.debt_to_equity,
      interestCoverageTTM: financials.interest_coverage,
    } as any;

    const metrics = {
      roicTTM: financials.roic,
      freeCashFlowMarginTTM: financials.fcf_margin,
      altmanZScore: (snap as any).profile_structural?.financial_scores?.altman_z,
      piotroskiScore: (snap as any).profile_structural?.financial_scores?.piotroski_score,
    } as any;

    const growth = (snap as any).fundamentals_growth || {};

    // History for Moat (FY only, Ascending)
    const fyHistory = sortedHistory.filter(row => row.period_type === 'FY');
    const moatHistory = [...fyHistory].sort((a, b) => 
      new Date(a.period_end_date).getTime() - new Date(b.period_end_date).getTime()
    );

    // 1. Earnings Volatility (Requires Ascending History)
    let earnings_volatility_class: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
    const revenueGrowth: number[] = [];
    if (moatHistory.length >= 2) {
        for (let i = 1; i < moatHistory.length; i++) {
            const prev = moatHistory[i - 1].revenue;
            const curr = moatHistory[i].revenue;
            if (prev && curr && prev !== 0) {
                revenueGrowth.push((curr - prev) / Math.abs(prev));
            }
        }
        if (revenueGrowth.length >= 2) {
            const mean = revenueGrowth.reduce((a, b) => a + b, 0) / revenueGrowth.length;
            const variance = revenueGrowth.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / revenueGrowth.length;
            const stdDev = Math.sqrt(variance);
            if (stdDev < 0.15) earnings_volatility_class = "LOW";
            else if (stdDev > 0.4) earnings_volatility_class = "HIGH";
        }
    }

    // 2. Years Since IPO
    let years_since_ipo = 10;
    const profileStruct = (snap as any).profile_structural;
    const ipoDateStr = profileStruct?.ipoDate || profileStruct?.identity?.founded;
    if (ipoDateStr) {
        const ipo = new Date(ipoDateStr);
        const now = new Date();
        if (!isNaN(ipo.getTime())) {
            years_since_ipo = (now.getTime() - ipo.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        }
    }

    // 3. IFS
    const ifsInputs: RelativePerformanceInputs = {
        relative_vs_sector_1m: (snap as any).relative_vs_sector_1m,
        relative_vs_sector_3m: (snap as any).relative_vs_sector_3m,
        relative_vs_sector_6m: (snap as any).relative_vs_sector_6m,
        relative_vs_sector_1y: (snap as any).relative_vs_sector_1y,
        relative_vs_sector_2y: (snap as any).relative_vs_sector_2y,
        relative_vs_sector_3y: (snap as any).relative_vs_sector_3y,
        relative_vs_sector_5y: (snap as any).relative_vs_sector_5y,
    };
    const ifsResult = calculateIFS(ifsInputs);

    // Valuation Timeline
    const tickerValuations = valuationMap.get(ticker) || [];
    tickerValuations.sort((a, b) => new Date(b.valuation_date).getTime() - new Date(a.valuation_date).getTime());
    
    const pickSnapshot = (targetDate: Date) => {
        const targetTime = targetDate.getTime();
        return tickerValuations.find(v => new Date(v.valuation_date).getTime() <= targetTime) || null;
    };

    const snapshotDateObj = new Date(date);
    const minusYears = (base: Date, years: number) => {
        const d = new Date(base.getTime());
        d.setFullYear(d.getFullYear() - years);
        return d;
    };

    const valuationTimeline = {
        TTM: pickSnapshot(snapshotDateObj),
        TTM_1A: pickSnapshot(minusYears(snapshotDateObj, 1)),
        TTM_3A: pickSnapshot(minusYears(snapshotDateObj, 3)),
        TTM_5A: pickSnapshot(minusYears(snapshotDateObj, 5)),
    } as any;

    // Compute FGOS
    const fgosResult = computeFGOS(
        ticker,
        snap as any,
        ratios,
        metrics,
        growth,
        benchmarks,
        {
             financial_history_years: moatHistory.length,
             years_since_ipo: years_since_ipo,
             earnings_volatility_class: earnings_volatility_class,
        } as any, 
        moatHistory,
        valuationTimeline
    );

    // Prepare Update
    updates.push({
        ticker: ticker,
        snapshot_date: date,
        fgos_score: fgosResult.fgos_score,
        fgos_components: fgosResult.fgos_components,
        fgos_category: fgosResult.fgos_category,
        fgos_confidence_percent: fgosResult.fgos_confidence_percent,
        fgos_confidence_label: fgosResult.fgos_confidence_label,
        fgos_status: fgosResult.fgos_status,
        fgos_maturity: fgosResult.fgos_status, // Sync with status
        engine_version: "v3.1-confidence-layer-bulk",
        ifs: ifsResult,
        updated_at: new Date().toISOString()
    });

    results.push({
        ticker,
        status: 'computed',
        fgos_score: fgosResult.fgos_score
    });
  }

  // 5. Bulk Update
  if (updates.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('fintra_snapshots')
        .upsert(updates, { onConflict: 'ticker,snapshot_date' });
        
      if (updateError) {
          console.error("❌ Error performing bulk upsert:", updateError);
      } else {
          console.log(`✅ Updated ${updates.length} snapshots with FGOS.`);
      }
  }

  return results;
}


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

dayjs.extend(utc);
dayjs.extend(timezone);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface StepResult {
  step: number;
  name: string;
  status: 'ok' | 'partial' | 'failed';
  evidence: Record<string, number | string | null>;
}

interface AuditOutput {
  date: string;
  overall_status: 'ok' | 'partial' | 'failed';
  steps: StepResult[];
}

// Helper to get last trading day (skipping weekends)
function resolveAsOfDate(inputDate?: string): string {
  if (inputDate) return inputDate;

  let date = dayjs();
  // If today is Sat (6) or Sun (0), go back to Friday
  while (date.day() === 0 || date.day() === 6) {
    date = date.subtract(1, 'day');
  }
  return date.format('YYYY-MM-DD');
}

async function getUniverseCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('fintra_universe')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  
  if (error) throw error;
  return count || 0;
}

async function main() {
  const args = process.argv.slice(2);
  const inputDate = args[0];
  const asOfDate = resolveAsOfDate(inputDate);

  const steps: StepResult[] = [];

  // --- 1. Sync Universe ---
  try {
    const count = await getUniverseCount();
    steps.push({
      step: 1,
      name: 'Sync Universe',
      status: count > 0 ? 'ok' : 'failed',
      evidence: { count_active: count }
    });
  } catch (e: any) {
    steps.push({ step: 1, name: 'Sync Universe', status: 'failed', evidence: { error: e.message } });
  }

  // --- 2. Industry Classification Sync ---
  try {
    const { data, error } = await supabaseAdmin
      .from('fintra_universe')
      .select('industry, sector');
    
    if (error) throw error;

    const total = data?.length || 0;
    const classified = data?.filter(r => r.industry && r.sector).length || 0;
    const ratio = total > 0 ? classified / total : 0;

    let status: 'ok' | 'partial' | 'failed' = 'failed';
    if (ratio >= 0.9) status = 'ok';
    else if (ratio > 0) status = 'partial';

    steps.push({
      step: 2,
      name: 'Industry Classification Sync',
      status,
      evidence: { classified, total, ratio: parseFloat(ratio.toFixed(4)) }
    });
  } catch (e: any) {
    steps.push({ step: 2, name: 'Industry Classification Sync', status: 'failed', evidence: { error: e.message } });
  }

  // --- 3. Prices Daily Bulk ---
  try {
    const universeCount = (steps[0].evidence.count_active as number) || 0;
    const { count, error } = await supabaseAdmin
      .from('prices_daily')
      .select('*', { count: 'exact', head: true })
      .eq('price_date', asOfDate);

    if (error) throw error;
    
    const c = count || 0;
    const threshold = universeCount * 0.7;

    let status: 'ok' | 'partial' | 'failed' = 'failed';
    if (c >= threshold) status = 'ok';
    else if (c > 0) status = 'partial';

    steps.push({
      step: 3,
      name: 'Prices Daily Bulk',
      status,
      evidence: { count: c, threshold: Math.floor(threshold) }
    });
  } catch (e: any) {
    steps.push({ step: 3, name: 'Prices Daily Bulk', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 4. Financials Bulk (Mapped to datos_financieros) ---
  try {
    const { count, error: countError } = await supabaseAdmin
        .from('datos_financieros')
        .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    const c = count || 0;

    steps.push({
      step: 4,
      name: 'Financials Bulk',
      status: c > 0 ? 'ok' : 'failed',
      evidence: { count_rows: c }
    });
  } catch (e: any) {
    steps.push({ step: 4, name: 'Financials Bulk', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 5. Company Profile Bulk (Mapped to company_profile) ---
  try {
    const { count, error } = await supabaseAdmin
        .from('company_profile')
        .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    const c = count || 0;

    steps.push({
      step: 5,
      name: 'Company Profile Bulk',
      status: c > 0 ? 'ok' : 'failed',
      evidence: { count: c }
    });
  } catch (e: any) {
    steps.push({ step: 5, name: 'Company Profile Bulk', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 6. Industry Performance Aggregator (1D) ---
  try {
    const { count, error } = await supabaseAdmin
        .from('industry_performance')
        .select('*', { count: 'exact', head: true })
        .eq('window_code', '1D')
        .eq('performance_date', asOfDate);

    if (error) throw error;
    const c = count || 0;
    
    let status: 'ok' | 'partial' | 'failed' = 'failed';
    if (c >= 50) status = 'ok';
    else if (c > 0) status = 'partial';

    steps.push({
      step: 6,
      name: 'Industry Performance Aggregator (1D)',
      status,
      evidence: { count: c }
    });
  } catch (e: any) {
    steps.push({ step: 6, name: 'Industry Performance Aggregator (1D)', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 7. Sector Performance Aggregator (1D) ---
  try {
    const { count, error } = await supabaseAdmin
        .from('sector_performance')
        .select('*', { count: 'exact', head: true })
        .eq('window_code', '1D')
        .eq('performance_date', asOfDate);

    if (error) throw error;
    const c = count || 0;

    let status: 'ok' | 'partial' | 'failed' = 'failed';
    if (c >= 11) status = 'ok';
    else if (c > 0) status = 'partial';

    steps.push({
      step: 7,
      name: 'Sector Performance Aggregator (1D)',
      status,
      evidence: { count: c }
    });
  } catch (e: any) {
    steps.push({ step: 7, name: 'Sector Performance Aggregator (1D)', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 8. Sector Performance Windows Aggregator ---
  try {
    const { data, error } = await supabaseAdmin
        .from('sector_performance')
        .select('window_code')
        .eq('performance_date', asOfDate);

    if (error) throw error;
    
    const uniqueWindows = Array.from(new Set(data?.map(d => d.window_code) || []));
    const required = ['1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y'];
    const missing = required.filter(w => !uniqueWindows.includes(w));

    let status: 'ok' | 'partial' | 'failed' = 'ok';
    if (missing.length === required.length) status = 'failed';
    else if (missing.length > 0) status = 'partial';

    steps.push({
      step: 8,
      name: 'Sector Performance Windows Aggregator',
      status,
      evidence: { found: uniqueWindows.length, missing: missing.join(',') }
    });
  } catch (e: any) {
    steps.push({ step: 8, name: 'Sector Performance Windows Aggregator', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 9. Industry Performance Windows Aggregator ---
  try {
    const { count, error } = await supabaseAdmin
        .from('industry_performance')
        .select('*', { count: 'exact', head: true })
        .eq('performance_date', asOfDate)
        .neq('window_code', '1D');

    if (error) throw error;
    const c = count || 0;
    
    const numIndustries = steps[5]?.evidence?.count as number || 0;
    const threshold = numIndustries * 3;
    
    let status: 'ok' | 'partial' | 'failed' = 'failed';
    if (threshold > 0 && c >= threshold) status = 'ok';
    else if (c > 0) status = 'partial';

    steps.push({
      step: 9,
      name: 'Industry Performance Windows Aggregator',
      status,
      evidence: { count: c, threshold, num_industries: numIndustries }
    });
  } catch (e: any) {
    steps.push({ step: 9, name: 'Industry Performance Windows Aggregator', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 10. Sector PE Aggregator ---
  try {
    const { count, error } = await supabaseAdmin
        .from('sector_pe')
        .select('*', { count: 'exact', head: true })
        .eq('pe_date', asOfDate);

    if (error) throw error;
    const c = count || 0;

    let status: 'ok' | 'partial' | 'failed' = 'failed';
    if (c >= 11) status = 'ok';
    else if (c > 0) status = 'partial';

    steps.push({
      step: 10,
      name: 'Sector PE Aggregator',
      status,
      evidence: { count: c }
    });
  } catch (e: any) {
    steps.push({ step: 10, name: 'Sector PE Aggregator', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 11. Industry PE Aggregator ---
  try {
    const { count, error } = await supabaseAdmin
        .from('industry_pe')
        .select('*', { count: 'exact', head: true })
        .eq('pe_date', asOfDate);

    if (error) throw error;
    const c = count || 0;

    let status: 'ok' | 'partial' | 'failed' = 'failed';
    if (c >= 50) status = 'ok';
    else if (c > 0) status = 'partial';

    steps.push({
      step: 11,
      name: 'Industry PE Aggregator',
      status,
      evidence: { count: c }
    });
  } catch (e: any) {
    steps.push({ step: 11, name: 'Industry PE Aggregator', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 12. Sector Benchmarks ---
  try {
    const { count, error } = await supabaseAdmin
        .from('sector_benchmarks')
        .select('*', { count: 'exact', head: true })
        .eq('snapshot_date', asOfDate);

    if (error) throw error;
    const c = count || 0;
    
    const threshold = 11 * 8 * 2; 

    let status: 'ok' | 'partial' | 'failed' = 'failed';
    if (c >= threshold) status = 'ok';
    else if (c > 0) status = 'partial';

    steps.push({
      step: 12,
      name: 'Sector Benchmarks',
      status,
      evidence: { count: c, threshold }
    });
  } catch (e: any) {
    steps.push({ step: 12, name: 'Sector Benchmarks', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 13. Performance Bulk (ticker) ---
  try {
    const { count, error } = await supabaseAdmin
        .from('datos_performance')
        .select('*', { count: 'exact', head: true })
        .eq('performance_date', asOfDate);

    if (error) throw error;
    const c = count || 0;
    
    const universeCount = (steps[0].evidence.count_active as number) || 0;
    const threshold = universeCount * 0.7;

    let status: 'ok' | 'partial' | 'failed' = 'failed';
    if (c >= threshold) status = 'ok';
    else if (c > 0) status = 'partial';

    steps.push({
      step: 13,
      name: 'Performance Bulk (ticker)',
      status,
      evidence: { count: c, threshold: Math.floor(threshold) }
    });
  } catch (e: any) {
    steps.push({ step: 13, name: 'Performance Bulk (ticker)', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 14. Market State Bulk (Mapped to fintra_market_state) ---
  try {
    const { count, error } = await supabaseAdmin
        .from('fintra_market_state')
        .select('*', { count: 'exact', head: true })
        .eq('last_price_date', asOfDate);

    if (error) throw error;
    const c = count || 0;

    steps.push({
      step: 14,
      name: 'Market State Bulk',
      status: c === 1 ? 'ok' : 'failed',
      evidence: { count: c }
    });
  } catch (e: any) {
    steps.push({ step: 14, name: 'Market State Bulk', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 15. Dividends Bulk V2 (Mapped to datos_dividendos) ---
  try {
    // Attempt updated_at first
    let lastUpdate: string | null = null;
    
    const { data: dataUpdated, error: errorUpdated } = await supabaseAdmin
        .from('datos_dividendos')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (!errorUpdated && dataUpdated && dataUpdated.length > 0) {
        lastUpdate = dataUpdated[0].updated_at;
    } else {
        // Fallback to max(year) or just existence check if column missing
        const { count, error: errorCount } = await supabaseAdmin
            .from('datos_dividendos')
            .select('*', { count: 'exact', head: true });
            
        if (errorCount) throw errorCount; // If this fails, table likely missing or inaccessible
        if ((count || 0) > 0) {
            lastUpdate = 'Present (no timestamp)';
        }
    }

    steps.push({
      step: 15,
      name: 'Dividends Bulk V2',
      status: lastUpdate ? 'ok' : 'failed',
      evidence: { last_update: lastUpdate }
    });
  } catch (e: any) {
    steps.push({ step: 15, name: 'Dividends Bulk V2', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- 16. FMP Bulk Snapshots (FINAL STEP) ---
  try {
    const { count, error } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('snapshot_date', asOfDate);

    if (error) throw error;
    const c = count || 0;
    
    const universeCount = (steps[0].evidence.count_active as number) || 0;
    const threshold = universeCount * 0.7;

    let status: 'ok' | 'partial' | 'failed' = 'failed';
    if (c >= threshold) status = 'ok';
    else if (c > 0) status = 'partial';

    steps.push({
      step: 16,
      name: 'FMP Bulk Snapshots',
      status,
      evidence: { count: c, threshold: Math.floor(threshold) }
    });
  } catch (e: any) {
    steps.push({ step: 16, name: 'FMP Bulk Snapshots', status: 'failed', evidence: { error: JSON.stringify(e) } });
  }

  // --- Overall Status ---
  let overall: 'ok' | 'partial' | 'failed' = 'ok';
  if (steps.some(s => s.status === 'failed')) overall = 'failed';
  else if (steps.some(s => s.status === 'partial')) overall = 'partial';

  const output: AuditOutput = {
    date: asOfDate,
    overall_status: overall,
    steps
  };

  // --- Console Output ---
  // Human readable summary to stderr (so stdout is pure JSON)
  console.error(`\n🧪 Fintra Daily Pipeline Audit — ${asOfDate}\n`);
  
  for (const s of steps) {
    let icon = '✔';
    if (s.status === 'partial') icon = '⚠';
    if (s.status === 'failed') icon = '❌';
    
    // Format evidence for display
    let evidenceStr = '';
    if (s.step === 1) evidenceStr = `(${s.evidence.count_active} active)`;
    else if (s.step === 2) evidenceStr = `(${(Number(s.evidence.ratio)*100).toFixed(1)}%)`;
    else if (s.step === 3 || s.step === 6 || s.step === 7 || s.step === 9 || s.step === 10 || s.step === 11 || s.step === 12 || s.step === 13 || s.step === 16) {
        // e.g. (126 rows)
        evidenceStr = `(${s.evidence.count || s.evidence.count_rows || 0} rows)`;
        if (s.evidence.threshold) evidenceStr += ` [target: ${s.evidence.threshold}]`;
    }
    else if (s.step === 8) evidenceStr = s.status === 'ok' ? '(All present)' : `(Missing: ${s.evidence.missing})`;
    else if (s.step === 15) {
        const val = s.evidence.last_update as string;
        evidenceStr = val ? (val.includes('Present') ? `(${val})` : `(${dayjs(val).format('YYYY-MM-DD')})`) : '(None)';
    }

    console.error(` ${icon} ${s.name} ${evidenceStr}`);
  }

  console.error(`\nOVERALL STATUS: ${overall.toUpperCase()}\n`);

  // JSON to stdout
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error('🔥 Fatal Audit Error:', err);
  process.exit(1);
});


import { runSyncUniverse } from '../app/api/cron/sync-universe/core';
import { runPricesDailyBulk } from '../app/api/cron/prices-daily-bulk/core';
import { runFinancialsBulk } from '../app/api/cron/financials-bulk/core';
import { runFmpBulk } from '../app/api/cron/fmp-bulk/core';
import { runValuationBulk } from '../app/api/cron/valuation-bulk/core';
import { runSectorBenchmarks } from '../app/api/cron/sector-benchmarks/core';
import { runPerformanceBulk } from '../app/api/cron/performance-bulk/core';
import { runMarketStateBulk } from '../app/api/cron/market-state-bulk/core';
import '../lib/supabase-admin';

async function runMasterCron() {
    const limit = 3;
    console.log(`🚀 [Debug] Iniciando Master Cron (Limit: ${limit})...`);

    const measure = async (name: string, fn: () => Promise<void>) => {
        console.log(`\n⏳ Iniciando: ${name}...`);
        const start = Date.now();
        try {
            await fn();
            console.log(`✅ ${name} completado en ${Date.now() - start}ms`);
        } catch (e) {
            console.error(`❌ Error en ${name}:`, e);
        }
    };

    await measure('1. Sync Universe', () => runSyncUniverse(undefined, limit));
    await measure('2. Prices Daily', () => runPricesDailyBulk({ limit }));
    await measure('3. Financials', () => runFinancialsBulk(undefined, limit));
    await measure('4. FMP Bulk (Snapshots)', () => runFmpBulk(undefined, limit));
    await measure('5. Valuation', () => runValuationBulk({ debugMode: true, limit }));
    await measure('6. Sector Benchmarks', () => runSectorBenchmarks()); 
    await measure('7. Performance', () => runPerformanceBulk(undefined, limit));
    await measure('8. Market State', () => runMarketStateBulk(undefined, limit));

    console.log('\n🏁 Debug Finalizado.');
}

runMasterCron();

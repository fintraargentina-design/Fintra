import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
	// Dynamic imports to ensure env vars are loaded first
	const { runFinancialsBulk } = await import('@/app/api/cron/financials-bulk/core');
	const { runFmpBulk } = await import('@/app/api/cron/fmp-bulk/core');
	const { recomputeFGOSForTicker } = await import('@/lib/engine/fgos-recompute');
	const { supabaseAdmin } = await import('@/lib/supabase-admin');

    // Parse limit from CLI args, default to 0 (ALL)
	const args = process.argv.slice(2);
	const limitArg = args[0] ? parseInt(args[0], 10) : 0;
	const LIMIT = isNaN(limitArg) ? 0 : limitArg;

	console.log('╔═══════════════════════════════════════════════════════════════╗');
	console.log('║         FIX SOLVENCY/EFFICIENCY - MINIMAL PIPELINE           ║');
	console.log('╚═══════════════════════════════════════════════════════════════╝');
	console.log('');
	console.log(`🎯 Mode: ${LIMIT === 0 ? 'ALL TICKERS' : `LIMIT ${LIMIT}`}`);
	console.log('');

	const startTime = Date.now();

    try {
		// ────────────────────────────────────────────────────────
		// STEP 1: Financials Bulk (Populate interest_coverage)
		// ────────────────────────────────────────────────────────
		console.log('┌─────────────────────────────────────────────────────────────┐');
		console.log('│ STEP 1: FINANCIALS BULK                                     │');
		console.log('│ Populating: interest_coverage, operating_income, ebitda     │');
		console.log('└─────────────────────────────────────────────────────────────┘');
		console.log('⏱️  Expected: 15-30 minutes');
		console.log('');

		const t1 = Date.now();
		const res1 = await runFinancialsBulk(undefined, LIMIT);
		const d1 = ((Date.now() - t1) / 1000 / 60).toFixed(2);

		console.log('');
		console.log('✅ STEP 1 COMPLETED');
		console.log(`   Duration: ${d1} minutes`);
		console.log(`   FY rows: ${res1.stats?.fy_built || 0}`);
		console.log(`   Quarterly: ${res1.stats?.q_built || 0}`);
		console.log(`   TTM: ${res1.stats?.ttm_built || 0}`);
		console.log('');

		// ────────────────────────────────────────────────────────
		// STEP 2: FMP Bulk (Build Snapshots with FGOS)
		// ────────────────────────────────────────────────────────
		console.log('┌─────────────────────────────────────────────────────────────┐');
		console.log('│ STEP 2: FMP BULK (Build Snapshots)                         │');
		console.log('│ Calculating: Solvency, Efficiency, FGOS Score              │');
		console.log('└─────────────────────────────────────────────────────────────┘');
		console.log('⏱️  Expected: 20-40 minutes');
		console.log('');

		const t2 = Date.now();
		const res2 = await runFmpBulk(undefined, LIMIT);
		const d2 = ((Date.now() - t2) / 1000 / 60).toFixed(2);

		console.log('');
		console.log('✅ STEP 2 COMPLETED');
		console.log(`   Duration: ${d2} minutes`);
		console.log(`   Snapshots: ${res2.processed || 0}`);
		console.log('');

		// ────────────────────────────────────────────────────────
		// STEP 3: Recompute FGOS (Final Validation)
		// ────────────────────────────────────────────────────────
		console.log('┌─────────────────────────────────────────────────────────────┐');
		console.log('│ STEP 3: RECOMPUTE FGOS (Final Validation)                  │');
		console.log('│ Ensuring all scores are up-to-date                         │');
		console.log('└─────────────────────────────────────────────────────────────┘');
		console.log('⏱️  Expected: 10-20 minutes');
		console.log('');

		const t3 = Date.now();
		const today = new Date().toISOString().slice(0, 10);

		// Fetch all tickers with snapshots today
		let allTickers: string[] = [];
		let page = 0;
		const PAGE_SIZE = 1000;

		while (true) {
			const { data, error } = await supabaseAdmin
				.from('fintra_snapshots')
				.select('ticker')
				.eq('snapshot_date', today)
				.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

			if (error) {
				console.error('Error fetching snapshots:', error);
				break;
			}

			if (!data || data.length === 0) break;

			data.forEach(d => allTickers.push(d.ticker));

			if (data.length < PAGE_SIZE) break;
			page++;
		}

		console.log(`📋 Found ${allTickers.length} snapshots to recompute`);
		console.log('');

		if (allTickers.length > 0) {
			let success = 0;
			let pending = 0;
			let failed = 0;

			const CHUNK_SIZE = 25;
			const TOTAL = allTickers.length;

			for (let i = 0; i < TOTAL; i += CHUNK_SIZE) {
				const chunk = allTickers.slice(i, i + CHUNK_SIZE);

				await Promise.all(chunk.map(async (ticker) => {
					try {
						const res: any = await recomputeFGOSForTicker(ticker, today);
						const status = res.fgos_status || res.status;
						if (status === 'computed') success++;
						else pending++;
					} catch (err) {
						failed++;
					}
				}));

				const progress = Math.min(i + CHUNK_SIZE, TOTAL);
				const percent = ((progress / TOTAL) * 100).toFixed(1);
				process.stdout.write(`\rProcessing: ${progress}/${TOTAL} (${percent}%) | ✅ ${success} | ⏳ ${pending} | ❌ ${failed}`);
			}

			const d3 = ((Date.now() - t3) / 1000 / 60).toFixed(2);

			console.log('');
			console.log('');
			console.log('✅ STEP 3 COMPLETED');
			console.log(`   Duration: ${d3} minutes`);
			console.log(`   Success: ${success}`);
			console.log(`   Pending: ${pending}`);
			console.log(`   Failed: ${failed}`);
			console.log('');
		} else {
			console.log('⚠️ No snapshots found for recompute');
			console.log('');
		}

		// ────────────────────────────────────────────────────────
		// FINAL SUMMARY
		// ────────────────────────────────────────────────────────
		const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

		console.log('╔═══════════════════════════════════════════════════════════════╗');
		console.log('║                 🎉 PROCESS COMPLETED                          ║');
		console.log('╚═══════════════════════════════════════════════════════════════╝');
		console.log('');
		console.log('✅ Solvency/Efficiency Data Fix Applied Successfully');
		console.log('');
		console.log('⏱️  TIMING:');
		console.log(`   Step 1 (Financials): ${d1} min`);
		console.log(`   Step 2 (Snapshots): ${d2} min`);
		console.log(`   Step 3 (Recompute): ${((Date.now() - t3) / 1000 / 60).toFixed(2)} min`);
		console.log(`   TOTAL: ${totalDuration} min`);
		console.log('');
		console.log('🔍 VALIDATION QUERIES:');
		console.log('');
		console.log('   1. Check interest_coverage:');
		console.log('      SELECT COUNT(*) FROM datos_financieros');
		console.log('      WHERE interest_coverage IS NOT NULL AND period_type = \'TTM\';');
		console.log('');
		console.log('   2. Check Solvency populated:');
		console.log('      SELECT COUNT(*), ROUND(AVG((fgos_components->>\'solvency\')::float), 2)');
		console.log('      FROM fintra_snapshots');
		console.log('      WHERE (fgos_components->>\'solvency\')::float IS NOT NULL');
		console.log('        AND snapshot_date >= \'2024-01-01\';');
		console.log('');
		console.log('   3. Check distribution:');
		console.log('      SELECT');
		console.log('        CASE');
		console.log('          WHEN (fgos_components->>\'solvency\')::float >= 70 THEN \'High\'');
		console.log('          WHEN (fgos_components->>\'solvency\')::float >= 40 THEN \'Medium\'');
		console.log('          ELSE \'Low\'');
		console.log('        END as band, COUNT(*)');
		console.log('      FROM fintra_snapshots');
		console.log('      WHERE (fgos_components->>\'solvency\')::float IS NOT NULL');
		console.log('      GROUP BY 1;');
		console.log('');

    } catch (error) {
        console.error('');
		console.error('╔═══════════════════════════════════════════════════════════════╗');
		console.error('║                    ❌ ERROR OCCURRED                          ║');
		console.error('╚═══════════════════════════════════════════════════════════════╝');
		console.error('');
        console.error('Error:', error);
        process.exit(1);
    }
}

main();

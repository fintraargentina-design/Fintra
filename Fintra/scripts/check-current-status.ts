import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
}

async function main() {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║              VERIFICACIÓN RÁPIDA DEL ESTADO ACTUAL            ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Check 1: Interest Coverage
    const { data: financials } = await supabaseAdmin
        .from('datos_financieros')
        .select('interest_coverage, period_type', { count: 'exact' })
        .eq('period_type', 'TTM');

    const totalFinancials = financials?.length || 0;
    const withCoverage = financials?.filter(f => f.interest_coverage !== null).length || 0;
    const pctCoverage = totalFinancials > 0 ? (withCoverage / totalFinancials * 100).toFixed(2) : '0';

    console.log('📊 DATOS FINANCIEROS (TTM):');
    console.log(`   Total registros: ${totalFinancials.toLocaleString()}`);
    console.log(`   Con interest_coverage: ${withCoverage.toLocaleString()} (${pctCoverage}%)`);
    console.log('');

    if (parseFloat(pctCoverage) >= 80) {
        console.log('✅ Interest Coverage BIEN POBLADO (>80%)');
    } else if (parseFloat(pctCoverage) >= 50) {
        console.log('⚠️  Interest Coverage ACEPTABLE (50-80%)');
    } else {
        console.log('❌ Interest Coverage INSUFICIENTE (<50%)');
    }
    console.log('');

    // Check 2: Snapshots hoy
    const today = new Date().toISOString().slice(0, 10);
    const { data: snapshotsToday } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('ticker, fgos_components', { count: 'exact' })
        .eq('snapshot_date', today);

    const totalToday = snapshotsToday?.length || 0;
    const withSolvencyToday = snapshotsToday?.filter(s => {
        try {
            return s.fgos_components?.solvency !== null && s.fgos_components?.solvency !== undefined;
        } catch { return false; }
    }).length || 0;
    const pctSolvencyToday = totalToday > 0 ? (withSolvencyToday / totalToday * 100).toFixed(2) : '0';

    console.log(`📊 SNAPSHOTS HOY (${today}):`);
    console.log(`   Total snapshots: ${totalToday.toLocaleString()}`);
    console.log(`   Con Solvency: ${withSolvencyToday.toLocaleString()} (${pctSolvencyToday}%)`);
    console.log('');

    if (totalToday === 0) {
        console.log('❌ NO HAY SNAPSHOTS DE HOY - Necesitas ejecutar FMP Bulk');
    } else if (parseFloat(pctSolvencyToday) >= 80) {
        console.log('✅ Solvency BIEN POBLADO (>80%)');
    } else if (parseFloat(pctSolvencyToday) >= 50) {
        console.log('⚠️  Solvency ACEPTABLE (50-80%)');
    } else {
        console.log('❌ Solvency INSUFICIENTE (<50%)');
    }
    console.log('');

    // Check 3: Snapshots recientes (últimos 7 días)
    const { data: snapshotsRecent } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('ticker, fgos_components, snapshot_date', { count: 'exact' })
        .gte('snapshot_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

    const totalRecent = snapshotsRecent?.length || 0;
    const withSolvencyRecent = snapshotsRecent?.filter(s => {
        try {
            return s.fgos_components?.solvency !== null && s.fgos_components?.solvency !== undefined;
        } catch { return false; }
    }).length || 0;
    const pctSolvencyRecent = totalRecent > 0 ? (withSolvencyRecent / totalRecent * 100).toFixed(2) : '0';

    console.log('📊 SNAPSHOTS ÚLTIMOS 7 DÍAS:');
    console.log(`   Total snapshots: ${totalRecent.toLocaleString()}`);
    console.log(`   Con Solvency: ${withSolvencyRecent.toLocaleString()} (${pctSolvencyRecent}%)`);
    console.log('');

    // RESUMEN
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                        RESUMEN                                ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    const needsFinancials = parseFloat(pctCoverage) < 80;
    const needsSnapshots = totalToday === 0 || parseFloat(pctSolvencyToday) < 80;

    if (!needsFinancials && !needsSnapshots) {
        console.log('🎉 TODO ESTÁ BIEN - Sistema listo para producción');
        console.log('');
        console.log('✅ Interest Coverage poblado correctamente');
        console.log('✅ Snapshots de hoy con Solvency calculado');
        console.log('');
        console.log('No necesitas ejecutar nada más.');
    } else {
        console.log('⚠️  ACCIÓN REQUERIDA:');
        console.log('');

        if (needsFinancials) {
            console.log('❌ Paso 1: Ejecutar Financials Bulk');
            console.log('   Comando: npx tsx scripts/pipeline/run-master-cron.ts');
            console.log('   (O solo financials: npx tsx scripts/validation/validate-solvency-fix.ts)');
            console.log('');
        } else {
            console.log('✅ Paso 1: Financials Bulk completado');
            console.log('');
        }

        if (needsSnapshots) {
            console.log('❌ Paso 2: Ejecutar FMP Bulk (Build Snapshots)');
            console.log('   Comando: npx tsx scripts/pipeline/run-master-cron.ts');
            console.log('   Duración estimada: 2-4 horas');
            console.log('');
        } else {
            console.log('✅ Paso 2: FMP Bulk completado');
            console.log('');
        }
    }

    console.log('💡 TIP: Para monitorear en tiempo real, ejecuta:');
    console.log('   npx tsx scripts/pipeline/run-master-cron.ts');
    console.log('   (Verás el output directo en tu terminal)');
    console.log('');
}

main();

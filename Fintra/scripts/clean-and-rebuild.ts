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
    console.log('║           CLEAN & REBUILD - Borrar y Reconstruir             ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    const today = new Date().toISOString().slice(0, 10);

    // Step 1: Verificar cuántos snapshots hay
    const { count: beforeCount } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('snapshot_date', today);

    console.log(`📊 Snapshots actuales para ${today}: ${beforeCount || 0}`);
    console.log('');

    if ((beforeCount || 0) === 0) {
        console.log('✅ No hay snapshots para hoy, no es necesario borrar.');
        console.log('   Puedes proceder directamente a ejecutar FMP Bulk.');
        console.log('');
        return;
    }

    // Step 2: Verificar si hay on-demand recientes que queramos preservar
    const { data: onDemandSnapshots } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('ticker, profile_structural')
        .eq('snapshot_date', today)
        .not('profile_structural', 'is', null);

    const onDemandCount = onDemandSnapshots?.filter(s => {
        try {
            return s.profile_structural?.source === 'on_demand';
        } catch {
            return false;
        }
    }).length || 0;

    if (onDemandCount > 0) {
        console.log(`⚠️  ADVERTENCIA: Hay ${onDemandCount} snapshots on-demand de hoy.`);
        console.log('   Estos fueron creados manualmente y se perderán si borras.');
        console.log('');
        console.log('   Opciones:');
        console.log('   1. Continuar y borrar todo (incluyendo on-demand)');
        console.log('   2. Cancelar y dejar que UPSERT maneje el merge');
        console.log('');
        console.log('   Para continuar con borrado, ejecuta con flag: --force');
        console.log('   Ejemplo: npx tsx scripts/clean-and-rebuild.ts --force');
        console.log('');

        const args = process.argv.slice(2);
        if (!args.includes('--force')) {
            console.log('❌ Cancelado. Usa --force para borrar de todas formas.');
            return;
        }
    }

    // Step 3: Borrar snapshots de hoy
    console.log('🗑️  Borrando snapshots de hoy...');

    const { error: deleteError, count: deletedCount } = await supabaseAdmin
        .from('fintra_snapshots')
        .delete({ count: 'exact' })
        .eq('snapshot_date', today);

    if (deleteError) {
        console.error('❌ Error al borrar snapshots:', deleteError);
        throw deleteError;
    }

    console.log(`✅ Borrados ${deletedCount || 0} snapshots de ${today}`);
    console.log('');

    // Step 4: Verificar que se borraron
    const { count: afterCount } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('snapshot_date', today);

    if ((afterCount || 0) === 0) {
        console.log('✅ Verificación: Snapshots de hoy borrados correctamente');
        console.log('');
        console.log('🚀 PRÓXIMO PASO:');
        console.log('');
        console.log('   Ejecuta FMP Bulk para reconstruir snapshots con Solvency:');
        console.log('');
        console.log('   cd D:\\FintraDeploy\\Fintra');
        console.log('   npx tsx scripts/pipeline/run-master-cron.ts');
        console.log('');
        console.log('   O solo FMP Bulk (más rápido):');
        console.log('   npx tsx -e "import(\'./app/api/cron/fmp-bulk/core.ts\').then(m => m.runFmpBulk())"');
        console.log('');
    } else {
        console.error(`⚠️  ERROR: Aún quedan ${afterCount} snapshots de hoy.`);
        console.log('   Puede ser un problema de permisos o constraint.');
    }
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});

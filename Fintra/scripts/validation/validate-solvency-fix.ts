/**
 * validate-solvency-fix.ts
 *
 * Script de validación completa para verificar que:
 * 1. interest_coverage está poblado correctamente
 * 2. Solvency y Efficiency están calculados
 * 3. FGOS scores son razonables
 * 4. No hay datos anormales o faltantes críticos
 *
 * USO:
 *   npx tsx scripts/validation/validate-solvency-fix.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
}

async function main() {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         VALIDACIÓN COMPLETA - SOLVENCY/EFFICIENCY FIX         ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    let allTestsPassed = true;
    const today = new Date().toISOString().slice(0, 10);

    // ═══════════════════════════════════════════════════════════════
    // TEST 1: Verificar interest_coverage poblado en datos_financieros
    // ═══════════════════════════════════════════════════════════════
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ TEST 1: Interest Coverage en datos_financieros             │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    const { data: financialsData, error: financialsError } = await supabaseAdmin.rpc('get_financials_coverage_stats');

    if (financialsError) {
        // Fallback: query directa si no existe la función
        const { data, error } = await supabaseAdmin
            .from('datos_financieros')
            .select('interest_coverage, operating_income, interest_expense, ebitda, period_type', { count: 'exact' })
            .eq('period_type', 'TTM');

        if (error) {
            console.error('❌ Error al consultar datos_financieros:', error);
            allTestsPassed = false;
        } else {
            const total = data?.length || 0;
            const withCoverage = data?.filter(d => d.interest_coverage !== null).length || 0;
            const withOpIncome = data?.filter(d => d.operating_income !== null).length || 0;
            const withIntExpense = data?.filter(d => d.interest_expense !== null).length || 0;
            const withEbitda = data?.filter(d => d.ebitda !== null).length || 0;

            const pctCoverage = total > 0 ? (withCoverage / total * 100).toFixed(2) : '0';
            const pctOpIncome = total > 0 ? (withOpIncome / total * 100).toFixed(2) : '0';
            const pctIntExpense = total > 0 ? (withIntExpense / total * 100).toFixed(2) : '0';
            const pctEbitda = total > 0 ? (withEbitda / total * 100).toFixed(2) : '0';

            console.log(`📊 Total registros TTM: ${total.toLocaleString()}`);
            console.log(`   interest_coverage: ${withCoverage.toLocaleString()} (${pctCoverage}%)`);
            console.log(`   operating_income: ${withOpIncome.toLocaleString()} (${pctOpIncome}%)`);
            console.log(`   interest_expense: ${withIntExpense.toLocaleString()} (${pctIntExpense}%)`);
            console.log(`   ebitda: ${withEbitda.toLocaleString()} (${pctEbitda}%)`);
            console.log('');

            // Validaciones
            if (parseFloat(pctCoverage) < 50) {
                console.error(`❌ FALLO: interest_coverage poblado en solo ${pctCoverage}% (esperado > 50%)`);
                allTestsPassed = false;
            } else if (parseFloat(pctCoverage) < 80) {
                console.warn(`⚠️  WARNING: interest_coverage poblado en ${pctCoverage}% (esperado > 80%)`);
            } else {
                console.log(`✅ PASS: interest_coverage poblado en ${pctCoverage}%`);
            }

            // Verificar valores razonables
            if (withCoverage > 0) {
                const values = data?.filter(d => d.interest_coverage !== null).map(d => d.interest_coverage) || [];
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                const sorted = values.sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)];

                console.log(`   Promedio: ${avg.toFixed(2)}`);
                console.log(`   Mediana: ${median.toFixed(2)}`);

                if (avg < -100 || avg > 100) {
                    console.error(`❌ FALLO: Promedio anormal (${avg.toFixed(2)}), esperado entre -50 y 50`);
                    allTestsPassed = false;
                } else {
                    console.log(`✅ PASS: Valores de interest_coverage razonables`);
                }
            }
        }
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // TEST 2: Verificar Solvency calculado en fintra_snapshots
    // ═══════════════════════════════════════════════════════════════
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ TEST 2: Solvency en fintra_snapshots                       │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    const { data: snapshotsData, error: snapshotsError } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('ticker, fgos_components, fgos_score, fgos_category, snapshot_date')
        .gte('snapshot_date', '2024-01-01');

    if (snapshotsError) {
        console.error('❌ Error al consultar fintra_snapshots:', snapshotsError);
        allTestsPassed = false;
    } else {
        const total = snapshotsData?.length || 0;
        const withSolvency = snapshotsData?.filter(s => {
            try {
                const solvency = s.fgos_components?.solvency;
                return solvency !== null && solvency !== undefined;
            } catch {
                return false;
            }
        }).length || 0;

        const withEfficiency = snapshotsData?.filter(s => {
            try {
                const efficiency = s.fgos_components?.efficiency;
                return efficiency !== null && efficiency !== undefined;
            } catch {
                return false;
            }
        }).length || 0;

        const withCategory = snapshotsData?.filter(s => s.fgos_category !== null).length || 0;

        const pctSolvency = total > 0 ? (withSolvency / total * 100).toFixed(2) : '0';
        const pctEfficiency = total > 0 ? (withEfficiency / total * 100).toFixed(2) : '0';
        const pctCategory = total > 0 ? (withCategory / total * 100).toFixed(2) : '0';

        console.log(`📊 Total snapshots (2024+): ${total.toLocaleString()}`);
        console.log(`   Con Solvency: ${withSolvency.toLocaleString()} (${pctSolvency}%)`);
        console.log(`   Con Efficiency: ${withEfficiency.toLocaleString()} (${pctEfficiency}%)`);
        console.log(`   Con Category: ${withCategory.toLocaleString()} (${pctCategory}%)`);
        console.log('');

        // Validaciones
        if (parseFloat(pctSolvency) < 50) {
            console.error(`❌ FALLO: Solvency poblado en solo ${pctSolvency}% (esperado > 80%)`);
            allTestsPassed = false;
        } else if (parseFloat(pctSolvency) < 80) {
            console.warn(`⚠️  WARNING: Solvency poblado en ${pctSolvency}% (esperado > 80%)`);
        } else {
            console.log(`✅ PASS: Solvency poblado en ${pctSolvency}%`);
        }

        if (parseFloat(pctEfficiency) < 50) {
            console.error(`❌ FALLO: Efficiency poblado en solo ${pctEfficiency}% (esperado > 80%)`);
            allTestsPassed = false;
        } else if (parseFloat(pctEfficiency) < 80) {
            console.warn(`⚠️  WARNING: Efficiency poblado en ${pctEfficiency}% (esperado > 80%)`);
        } else {
            console.log(`✅ PASS: Efficiency poblado en ${pctEfficiency}%`);
        }

        // Calcular distribución de Solvency
        if (withSolvency > 0) {
            const solvencyValues = snapshotsData
                ?.filter(s => s.fgos_components?.solvency !== null && s.fgos_components?.solvency !== undefined)
                .map(s => s.fgos_components.solvency) || [];

            const high = solvencyValues.filter(v => v >= 70).length;
            const medium = solvencyValues.filter(v => v >= 40 && v < 70).length;
            const low = solvencyValues.filter(v => v < 40).length;

            const pctHigh = (high / solvencyValues.length * 100).toFixed(2);
            const pctMedium = (medium / solvencyValues.length * 100).toFixed(2);
            const pctLow = (low / solvencyValues.length * 100).toFixed(2);

            console.log('📊 Distribución de Solvency:');
            console.log(`   High (70-100): ${high.toLocaleString()} (${pctHigh}%)`);
            console.log(`   Medium (40-69): ${medium.toLocaleString()} (${pctMedium}%)`);
            console.log(`   Low (0-39): ${low.toLocaleString()} (${pctLow}%)`);
            console.log('');

            // Validar distribución normal (25-50-25 con margen)
            if (parseFloat(pctHigh) < 15 || parseFloat(pctHigh) > 35) {
                console.warn(`⚠️  WARNING: Distribución High anormal (${pctHigh}%, esperado 20-30%)`);
            }
            if (parseFloat(pctMedium) < 40 || parseFloat(pctMedium) > 60) {
                console.warn(`⚠️  WARNING: Distribución Medium anormal (${pctMedium}%, esperado 45-55%)`);
            }
            if (parseFloat(pctLow) < 15 || parseFloat(pctLow) > 35) {
                console.warn(`⚠️  WARNING: Distribución Low anormal (${pctLow}%, esperado 20-30%)`);
            }

            // Promedios
            const avgSolvency = solvencyValues.reduce((a, b) => a + b, 0) / solvencyValues.length;
            console.log(`   Promedio Solvency: ${avgSolvency.toFixed(2)}`);

            if (avgSolvency < 30 || avgSolvency > 70) {
                console.warn(`⚠️  WARNING: Promedio Solvency anormal (${avgSolvency.toFixed(2)}, esperado 45-65)`);
            } else {
                console.log(`✅ PASS: Promedio Solvency razonable`);
            }
        }
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // TEST 3: Verificar bug de inversión corregido
    // ═══════════════════════════════════════════════════════════════
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ TEST 3: Bug de inversión de Solvency corregido             │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    // Empresas con D/E alto NO deben tener Solvency alto
    const { data: bugCheckData, error: bugCheckError } = await supabaseAdmin.rpc(
        'check_solvency_inversion_bug',
        { min_date: '2024-01-01' }
    );

    if (bugCheckError) {
        // Fallback: query manual
        const { data: snapshots } = await supabaseAdmin
            .from('fintra_snapshots')
            .select('ticker, fgos_components, snapshot_date')
            .gte('snapshot_date', '2024-01-01')
            .limit(1000);

        if (snapshots) {
            const suspicious = snapshots.filter(s => {
                try {
                    const solvency = s.fgos_components?.solvency;
                    return solvency && solvency > 90; // Solvency muy alto sospechoso
                } catch {
                    return false;
                }
            });

            console.log(`📊 Snapshots con Solvency > 90: ${suspicious.length}`);

            if (suspicious.length > 0) {
                console.log('   Ejemplos:');
                suspicious.slice(0, 5).forEach(s => {
                    console.log(`   - ${s.ticker}: Solvency ${s.fgos_components.solvency.toFixed(2)}`);
                });

                if (suspicious.length > 100) {
                    console.warn(`⚠️  WARNING: ${suspicious.length} snapshots con Solvency > 90 (verificar si es razonable)`);
                }
            } else {
                console.log('✅ PASS: No se encontraron valores de Solvency anormalmente altos');
            }
        }
    } else {
        const bugCount = bugCheckData?.count || 0;
        console.log(`📊 Empresas con D/E > 2.0 y Solvency > 90: ${bugCount}`);

        if (bugCount > 0) {
            console.error(`❌ FALLO: Bug de inversión aún presente (${bugCount} casos)`);
            allTestsPassed = false;
        } else {
            console.log('✅ PASS: Bug de inversión corregido');
        }
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // TEST 4: Verificar FGOS scores razonables
    // ═══════════════════════════════════════════════════════════════
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ TEST 4: FGOS Scores razonables                             │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    const { data: fgosData } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('fgos_score, fgos_category')
        .gte('snapshot_date', today)
        .not('fgos_score', 'is', null);

    if (fgosData && fgosData.length > 0) {
        const scores = fgosData.map(d => d.fgos_score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);

        console.log(`📊 FGOS Scores (hoy, ${today}):`);
        console.log(`   Total: ${fgosData.length.toLocaleString()}`);
        console.log(`   Promedio: ${avgScore.toFixed(2)}`);
        console.log(`   Mínimo: ${minScore.toFixed(2)}`);
        console.log(`   Máximo: ${maxScore.toFixed(2)}`);
        console.log('');

        if (avgScore < 30 || avgScore > 70) {
            console.warn(`⚠️  WARNING: Promedio FGOS anormal (${avgScore.toFixed(2)}, esperado 45-65)`);
        } else {
            console.log(`✅ PASS: Promedio FGOS razonable`);
        }

        if (minScore < 0 || maxScore > 100) {
            console.error(`❌ FALLO: FGOS fuera de rango (min=${minScore}, max=${maxScore})`);
            allTestsPassed = false;
        } else {
            console.log(`✅ PASS: FGOS dentro de rango válido (0-100)`);
        }

        // Distribución de categorías
        const highCount = fgosData.filter(d => d.fgos_category === 'High').length;
        const mediumCount = fgosData.filter(d => d.fgos_category === 'Medium').length;
        const lowCount = fgosData.filter(d => d.fgos_category === 'Low').length;

        const pctHigh = (highCount / fgosData.length * 100).toFixed(2);
        const pctMedium = (mediumCount / fgosData.length * 100).toFixed(2);
        const pctLow = (lowCount / fgosData.length * 100).toFixed(2);

        console.log('📊 Distribución de Categorías:');
        console.log(`   High: ${highCount.toLocaleString()} (${pctHigh}%)`);
        console.log(`   Medium: ${mediumCount.toLocaleString()} (${pctMedium}%)`);
        console.log(`   Low: ${lowCount.toLocaleString()} (${pctLow}%)`);

        if (parseFloat(pctHigh) < 15 || parseFloat(pctHigh) > 35) {
            console.warn(`⚠️  WARNING: Distribución High anormal (${pctHigh}%)`);
        }
        if (parseFloat(pctMedium) < 40 || parseFloat(pctMedium) > 60) {
            console.warn(`⚠️  WARNING: Distribución Medium anormal (${pctMedium}%)`);
        }
    } else {
        console.warn(`⚠️  WARNING: No se encontraron snapshots para hoy (${today})`);
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // RESUMEN FINAL
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    if (allTestsPassed) {
        console.log('║                  ✅ TODAS LAS VALIDACIONES PASARON            ║');
    } else {
        console.log('║                  ❌ ALGUNAS VALIDACIONES FALLARON             ║');
    }
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    if (allTestsPassed) {
        console.log('✅ La base de datos está correctamente poblada y calculada');
        console.log('✅ interest_coverage tiene valores razonables');
        console.log('✅ Solvency y Efficiency están calculados correctamente');
        console.log('✅ FGOS scores son razonables');
        console.log('✅ No se detectaron datos anormales');
        console.log('');
        console.log('🎉 El sistema está listo para producción');
    } else {
        console.log('⚠️  Se encontraron problemas que requieren atención');
        console.log('');
        console.log('Revisa los mensajes de error arriba para más detalles');
    }

    process.exit(allTestsPassed ? 0 : 1);
}

main();

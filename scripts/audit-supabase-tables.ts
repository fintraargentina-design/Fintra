#!/usr/bin/env tsx
/**
 * Script de Auditoría de Tablas de Supabase - Fintra
 *
 * Analiza el estado de todas las tablas críticas del pipeline de datos:
 * - Conteo de registros
 * - Fechas mínimas/máximas
 * - Integridad de datos
 * - Distribución de scores FGOS
 * - Validación de dependencias
 *
 * Uso: npx tsx scripts/audit-supabase-tables.ts
 */

import { createClient } from '@supabase/supabase-js';

// Configuración
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvqfmrsvtyoemxfbnwzv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY no encontrada en variables de entorno');
  console.log('   Configura: export SUPABASE_SERVICE_ROLE_KEY=tu_service_key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ═══════════════════════════════════════════════════════════
// NIVEL 1: DATOS BASE (RAW DATA)
// ═══════════════════════════════════════════════════════════

async function auditCompanyProfiles() {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│ 📊 TABLA: company_profiles                             │');
  console.log('└─────────────────────────────────────────────────────────┘');

  try {
    // Conteo total
    const { count: totalCount } = await supabase
      .from('company_profiles')
      .select('*', { count: 'exact', head: true });

    console.log(`   Total de empresas: ${totalCount?.toLocaleString() || 'N/A'}`);

    // Por exchange
    const { data: byExchange } = await supabase
      .from('company_profiles')
      .select('exchange')
      .not('exchange', 'is', null);

    const exchanges = byExchange?.reduce((acc: Record<string, number>, row) => {
      acc[row.exchange] = (acc[row.exchange] || 0) + 1;
      return acc;
    }, {});

    console.log('\n   📍 Distribución por Exchange:');
    Object.entries(exchanges || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([ex, count]) => {
        console.log(`      ${ex}: ${count}`);
      });

    // Con datos completos
    const { count: withSector } = await supabase
      .from('company_profiles')
      .select('*', { count: 'exact', head: true })
      .not('sector', 'is', null);

    console.log(`\n   ✅ Con sector: ${withSector?.toLocaleString() || 'N/A'} (${((withSector || 0) / (totalCount || 1) * 100).toFixed(1)}%)`);

  } catch (error) {
    console.error('   ❌ Error:', error);
  }
}

async function auditDatosFinancieros() {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│ 💰 TABLA: datos_financieros                            │');
  console.log('└─────────────────────────────────────────────────────────┘');

  try {
    // Conteo total
    const { count: totalCount } = await supabase
      .from('datos_financieros')
      .select('*', { count: 'exact', head: true });

    console.log(`   Total de registros: ${totalCount?.toLocaleString() || 'N/A'}`);

    // Últimas fechas
    const { data: latestDates } = await supabase
      .from('datos_financieros')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    console.log(`   📅 Fecha más reciente: ${latestDates?.[0]?.date || 'N/A'}`);

    // Con ratios clave
    const { count: withROE } = await supabase
      .from('datos_financieros')
      .select('*', { count: 'exact', head: true })
      .not('return_on_equity_ttm', 'is', null);

    const { count: withDebtEquity } = await supabase
      .from('datos_financieros')
      .select('*', { count: 'exact', head: true })
      .not('debt_to_equity_ttm', 'is', null);

    console.log(`\n   Completitud de ratios:`);
    console.log(`      ROE: ${withROE?.toLocaleString() || 'N/A'} (${((withROE || 0) / (totalCount || 1) * 100).toFixed(1)}%)`);
    console.log(`      D/E: ${withDebtEquity?.toLocaleString() || 'N/A'} (${((withDebtEquity || 0) / (totalCount || 1) * 100).toFixed(1)}%)`);

  } catch (error) {
    console.error('   ❌ Error:', error);
  }
}

async function auditDatosPerformance() {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│ 📈 TABLA: datos_performance                            │');
  console.log('└─────────────────────────────────────────────────────────┘');

  try {
    const { count: totalCount } = await supabase
      .from('datos_performance')
      .select('*', { count: 'exact', head: true });

    console.log(`   Total de registros: ${totalCount?.toLocaleString() || 'N/A'}`);

    // Últimas fechas
    const { data: latestDates } = await supabase
      .from('datos_performance')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    console.log(`   📅 Fecha más reciente: ${latestDates?.[0]?.date || 'N/A'}`);

  } catch (error) {
    console.error('   ❌ Error:', error);
  }
}

// ═══════════════════════════════════════════════════════════
// NIVEL 2: BENCHMARKS Y CLASIFICACIÓN
// ═══════════════════════════════════════════════════════════

async function auditSectorBenchmarks() {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│ 🎯 TABLA: sector_benchmarks                            │');
  console.log('└─────────────────────────────────────────────────────────┘');

  try {
    const { count: totalCount } = await supabase
      .from('sector_benchmarks')
      .select('*', { count: 'exact', head: true });

    console.log(`   Total de benchmarks: ${totalCount?.toLocaleString() || 'N/A'}`);

    // Por sector
    const { data: bySector } = await supabase
      .from('sector_benchmarks')
      .select('sector');

    const sectors = bySector?.reduce((acc: Record<string, number>, row) => {
      acc[row.sector] = (acc[row.sector] || 0) + 1;
      return acc;
    }, {});

    console.log('\n   📊 Sectores con benchmarks:');
    Object.entries(sectors || {})
      .sort((a, b) => b[1] - a[1])
      .forEach(([sector, count]) => {
        console.log(`      ${sector}: ${count} métricas`);
      });

    // Últimas actualizaciones
    const { data: latestUpdate } = await supabase
      .from('sector_benchmarks')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    console.log(`\n   📅 Última actualización: ${latestUpdate?.[0]?.updated_at || 'N/A'}`);

  } catch (error) {
    console.error('   ❌ Error:', error);
  }
}

async function auditIndustryClassification() {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│ 🏭 TABLA: industry_classification                      │');
  console.log('└─────────────────────────────────────────────────────────┘');

  try {
    const { count: totalCount } = await supabase
      .from('industry_classification')
      .select('*', { count: 'exact', head: true });

    console.log(`   Total de clasificaciones: ${totalCount?.toLocaleString() || 'N/A'}`);

    // Por industria
    const { data: byIndustry } = await supabase
      .from('industry_classification')
      .select('industry_name');

    const industries = byIndustry?.reduce((acc: Record<string, number>, row) => {
      acc[row.industry_name] = (acc[row.industry_name] || 0) + 1;
      return acc;
    }, {});

    console.log(`\n   📊 Total de industrias: ${Object.keys(industries || {}).length}`);

  } catch (error) {
    console.error('   ❌ Error:', error);
  }
}

// ═══════════════════════════════════════════════════════════
// NIVEL 4: SNAPSHOTS (CORE - CRÍTICO)
// ═══════════════════════════════════════════════════════════

async function auditFintraSnapshots() {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│ ⭐ TABLA: fintra_snapshots (CRÍTICA)                   │');
  console.log('└─────────────────────────────────────────────────────────┘');

  try {
    // Conteo total
    const { count: totalCount } = await supabase
      .from('fintra_snapshots')
      .select('*', { count: 'exact', head: true });

    console.log(`   Total de snapshots: ${totalCount?.toLocaleString() || 'N/A'}`);

    // Por fecha
    const { data: latestSnapshot } = await supabase
      .from('fintra_snapshots')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1);

    const { data: oldestSnapshot } = await supabase
      .from('fintra_snapshots')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: true })
      .limit(1);

    console.log(`   📅 Rango de fechas:`);
    console.log(`      Más antiguo: ${oldestSnapshot?.[0]?.snapshot_date || 'N/A'}`);
    console.log(`      Más reciente: ${latestSnapshot?.[0]?.snapshot_date || 'N/A'}`);

    // Snapshots de hoy
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCount } = await supabase
      .from('fintra_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('snapshot_date', today);

    console.log(`\n   📊 Snapshots de hoy (${today}): ${todayCount?.toLocaleString() || '0'}`);

    // Con FGOS score
    const { count: withFGOS } = await supabase
      .from('fintra_snapshots')
      .select('*', { count: 'exact', head: true })
      .not('fgos_score', 'is', null);

    console.log(`\n   ✅ Con FGOS Score: ${withFGOS?.toLocaleString() || 'N/A'} (${((withFGOS || 0) / (totalCount || 1) * 100).toFixed(1)}%)`);

    // Distribución de categorías FGOS
    const { data: byCategory } = await supabase
      .from('fintra_snapshots')
      .select('fgos_category')
      .not('fgos_category', 'is', null);

    const categories = byCategory?.reduce((acc: Record<string, number>, row) => {
      acc[row.fgos_category] = (acc[row.fgos_category] || 0) + 1;
      return acc;
    }, {});

    console.log('\n   📊 Distribución FGOS:');
    ['High', 'Medium', 'Low', 'Pending'].forEach(cat => {
      const count = categories?.[cat] || 0;
      const pct = ((count / (totalCount || 1)) * 100).toFixed(1);
      console.log(`      ${cat}: ${count.toLocaleString()} (${pct}%)`);
    });

    // 🔴 ANÁLISIS CRÍTICO: Solvency scores altos (potencialmente afectados por bug)
    console.log('\n   🔍 ANÁLISIS DE SOLVENCY (Bug detectado):');

    const { data: allSnapshots } = await supabase
      .from('fintra_snapshots')
      .select('fgos_components')
      .not('fgos_components', 'is', null)
      .limit(50000);

    const solvencyScores = allSnapshots
      ?.map(s => s.fgos_components?.solvency)
      .filter(s => s !== null && s !== undefined) as number[];

    if (solvencyScores && solvencyScores.length > 0) {
      const high = solvencyScores.filter(s => s > 90).length;
      const medium = solvencyScores.filter(s => s >= 70 && s <= 90).length;
      const low = solvencyScores.filter(s => s < 70).length;

      console.log(`      Total con solvency: ${solvencyScores.length.toLocaleString()}`);
      console.log(`      🔴 >90 (altamente afectados): ${high.toLocaleString()} (${(high/solvencyScores.length*100).toFixed(1)}%)`);
      console.log(`      🟡 70-90 (moderadamente afectados): ${medium.toLocaleString()} (${(medium/solvencyScores.length*100).toFixed(1)}%)`);
      console.log(`      ✅ <70 (probablemente OK): ${low.toLocaleString()} (${(low/solvencyScores.length*100).toFixed(1)}%)`);
    }

    // Por status
    const { data: byStatus } = await supabase
      .from('fintra_snapshots')
      .select('fgos_status')
      .not('fgos_status', 'is', null);

    const statuses = byStatus?.reduce((acc: Record<string, number>, row) => {
      acc[row.fgos_status] = (acc[row.fgos_status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n   📊 Por Status:');
    Object.entries(statuses || {}).forEach(([status, count]) => {
      console.log(`      ${status}: ${count.toLocaleString()}`);
    });

  } catch (error) {
    console.error('   ❌ Error:', error);
  }
}

// ═══════════════════════════════════════════════════════════
// VALIDACIÓN DE DEPENDENCIAS
// ═══════════════════════════════════════════════════════════

async function auditDependencies() {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│ 🔗 VALIDACIÓN DE DEPENDENCIAS                          │');
  console.log('└─────────────────────────────────────────────────────────┘');

  try {
    // Snapshots sin company_profiles
    const { data: snapshotsWithoutProfile } = await supabase
      .from('fintra_snapshots')
      .select('ticker')
      .limit(1000);

    if (snapshotsWithoutProfile) {
      const tickers = snapshotsWithoutProfile.map(s => s.ticker);
      const { count: profileCount } = await supabase
        .from('company_profiles')
        .select('*', { count: 'exact', head: true })
        .in('symbol', tickers);

      console.log(`   ✅ Snapshots con company_profile: ${profileCount}/${tickers.length}`);
    }

    // Snapshots sin datos_financieros
    const { data: recentSnapshots } = await supabase
      .from('fintra_snapshots')
      .select('ticker')
      .order('snapshot_date', { ascending: false })
      .limit(100);

    if (recentSnapshots) {
      const tickers = [...new Set(recentSnapshots.map(s => s.ticker))];
      const { count: financialCount } = await supabase
        .from('datos_financieros')
        .select('*', { count: 'exact', head: true })
        .in('symbol', tickers);

      console.log(`   ✅ Snapshots recientes con datos_financieros: ${financialCount}/${tickers.length} tickers`);
    }

  } catch (error) {
    console.error('   ❌ Error:', error);
  }
}

// ═══════════════════════════════════════════════════════════
// EJECUCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🔍 AUDITORÍA DE TABLAS SUPABASE - FINTRA                ║');
  console.log('║  Database: lvqfmrsvtyoemxfbnwzv.supabase.co              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    // NIVEL 1: Datos Base
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  NIVEL 1: DATOS BASE (RAW DATA)');
    console.log('═══════════════════════════════════════════════════════════');
    await auditCompanyProfiles();
    await auditDatosFinancieros();
    await auditDatosPerformance();

    // NIVEL 2: Clasificación y Benchmarks
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  NIVEL 2: CLASIFICACIÓN Y BENCHMARKS');
    console.log('═══════════════════════════════════════════════════════════');
    await auditSectorBenchmarks();
    await auditIndustryClassification();

    // NIVEL 4: Snapshots (CRÍTICO)
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  NIVEL 4: SNAPSHOTS (CRÍTICO)');
    console.log('═══════════════════════════════════════════════════════════');
    await auditFintraSnapshots();

    // Validación de dependencias
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  VALIDACIÓN DE INTEGRIDAD');
    console.log('═══════════════════════════════════════════════════════════');
    await auditDependencies();

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ AUDITORÍA COMPLETADA                                 ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ ERROR GENERAL:', error);
    process.exit(1);
  }
}

// Ejecutar
main();

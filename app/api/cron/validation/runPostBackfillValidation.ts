// cron/validation/runPostBackfillValidation.ts

import { runCheck } from './utils';
import { checkNoFutureData } from './checkNoFutureData';
import { checkSnapshotCoverage } from './checkSnapshotCoverage';
import { checkSectorStats } from './checkSectorStats';
import { checkFGOSDistribution } from './checkFGOSDistribution';

export async function runPostBackfillValidation() {
  console.log('🔍 Iniciando validaciones post-backfill');

  await runCheck('No future data', checkNoFutureData);
  await runCheck('Snapshot coverage', () => checkSnapshotCoverage());
  await runCheck('Sector stats sanity', checkSectorStats);
  await runCheck('FGOS distribution', checkFGOSDistribution);

  console.log('✅ Validaciones completadas');
}

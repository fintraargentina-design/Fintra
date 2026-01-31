/**
 * Database Lock Utilities using PostgreSQL Advisory Locks
 *
 * Prevents race conditions in concurrent cron jobs and batch operations.
 * Uses PostgreSQL's pg_advisory_lock for distributed locking.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Converts a string to a consistent 64-bit integer for advisory locks
 * Uses a simple hash function to generate lock IDs
 */
function stringToLockId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Ensure positive integer within PostgreSQL bigint range
  return Math.abs(hash) % 2147483647;
}

/**
 * Attempts to acquire an advisory lock (non-blocking)
 *
 * @param lockName - Unique name for this lock (e.g., 'fmp-bulk-2024-01-15')
 * @returns true if lock acquired, false if already held
 *
 * @example
 * const acquired = await tryAcquireLock('fmp-bulk-2024-01-15');
 * if (!acquired) {
 *   console.log('Another instance is already running');
 *   return;
 * }
 * try {
 *   // Do work
 * } finally {
 *   await releaseLock('fmp-bulk-2024-01-15');
 * }
 */
export async function tryAcquireLock(lockName: string): Promise<boolean> {
  const lockId = stringToLockId(lockName);

  try {
    const { data, error } = await supabaseAdmin
      .rpc('pg_try_advisory_lock', { lock_id: lockId });

    if (error) {
      console.error(`❌ Failed to acquire lock ${lockName}:`, error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error(`❌ Exception acquiring lock ${lockName}:`, err);
    return false;
  }
}

/**
 * Releases an advisory lock
 *
 * @param lockName - Same name used in tryAcquireLock
 * @returns true if lock was released, false otherwise
 */
export async function releaseLock(lockName: string): Promise<boolean> {
  const lockId = stringToLockId(lockName);

  try {
    const { data, error } = await supabaseAdmin
      .rpc('pg_advisory_unlock', { lock_id: lockId });

    if (error) {
      console.error(`❌ Failed to release lock ${lockName}:`, error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error(`❌ Exception releasing lock ${lockName}:`, err);
    return false;
  }
}

/**
 * Executes a function with an advisory lock
 * Automatically acquires and releases the lock
 *
 * @param lockName - Unique name for this lock
 * @param fn - Async function to execute while holding the lock
 * @param skipIfLocked - If true, returns null if lock can't be acquired. If false, throws error.
 * @returns Result of fn, or null if lock couldn't be acquired and skipIfLocked=true
 *
 * @example
 * const result = await withLock('daily-snapshot', async () => {
 *   return await processDailySnapshot();
 * }, true);
 *
 * if (result === null) {
 *   console.log('Another instance is processing');
 * }
 */
export async function withLock<T>(
  lockName: string,
  fn: () => Promise<T>,
  skipIfLocked: boolean = true
): Promise<T | null> {
  const acquired = await tryAcquireLock(lockName);

  if (!acquired) {
    if (skipIfLocked) {
      console.log(`⏭️  Lock ${lockName} already held, skipping execution`);
      return null;
    } else {
      throw new Error(`Failed to acquire lock: ${lockName}`);
    }
  }

  try {
    console.log(`🔒 Lock acquired: ${lockName}`);
    return await fn();
  } finally {
    await releaseLock(lockName);
    console.log(`🔓 Lock released: ${lockName}`);
  }
}

/**
 * Generates a lock name for daily cron jobs
 * Format: 'cron-{jobName}-YYYY-MM-DD'
 */
export function getDailyLockName(jobName: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `cron-${jobName}-${today}`;
}

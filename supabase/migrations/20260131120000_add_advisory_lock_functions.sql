-- Migration: Add PostgreSQL Advisory Lock Functions
-- Purpose: Enable distributed locking for cron jobs to prevent race conditions
-- Date: 2026-01-31

-- Function to try acquiring an advisory lock (non-blocking)
CREATE OR REPLACE FUNCTION public.pg_try_advisory_lock(lock_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_try_advisory_lock(lock_id);
$$;

-- Function to release an advisory lock
CREATE OR REPLACE FUNCTION public.pg_advisory_unlock(lock_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_advisory_unlock(lock_id);
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.pg_try_advisory_lock(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pg_advisory_unlock(bigint) TO authenticated;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION public.pg_try_advisory_lock(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.pg_advisory_unlock(bigint) TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION public.pg_try_advisory_lock IS 'Attempts to acquire a PostgreSQL advisory lock. Returns true if successful, false if lock is already held.';
COMMENT ON FUNCTION public.pg_advisory_unlock IS 'Releases a PostgreSQL advisory lock. Returns true if successful.';

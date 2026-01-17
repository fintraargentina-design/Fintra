-- Migration: Seed derived window rows for sector_performance
-- Note: No schema changes. All logic is handled in the cron aggregator.

-- This migration is intentionally minimal to keep DDL history consistent.
-- It does not insert any data eagerly; sector windows are derived by
-- the app/api/cron/sector-performance-windows-aggregator core.


-- Migration: Drop unused indexes to resolve Performance Advisor warnings
-- Description: Drops indexes that have 0 usage scans according to pg_stat_user_indexes.
-- This reduces storage usage and improves INSERT/UPDATE performance.

-- Table: public.fintra_market_state
DROP INDEX IF EXISTS idx_market_state_ytd;
DROP INDEX IF EXISTS idx_market_state_fgos;
DROP INDEX IF EXISTS idx_fintra_market_state_market_cap;
DROP INDEX IF EXISTS idx_market_state_market_cap;
DROP INDEX IF EXISTS idx_fintra_market_state_price;
DROP INDEX IF EXISTS idx_market_state_industry;

-- Table: public.stock_peers
DROP INDEX IF EXISTS idx_stock_peers_peer;

-- Table: public.datos_performance
DROP INDEX IF EXISTS idx_datos_performance_window;

-- Table: public.busquedas_acciones
DROP INDEX IF EXISTS idx_ultima_busqueda;
DROP INDEX IF EXISTS idx_busquedas_desc;

-- Table: public.industry_benchmarks
DROP INDEX IF EXISTS idx_industry_benchmarks_window_code;

-- Table: public.sector_stats
DROP INDEX IF EXISTS idx_sector_stats_metric;
DROP INDEX IF EXISTS idx_sector_stats_sector;

-- Table: public.performance_windows
DROP INDEX IF EXISTS performance_windows_as_of_date_idx;

-- Table: public.fintra_snapshots
DROP INDEX IF EXISTS idx_fintra_snapshots_sector;
DROP INDEX IF EXISTS idx_snapshots_fgos;

-- Table: public.asset_industry_map
DROP INDEX IF EXISTS idx_asset_industry_map_industry_code;

-- Table: public.sic_industry_map
DROP INDEX IF EXISTS idx_sic_industry_map_industry_code;

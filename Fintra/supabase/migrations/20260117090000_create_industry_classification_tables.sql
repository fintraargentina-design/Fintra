-- Migration: Create industry_classification and asset_industry_map tables

CREATE TABLE IF NOT EXISTS industry_classification (
    industry_id TEXT PRIMARY KEY,
    sic_code TEXT,
    sector TEXT NOT NULL,
    industry TEXT NOT NULL,
    sub_industry TEXT,
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    source TEXT NOT NULL DEFAULT 'fmp',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_industry_map (
    ticker TEXT PRIMARY KEY,
    industry_id TEXT NOT NULL REFERENCES industry_classification(industry_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    sector TEXT NOT NULL,
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    source TEXT NOT NULL DEFAULT 'fmp',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asset_industry_map_sector_idx
    ON asset_industry_map (sector);

CREATE INDEX IF NOT EXISTS asset_industry_map_industry_id_idx
    ON asset_industry_map (industry_id);


-- Migration: Industry / SIC Mapping Block
-- 20260117130000_industry_sic_mapping.sql

-- 1. Clean up existing tables if they exist (safe to drop as they are empty or being redefined)
DROP TABLE IF EXISTS asset_industry_map;
DROP TABLE IF EXISTS sic_industry_map;
DROP TABLE IF EXISTS industry_classification;

-- 2. Create industry_classification
CREATE TABLE industry_classification (
    industry_code TEXT PRIMARY KEY, -- canonical internal key
    industry_name TEXT UNIQUE NOT NULL,
    sector TEXT NOT NULL,
    description TEXT NULL,
    source TEXT NOT NULL, -- e.g. 'SIC', 'manual'
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT chk_valid_sector CHECK (sector IN (
        'Basic Materials',
        'Communication Services',
        'Consumer Cyclical',
        'Consumer Defensive',
        'Energy',
        'Financial Services',
        'Healthcare',
        'Industrials',
        'Real Estate',
        'Technology',
        'Utilities'
    ))
);

-- 3. Create sic_industry_map
CREATE TABLE sic_industry_map (
    sic_code TEXT PRIMARY KEY,
    sic_description TEXT NOT NULL,
    industry_code TEXT NOT NULL,
    source TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create asset_industry_map
CREATE TABLE asset_industry_map (
    ticker TEXT NOT NULL,
    industry_code TEXT NOT NULL,
    source TEXT NOT NULL, -- 'sic_resolve' | 'manual_override'
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    created_at TIMESTAMPTZ DEFAULT now(),

    PRIMARY KEY (ticker, effective_from)
);

-- Indexes for performance
CREATE INDEX idx_sic_industry_map_industry_code ON sic_industry_map(industry_code);
CREATE INDEX idx_asset_industry_map_industry_code ON asset_industry_map(industry_code);
CREATE INDEX idx_asset_industry_map_ticker ON asset_industry_map(ticker);

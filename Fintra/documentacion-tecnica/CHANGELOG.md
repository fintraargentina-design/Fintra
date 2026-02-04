# Changelog

All notable changes to Fintra will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Sector Performance Fallback (2026-02-02)**
  - Improved `fetchSectorPerformanceHistory` to log fallback usage
  - Weekend snapshots now use latest available sector data (typically Friday)
  - Added `daysBetween` helper for data age calculation
  - Logs warn when using data older than current date

### Deprecated

- **Database Schema Changes (2026-02-02)**
  - Deprecated flat performance columns in favor of JSONB `performance_windows`:
    - `sector_rank` → Use `performance_windows['1M'].sector_rank`
    - `sector_rank_total` → Use `performance_windows['1M'].sector_total`
    - `relative_vs_sector_*` → Use `performance_windows['WINDOW'].vs_sector`
    - `relative_vs_market_*` → Use `performance_windows['WINDOW'].vs_market`
  - **Timeline:**
    - Feb 2026: Columns marked as DEPRECATED (Phase 1) ✅
    - Mar 2026: Migrate all queries to use JSONB (Phase 2)
    - Q2 2026: Remove deprecated columns (Phase 3)
  - **Migration Guide:** See `docs/migrations/performance_windows.md`
  - **Audit Tool:** Run `pnpm audit:deprecated-columns` to check usage
  - **Action Required:**
    - Update queries reading `sector_rank` to use JSONB
    - Update UI components reading `relative_vs_*` columns
    - No changes needed for data writes (already migrated)

### Fixed

- **IFS Weekend Coverage (2026-02-02)**
  - Fixed `ifs` and `ifs_memory` being NULL on weekends
  - Added fallback lookup for `sector_performance` (uses latest available)
  - Weekend snapshots now use Friday's sector data
  - Improves IFS coverage from 0% to >95% on weekends
  - Added structured logging for data age tracking

## [3.2.0] - 2026-02-01

### Added

- **Moat Engine: Coherence Check**
  - Added `calculateCoherenceCheck()` function with 3 verdicts
  - Detects high quality growth vs inefficient growth
  - 40% penalty for inefficient growth in stability score
  - Thresholds: revenue growth 5%, margin decline -1%
  - Comprehensive test suite with 6 test cases

- **IFS Engine: Confidence Score**
  - Added confidence calculation with 40/40/20 weighting
  - Formula: 40% availability + 40% consistency + 20% sector universe
  - New fields: `confidence`, `confidence_label`, `interpretation`
  - Test suite with 8 confidence test cases
  - Penalizes mixed signals with 0.7 multiplier

- **Cron Jobs: Fault Tolerance & Logging**
  - Wrapped all ticker processing in try-catch blocks
  - Errors in one ticker no longer abort entire batch
  - ISO timestamp logging (`new Date().toISOString()`)
  - Mandatory log events: SNAPSHOT START, OK, FAILED
  - Performance tracking with duration in milliseconds
  - SLOW SNAPSHOT warning for operations >5s

### Changed

- All cron jobs now use structured logging
- IFS now includes confidence metrics in output
- Moat calculation integrates coherence check

### Documentation

- Added comprehensive audit report (500+ lines)
- Added GitHub Copilot instructions for project
- Documented 4 priority corrections
- Added test coverage for new features

## [3.1.0] - 2026-01-15

### Added

- Initial release of Fintra v3 architecture
- FGOS (Fintra Growth & Operations Score)
- IFS (Industry Fit Score) v1.1 with block-based voting
- Valuation engine with sector benchmarks
- Life Cycle classification
- Sentiment analysis
- Moat detection

---

**Legend:**

- ✅ Completed
- 🚧 In Progress
- ⏳ Planned

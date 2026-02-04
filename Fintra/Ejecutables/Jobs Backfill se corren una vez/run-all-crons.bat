@echo off
REM ========================================
REM FINTRA - Run All Cron Jobs (Windows)
REM ========================================
REM Version: 1.0
REM Updated: 2026-02-02

setlocal enabledelayedexpansion

REM Configuration
set BASE_URL=http://localhost:3000
set LOG_DIR=logs
set LOG_FILE=%LOG_DIR%\cron-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log
set TIMEOUT_DEFAULT=600

REM Create logs directory if it doesn't exist
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo ========================================= > "%LOG_FILE%"
echo FINTRA - Cron Jobs Execution >> "%LOG_FILE%"
echo Started: %date% %time% >> "%LOG_FILE%"
echo ========================================= >> "%LOG_FILE%"
echo.

echo [FINTRA] Starting all cron jobs...
echo [FINTRA] Log file: %LOG_FILE%
echo.

REM ========================================
REM PHASE 1: Universe and Classification
REM ========================================
echo ========================================
echo PHASE 1: Universe and Classification
echo ========================================

call :run_job 1 "Sync Universe" "/api/cron/sync-universe" 600
call :run_job 2 "Industry Classification" "/api/cron/industry-classification-sync" 900

REM ========================================
REM PHASE 2: Raw Data (FMP API)
REM ========================================
echo.
echo ========================================
echo PHASE 2: Raw Data from FMP API
echo ========================================

call :run_job 3 "Prices Daily Bulk" "/api/cron/prices-daily-bulk" 1200
call :run_job 4 "Financials Bulk" "/api/cron/financials-bulk" 1800
call :run_job 5 "Company Profile Bulk" "/api/cron/company-profile-bulk" 900

REM ========================================
REM PHASE 3: Performance Aggregators
REM ========================================
echo.
echo ========================================
echo PHASE 3: Performance Aggregators
echo ========================================

call :run_job 6 "Industry Performance 1D" "/api/cron/industry-performance-aggregator" 1200
call :run_job 7 "Sector Performance 1D" "/api/cron/sector-performance-aggregator" 900
call :run_job 8 "Sector Perf Windows" "/api/cron/sector-performance-windows-aggregator" 1200
call :run_job 9 "Industry Perf Windows" "/api/cron/industry-performance-windows-aggregator" 1200

REM ========================================
REM PHASE 4: Benchmarks (Critical for FGOS)
REM ========================================
echo.
echo ========================================
echo PHASE 4: Sector Benchmarks
echo ========================================

call :run_job 10 "Sector Benchmarks" "/api/cron/sector-benchmarks" 900

REM ========================================
REM PHASE 5: Individual Metrics
REM ========================================
echo.
echo ========================================
echo PHASE 5: Individual Performance and Valuation
echo ========================================

call :run_job 11 "Performance Bulk" "/api/cron/performance-bulk" 1200
call :run_job 12 "Market State Bulk" "/api/cron/market-state-bulk" 600
call :run_job 13 "Dividends Bulk V2" "/api/cron/dividends-bulk-v2" 900

REM ========================================
REM PHASE 6: Final Snapshots (CRITICAL)
REM ========================================
echo.
echo ========================================
echo PHASE 6: Fintra Snapshots (CORE)
echo ========================================

call :run_job 14 "FMP Bulk Update" "/api/cron/bulk-update" 7200
call :run_job 15 "Healthcheck Snapshots" "/api/cron/healthcheck-fmp-bulk" 300

REM ========================================
REM PHASE 7: Additional Data
REM ========================================
echo.
echo ========================================
echo PHASE 7: Additional Data
echo ========================================

call :run_job 16 "FMP Peers Bulk" "/api/cron/fmp-peers-bulk" 900
call :run_job 17 "Valuation Bulk" "/api/cron/valuation-bulk" 1200

REM ========================================
REM PHASE 8: Validation
REM ========================================
echo.
echo ========================================
echo PHASE 8: Post-Processing Validation
echo ========================================

call :run_job 18 "Run Validation" "/api/cron/validation" 600

REM ========================================
REM Summary
REM ========================================
echo.
echo ========================================= >> "%LOG_FILE%"
echo Finished: %date% %time% >> "%LOG_FILE%"
echo ========================================= >> "%LOG_FILE%"

echo.
echo ========================================
echo ALL CRON JOBS COMPLETED
echo ========================================
echo Check log file: %LOG_FILE%
echo.
pause
goto :eof

REM ========================================
REM Function: run_job
REM Arguments:
REM   %1 = Job number
REM   %2 = Job name
REM   %3 = API endpoint
REM   %4 = Timeout (seconds)
REM ========================================
:run_job
set JOB_NUM=%~1
set JOB_NAME=%~2
set ENDPOINT=%~3
set TIMEOUT=%~4

echo.
echo [%JOB_NUM%] Starting: %JOB_NAME%
echo [%JOB_NUM%] URL: %BASE_URL%%ENDPOINT%
echo [%JOB_NUM%] Timeout: %TIMEOUT%s
echo.

echo ----------------------------------------- >> "%LOG_FILE%"
echo [%JOB_NUM%] %JOB_NAME% >> "%LOG_FILE%"
echo Started: %date% %time% >> "%LOG_FILE%"
echo ----------------------------------------- >> "%LOG_FILE%"

REM Execute curl command
curl -X POST "%BASE_URL%%ENDPOINT%" ^
     -H "Content-Type: application/json" ^
     --max-time %TIMEOUT% ^
     --silent ^
     --show-error ^
     >> "%LOG_FILE%" 2>&1

set CURL_EXIT_CODE=!errorlevel!

if !CURL_EXIT_CODE! equ 0 (
    echo [%JOB_NUM%] SUCCESS: %JOB_NAME%
    echo Status: SUCCESS >> "%LOG_FILE%"
) else (
    echo [%JOB_NUM%] ERROR: %JOB_NAME% (Exit Code: !CURL_EXIT_CODE!)
    echo Status: FAILED ^(Exit Code: !CURL_EXIT_CODE!^) >> "%LOG_FILE%"
)

echo Finished: %date% %time% >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

REM Wait 2 seconds between jobs
timeout /t 2 /nobreak >nul

goto :eof

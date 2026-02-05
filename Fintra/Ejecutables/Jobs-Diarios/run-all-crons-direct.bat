@echo off
REM ========================================
REM FINTRA - Run All Cron Jobs (Direct - No Server)
REM ========================================
REM Version: 1.0 Direct
REM Updated: 2026-02-02
REM Executes TypeScript scripts directly without HTTP server

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0

REM Change to project root (one level up from Ejecutables)
cd /d "%SCRIPT_DIR%.."

REM Configuration
set LOG_DIR=Ejecutables\logs
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOG_FILE=%LOG_DIR%\cron-direct-%TIMESTAMP%.log
set ERROR_FILE=%LOG_DIR%\cron-direct-%TIMESTAMP%.error.log
set SUMMARY_FILE=%LOG_DIR%\cron-direct-%TIMESTAMP%.summary.log
set ERROR_COUNT=0

REM Create logs directory
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Initialize error log
echo ========================================= > "%ERROR_FILE%"
echo FINTRA - Error Log >> "%ERROR_FILE%"
echo Started: %date% %time% >> "%ERROR_FILE%"
echo ========================================= >> "%ERROR_FILE%"
echo. >> "%ERROR_FILE%"

echo ========================================= > "%LOG_FILE%"
echo FINTRA - Direct Cron Jobs Execution >> "%LOG_FILE%"
echo (No HTTP Server Required) >> "%LOG_FILE%"
echo Started: %date% %time% >> "%LOG_FILE%"
echo ========================================= >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

REM Initialize summary log
echo ========================================= > "%SUMMARY_FILE%"
echo FINTRA - Execution Summary >> "%SUMMARY_FILE%"
echo Started: %date% %time% >> "%SUMMARY_FILE%"
echo ========================================= >> "%SUMMARY_FILE%"
echo. >> "%SUMMARY_FILE%"

echo.
echo =========================================================================
echo [FINTRA] Starting all cron jobs (Direct Mode)...
echo [FINTRA] No HTTP server required
echo =========================================================================
echo.
echo LOG FILES:
echo   Main Log:    %LOG_FILE%
echo   Errors Only: %ERROR_FILE%
echo   Summary:     %SUMMARY_FILE%
echo.
echo =========================================================================
echo.

REM ========================================
REM PHASE 1: Universe and Classification
REM ========================================
echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 1: Universe and Classification                             ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_script 1 "Sync Universe" "scripts\pipeline\01-sync-universe.ts"
call :run_script 2 "Industry Classification" "scripts\pipeline\02-industry-classification-sync.ts"

REM ========================================
REM PHASE 2: Raw Data (FMP API)
REM ========================================
echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 2: Raw Data from FMP API                                   ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_script 3 "Prices Daily Bulk" "scripts\pipeline\03-prices-daily-bulk.ts"
call :run_script 4 "Financials Bulk" "scripts\pipeline\04-financials-bulk.ts"
call :run_script 5 "TTM Valuation Incremental" "scripts\backfill\backfill-ttm-valuation.ts"
call :run_script 6 "Company Profile Bulk" "scripts\pipeline\05-company-profile-bulk.ts"

REM ========================================
REM PHASE 3: Performance Aggregators
REM ========================================
echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 3: Performance Aggregators                                 ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_script 7 "Industry Performance 1D" "scripts\pipeline\06-industry-performance-aggregator.ts"
call :run_script 8 "Sector Performance 1D" "scripts\pipeline\07-sector-performance-aggregator.ts"
call :run_script 9 "Sector Perf Windows" "scripts\pipeline\08-sector-performance-windows-aggregator.ts"
call :run_script 10 "Industry Perf Windows" "scripts\pipeline\09-industry-performance-windows-aggregator.ts"
call :run_script 11 "Sector PE Aggregator" "scripts\pipeline\10-sector-pe-aggregator.ts"
call :run_script 12 "Industry PE Aggregator" "scripts\pipeline\11-industry-pe-aggregator.ts"

REM ========================================
REM PHASE 4: Benchmarks (Critical for FGOS)
REM ========================================
echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 4: Sector Benchmarks (CRITICAL)                            ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_script 13 "Sector Benchmarks" "scripts\pipeline\12-sector-benchmarks.ts"

REM ========================================
REM PHASE 5: Individual Metrics
REM ========================================
echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 5: Individual Performance and Valuation                    ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_script 14 "Performance Bulk" "scripts\pipeline\13-performance-bulk.ts"
call :run_script 15 "Market State Bulk" "scripts\pipeline\14-market-state-bulk.ts"
call :run_script 16 "Dividends Bulk V2" "scripts\pipeline\15-dividends-bulk-v2.ts"

REM ========================================
REM PHASE 6: Final Snapshots (CRITICAL)
REM ========================================
echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 6: Fintra Snapshots (CORE)                                 ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_script 17 "FMP Bulk Snapshots" "scripts\pipeline\16-fmp-bulk-snapshots.ts"
call :run_script 18 "Healthcheck Snapshots" "scripts\pipeline\17-healthcheck-snapshots.ts"

REM ========================================
REM PHASE 7: Final Calculations (FGOS + IFS)
REM ========================================
echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 7: Final Calculations (CRITICAL)                           ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_script 19 "Recompute FGOS All" "scripts\pipeline\18-recompute-fgos-all.ts"

REM ========================================
REM Summary
REM ========================================
echo.
echo ========================================= >> "%LOG_FILE%"
echo Finished: %date% %time% >> "%LOG_FILE%"
echo Total Errors: %ERROR_COUNT% >> "%LOG_FILE%"
echo ========================================= >> "%LOG_FILE%"

echo. >> "%SUMMARY_FILE%"
echo ========================================= >> "%SUMMARY_FILE%"
echo Finished: %date% %time% >> "%SUMMARY_FILE%"
echo Total Errors: %ERROR_COUNT% >> "%SUMMARY_FILE%"
echo ========================================= >> "%SUMMARY_FILE%"

if %ERROR_COUNT% gtr 0 (
    echo. >> "%ERROR_FILE%"
    echo ========================================= >> "%ERROR_FILE%"
    echo TOTAL ERRORS: %ERROR_COUNT% >> "%ERROR_FILE%"
    echo Finished: %date% %time% >> "%ERROR_FILE%"
    echo ========================================= >> "%ERROR_FILE%"
)

echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   ALL CRON JOBS COMPLETED                                          ###
echo ###                                                                     ###
echo #########################################################################
echo.
echo =========================================================================
echo EXECUTION SUMMARY
echo =========================================================================
echo   Total Errors: %ERROR_COUNT%
echo.
echo LOG FILES GENERATED:
echo   [1] Main Log:    %LOG_FILE%
echo   [2] Errors Only: %ERROR_FILE%
echo   [3] Summary:     %SUMMARY_FILE%
echo.
if %ERROR_COUNT% gtr 0 (
    echo ⚠️  WARNING: %ERROR_COUNT% job^(s^) failed! Check error log for details.
    echo   Error log: %ERROR_FILE%
) else (
    echo ✅ SUCCESS: All jobs completed without errors!
)
echo =========================================================================
echo.
pause
goto :eof

REM ========================================
REM Function: run_script
REM Arguments:
REM   %1 = Job number
REM   %2 = Job name
REM   %3 = Script path
REM ========================================
:run_script
set JOB_NUM=%~1
set JOB_NAME=%~2
set SCRIPT_PATH=%~3
set JOB_START=%time%

echo.
echo =========================================================================
echo [JOB %JOB_NUM%] %JOB_NAME%
echo =========================================================================
echo Script: %SCRIPT_PATH%
echo Started: %date% %time%
echo -------------------------------------------------------------------------
echo.

echo ----------------------------------------- >> "%LOG_FILE%"
echo [%JOB_NUM%] %JOB_NAME% >> "%LOG_FILE%"
echo Script: %SCRIPT_PATH% >> "%LOG_FILE%"
echo Started: %date% %time% >> "%LOG_FILE%"
echo ----------------------------------------- >> "%LOG_FILE%"

REM Execute TypeScript script and capture both stdout and stderr
pnpm tsx %SCRIPT_PATH% >> "%LOG_FILE%" 2>&1

set EXIT_CODE=!errorlevel!
set JOB_END=%time%
echo.

if !EXIT_CODE! equ 0 (
    echo [%JOB_NUM%] SUCCESS: %JOB_NAME%
    echo Status: SUCCESS >> "%LOG_FILE%"
    echo [%JOB_NUM%] SUCCESS: %JOB_NAME% (Start: %JOB_START%, End: %JOB_END%) >> "%SUMMARY_FILE%"
) else (
    echo [%JOB_NUM%] ERROR: %JOB_NAME% (Exit Code: !EXIT_CODE!)
    echo Status: FAILED ^(Exit Code: !EXIT_CODE!^) >> "%LOG_FILE%"
    
    REM Log to error file with more details
    echo. >> "%ERROR_FILE%"
    echo ========================================= >> "%ERROR_FILE%"
    echo ERROR IN JOB %JOB_NUM%: %JOB_NAME% >> "%ERROR_FILE%"
    echo ========================================= >> "%ERROR_FILE%"
    echo Script: %SCRIPT_PATH% >> "%ERROR_FILE%"
    echo Exit Code: !EXIT_CODE! >> "%ERROR_FILE%"
    echo Started: %JOB_START% >> "%ERROR_FILE%"
    echo Failed: %JOB_END% >> "%ERROR_FILE%"
    echo ----------------------------------------- >> "%ERROR_FILE%"
    echo Check main log for details: %LOG_FILE% >> "%ERROR_FILE%"
    echo. >> "%ERROR_FILE%"
    
    REM Increment error counter
    set /a ERROR_COUNT+=1
    
    echo [%JOB_NUM%] ERROR: %JOB_NAME% ^(Exit Code: !EXIT_CODE!^) (Start: %JOB_START%, End: %JOB_END%) >> "%SUMMARY_FILE%"
)

echo Finished: %date% %time% >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

REM Wait 2 seconds between jobs
timeout /t 2 /nobreak >nul

goto :eof

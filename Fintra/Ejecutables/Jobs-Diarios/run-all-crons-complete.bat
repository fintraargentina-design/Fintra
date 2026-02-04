@echo off
REM ========================================
REM FINTRA - Run All 23 Cron Jobs Complete
REM ========================================
REM Version: 2.1 Complete
REM Updated: 2026-02-03
REM Ejecuta los 23 crons diarios recomendados

setlocal enabledelayedexpansion

REM Configuration
set LOG_DIR=logs
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOG_FILE=%LOG_DIR%\cron-complete-%TIMESTAMP%.log
set ERROR_FILE=%LOG_DIR%\cron-complete-%TIMESTAMP%.error.log
set SUMMARY_FILE=%LOG_DIR%\cron-complete-%TIMESTAMP%.summary.log
set ERROR_COUNT=0
set API_BASE=http://localhost:3000/api/cron

REM Create logs directory
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Initialize logs
echo ========================================= > "%LOG_FILE%"
echo FINTRA - Complete 22 Crons Execution >> "%LOG_FILE%"
echo Started: %date% %time% >> "%LOG_FILE%"
echo ========================================= >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

echo ========================================= > "%ERROR_FILE%"
echo FINTRA - Error Log >> "%ERROR_FILE%"
echo Started: %date% %time% >> "%ERROR_FILE%"
echo ========================================= >> "%ERROR_FILE%"
echo. >> "%ERROR_FILE%"

echo ========================================= > "%SUMMARY_FILE%"
echo FINTRA - Execution Summary >> "%SUMMARY_FILE%"
echo Started: %date% %time% >> "%SUMMARY_FILE%"
echo ========================================= >> "%SUMMARY_FILE%"
echo. >> "%SUMMARY_FILE%"

echo.
echo =========================================================================
echo [FINTRA] Starting all 23 cron jobs (Complete Daily Update)
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
REM OPCION 1: Master Orchestrator (10 crons)
REM ========================================
echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 1: Master Orchestrator (10 Crons Automaticos)             ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_api 1 "Master-All Orchestrator" "master-all"

REM ========================================
REM OPCION 2: Crons Complementarios (12 adicionales)
REM ========================================
echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 2: Agregadores de Industria (6 crons)                     ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_api 11 "Industry Performance Aggregator" "industry-performance-aggregator"
call :run_api 12 "Industry Performance Windows" "industry-performance-windows-aggregator"
call :run_api 13 "Sector Performance Windows" "sector-performance-windows-aggregator"
call :run_api 14 "Industry Benchmarks" "industry-benchmarks-aggregator"
call :run_api 15 "Sector PE Aggregator" "sector-pe-aggregator"
call :run_api 16 "Industry PE Aggregator" "industry-pe-aggregator"

echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 3: Datos Complementarios (4 crons)                        ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_api 17 "FMP Peers Bulk" "fmp-peers-bulk"
call :run_api 18 "Dividends Bulk V2" "dividends-bulk-v2"
call :run_api 19 "TTM Valuation Incremental" "ttm-valuation-incremental"
call :run_api 20 "Company Profile Bulk" "company-profile-bulk"
call :run_api 21 "Compute Global Ranks" "compute-ranks"

echo.
echo.
echo #########################################################################
echo ###                                                                     ###
echo ###   PHASE 4: SEC Filings (2 crons - Opcional)                       ###
echo ###                                                                     ###
echo #########################################################################
echo.

call :run_api 22 "SEC 10-K Ingest" "sec-10k-ingest"
call :run_api 23 "SEC 8-K Ingest" "sec-8k-ingest"

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
echo ###   ALL 23 CRON JOBS COMPLETED                                      ###
echo ###                                                                     ###
echo #########################################################################
echo.
echo =========================================================================
echo EXECUTION SUMMARY
echo =========================================================================
echo   Total Jobs: 23 crons
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
    echo ✅ SUCCESS: All 23 jobs completed without errors!
)
echo =========================================================================
echo.
pause
goto :eof

REM ========================================
REM Function: run_api
REM Arguments:
REM   %1 = Job number
REM   %2 = Job name
REM   %3 = API endpoint (sin /api/cron/)
REM ========================================
:run_api
set JOB_NUM=%~1
set JOB_NAME=%~2
set ENDPOINT=%~3
set JOB_START=%time%
set FULL_URL=%API_BASE%/%ENDPOINT%

echo.
echo =========================================================================
echo [JOB %JOB_NUM%] %JOB_NAME%
echo =========================================================================
echo API: %FULL_URL%
echo Started: %date% %time%
echo -------------------------------------------------------------------------
echo.

echo ----------------------------------------- >> "%LOG_FILE%"
echo [%JOB_NUM%] %JOB_NAME% >> "%LOG_FILE%"
echo API: %FULL_URL% >> "%LOG_FILE%"
echo Started: %date% %time% >> "%LOG_FILE%"
echo ----------------------------------------- >> "%LOG_FILE%"

REM Execute API call using curl
curl -X GET "%FULL_URL%" >> "%LOG_FILE%" 2>&1

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
    echo API: %FULL_URL% >> "%ERROR_FILE%"
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

REM Wait 5 seconds between jobs
timeout /t 5 /nobreak >nul

goto :eof

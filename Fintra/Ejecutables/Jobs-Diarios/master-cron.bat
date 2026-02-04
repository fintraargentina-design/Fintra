@echo off
REM ========================================
REM FINTRA - Master Cron Orchestrator
REM ========================================
REM Version: 2.0
REM Updated: 2026-02-02
REM Executes master-all endpoint (10 crons)

setlocal enabledelayedexpansion

REM Configuration
set API_BASE=http://localhost:3000/api/cron
set LOG_DIR=logs
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOG_FILE=%LOG_DIR%\master-cron-%TIMESTAMP%.log

REM Create logs directory
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo ========================================= > "%LOG_FILE%"
echo FINTRA - Master Cron Orchestrator >> "%LOG_FILE%"
echo Started: %date% %time% >> "%LOG_FILE%"
echo ========================================= >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

echo.
echo =========================================================================
echo [FINTRA] Master Cron Orchestrator
echo =========================================================================
echo.
echo Ejecutando: %API_BASE%/master-all
echo.
echo Esto ejecutará los siguientes 10 crons automáticamente:
echo   1. sync-universe
echo   2. prices-daily-bulk
echo   3. financials-bulk
echo   4. performance-bulk
echo   5. sector-performance-aggregator
echo   6. performance-windows-aggregator
echo   7. fmp-bulk (snapshots)
echo   8. valuation-bulk
echo   9. sector-benchmarks
echo   10. market-state-bulk
echo.
echo Duración Estimada: 3-4 horas
echo Log: %LOG_FILE%
echo.
echo =========================================================================
echo.

REM Execute API call
curl -X GET "%API_BASE%/master-all" >> "%LOG_FILE%" 2>&1

set EXIT_CODE=%errorlevel%

if %EXIT_CODE% equ 0 (
    echo.
    echo ✅ Master Cron Finalizado con Éxito
    echo Status: SUCCESS >> "%LOG_FILE%"
) else (
    echo.
    echo ❌ Master Cron Finalizado con Errores (Exit Code: %EXIT_CODE%)
    echo Status: FAILED (Exit Code: %EXIT_CODE%) >> "%LOG_FILE%"
)

echo. >> "%LOG_FILE%"
echo Finished: %date% %time% >> "%LOG_FILE%"

echo.
echo Check log file: %LOG_FILE%
echo.
pause

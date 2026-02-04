@echo off
REM Script para ejecutar actualización diaria completa de Fintra (LOCAL - Windows)
REM Uso: scripts\run-daily-update.bat

setlocal enabledelayedexpansion

set BASE_URL=http://localhost:3000
set LOG_DIR=logs
set TIMESTAMP=%date:~-4,4%%date:~-7,2%%date:~-10,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOG_FILE=%LOG_DIR%\cron-%TIMESTAMP%.log

REM Crear directorio de logs
if not exist %LOG_DIR% mkdir %LOG_DIR%

echo ================================================================= >> %LOG_FILE%
echo   FINTRA - ACTUALIZACION DIARIA                                  >> %LOG_FILE%
echo   Fecha: %date% %time%                                            >> %LOG_FILE%
echo ================================================================= >> %LOG_FILE%
echo. >> %LOG_FILE%

echo Verificando servidor...
curl -s --max-time 5 %BASE_URL%/api/health > nul 2>&1
if errorlevel 1 (
  echo ERROR: Servidor no esta corriendo en %BASE_URL% >> %LOG_FILE%
  echo Ejecuta: npm run dev >> %LOG_FILE%
  exit /b 1
)
echo Servidor OK >> %LOG_FILE%
echo. >> %LOG_FILE%

REM ================================================================
REM NIVEL 1: DATOS BASE
REM ================================================================
echo ================================================================= >> %LOG_FILE%
echo   NIVEL 1: INGESTA DE DATOS                                      >> %LOG_FILE%
echo ================================================================= >> %LOG_FILE%
echo. >> %LOG_FILE%

call :run_job "1.1" "FMP Bulk" "/api/cron/fmp-bulk" 3600
if errorlevel 1 goto :error

call :run_job "1.2" "Dividends Bulk" "/api/cron/dividends-bulk-v2" 600

REM ================================================================
REM NIVEL 1.5: VALUACION TTM (INCREMENTAL)
REM ================================================================
echo ================================================================= >> %LOG_FILE%
echo   NIVEL 1.5: VALUACION TTM INCREMENTAL                        >> %LOG_FILE%
echo ================================================================= >> %LOG_FILE%
echo. >> %LOG_FILE%

echo [1.5] TTM Valuation (Incremental) >> %LOG_FILE%
echo Ejecutando: pnpm tsx scripts/pipeline/incremental-ttm-valuation.ts >> %LOG_FILE%
pnpm tsx scripts/pipeline/incremental-ttm-valuation.ts >> %LOG_FILE% 2>&1
if errorlevel 1 (
  echo WARNING: TTM Valuation fallo, pero continuando... >> %LOG_FILE%
)
echo. >> %LOG_FILE%

REM ================================================================
REM NIVEL 2: CLASIFICACION
REM ================================================================
echo ================================================================= >> %LOG_FILE%
echo   NIVEL 2: CLASIFICACION                                         >> %LOG_FILE%
echo ================================================================= >> %LOG_FILE%
echo. >> %LOG_FILE%

call :run_job "2.1" "Industry Classification" "/api/cron/industry-classification-sync" 600
call :run_job "2.2" "Sector Benchmarks" "/api/cron/master-benchmark" 900

REM ================================================================
REM NIVEL 3: PERFORMANCE
REM ================================================================
echo ================================================================= >> %LOG_FILE%
echo   NIVEL 3: PERFORMANCE                                           >> %LOG_FILE%
echo ================================================================= >> %LOG_FILE%
echo. >> %LOG_FILE%

call :run_job "3.1" "Industry Performance" "/api/cron/industry-performance-aggregator" 1200
call :run_job "3.2" "Industry Windows" "/api/cron/industry-performance-windows-aggregator" 900
call :run_job "3.3" "Industry Benchmarks" "/api/cron/industry-benchmarks-aggregator" 900

REM ================================================================
REM NIVEL 4: SNAPSHOTS
REM ================================================================
echo ================================================================= >> %LOG_FILE%
echo   NIVEL 4: MOTOR FGOS                                            >> %LOG_FILE%
echo ================================================================= >> %LOG_FILE%
echo. >> %LOG_FILE%

call :run_job "4.1" "Bulk Update" "/api/cron/bulk-update" 7200
if errorlevel 1 goto :error

REM ================================================================
REM NIVEL 5: RANKINGS
REM ================================================================
echo ================================================================= >> %LOG_FILE%
echo   NIVEL 5: RANKINGS                                              >> %LOG_FILE%
echo ================================================================= >> %LOG_FILE%
echo. >> %LOG_FILE%

call :run_job "5.1" "Compute Ranks" "/api/cron/compute-ranks" 900
call :run_job "5.2" "Market State" "/api/cron/market-state-bulk" 600

REM ================================================================
REM RESUMEN
REM ================================================================
echo ================================================================= >> %LOG_FILE%
echo   ACTUALIZACION COMPLETADA                                       >> %LOG_FILE%
echo   Log: %LOG_FILE%                                                >> %LOG_FILE%
echo ================================================================= >> %LOG_FILE%

echo.
echo Actualizacion completada exitosamente
echo Ver log completo: type %LOG_FILE%
goto :eof

:run_job
  set LEVEL=%~1
  set NAME=%~2
  set ENDPOINT=%~3
  set TIMEOUT=%~4

  echo [%LEVEL%] %NAME% >> %LOG_FILE%
  echo Ejecutando: %NAME%

  set START_TIME=%time%

  curl -s -o temp_response.json "%BASE_URL%%ENDPOINT%" 2>&1
  set EXIT_CODE=!errorlevel!

  if !EXIT_CODE! EQU 0 (
    echo OK - Completado >> %LOG_FILE%
    echo OK - %NAME% completado
  ) else (
    echo FALLO - Exit code: !EXIT_CODE! >> %LOG_FILE%
    echo ERROR - %NAME% fallo
    type temp_response.json >> %LOG_FILE% 2>&1
    del temp_response.json 2>nul
    exit /b !EXIT_CODE!
  )

  echo. >> %LOG_FILE%
  timeout /t 5 /nobreak > nul

  del temp_response.json 2>nul
  goto :eof

:error
  echo.
  echo ERROR CRITICO - Abortando ejecucion
  echo Ver detalles en: %LOG_FILE%
  exit /b 1

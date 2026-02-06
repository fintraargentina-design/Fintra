@echo off
REM ====================================
REM Convert run-all-crons-direct.ps1 to EXE
REM ====================================

echo [FINTRA] Converting PowerShell script to EXE...
echo.

REM Stop any running instance
taskkill /F /IM FintraCronJobs.exe 2>nul

REM Delete old exe
if exist "%~dp0FintraCronJobs.exe" (
    echo Removing old executable...
    del /F /Q "%~dp0FintraCronJobs.exe"
    timeout /t 2 /nobreak >nul
)

REM Generate new exe
pwsh.exe -ExecutionPolicy Bypass -NoProfile -Command "Import-Module ps2exe -Force; Invoke-ps2exe -inputFile '%~dp0run-all-crons-direct.ps1' -outputFile '%~dp0FintraCronJobs.exe' -noConsole:$false -title 'Fintra Cron Jobs' -description 'Fintra Daily Cron Jobs Executor' -company 'Fintra' -product 'Fintra Pipeline' -version '3.0.2.0'"

echo.
if exist "%~dp0FintraCronJobs.exe" (
    echo [FINTRA] Conversion complete!
    echo Output: %~dp0FintraCronJobs.exe
) else (
    echo [ERROR] Conversion failed!
)
echo.
pause

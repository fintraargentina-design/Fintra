# ========================================
# FINTRA - Run All Cron Jobs (Direct - No Server)
# ========================================
# Version: 1.0 Direct
# Updated: 2026-02-02
# Executes TypeScript scripts directly without HTTP server

param(
    [string]$LogDir = "logs"
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Create logs directory
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

$LogFile = Join-Path $LogDir "cron-direct-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LogFile -Value $logMessage
}

function Run-Script {
    param(
        [int]$JobNum,
        [string]$JobName,
        [string]$ScriptPath
    )

    Write-Host "`n=========================================================================" -ForegroundColor Yellow
    Write-Host "[JOB $JobNum] $JobName" -ForegroundColor Cyan
    Write-Host "=========================================================================" -ForegroundColor Yellow
    Write-Host "Script: $ScriptPath" -ForegroundColor Gray
    Write-Host "-------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Log "========================================="
    Write-Log "[$JobNum] Starting: $JobName"
    Write-Log "[$JobNum] Script: $ScriptPath"
    Write-Log "========================================="

    $startTime = Get-Date

    try {
        # Execute TypeScript script directly with pnpm tsx
        # Use Tee-Object to show output in real-time AND log it
        pnpm tsx $ScriptPath 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Host

        if ($LASTEXITCODE -eq 0) {
            $duration = (Get-Date) - $startTime
            Write-Host "=========================================================================" -ForegroundColor Green
            Write-Host "[JOB $JobNum] ✅ SUCCESS: $JobName (Duration: $($duration.TotalSeconds.ToString('F1'))s)" -ForegroundColor Green
            Write-Host "=========================================================================" -ForegroundColor Green
            Write-Log "[$JobNum] ✅ SUCCESS: $JobName (Duration: $($duration.TotalSeconds.ToString('F1'))s)"
            return $true
        } else {
            $duration = (Get-Date) - $startTime
            Write-Host "=========================================================================" -ForegroundColor Red
            Write-Host "[JOB $JobNum] ❌ ERROR: $JobName (Exit Code: $LASTEXITCODE, Duration: $($duration.TotalSeconds.ToString('F1'))s)" -ForegroundColor Red
            Write-Host "=========================================================================" -ForegroundColor Red
            Write-Log "[$JobNum] ❌ ERROR: $JobName (Exit Code: $LASTEXITCODE, Duration: $($duration.TotalSeconds.ToString('F1'))s)"
            return $false
        }
    }
    catch {
        $duration = (Get-Date) - $startTime
        Write-Log "[$JobNum] ❌ ERROR: $JobName (Duration: $($duration.TotalSeconds.ToString('F1'))s)"
        Write-Log "[$JobNum] Exception: $($_.Exception.Message)"
        return $false
    }
    finally {
        Write-Log ""
        Start-Sleep -Seconds 2
    }
}

# ========================================
# START EXECUTION
# ========================================

Write-Log "========================================="
Write-Log "FINTRA - Direct Cron Jobs Execution"
Write-Log "(No HTTP Server Required)"
Write-Log "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Log "Log File: $LogFile"
Write-Log "========================================="
Write-Log ""

$jobs = @()
$successCount = 0
$failureCount = 0

# ========================================
# PHASE 1: Universe and Classification
# ========================================
Write-Host "`n`n#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 1: Universe and Classification                             ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

$jobs += Run-Script 1 "Sync Universe" "scripts\pipeline\01-sync-universe.ts"
$jobs += Run-Script 2 "Industry Classification" "scripts\pipeline\02-industry-classification-sync.ts"

# ========================================
# PHASE 2: Raw Data (FMP API)
# ========================================
Write-Host "`n`n#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 2: Raw Data from FMP API                                   ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

$jobs += Run-Script 3 "Prices Daily Bulk" "scripts\pipeline\03-prices-daily-bulk.ts"
$jobs += Run-Script 4 "Financials Bulk" "scripts\pipeline\04-financials-bulk.ts"
$jobs += Run-Script 5 "Company Profile Bulk" "scripts\pipeline\05-company-profile-bulk.ts"

# ========================================
# PHASE 3: Performance Aggregators
# ========================================
Write-Host "`n`n#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 3: Performance Aggregators                                 ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

$jobs += Run-Script 6 "Industry Performance 1D" "scripts\pipeline\06-industry-performance-aggregator.ts"
$jobs += Run-Script 7 "Sector Performance 1D" "scripts\pipeline\07-sector-performance-aggregator.ts"
$jobs += Run-Script 8 "Sector Perf Windows" "scripts\pipeline\08-sector-performance-windows-aggregator.ts"
$jobs += Run-Script 9 "Industry Perf Windows" "scripts\pipeline\09-industry-performance-windows-aggregator.ts"
$jobs += Run-Script 10 "Sector PE Aggregator" "scripts\pipeline\10-sector-pe-aggregator.ts"
$jobs += Run-Script 11 "Industry PE Aggregator" "scripts\pipeline\11-industry-pe-aggregator.ts"

# ========================================
# PHASE 4: Benchmarks (Critical for FGOS)
# ========================================
Write-Host "`n`n#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 4: Sector Benchmarks (CRITICAL)                            ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

$jobs += Run-Script 12 "Sector Benchmarks" "scripts\pipeline\12-sector-benchmarks.ts"

# ========================================
# PHASE 5: Individual Metrics
# ========================================
Write-Host "`n`n#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 5: Individual Performance & Valuation                      ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

$jobs += Run-Script 13 "Performance Bulk" "scripts\pipeline\13-performance-bulk.ts"
$jobs += Run-Script 14 "Market State Bulk" "scripts\pipeline\14-market-state-bulk.ts"
$jobs += Run-Script 15 "Dividends Bulk V2" "scripts\pipeline\15-dividends-bulk-v2.ts"

# ========================================
# PHASE 6: Final Snapshots (CRITICAL)
# ========================================
Write-Host "`n`n#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 6: Fintra Snapshots (CORE)                                 ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

$jobs += Run-Script 16 "FMP Bulk Snapshots" "scripts\pipeline\16-fmp-bulk-snapshots.ts"
$jobs += Run-Script 17 "Healthcheck Snapshots" "scripts\pipeline\17-healthcheck-snapshots.ts"

# ========================================
# PHASE 7: Final Calculations (FGOS + IFS)
# ========================================
Write-Host "`n`n#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 7: Final Calculations (CRITICAL)                           ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

$jobs += Run-Script 18 "Recompute FGOS All" "scripts\pipeline\18-recompute-fgos-all.ts"
$jobs += Run-Script 19 "IFS Memory Aggregator" "scripts\pipeline\ifs-memory-aggregator.ts"

# ========================================
# Summary
# ========================================
$successCount = ($jobs | Where-Object { $_ -eq $true }).Count
$failureCount = ($jobs | Where-Object { $_ -eq $false }).Count

Write-Log "========================================="
Write-Log "EXECUTION SUMMARY"
Write-Log "========================================="
Write-Log "Total Jobs: $($jobs.Count)"
Write-Log "Successful: $successCount"
Write-Log "Failed: $failureCount"
Write-Log "========================================="
Write-Log "Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Log "========================================="

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "ALL CRON JOBS COMPLETED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Total Jobs: $($jobs.Count)" -ForegroundColor White
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed: $failureCount" -ForegroundColor $(if ($failureCount -gt 0) { 'Red' } else { 'Green' })
Write-Host "Log File: $LogFile" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green

if ($failureCount -gt 0) {
    exit 1
} else {
    exit 0
}

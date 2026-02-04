# ========================================
# FINTRA - Run All Cron Jobs (PowerShell)
# ========================================
# Version: 1.0
# Updated: 2026-02-02

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$LogDir = "logs",
    [int]$DefaultTimeout = 600
)

# Configuration
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Create logs directory
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

$LogFile = Join-Path $LogDir "cron-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LogFile -Value $logMessage
}

function Run-CronJob {
    param(
        [int]$JobNum,
        [string]$JobName,
        [string]$Endpoint,
        [int]$Timeout = 600
    )

    Write-Log "========================================="
    Write-Log "[$JobNum] Starting: $JobName"
    Write-Log "[$JobNum] URL: $BaseUrl$Endpoint"
    Write-Log "[$JobNum] Timeout: ${Timeout}s"
    Write-Log "========================================="

    $url = "$BaseUrl$Endpoint"
    $startTime = Get-Date

    try {
        $response = Invoke-WebRequest -Uri $url -Method POST `
            -ContentType "application/json" `
            -TimeoutSec $Timeout `
            -UseBasicParsing `
            -ErrorAction Stop

        $duration = (Get-Date) - $startTime
        Write-Log "[$JobNum] ✅ SUCCESS: $JobName (Duration: $($duration.TotalSeconds.ToString('F1'))s)"
        Write-Log "[$JobNum] Response: $($response.StatusCode) $($response.StatusDescription)"
        
        # Log response body (truncated)
        $responseBody = $response.Content
        if ($responseBody.Length -gt 500) {
            $responseBody = $responseBody.Substring(0, 500) + "..."
        }
        Write-Log "[$JobNum] Response Body: $responseBody"
        
        return $true
    }
    catch {
        $duration = (Get-Date) - $startTime
        Write-Log "[$JobNum] ❌ ERROR: $JobName (Duration: $($duration.TotalSeconds.ToString('F1'))s)"
        Write-Log "[$JobNum] Error: $($_.Exception.Message)"
        
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
Write-Log "FINTRA - All Cron Jobs Execution"
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
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 1: Universe and Classification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$jobs += Run-CronJob 1 "Sync Universe" "/api/cron/sync-universe" 600
$jobs += Run-CronJob 2 "Industry Classification" "/api/cron/industry-classification-sync" 900

# ========================================
# PHASE 2: Raw Data (FMP API)
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 2: Raw Data from FMP API" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$jobs += Run-CronJob 3 "Prices Daily Bulk" "/api/cron/prices-daily-bulk" 1200
$jobs += Run-CronJob 4 "Financials Bulk" "/api/cron/financials-bulk" 1800
$jobs += Run-CronJob 5 "Company Profile Bulk" "/api/cron/company-profile-bulk" 900

# ========================================
# PHASE 3: Performance Aggregators
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 3: Performance Aggregators" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$jobs += Run-CronJob 6 "Industry Performance 1D" "/api/cron/industry-performance-aggregator" 1200
$jobs += Run-CronJob 7 "Sector Performance 1D" "/api/cron/sector-performance-aggregator" 900
$jobs += Run-CronJob 8 "Sector Perf Windows" "/api/cron/sector-performance-windows-aggregator" 1200
$jobs += Run-CronJob 9 "Industry Perf Windows" "/api/cron/industry-performance-windows-aggregator" 1200

# ========================================
# PHASE 4: Benchmarks (Critical for FGOS)
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 4: Sector Benchmarks (CRITICAL)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$jobs += Run-CronJob 10 "Sector Benchmarks" "/api/cron/sector-benchmarks" 900

# ========================================
# PHASE 5: Individual Metrics
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 5: Individual Performance & Valuation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$jobs += Run-CronJob 11 "Performance Bulk" "/api/cron/performance-bulk" 1200
$jobs += Run-CronJob 12 "Market State Bulk" "/api/cron/market-state-bulk" 600
$jobs += Run-CronJob 13 "Dividends Bulk V2" "/api/cron/dividends-bulk-v2" 900

# ========================================
# PHASE 6: Final Snapshots (CRITICAL)
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 6: Fintra Snapshots (CORE)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$jobs += Run-CronJob 14 "FMP Bulk Update" "/api/cron/bulk-update" 7200
$jobs += Run-CronJob 15 "Healthcheck Snapshots" "/api/cron/healthcheck-fmp-bulk" 300

# ========================================
# PHASE 7: Additional Data
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 7: Additional Data" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$jobs += Run-CronJob 16 "FMP Peers Bulk" "/api/cron/fmp-peers-bulk" 900
$jobs += Run-CronJob 17 "Valuation Bulk" "/api/cron/valuation-bulk" 1200

# ========================================
# PHASE 8: Validation
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 8: Post-Processing Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$jobs += Run-CronJob 18 "Run Validation" "/api/cron/validation" 600

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

# Exit with error code if any job failed
if ($failureCount -gt 0) {
    exit 1
} else {
    exit 0
}

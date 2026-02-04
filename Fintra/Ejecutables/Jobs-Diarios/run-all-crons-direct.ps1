# ========================================
# FINTRA - Run All 22 Cron Jobs Direct (VPS)
# ========================================
# Version: 3.0 Direct Execution
# Updated: 2026-02-03
# Ejecuta 22 scripts TypeScript directamente (sin servidor web)

# Configuration
$ScriptRoot = Split-Path -Parent $PSScriptRoot
$ScriptRoot = Split-Path -Parent $ScriptRoot
$ScriptsDir = Join-Path $ScriptRoot "scripts\pipeline"
$LogDir = Join-Path $PSScriptRoot "logs"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = "$LogDir\cron-direct-$Timestamp.log"
$ErrorFile = "$LogDir\cron-direct-$Timestamp.error.log"
$SummaryFile = "$LogDir\cron-direct-$Timestamp.summary.log"
$ErrorCount = 0

# Fix console encoding for UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Create logs directory
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

# Initialize logs
@"
=========================================
FINTRA - Direct Cron Jobs Execution (VPS)
Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
=========================================

"@ | Out-File $LogFile -Encoding UTF8

@"
=========================================
FINTRA - Error Log
Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
=========================================

"@ | Out-File $ErrorFile -Encoding UTF8

@"
=========================================
FINTRA - Execution Summary
Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
=========================================

"@ | Out-File $SummaryFile -Encoding UTF8

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "[FINTRA] Starting Direct Cron Jobs Execution (VPS Mode)" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "LOG FILES:" -ForegroundColor Yellow
Write-Host "  Main Log:    $LogFile" -ForegroundColor Gray
Write-Host "  Errors Only: $ErrorFile" -ForegroundColor Gray
Write-Host "  Summary:     $SummaryFile" -ForegroundColor Gray
Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""

# Function to run TypeScript script directly
function Invoke-DirectScript {
    param(
        [int]$JobNum,
        [string]$JobName,
        [string]$ScriptPath
    )
    
    $JobStart = Get-Date
    $FullPath = Join-Path $ScriptsDir $ScriptPath
    
    Write-Host ""
    Write-Host "=========================================================================" -ForegroundColor White
    Write-Host "[JOB $JobNum] $JobName" -ForegroundColor Cyan
    Write-Host "=========================================================================" -ForegroundColor White
    Write-Host "Script: $FullPath" -ForegroundColor Gray
    Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host "-------------------------------------------------------------------------" -ForegroundColor White
    Write-Host ""
    
    # Log to main file
    @"
-----------------------------------------
[$JobNum] $JobName
Script: $FullPath
Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-----------------------------------------
"@ | Out-File $LogFile -Append -Encoding UTF8
    
    # Execute TypeScript script with real-time output
    try {
        # Change to project root and execute
        Push-Location $ScriptRoot
        
        Write-Host "Executing: npx tsx $FullPath" -ForegroundColor DarkGray
        Write-Host ""
        
        # Create temp file for output
        $tempOut = [System.IO.Path]::GetTempFileName()
        
        # Execute with tee to show AND log
        $command = "npx tsx `"$FullPath`" 2>&1 | Tee-Object -FilePath `"$tempOut`""
        Invoke-Expression $command
        $exitCode = $LASTEXITCODE
        
        # Read and log output
        if (Test-Path $tempOut) {
            $output = Get-Content $tempOut -Raw -ErrorAction SilentlyContinue
            if ($output) {
                $output | Out-File $LogFile -Append -Encoding UTF8
            }
            Remove-Item $tempOut -ErrorAction SilentlyContinue
        }
        
        Pop-Location
        
    } catch {
        Pop-Location
        $exitCode = 1
        $errorMessage = $_.Exception.Message
        
        Write-Host "ERROR: $errorMessage" -ForegroundColor Red
        "ERROR: $errorMessage" | Out-File $LogFile -Append -Encoding UTF8
    }
    
    $JobEnd = Get-Date
    $Duration = ($JobEnd - $JobStart).TotalSeconds
    
    Write-Host ""
    
    if ($exitCode -eq 0) {
        Write-Host "[$JobNum] SUCCESS: $JobName" -ForegroundColor Green
        "Status: SUCCESS" | Out-File $LogFile -Append -Encoding UTF8
        "[$JobNum] SUCCESS: $JobName (Duration: $([math]::Round($Duration, 2))s)" | Out-File $SummaryFile -Append -Encoding UTF8
    } else {
        Write-Host "[$JobNum] ERROR: $JobName (Exit Code: $exitCode)" -ForegroundColor Red
        "Status: FAILED (Exit Code: $exitCode)" | Out-File $LogFile -Append -Encoding UTF8
        
        # Log to error file
        $errorLogEntry = @"

=========================================
ERROR IN JOB $JobNum - $JobName
=========================================
Script: $FullPath
Exit Code: $exitCode
Started: $($JobStart.ToString('yyyy-MM-dd HH:mm:ss'))
Failed: $($JobEnd.ToString('yyyy-MM-dd HH:mm:ss'))
Duration: $([math]::Round($Duration, 2))s
-----------------------------------------
Check main log for details: $LogFile

"@
        $errorLogEntry | Out-File $ErrorFile -Append -Encoding UTF8
        
        $script:ErrorCount++
        
        "[$JobNum] ERROR: $JobName (Exit Code: $exitCode, Duration: $([math]::Round($Duration, 2))s)" | Out-File $SummaryFile -Append -Encoding UTF8
    }
    
    "Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $LogFile -Append -Encoding UTF8
    "" | Out-File $LogFile -Append -Encoding UTF8
    
    # Wait 5 seconds between jobs
    Start-Sleep -Seconds 5
}

# ========================================
# PHASE 1: Master-All (10 crons automáticos)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 1: Master-All (10 Crons Automaticos)                      ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 1 -JobName "Sync Universe" -ScriptPath "01-sync-universe.ts"
Invoke-DirectScript -JobNum 2 -JobName "Prices Daily Bulk" -ScriptPath "03-prices-daily-bulk.ts"
Invoke-DirectScript -JobNum 3 -JobName "Financials Bulk" -ScriptPath "04-financials-bulk.ts"
Invoke-DirectScript -JobNum 4 -JobName "Performance Bulk" -ScriptPath "13-performance-bulk.ts"
Invoke-DirectScript -JobNum 5 -JobName "Sector Performance Aggregator" -ScriptPath "07-sector-performance-aggregator.ts"
Invoke-DirectScript -JobNum 6 -JobName "Performance Windows Aggregator" -ScriptPath "run-performance-windows-aggregator.ts"
Invoke-DirectScript -JobNum 7 -JobName "FMP Bulk Snapshots" -ScriptPath "16-fmp-bulk-snapshots.ts"
Invoke-DirectScript -JobNum 8 -JobName "Sector Benchmarks" -ScriptPath "12-sector-benchmarks.ts"
Invoke-DirectScript -JobNum 9 -JobName "Market State Bulk" -ScriptPath "14-market-state-bulk.ts"

# ========================================
# PHASE 2: Agregadores de Industria (6 crons)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 2: Agregadores de Industria (6 crons)                     ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 10 -JobName "Industry Performance Aggregator" -ScriptPath "06-industry-performance-aggregator.ts"
Invoke-DirectScript -JobNum 11 -JobName "Industry Performance Windows" -ScriptPath "09-industry-performance-windows-aggregator.ts"
Invoke-DirectScript -JobNum 12 -JobName "Sector Performance Windows" -ScriptPath "08-sector-performance-windows-aggregator.ts"
Invoke-DirectScript -JobNum 13 -JobName "Industry Benchmarks" -ScriptPath "run-industry-benchmarks-aggregator.ts"
Invoke-DirectScript -JobNum 14 -JobName "Sector PE Aggregator" -ScriptPath "10-sector-pe-aggregator.ts"
Invoke-DirectScript -JobNum 15 -JobName "Industry PE Aggregator" -ScriptPath "11-industry-pe-aggregator.ts"

# ========================================
# PHASE 3: Datos Complementarios (5 crons)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 3: Datos Complementarios (5 crons)                        ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 16 -JobName "FMP Peers Bulk" -ScriptPath "run-peers-cron.ts"
Invoke-DirectScript -JobNum 17 -JobName "Dividends Bulk V2" -ScriptPath "15-dividends-bulk-v2.ts"
Invoke-DirectScript -JobNum 18 -JobName "TTM Valuation Incremental" -ScriptPath "incremental-ttm-valuation.ts"
Invoke-DirectScript -JobNum 19 -JobName "Company Profile Bulk" -ScriptPath "05-company-profile-bulk.ts"
Invoke-DirectScript -JobNum 20 -JobName "Compute Global Ranks" -ScriptPath "run-master-cron.ts"

# ========================================
# PHASE 4: SEC Filings (2 crons - Opcional)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 4: SEC Filings (2 crons - Opcional)                       ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Write-Host "⚠️  SEC Filings scripts not yet implemented in pipeline folder" -ForegroundColor Yellow
Write-Host "   Skipping Job 21: SEC 10-K Ingest" -ForegroundColor Gray
Write-Host "   Skipping Job 22: SEC 8-K Ingest" -ForegroundColor Gray
Write-Host ""

# Invoke-DirectScript -JobNum 21 -JobName "SEC 10-K Ingest" -ScriptPath "sec-10k-ingest.ts"
# Invoke-DirectScript -JobNum 22 -JobName "SEC 8-K Ingest" -ScriptPath "sec-8k-ingest.ts"

# ========================================
# Summary
# ========================================
@"

=========================================
Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Total Errors: $ErrorCount
=========================================
"@ | Out-File $LogFile -Append -Encoding UTF8

@"

=========================================
Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Total Errors: $ErrorCount
=========================================
"@ | Out-File $SummaryFile -Append -Encoding UTF8

if ($ErrorCount -gt 0) {
    @"

=========================================
TOTAL ERRORS: $ErrorCount
Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
=========================================
"@ | Out-File $ErrorFile -Append -Encoding UTF8
}

Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Green
Write-Host "###                                                                     ###" -ForegroundColor Green
Write-Host "###   ALL CRON JOBS COMPLETED                                         ###" -ForegroundColor Green
Write-Host "###                                                                     ###" -ForegroundColor Green
Write-Host "#########################################################################" -ForegroundColor Green
Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "EXECUTION SUMMARY" -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "  Total Jobs: 20 crons (22 total, 2 SEC skipped)" -ForegroundColor White
Write-Host "  Total Errors: $ErrorCount" -ForegroundColor $(if ($ErrorCount -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "LOG FILES GENERATED:" -ForegroundColor Yellow
Write-Host "  [1] Main Log:    $LogFile" -ForegroundColor Gray
Write-Host "  [2] Errors Only: $ErrorFile" -ForegroundColor Gray
Write-Host "  [3] Summary:     $SummaryFile" -ForegroundColor Gray
Write-Host ""

if ($ErrorCount -gt 0) {
    Write-Host "⚠️  WARNING: $ErrorCount job(s) failed! Check error log for details." -ForegroundColor Red
    Write-Host "  Error log: $ErrorFile" -ForegroundColor Gray
} else {
    Write-Host "✅ SUCCESS: All jobs completed without errors!" -ForegroundColor Green
}

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

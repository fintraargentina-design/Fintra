# ========================================
# FINTRA - Run Complete Pipeline (22 Jobs)
# ========================================
# Version: 4.0 Pipeline Execution
# Updated: 2026-02-07
# Ejecuta 22 scripts TypeScript del pipeline secuencialmente
# Jobs 01-19 (pipeline core) + healthcheck + FGOS engine + peers

# Configuration
# Fix for PS2EXE compatibility - detect if running as .exe
if ($MyInvocation.MyCommand.Path) {
    $CurrentScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
} else {
    $CurrentScriptPath = $PSScriptRoot
}

# Navigate to project root (2 levels up from Jobs-Diarios)
$ScriptRoot = Split-Path -Parent $CurrentScriptPath
$ScriptRoot = Split-Path -Parent $ScriptRoot
$ScriptsDir = Join-Path $ScriptRoot "scripts\pipeline"
$LogDir = Join-Path $CurrentScriptPath "logs"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = "$LogDir\pipeline-$Timestamp.log"
$ErrorFile = "$LogDir\pipeline-$Timestamp.error.log"
$SummaryFile = "$LogDir\pipeline-$Timestamp.summary.log"
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
FINTRA - Complete Pipeline Execution
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
Write-Host "[FINTRA] Starting Complete Pipeline Execution (22 Jobs)" -ForegroundColor Cyan
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
        
        # Force use of npx.cmd to avoid npx.ps1 execution policy issues
        $npxCmd = "npx.cmd"
        if (-not (Get-Command $npxCmd -ErrorAction SilentlyContinue)) {
            $npxCmd = "npx"
        }
        
        Write-Host "Executing: $npxCmd tsx $FullPath" -ForegroundColor DarkGray
        Write-Host ""
        
        # Create temp file for output
        $tempOut = [System.IO.Path]::GetTempFileName()
        
        # Execute with tee to show AND log
        $command = "$npxCmd tsx `"$FullPath`" 2>&1 | Tee-Object -FilePath `"$tempOut`""
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
# PHASE 1: Foundation (Universe & Classifications)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 1: Foundation (Universe & Classifications)                ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 1 -JobName "Sync Universe" -ScriptPath "01-sync-universe.ts"
Invoke-DirectScript -JobNum 2 -JobName "Industry Classification Sync" -ScriptPath "02-industry-classification-sync.ts"

# ========================================
# PHASE 2: Raw Data Ingestion
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 2: Raw Data Ingestion                                     ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 3 -JobName "Prices Daily Bulk" -ScriptPath "03-prices-daily-bulk.ts"
Invoke-DirectScript -JobNum 4 -JobName "Financials Bulk (CRITICAL)" -ScriptPath "04-financials-bulk.ts"
Invoke-DirectScript -JobNum 5 -JobName "Incremental TTM Valuation" -ScriptPath "04b-incremental-ttm-valuation.ts"
Invoke-DirectScript -JobNum 6 -JobName "Company Profile Bulk" -ScriptPath "05-company-profile-bulk.ts"

# ========================================
# PHASE 3: Performance Aggregations
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 3: Performance Aggregations                               ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 7 -JobName "Industry Performance Aggregator (1D)" -ScriptPath "06-industry-performance-aggregator.ts"
Invoke-DirectScript -JobNum 8 -JobName "Sector Performance Aggregator (1D)" -ScriptPath "07-sector-performance-aggregator.ts"
Invoke-DirectScript -JobNum 9 -JobName "Sector Performance Windows" -ScriptPath "08-sector-performance-windows-aggregator.ts"
Invoke-DirectScript -JobNum 10 -JobName "Industry Performance Windows" -ScriptPath "09-industry-performance-windows-aggregator.ts"

# ========================================
# PHASE 4: Valuation Aggregations
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 4: Valuation Aggregations                                 ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 11 -JobName "Sector PE Aggregator" -ScriptPath "10-sector-pe-aggregator.ts"
Invoke-DirectScript -JobNum 12 -JobName "Industry PE Aggregator" -ScriptPath "11-industry-pe-aggregator.ts"

# ========================================
# PHASE 5: Benchmarks (CRITICAL for Engines)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 5: Benchmarks (CRITICAL for Engines)                      ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 13 -JobName "Sector Benchmarks (CRITICAL)" -ScriptPath "12-sector-benchmarks.ts"
Invoke-DirectScript -JobNum 14 -JobName "Industry Benchmarks Aggregator" -ScriptPath "12b-industry-benchmarks-aggregator.ts"

# ========================================
# PHASE 6: Performance Relative
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 6: Performance Relative                                   ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 15 -JobName "Performance Bulk (Alpha Calculation)" -ScriptPath "13-performance-bulk.ts"
Invoke-DirectScript -JobNum 16 -JobName "Performance Windows Aggregator" -ScriptPath "13b-performance-windows-aggregator.ts"

# ========================================
# PHASE 7: Market State Consolidation
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 7: Market State Consolidation                             ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 17 -JobName "Market State Bulk (CRITICAL)" -ScriptPath "14-market-state-bulk.ts"

# ========================================
# PHASE 8: Dividends (Parallel Track)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 8: Dividends (Parallel Track)                             ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 18 -JobName "Dividends Bulk V2" -ScriptPath "15-dividends-bulk-v2.ts"

# ========================================
# PHASE 9: FMP Snapshots (Skeleton)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 9: FMP Snapshots (Skeleton)                               ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 19 -JobName "FMP Bulk Snapshots" -ScriptPath "16-fmp-bulk-snapshots.ts"

# ========================================
# PHASE 10: Validation
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 10: Validation                                            ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 20 -JobName "Healthcheck Snapshots" -ScriptPath "17-healthcheck-snapshots.ts"

# ========================================
# PHASE 11: Engines (Core Scoring)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 11: Engines (Core Scoring)                                ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 21 -JobName "Recompute FGOS All (ENGINE CRITICAL)" -ScriptPath "18-recompute-fgos-all.ts"

# ========================================
# PHASE 12: Peers (Independent)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 12: Peers (Independent)                                   ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-DirectScript -JobNum 22 -JobName "Peers Bulk" -ScriptPath "19-peers-bulk.ts"

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
Write-Host "###   ALL PIPELINE JOBS COMPLETED                                     ###" -ForegroundColor Green
Write-Host "###                                                                     ###" -ForegroundColor Green
Write-Host "#########################################################################" -ForegroundColor Green
Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "EXECUTION SUMMARY" -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "  Total Pipeline Jobs: 22 (01-19 + healthcheck + FGOS + peers)" -ForegroundColor White
Write-Host "  Total Errors: $ErrorCount" -ForegroundColor $(if ($ErrorCount -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "PIPELINE PHASES EXECUTED:" -ForegroundColor Yellow
Write-Host "  Phase  1: Foundation (Universe & Classifications)" -ForegroundColor Gray
Write-Host "  Phase  2: Raw Data Ingestion (Prices, Financials, TTM, Profiles)" -ForegroundColor Gray
Write-Host "  Phase  3: Performance Aggregations (1D + Multi-period)" -ForegroundColor Gray
Write-Host "  Phase  4: Valuation Aggregations (P/E Sector/Industry)" -ForegroundColor Gray
Write-Host "  Phase  5: Benchmarks (CRITICAL - Sector + Industry percentiles)" -ForegroundColor Gray
Write-Host "  Phase  6: Performance Relative (Alpha calculations)" -ForegroundColor Gray
Write-Host "  Phase  7: Market State Consolidation" -ForegroundColor Gray
Write-Host "  Phase  8: Dividends" -ForegroundColor Gray
Write-Host "  Phase  9: FMP Snapshots (Skeleton)" -ForegroundColor Gray
Write-Host "  Phase 10: Validation (Healthcheck)" -ForegroundColor Gray
Write-Host "  Phase 11: Engines (FGOS Scoring)" -ForegroundColor Gray
Write-Host "  Phase 12: Peers" -ForegroundColor Gray
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
    Write-Host "✅ SUCCESS: All pipeline jobs completed without errors!" -ForegroundColor Green
}

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

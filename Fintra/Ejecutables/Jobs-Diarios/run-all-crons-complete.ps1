# ========================================
# FINTRA - Run All 23 Cron Jobs Complete
# ========================================
# Version: 2.1 Complete
# Updated: 2026-02-03
# Ejecuta los 23 crons diarios recomendados

# Configuration
$LogDir = "logs"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = "$LogDir\cron-complete-$Timestamp.log"
$ErrorFile = "$LogDir\cron-complete-$Timestamp.error.log"
$SummaryFile = "$LogDir\cron-complete-$Timestamp.summary.log"
$ErrorCount = 0
$ApiBase = "http://localhost:3000/api/cron"

# Create logs directory
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

# Initialize logs
@"
=========================================
FINTRA - Complete 23 Crons Execution
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
Write-Host "[FINTRA] Starting all 23 cron jobs (Complete Daily Update)" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "LOG FILES:" -ForegroundColor Yellow
Write-Host "  Main Log:    $LogFile" -ForegroundColor Gray
Write-Host "  Errors Only: $ErrorFile" -ForegroundColor Gray
Write-Host "  Summary:     $SummaryFile" -ForegroundColor Gray
Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""

# Function to run API endpoint
function Invoke-ApiJob {
    param(
        [int]$JobNum,
        [string]$JobName,
        [string]$Endpoint
    )
    
    $JobStart = Get-Date
    $FullUrl = "$ApiBase/$Endpoint"
    
    Write-Host ""
    Write-Host "=========================================================================" -ForegroundColor White
    Write-Host "[JOB $JobNum] $JobName" -ForegroundColor Cyan
    Write-Host "=========================================================================" -ForegroundColor White
    Write-Host "API: $FullUrl" -ForegroundColor Gray
    Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host "-------------------------------------------------------------------------" -ForegroundColor White
    Write-Host ""
    
    # Log to main file
    @"
-----------------------------------------
[$JobNum] $JobName
API: $FullUrl
Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-----------------------------------------
"@ | Out-File $LogFile -Append -Encoding UTF8
    
    # Execute API call
    try {
        $response = Invoke-WebRequest -Uri $FullUrl -Method Get -ErrorAction Stop
        $exitCode = 0
        $responseBody = $response.Content
        
        # Show AND log response
        Write-Host $responseBody -ForegroundColor Gray
        $responseBody | Out-File $LogFile -Append -Encoding UTF8
        
    } catch {
        $exitCode = 1
        $errorMessage = $_.Exception.Message
        
        # Show AND log error
        Write-Host "ERROR: $errorMessage" -ForegroundColor Red
        "ERROR: $errorMessage" | Out-File $LogFile -Append -Encoding UTF8
        
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host $responseBody -ForegroundColor Red
            $responseBody | Out-File $LogFile -Append -Encoding UTF8
        }
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
API: $FullUrl
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
# PHASE 1: Master Orchestrator (10 crons)
# ========================================
Write-Host ""
Write-Host ""
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "###   PHASE 1: Master Orchestrator (10 Crons Automaticos)             ###" -ForegroundColor Magenta
Write-Host "###                                                                     ###" -ForegroundColor Magenta
Write-Host "#########################################################################" -ForegroundColor Magenta
Write-Host ""

Invoke-ApiJob -JobNum 1 -JobName "Master-All Orchestrator" -Endpoint "master-all"

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

Invoke-ApiJob -JobNum 11 -JobName "Industry Performance Aggregator" -Endpoint "industry-performance-aggregator"
Invoke-ApiJob -JobNum 12 -JobName "Industry Performance Windows" -Endpoint "industry-performance-windows-aggregator"
Invoke-ApiJob -JobNum 13 -JobName "Sector Performance Windows" -Endpoint "sector-performance-windows-aggregator"
Invoke-ApiJob -JobNum 14 -JobName "Industry Benchmarks" -Endpoint "industry-benchmarks-aggregator"
Invoke-ApiJob -JobNum 15 -JobName "Sector PE Aggregator" -Endpoint "sector-pe-aggregator"
Invoke-ApiJob -JobNum 16 -JobName "Industry PE Aggregator" -Endpoint "industry-pe-aggregator"

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

Invoke-ApiJob -JobNum 17 -JobName "FMP Peers Bulk" -Endpoint "fmp-peers-bulk"
Invoke-ApiJob -JobNum 18 -JobName "Dividends Bulk V2" -Endpoint "dividends-bulk-v2"
Invoke-ApiJob -JobNum 19 -JobName "TTM Valuation Incremental" -Endpoint "ttm-valuation-incremental"
Invoke-ApiJob -JobNum 20 -JobName "Company Profile Bulk" -Endpoint "company-profile-bulk"
Invoke-ApiJob -JobNum 21 -JobName "Compute Global Ranks" -Endpoint "compute-ranks"

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

Invoke-ApiJob -JobNum 22 -JobName "SEC 10-K Ingest" -Endpoint "sec-10k-ingest"
Invoke-ApiJob -JobNum 23 -JobName "SEC 8-K Ingest" -Endpoint "sec-8k-ingest"

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
Write-Host "###   ALL 23 CRON JOBS COMPLETED                                      ###" -ForegroundColor Green
Write-Host "###                                                                     ###" -ForegroundColor Green
Write-Host "#########################################################################" -ForegroundColor Green
Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "EXECUTION SUMMARY" -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "  Total Jobs: 23 crons" -ForegroundColor White
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
    Write-Host "✅ SUCCESS: All 23 jobs completed without errors!" -ForegroundColor Green
}

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

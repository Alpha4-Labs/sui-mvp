# Check migration status
Write-Host "📊 ALPHA POINTS MIGRATION STATUS CHECK"
Write-Host "=" * 50

# Check if sui client is running (indicates migration in progress)
$suiProcesses = Get-Process | Where-Object {$_.ProcessName -eq "sui"}
if ($suiProcesses.Count -gt 0) {
    Write-Host "✅ Migration appears to be running ($($suiProcesses.Count) sui processes active)"
} else {
    Write-Host "⏸️ No active sui processes detected"
}

# Check PowerShell processes
$psProcesses = Get-Process | Where-Object {$_.ProcessName -eq "powershell"}
Write-Host "📋 PowerShell processes running: $($psProcesses.Count)"

# Try to get recent transaction activity
Write-Host ""
Write-Host "🔍 Checking recent transaction activity..."

try {
    # Get recent transactions from the current address
    $recentTxs = & sui client transaction-history --limit 5 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Recent transaction history available"
        Write-Host "Last 5 transactions:"
        $recentTxs | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "⚠️ Could not fetch transaction history: $recentTxs"
    }
} catch {
    Write-Host "⚠️ Error checking transactions: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "📈 MIGRATION PROGRESS ESTIMATE"
Write-Host "=" * 30

# Based on our analysis, we know:
# - Total stakes: 573
# - Top 10 completed: 10 stakes
# - Remaining: 563 stakes
# - Rate: ~1 transaction every 3-5 seconds

$totalRemaining = 563
$estimatedTimePerTx = 4 # seconds
$totalEstimatedTime = $totalRemaining * $estimatedTimePerTx
$estimatedMinutes = [math]::Round($totalEstimatedTime / 60, 1)

Write-Host "Total remaining stakes: $totalRemaining"
Write-Host "Estimated time per transaction: $estimatedTimePerTx seconds"
Write-Host "Total estimated completion time: $estimatedMinutes minutes"

$startTime = Get-Date "2025-01-27 12:00:00" # Approximate start time
$currentTime = Get-Date
$elapsedMinutes = [math]::Round(($currentTime - $startTime).TotalMinutes, 1)

if ($elapsedMinutes -gt 0) {
    Write-Host "Estimated elapsed time: $elapsedMinutes minutes"
    $remainingMinutes = [math]::Max(0, $estimatedMinutes - $elapsedMinutes)
    Write-Host "Estimated remaining time: $remainingMinutes minutes"
    
    $estimatedCompletion = $currentTime.AddMinutes($remainingMinutes)
    Write-Host "Estimated completion: $($estimatedCompletion.ToString('HH:mm:ss'))"
}

Write-Host ""
Write-Host "💡 MIGRATION SUMMARY"
Write-Host "=" * 20
Write-Host "✅ Top 10 stakes completed (2,917.44 SUI → 3.2B Alpha Points)"
Write-Host "🚀 Remaining 563 stakes in progress (4,788.06 SUI → 5.3B Alpha Points)"
Write-Host "🎯 Total compensation: 7,705.50 SUI → 8.5B Alpha Points"
Write-Host "👥 Total users affected: 473 unique addresses"

Write-Host ""
Write-Host "To check status again, run: .\check_status.ps1" 
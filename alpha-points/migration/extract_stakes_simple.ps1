# PowerShell script to extract stakes and generate migration commands
Write-Host "📊 EXTRACTING STAKE DATA FROM MIGRATION FILE..."

$content = Get-Content "migration_data_complete.txt" -Raw

# Extract all principal_mist values
$mistMatches = [regex]::Matches($content, "principal_mist:\s*(\d+)")
Write-Host "Found $($mistMatches.Count) principal_mist entries"

# Extract all owner addresses  
$ownerPattern = "owner:\s*`"(0x[a-f0-9]{64})`""
$ownerMatches = [regex]::Matches($content, $ownerPattern)
Write-Host "Found $($ownerMatches.Count) owner addresses"

# Extract all duration_days
$durationMatches = [regex]::Matches($content, "duration_days:\s*(\d+)")
Write-Host "Found $($durationMatches.Count) duration entries"

if ($mistMatches.Count -eq 0) {
    Write-Host "❌ No stakes found in migration data!"
    exit 1
}

# Build stakes array
$stakes = @()
for ($i = 0; $i -lt $mistMatches.Count; $i++) {
    if ($i -lt $ownerMatches.Count -and $i -lt $durationMatches.Count) {
        $principalMist = [long]$mistMatches[$i].Groups[1].Value
        $principalSui = $principalMist / 1000000000
        $owner = $ownerMatches[$i].Groups[1].Value
        $duration = [int]$durationMatches[$i].Groups[1].Value
        
        $stakes += [PSCustomObject]@{
            Index = $i + 1
            Owner = $owner
            PrincipalMist = $principalMist
            PrincipalSui = $principalSui
            DurationDays = $duration
        }
    }
}

Write-Host "📊 MIGRATION DATA ANALYSIS"
Write-Host "=================================================="
Write-Host "Total stakes found: $($stakes.Count)"

$totalSUI = ($stakes | Measure-Object -Property PrincipalSui -Sum).Sum
Write-Host "Total SUI value: $($totalSUI.ToString('F4')) SUI"
Write-Host "Top 10 already processed: 2,917.44 SUI"
Write-Host "Remaining stakes: $($stakes.Count - 10)"
$remainingSUI = $totalSUI - 2917.44
Write-Host "Remaining SUI value: $($remainingSUI.ToString('F4')) SUI"
$remainingPoints = [math]::Round($remainingSUI * 1100000)
Write-Host "Remaining Alpha Points: $($remainingPoints.ToString('N0'))"

# Sort by value descending and skip top 10
$sortedStakes = $stakes | Sort-Object PrincipalSui -Descending
$remainingStakes = $sortedStakes | Select-Object -Skip 10

Write-Host ""
Write-Host "🎯 READY TO EXECUTE REMAINING STAKES"
Write-Host "Processing $($remainingStakes.Count) remaining stakes..."

# Now let's execute them directly instead of generating files
Write-Host ""
Write-Host "🚀 STARTING BATCH EXECUTION..."

$batchSize = 50
$totalProcessed = 0
$totalPointsIssued = 0

for ($i = 0; $i -lt $remainingStakes.Count; $i += $batchSize) {
    $batchEnd = [math]::Min($i + $batchSize - 1, $remainingStakes.Count - 1)
    $batch = $remainingStakes[$i..$batchEnd]
    $batchNum = [math]::Floor($i / $batchSize) + 1
    $totalBatches = [math]::Ceiling($remainingStakes.Count / $batchSize)
    
    Write-Host ""
    Write-Host "🚀 Executing Batch $batchNum of $totalBatches ($($batch.Count) stakes)..."
    
    foreach ($stake in $batch) {
        $stakeNum = $totalProcessed + 11  # Start from 11 since we did top 10
        $alphaPoints = [math]::Round($stake.PrincipalSui * 1100000)
        $totalPointsIssued += $alphaPoints
        
        Write-Host "Stake ${stakeNum}: $($stake.PrincipalSui.ToString('F4')) SUI → $($alphaPoints.ToString('N0')) points"
        
        # Execute the command
        $cmd = "sui client call --package 0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec --module integration --function earn_points_testnet --args 0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb 0x6a31f5554e31e90d6e75925a83cb22638c0152684410ad81cd1c62f3f30ca38e $($stake.Owner) $alphaPoints 0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00 0x6 --gas-budget 10000000"
        
        try {
            Invoke-Expression $cmd
            Write-Host "✅ Success!" -ForegroundColor Green
        } catch {
            Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        $totalProcessed++
        Write-Host ""
    }
    
    Write-Host "✅ Batch $batchNum Complete! Processed $($batch.Count) stakes."
    
    if ($batchNum -lt $totalBatches) {
        Write-Host "Pausing 5 seconds before next batch..."
        Start-Sleep -Seconds 5
    }
}

$uniqueUsers = ($remainingStakes | Select-Object -Property Owner -Unique).Count
Write-Host ""
Write-Host "🎉 ALL REMAINING STAKES COMPLETED! 🎉"
Write-Host "Total Remaining Alpha Points Issued: $($totalPointsIssued.ToString('N0'))"
Write-Host "Total Remaining SUI Value: $($remainingSUI.ToString('F4')) SUI"
Write-Host "Total Remaining Users Compensated: $uniqueUsers unique users"
Write-Host "Total Stakes Processed: $totalProcessed" 
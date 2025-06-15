# Simple PowerShell script to extract stakes using Select-String
Write-Host "📊 EXTRACTING STAKE DATA..."

# Extract principal_mist values
$mistLines = Select-String "principal_mist:" migration_data_complete.txt
Write-Host "Found $($mistLines.Count) principal_mist entries"

# Extract owner addresses
$ownerLines = Select-String "owner:" migration_data_complete.txt
Write-Host "Found $($ownerLines.Count) owner entries"

# Extract duration_days
$durationLines = Select-String "duration_days:" migration_data_complete.txt
Write-Host "Found $($durationLines.Count) duration entries"

if ($mistLines.Count -eq 0) {
    Write-Host "❌ No stakes found!"
    exit 1
}

# Build stakes array
$stakes = @()
for ($i = 0; $i -lt $mistLines.Count; $i++) {
    if ($i -lt $ownerLines.Count -and $i -lt $durationLines.Count) {
        # Extract values using string manipulation
        $mistLine = $mistLines[$i].Line
        $ownerLine = $ownerLines[$i].Line
        $durationLine = $durationLines[$i].Line
        
        # Parse principal_mist
        $mistValue = ($mistLine -split ': ')[1] -replace ',', ''
        $principalMist = [long]$mistValue
        $principalSui = $principalMist / 1000000000
        
        # Parse owner
        $owner = ($ownerLine -split '"')[1]
        
        # Parse duration
        $duration = [int](($durationLine -split ': ')[1] -replace ',', '')
        
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

if ($remainingStakes.Count -eq 0) {
    Write-Host "❌ No remaining stakes to process!"
    exit 1
}

# Show first few for verification
Write-Host ""
Write-Host "First 5 remaining stakes:"
for ($i = 0; $i -lt [math]::Min(5, $remainingStakes.Count); $i++) {
    $stake = $remainingStakes[$i]
    $stakeNum = $i + 11
    $alphaPoints = [math]::Round($stake.PrincipalSui * 1100000)
    Write-Host "  Stake ${stakeNum}: $($stake.PrincipalSui.ToString('F4')) SUI → $($alphaPoints.ToString('N0')) points"
}

Write-Host ""
$confirm = Read-Host "Do you want to proceed with executing all $($remainingStakes.Count) remaining stakes? (y/N)"

if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "❌ Execution cancelled by user"
    exit 0
}

# Execute all remaining stakes
Write-Host ""
Write-Host "🚀 STARTING EXECUTION OF ALL REMAINING STAKES..."

$batchSize = 50
$totalProcessed = 0
$totalPointsIssued = 0
$successCount = 0
$errorCount = 0

for ($i = 0; $i -lt $remainingStakes.Count; $i += $batchSize) {
    $batchEnd = [math]::Min($i + $batchSize - 1, $remainingStakes.Count - 1)
    $batch = $remainingStakes[$i..$batchEnd]
    $batchNum = [math]::Floor($i / $batchSize) + 1
    $totalBatches = [math]::Ceiling($remainingStakes.Count / $batchSize)
    
    Write-Host ""
    $batchMessage = "🚀 Executing Batch " + $batchNum + " of " + $totalBatches + " (" + $batch.Count + " stakes)..."
    Write-Host $batchMessage
    
    foreach ($stake in $batch) {
        $stakeNum = $totalProcessed + 11
        $alphaPoints = [math]::Round($stake.PrincipalSui * 1100000)
        $totalPointsIssued += $alphaPoints
        
        $stakeMessage = "Stake " + $stakeNum + ": " + $stake.PrincipalSui.ToString('F4') + " SUI → " + $alphaPoints.ToString('N0') + " points"
        Write-Host $stakeMessage
        
        # Execute the command
        $result = & sui client call --package 0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec --module integration --function earn_points_testnet --args 0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb 0x6a31f5554e31e90d6e75925a83cb22638c0152684410ad81cd1c62f3f30ca38e $($stake.Owner) $alphaPoints 0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00 0x6 --gas-budget 10000000 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Success!" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "❌ Error: $result" -ForegroundColor Red
            $errorCount++
        }
        
        $totalProcessed++
        Write-Host ""
    }
    
    $batchCompleteMessage = "✅ Batch " + $batchNum + " Complete! Processed " + $batch.Count + " stakes."
    Write-Host $batchCompleteMessage
    Write-Host "   Success: $successCount | Errors: $errorCount"
    
    if ($batchNum -lt $totalBatches) {
        Write-Host "Pausing 5 seconds before next batch..."
        Start-Sleep -Seconds 5
    }
}

$uniqueUsers = ($remainingStakes | Select-Object -Property Owner -Unique).Count
Write-Host ""
Write-Host "🎉 ALL REMAINING STAKES COMPLETED! 🎉"
$pointsMessage = "Total Remaining Alpha Points Issued: " + $totalPointsIssued.ToString('N0')
Write-Host $pointsMessage
$suiMessage = "Total Remaining SUI Value: " + $remainingSUI.ToString('F4') + " SUI"
Write-Host $suiMessage
Write-Host "Total Remaining Users Compensated: $uniqueUsers unique users"
Write-Host "Total Stakes Processed: $totalProcessed"
Write-Host "Successful Transactions: $successCount"
Write-Host "Failed Transactions: $errorCount" 
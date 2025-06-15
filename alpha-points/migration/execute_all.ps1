# Execute all remaining stakes - Simple version
Write-Host "Extracting stake data..."

# Extract data using Select-String
$mistLines = Select-String "principal_mist:" migration_data_complete.txt
$ownerLines = Select-String "owner:" migration_data_complete.txt
$durationLines = Select-String "duration_days:" migration_data_complete.txt

Write-Host "Found" $mistLines.Count "principal_mist entries"
Write-Host "Found" $ownerLines.Count "owner entries"
Write-Host "Found" $durationLines.Count "duration entries"

if ($mistLines.Count -eq 0) {
    Write-Host "No stakes found!"
    exit 1
}

# Build stakes array
$stakes = @()
for ($i = 0; $i -lt $mistLines.Count; $i++) {
    if ($i -lt $ownerLines.Count -and $i -lt $durationLines.Count) {
        $mistLine = $mistLines[$i].Line
        $ownerLine = $ownerLines[$i].Line
        $durationLine = $durationLines[$i].Line
        
        $mistValue = ($mistLine -split ': ')[1] -replace ',', ''
        $principalMist = [long]$mistValue
        $principalSui = $principalMist / 1000000000
        
        $owner = ($ownerLine -split '"')[1]
        $duration = [int](($durationLine -split ': ')[1] -replace ',', '')
        
        $stakes += [PSCustomObject]@{
            Owner = $owner
            PrincipalSui = $principalSui
            DurationDays = $duration
        }
    }
}

Write-Host "Total stakes found:" $stakes.Count

$totalSUI = ($stakes | Measure-Object -Property PrincipalSui -Sum).Sum
Write-Host "Total SUI value:" $totalSUI.ToString('F4') "SUI"
Write-Host "Top 10 already processed: 2917.44 SUI"
Write-Host "Remaining stakes:" ($stakes.Count - 10)

$remainingSUI = $totalSUI - 2917.44
Write-Host "Remaining SUI value:" $remainingSUI.ToString('F4') "SUI"

$remainingPoints = [math]::Round($remainingSUI * 1100000)
Write-Host "Remaining Alpha Points:" $remainingPoints.ToString('N0')

# Sort by value descending and skip top 10
$sortedStakes = $stakes | Sort-Object PrincipalSui -Descending
$remainingStakes = $sortedStakes | Select-Object -Skip 10

Write-Host ""
Write-Host "Ready to execute" $remainingStakes.Count "remaining stakes"

if ($remainingStakes.Count -eq 0) {
    Write-Host "No remaining stakes to process!"
    exit 1
}

# Show first few
Write-Host ""
Write-Host "First 5 remaining stakes:"
for ($i = 0; $i -lt [math]::Min(5, $remainingStakes.Count); $i++) {
    $stake = $remainingStakes[$i]
    $stakeNum = $i + 11
    $alphaPoints = [math]::Round($stake.PrincipalSui * 1100000)
    Write-Host "  Stake" $stakeNum ":" $stake.PrincipalSui.ToString('F4') "SUI ->" $alphaPoints.ToString('N0') "points"
}

Write-Host ""
$confirm = Read-Host "Proceed with executing all remaining stakes? (y/N)"

if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Execution cancelled"
    exit 0
}

# Execute all remaining stakes
Write-Host ""
Write-Host "Starting execution..."

$totalProcessed = 0
$successCount = 0
$errorCount = 0

foreach ($stake in $remainingStakes) {
    $stakeNum = $totalProcessed + 11
    $alphaPoints = [math]::Round($stake.PrincipalSui * 1100000)
    
    Write-Host "Stake" $stakeNum ":" $stake.PrincipalSui.ToString('F4') "SUI ->" $alphaPoints.ToString('N0') "points"
    
    # Execute the command
    $result = & sui client call --package 0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec --module integration --function earn_points_testnet --args 0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb 0x6a31f5554e31e90d6e75925a83cb22638c0152684410ad81cd1c62f3f30ca38e $($stake.Owner) $alphaPoints 0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00 0x6 --gas-budget 10000000 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success!" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "Error:" $result -ForegroundColor Red
        $errorCount++
    }
    
    $totalProcessed++
    
    # Pause every 10 transactions
    if ($totalProcessed % 10 -eq 0) {
        Write-Host "Processed" $totalProcessed "stakes. Success:" $successCount "Errors:" $errorCount
        Start-Sleep -Seconds 2
    }
}

$uniqueUsers = ($remainingStakes | Select-Object -Property Owner -Unique).Count
Write-Host ""
Write-Host "ALL REMAINING STAKES COMPLETED!"
Write-Host "Total Alpha Points Issued:" $remainingPoints.ToString('N0')
Write-Host "Total SUI Value:" $remainingSUI.ToString('F4') "SUI"
Write-Host "Total Users Compensated:" $uniqueUsers "unique users"
Write-Host "Total Stakes Processed:" $totalProcessed
Write-Host "Successful Transactions:" $successCount
Write-Host "Failed Transactions:" $errorCount 
# PowerShell script to extract stakes and generate migration commands
Write-Host "📊 EXTRACTING STAKE DATA FROM MIGRATION FILE..."

$content = Get-Content "migration_data_complete.txt" -Raw

# Extract all principal_mist values
$mistMatches = [regex]::Matches($content, 'principal_mist:\s*(\d+)')
Write-Host "Found $($mistMatches.Count) principal_mist entries"

# Extract all owner addresses  
$ownerMatches = [regex]::Matches($content, 'owner:\s*"(0x[a-f0-9]{64})"')
Write-Host "Found $($ownerMatches.Count) owner addresses"

# Extract all duration_days
$durationMatches = [regex]::Matches($content, 'duration_days:\s*(\d+)')
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
Write-Host "=" * 50
Write-Host "Total stakes found: $($stakes.Count)"

$totalSUI = ($stakes | Measure-Object -Property PrincipalSui -Sum).Sum
Write-Host "Total SUI value: $($totalSUI.ToString('F4')) SUI"
Write-Host "Top 10 already processed: 2,917.44 SUI"
Write-Host "Remaining stakes: $($stakes.Count - 10)"
Write-Host "Remaining SUI value: $(($totalSUI - 2917.44).ToString('F4')) SUI"
Write-Host "Remaining Alpha Points: $([math]::Round(($totalSUI - 2917.44) * 1100000).ToString('N0'))"

# Sort by value descending and skip top 10
$sortedStakes = $stakes | Sort-Object PrincipalSui -Descending
$remainingStakes = $sortedStakes | Select-Object -Skip 10

Write-Host ""
Write-Host "🎯 GENERATING MIGRATION COMMANDS"
Write-Host "Processing $($remainingStakes.Count) remaining stakes..."

# Generate commands
$commands = @()
$commands += "# Alpha Points Migration - Remaining Stakes ($($remainingStakes.Count) stakes)"
$commands += "# Generated: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')"
$commands += "# Rate: 1 SUI = 1,100,000 Alpha Points"
$commands += "#"
$commands += "# ✅ READY TO EXECUTE - Using earn_points_testnet function!"
$commands += "# Package ID: 0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec"
$commands += "# Ledger ID: 0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00"
$commands += "# Config ID: 0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb"
$commands += "# Testnet Bypass Cap: 0x6a31f5554e31e90d6e75925a83cb22638c0152684410ad81cd1c62f3f30ca38e"
$commands += "# Clock Object: 0x6 (standard Sui clock)"
$commands += ""

$totalRemainingPoints = 0
$totalRemainingSUI = 0

for ($i = 0; $i -lt $remainingStakes.Count; $i++) {
    $stake = $remainingStakes[$i]
    $stakeNum = $i + 11  # Start from 11 since we did top 10
    $alphaPoints = [math]::Round($stake.PrincipalSui * 1100000)
    $totalRemainingPoints += $alphaPoints
    $totalRemainingSUI += $stake.PrincipalSui
    
    $commands += "# Stake ${stakeNum}: $($stake.PrincipalSui.ToString('F4')) SUI → $($alphaPoints.ToString('N0')) points"
    $commands += "# Owner: $($stake.Owner)"
    $commands += "# Duration: $($stake.DurationDays) days"
    $commands += "sui client call --package 0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec \"
    $commands += "  --module integration \"
    $commands += "  --function earn_points_testnet \"
    $commands += "  --args 0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb 0x6a31f5554e31e90d6e75925a83cb22638c0152684410ad81cd1c62f3f30ca38e $($stake.Owner) $alphaPoints 0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00 0x6 \"
    $commands += "  --gas-budget 10000000"
    $commands += ""
}

$commands += "# SUMMARY:"
$commands += "# Total Remaining Stakes: $($remainingStakes.Count)"
$commands += "# Total Remaining SUI: $($totalRemainingSUI.ToString('F4')) SUI"
$commands += "# Total Remaining Alpha Points: $($totalRemainingPoints.ToString('N0'))"
$commands += "# Estimated Gas Cost: ~$(($remainingStakes.Count * 0.004).ToString('F2')) SUI"

# Write to file
$commands | Out-File -FilePath "REMAINING_MIGRATION_COMMANDS.sh" -Encoding UTF8
Write-Host ""
Write-Host "✅ Generated REMAINING_MIGRATION_COMMANDS.sh"
Write-Host "📝 Contains $($remainingStakes.Count) migration commands"
Write-Host "💰 Total value: $($totalRemainingSUI.ToString('F4')) SUI → $($totalRemainingPoints.ToString('N0')) Alpha Points"

# Create batch execution script
$batchSize = 50
$batches = @()
for ($i = 0; $i -lt $remainingStakes.Count; $i += $batchSize) {
    $end = [math]::Min($i + $batchSize - 1, $remainingStakes.Count - 1)
    $batches += ,($remainingStakes[$i..$end])
}

$psCommands = @()
$psCommands += "# PowerShell Batch Execution Script for Remaining Stakes"
$psCommands += "# Execute in batches of $batchSize to manage gas and monitoring"
$psCommands += ""

for ($batchIndex = 0; $batchIndex -lt $batches.Count; $batchIndex++) {
    $batch = $batches[$batchIndex]
    $batchNum = $batchIndex + 1
    $totalBatches = $batches.Count
    $stakeCount = $batch.Count
    
    $psCommands += "Write-Host `"🚀 Executing Batch $batchNum/$totalBatches ($stakeCount stakes)...`""
    $psCommands += ""
    
    for ($j = 0; $j -lt $batch.Count; $j++) {
        $stake = $batch[$j]
        $globalIndex = $batchIndex * $batchSize + $j + 11
        $alphaPoints = [math]::Round($stake.PrincipalSui * 1100000)
        
        $psCommands += "Write-Host `"Stake ${globalIndex}: $($stake.PrincipalSui.ToString('F4')) SUI → $($alphaPoints.ToString('N0')) points`""
        $psCommands += "sui client call --package 0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec --module integration --function earn_points_testnet --args 0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb 0x6a31f5554e31e90d6e75925a83cb22638c0152684410ad81cd1c62f3f30ca38e $($stake.Owner) $alphaPoints 0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00 0x6 --gas-budget 10000000"
        $psCommands += ""
    }
    
    $psCommands += "Write-Host `"✅ Batch $batchNum Complete! Processed $stakeCount stakes.`""
    $psCommands += "Write-Host `"Pausing 5 seconds before next batch...`""
    $psCommands += "Start-Sleep -Seconds 5"
    $psCommands += ""
}

$uniqueUsers = ($remainingStakes | Select-Object -Property Owner -Unique).Count
$psCommands += "Write-Host `"🎉 ALL REMAINING STAKES COMPLETED! 🎉`""
$psCommands += "Write-Host `"Total Remaining Alpha Points Issued: $($totalRemainingPoints.ToString('N0'))`""
$psCommands += "Write-Host `"Total Remaining SUI Value: $($totalRemainingSUI.ToString('F4')) SUI`""
$psCommands += "Write-Host `"Total Remaining Users Compensated: $uniqueUsers unique users`""

$psCommands | Out-File -FilePath "EXECUTE_REMAINING_STAKES.ps1" -Encoding UTF8
Write-Host "✅ Generated EXECUTE_REMAINING_STAKES.ps1 (PowerShell batch execution script)"
Write-Host "📦 Created $($batches.Count) batches of ~$batchSize stakes each" 
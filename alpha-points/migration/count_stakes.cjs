const fs = require('fs');

// Read the migration data
const data = fs.readFileSync('migration_data_complete.txt', 'utf8');

console.log('📊 PARSING MIGRATION DATA...');

// Extract stakes using regex - handle multiline format with spaces
const stakePattern = /stake_id:\s*"([^"]+)",\s*owner:\s*"([^"]+)",\s*principal_mist:\s*(\d+),\s*duration_days:\s*(\d+)/gs;
const stakeMatches = data.matchAll(stakePattern);
const stakes = [];

for (const match of stakeMatches) {
  stakes.push({
    stake_id: match[1],
    owner: match[2],
    principal_mist: parseInt(match[3]),
    principal_sui: parseInt(match[3]) / 1000000000,
    duration_days: parseInt(match[4])
  });
}

console.log('📊 MIGRATION DATA ANALYSIS');
console.log('='.repeat(50));
console.log(`Total stakes found: ${stakes.length}`);

if (stakes.length === 0) {
  console.log('❌ No stakes found! Let me try a different approach...');
  
  // Try simpler patterns
  const simplePattern = /"0x[a-f0-9]{64}"/g;
  const addresses = data.match(simplePattern);
  console.log(`Found ${addresses ? addresses.length : 0} addresses in the file`);
  
  // Try finding principal_mist values
  const mistPattern = /principal_mist:\s*(\d+)/g;
  const mistMatches = data.match(mistPattern);
  console.log(`Found ${mistMatches ? mistMatches.length : 0} principal_mist entries`);
  
  process.exit(1);
}

const totalSUI = stakes.reduce((sum, stake) => sum + stake.principal_sui, 0);
console.log(`Total SUI value: ${totalSUI.toFixed(4)} SUI`);
console.log(`Top 10 already processed: 2,917.44 SUI`);
console.log(`Remaining stakes: ${stakes.length - 10}`);
console.log(`Remaining SUI value: ${(totalSUI - 2917.44).toFixed(4)} SUI`);
console.log(`Remaining Alpha Points: ${Math.round((totalSUI - 2917.44) * 1100000).toLocaleString()}`);

// Sort stakes by value (descending) to skip the top 10
stakes.sort((a, b) => b.principal_sui - a.principal_sui);
const remainingStakes = stakes.slice(10); // Skip top 10

console.log('\n🎯 READY TO GENERATE REMAINING COMMANDS');
console.log(`Processing ${remainingStakes.length} remaining stakes...`);

// Generate migration commands for remaining stakes
let commands = [];
commands.push('# Alpha Points Migration - Remaining Stakes');
commands.push('# Generated: ' + new Date().toISOString());
commands.push('# Rate: 1 SUI = 1,100,000 Alpha Points');
commands.push('#');
commands.push('# ✅ READY TO EXECUTE - Using earn_points_testnet function!');
commands.push('# Package ID: 0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec');
commands.push('# Ledger ID: 0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00');
commands.push('# Config ID: 0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb');
commands.push('# Testnet Bypass Cap: 0x6a31f5554e31e90d6e75925a83cb22638c0152684410ad81cd1c62f3f30ca38e');
commands.push('# Clock Object: 0x6 (standard Sui clock)');
commands.push('');

let totalRemainingPoints = 0;
let totalRemainingSUI = 0;

remainingStakes.forEach((stake, index) => {
  const stakeNum = index + 11; // Start from 11 since we did top 10
  const alphaPoints = Math.round(stake.principal_sui * 1100000);
  totalRemainingPoints += alphaPoints;
  totalRemainingSUI += stake.principal_sui;
  
  commands.push(`# Stake ${stakeNum}: ${stake.principal_sui.toFixed(4)} SUI → ${alphaPoints.toLocaleString()} points`);
  commands.push(`# Owner: ${stake.owner}`);
  commands.push(`# Duration: ${stake.duration_days} days`);
  commands.push(`sui client call --package 0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec \\`);
  commands.push(`  --module integration \\`);
  commands.push(`  --function earn_points_testnet \\`);
  commands.push(`  --args 0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb 0x6a31f5554e31e90d6e75925a83cb22638c0152684410ad81cd1c62f3f30ca38e ${stake.owner} ${alphaPoints} 0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00 0x6 \\`);
  commands.push(`  --gas-budget 10000000`);
  commands.push('');
});

commands.push(`# SUMMARY:`);
commands.push(`# Total Remaining Stakes: ${remainingStakes.length}`);
commands.push(`# Total Remaining SUI: ${totalRemainingSUI.toFixed(4)} SUI`);
commands.push(`# Total Remaining Alpha Points: ${totalRemainingPoints.toLocaleString()}`);
commands.push(`# Estimated Gas Cost: ~${(remainingStakes.length * 0.004).toFixed(2)} SUI`);

// Write to file
fs.writeFileSync('REMAINING_MIGRATION_COMMANDS.sh', commands.join('\n'));
console.log('\n✅ Generated REMAINING_MIGRATION_COMMANDS.sh');
console.log(`📝 Contains ${remainingStakes.length} migration commands`);
console.log(`💰 Total value: ${totalRemainingSUI.toFixed(4)} SUI → ${totalRemainingPoints.toLocaleString()} Alpha Points`);

// Also create a PowerShell execution script for batches
const batchSize = 50; // Process 50 stakes at a time
const batches = [];
for (let i = 0; i < remainingStakes.length; i += batchSize) {
  batches.push(remainingStakes.slice(i, i + batchSize));
}

let psCommands = [];
psCommands.push('# PowerShell Batch Execution Script for Remaining Stakes');
psCommands.push('# Execute in batches of 50 to manage gas and monitoring');
psCommands.push('');

batches.forEach((batch, batchIndex) => {
  psCommands.push(`Write-Host "🚀 Executing Batch ${batchIndex + 1}/${batches.length} (${batch.length} stakes)..."`);
  psCommands.push('');
  
  batch.forEach((stake, index) => {
    const globalIndex = batchIndex * batchSize + index + 11;
    const alphaPoints = Math.round(stake.principal_sui * 1100000);
    
    psCommands.push(`Write-Host "Stake ${globalIndex}: ${stake.principal_sui.toFixed(4)} SUI → ${alphaPoints.toLocaleString()} points"`);
    psCommands.push(`sui client call --package 0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec --module integration --function earn_points_testnet --args 0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb 0x6a31f5554e31e90d6e75925a83cb22638c0152684410ad81cd1c62f3f30ca38e ${stake.owner} ${alphaPoints} 0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00 0x6 --gas-budget 10000000`);
    psCommands.push('');
  });
  
  psCommands.push(`Write-Host "✅ Batch ${batchIndex + 1} Complete! Processed ${batch.length} stakes."`);
  psCommands.push('Write-Host "Pausing 5 seconds before next batch..."');
  psCommands.push('Start-Sleep -Seconds 5');
  psCommands.push('');
});

psCommands.push('Write-Host "🎉 ALL REMAINING STAKES COMPLETED! 🎉"');
psCommands.push(`Write-Host "Total Remaining Alpha Points Issued: ${totalRemainingPoints.toLocaleString()}"`);
psCommands.push(`Write-Host "Total Remaining SUI Value: ${totalRemainingSUI.toFixed(4)} SUI"`);
psCommands.push(`Write-Host "Total Remaining Users Compensated: ${new Set(remainingStakes.map(s => s.owner)).size} unique users"`);

fs.writeFileSync('EXECUTE_REMAINING_STAKES.ps1', psCommands.join('\n'));
console.log('✅ Generated EXECUTE_REMAINING_STAKES.ps1 (PowerShell batch execution script)');
console.log(`📦 Created ${batches.length} batches of ~${batchSize} stakes each`); 
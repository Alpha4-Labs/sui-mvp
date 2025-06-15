import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const POINTS_PER_SUI = 1_100_000; // 1 SUI = 1,100,000 Alpha Points
const MIST_PER_SUI = 1_000_000_000; // 1 SUI = 1 billion MIST

// Package configuration - UPDATE THESE VALUES
const PACKAGE_ID = "0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec"; // Current Alpha Points package
const LEDGER_ID = "0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00";   // Current Alpha Points ledger object

console.log('🚀 Alpha Points Migration Script');
console.log('================================');
console.log(`Rate: 1 SUI = ${POINTS_PER_SUI.toLocaleString()} Alpha Points`);
console.log('');

// Function to parse migration data
function parseMigrationData() {
    try {
        const dataPath = path.join(__dirname, 'migration_data_complete.txt');
        console.log(`📁 Reading file: ${dataPath}`);
        
        if (!fs.existsSync(dataPath)) {
            console.error('❌ Migration data file not found:', dataPath);
            return [];
        }
        
        const data = fs.readFileSync(dataPath, 'utf8');
        console.log(`📄 File size: ${data.length} characters`);
        
        // Find the JavaScript array containing all stakes
        const arrayStartPattern = 'const allStakesToMigrate = [';
        const arrayStart = data.indexOf(arrayStartPattern);
        
        if (arrayStart === -1) {
            console.error('❌ Could not find allStakesToMigrate array in file');
            return [];
        }
        
        console.log(`🔍 Found array start at position ${arrayStart}`);
        
        // Find the end of the array (look for the closing bracket and semicolon)
        let arrayEnd = arrayStart + arrayStartPattern.length;
        let bracketCount = 1;
        let inString = false;
        let escapeNext = false;
        
        for (let i = arrayEnd; i < data.length && bracketCount > 0; i++) {
            const char = data[i];
            
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
            }
            
            if (!inString) {
                if (char === '[' || char === '{') {
                    bracketCount++;
                } else if (char === ']' || char === '}') {
                    bracketCount--;
                }
            }
            
            arrayEnd = i;
        }
        
        // Extract the array content
        const arrayContent = data.substring(arrayStart + arrayStartPattern.length, arrayEnd);
        console.log(`📝 Extracted array content (${arrayContent.length} characters)`);
        
        // Parse the JavaScript array
        const fullArrayString = '[' + arrayContent + ']';
        
        // Clean up the string to make it valid JSON
        const jsonString = fullArrayString
            .replace(/(\w+):/g, '"$1":')  // Add quotes around keys
            .replace(/'/g, '"')           // Replace single quotes with double quotes
            .replace(/,\s*]/g, ']')       // Remove trailing commas
            .replace(/,\s*}/g, '}');      // Remove trailing commas in objects
        
        const stakes = JSON.parse(jsonString);
        console.log(`✅ Successfully parsed ${stakes.length} stakes`);
        
        // Show first few stakes as samples
        stakes.slice(0, 3).forEach((stake, i) => {
            console.log(`✅ Sample stake ${i + 1}:`, {
                stake_id: stake.stake_id?.substring(0, 10) + '...',
                owner: stake.owner?.substring(0, 10) + '...',
                principal_mist: stake.principal_mist,
                duration_days: stake.duration_days
            });
        });
        
        return stakes;
        
    } catch (error) {
        console.error('❌ Error parsing migration data:', error.message);
        console.error('Stack trace:', error.stack);
        return [];
    }
}

// Function to calculate Alpha Points for a stake
function calculateAlphaPoints(principalMist) {
    // Convert MIST to SUI, then multiply by points rate
    const sui = principalMist / MIST_PER_SUI;
    const points = Math.floor(sui * POINTS_PER_SUI);
    return points;
}

// Function to generate mint_points command
function generateMintCommand(stake, points) {
    // Need to add the PointType parameter - using Staking type
    return `sui client call --package ${PACKAGE_ID} \\
  --module ledger \\
  --function mint_points \\
  --args ${LEDGER_ID} ${stake.owner} ${points} "0" \\
  --gas-budget 10000000`;
}

// Function to generate batch mint commands (if we create a batch function)
function generateBatchMintCommand(stakes, maxBatchSize = 50) {
    const batches = [];
    
    for (let i = 0; i < stakes.length; i += maxBatchSize) {
        const batch = stakes.slice(i, i + maxBatchSize);
        const owners = batch.map(s => s.owner);
        const amounts = batch.map(s => calculateAlphaPoints(s.principal_mist));
        
        const command = `sui client call --package ${PACKAGE_ID} \\
  --module ledger \\
  --function batch_mint_points \\
  --args ${LEDGER_ID} '[${owners.join(',')}]' '[${amounts.join(',')}]' \\
  --gas-budget 50000000`;
        
        batches.push({
            command,
            stakes: batch,
            totalPoints: amounts.reduce((sum, amt) => sum + amt, 0)
        });
    }
    
    return batches;
}

// Main execution
function main() {
    try {
        console.log('📖 Parsing migration data...');
        const stakes = parseMigrationData();
        
        if (stakes.length === 0) {
            console.error('❌ No stakes found to migrate');
            return;
        }
        
        console.log(`✅ Found ${stakes.length} stakes to migrate`);
        console.log('');
        
        // Calculate totals
        let totalSUI = 0;
        let totalPoints = 0;
        const userSummary = new Map();
        
        stakes.forEach(stake => {
            const sui = stake.principal_mist / MIST_PER_SUI;
            const points = calculateAlphaPoints(stake.principal_mist);
            
            totalSUI += sui;
            totalPoints += points;
            
            if (!userSummary.has(stake.owner)) {
                userSummary.set(stake.owner, { stakes: 0, sui: 0, points: 0 });
            }
            
            const userStats = userSummary.get(stake.owner);
            userStats.stakes += 1;
            userStats.sui += sui;
            userStats.points += points;
        });
        
        // Display summary
        console.log('📊 MIGRATION SUMMARY');
        console.log('===================');
        console.log(`Total Stakes: ${stakes.length}`);
        console.log(`Total SUI: ${totalSUI.toFixed(4)} SUI`);
        console.log(`Total Points to Award: ${totalPoints.toLocaleString()} Alpha Points`);
        console.log(`Unique Users: ${userSummary.size}`);
        console.log('');
        
        // Show top 10 largest stakes
        const sortedStakes = stakes.sort((a, b) => b.principal_mist - a.principal_mist);
        console.log('🏆 TOP 10 LARGEST STAKES');
        console.log('========================');
        sortedStakes.slice(0, 10).forEach((stake, i) => {
            const sui = stake.principal_mist / MIST_PER_SUI;
            const points = calculateAlphaPoints(stake.principal_mist);
            console.log(`${i + 1}. ${sui.toFixed(4)} SUI → ${points.toLocaleString()} points (${stake.owner.substring(0, 10)}...)`);
        });
        console.log('');
        
        // Generate individual commands
        console.log('📝 Generating individual mint commands...');
        const individualCommands = stakes.map(stake => {
            const points = calculateAlphaPoints(stake.principal_mist);
            return {
                stake,
                points,
                command: generateMintCommand(stake, points)
            };
        });
        
        // Save individual commands
        const individualOutput = individualCommands.map(cmd => 
            `# Stake: ${cmd.stake.stake_id}\n# Owner: ${cmd.stake.owner}\n# Amount: ${(cmd.stake.principal_mist / MIST_PER_SUI).toFixed(4)} SUI → ${cmd.points.toLocaleString()} points\n${cmd.command}\n`
        ).join('\n');
        
        fs.writeFileSync(path.join(__dirname, 'individual_mint_commands.sh'), individualOutput);
        console.log('✅ Individual commands saved to: individual_mint_commands.sh');
        
        // Generate summary for verification
        const summaryOutput = `# Alpha Points Migration Summary
# Generated: ${new Date().toISOString()}
# 
# Total Stakes: ${stakes.length}
# Total SUI: ${totalSUI.toFixed(4)}
# Total Points: ${totalPoints.toLocaleString()}
# Unique Users: ${userSummary.size}
# Rate: 1 SUI = ${POINTS_PER_SUI.toLocaleString()} Alpha Points
#
# IMPORTANT: Update PACKAGE_ID and LEDGER_ID in the commands before execution!

${individualOutput}`;
        
        fs.writeFileSync(path.join(__dirname, 'MIGRATION_COMMANDS_READY.sh'), summaryOutput);
        console.log('✅ Complete migration file saved to: MIGRATION_COMMANDS_READY.sh');
        
        // Generate user summary
        const userSummaryOutput = Array.from(userSummary.entries())
            .sort((a, b) => b[1].points - a[1].points)
            .map(([address, stats]) => 
                `${address},${stats.stakes},${stats.sui.toFixed(4)},${stats.points}`
            )
            .join('\n');
        
        fs.writeFileSync(path.join(__dirname, 'user_migration_summary.csv'), 
            'address,stakes,sui_amount,points_awarded\n' + userSummaryOutput);
        console.log('✅ User summary saved to: user_migration_summary.csv');
        
        console.log('');
        console.log('🎯 NEXT STEPS:');
        console.log('1. Update PACKAGE_ID and LEDGER_ID in MIGRATION_COMMANDS_READY.sh');
        console.log('2. Test with a few small stakes first');
        console.log('3. Execute the migration commands');
        console.log('4. Verify user balances using the CSV summary');
        console.log('');
        console.log('⚠️  IMPORTANT: Make sure you have sufficient gas and the correct network selected!');
        
    } catch (error) {
        console.error('❌ Fatal error in main():', error.message);
        console.error(error.stack);
    }
}

// Run the script
main();

export {
    parseMigrationData,
    calculateAlphaPoints,
    generateMintCommand,
    POINTS_PER_SUI,
    MIST_PER_SUI
}; 
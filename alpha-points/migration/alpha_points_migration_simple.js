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

console.log('🚀 Alpha Points Migration Script (Simple Version)');
console.log('================================================');
console.log(`Rate: 1 SUI = ${POINTS_PER_SUI.toLocaleString()} Alpha Points`);
console.log('');

// Hardcoded sample stakes for testing - replace with full data
const sampleStakes = [
  {
    stake_id: "0x31b73dc192dacfe80ce7929eb34b40f1d3a038ff8a05b18c72e3d5b1249f430e",
    owner: "0xfc5cd7ce4ffd3552d87df6fcf1738c8e284b8bea9c38052dda94c3eb30d1a1b8",
    principal_mist: 500000000000,
    duration_days: 30
  },
  {
    stake_id: "0x794d84ea07bb597ea79610b1b526f3c0a1b30f9bb11589f3b360735c9c99d17b",
    owner: "0x26c25d11ac38064e727272797e5955c3e5f08dcc928f5d6bbb2491658eca3896",
    principal_mist: 420000000000,
    duration_days: 365
  },
  {
    stake_id: "0xbbcbbc97a12c7db35ae4fd4864806687447e0d62ba9735e42425bacfd4a2e234",
    owner: "0x08b8700a6cf6a41835de61163f8dd55bccbcd9e8ed3150079b3feb8513c3e221",
    principal_mist: 400000000000,
    duration_days: 30
  }
];

// Function to calculate Alpha Points for a stake
function calculateAlphaPoints(principalMist) {
    // Convert MIST to SUI, then multiply by points rate
    const sui = principalMist / MIST_PER_SUI;
    const points = Math.floor(sui * POINTS_PER_SUI);
    return points;
}

// Function to generate mint_points command
function generateMintCommand(stake, points) {
    // Need to add the PointType parameter - using Staking type (0)
    return `sui client call --package ${PACKAGE_ID} \\
  --module ledger \\
  --function mint_points \\
  --args ${LEDGER_ID} ${stake.owner} ${points} "0" \\
  --gas-budget 10000000`;
}

// Function to extract stakes from migration file using regex
function extractStakesFromFile() {
    try {
        const dataPath = path.join(__dirname, 'migration_data_complete.txt');
        console.log(`📁 Reading file: ${dataPath}`);
        
        if (!fs.existsSync(dataPath)) {
            console.error('❌ Migration data file not found, using sample data');
            return sampleStakes;
        }
        
        // Read file with latin1 encoding to handle special characters
        const data = fs.readFileSync(dataPath, 'latin1');
        console.log(`📄 File size: ${data.length} characters`);
        
        // More flexible regex pattern to match stake objects
        // This pattern looks for the key fields we need
        const stakePattern = /stake_id:\s*"(0x[a-fA-F0-9]+)"[\s\S]*?owner:\s*"(0x[a-fA-F0-9]+)"[\s\S]*?principal_mist:\s*(\d+)[\s\S]*?duration_days:\s*(\d+)/g;
        
        const stakes = [];
        let match;
        let matchCount = 0;
        
        console.log('🔍 Searching for stake patterns...');
        
        while ((match = stakePattern.exec(data)) !== null && matchCount < 1000) { // Limit to prevent infinite loops
            stakes.push({
                stake_id: match[1],
                owner: match[2],
                principal_mist: parseInt(match[3]),
                duration_days: parseInt(match[4])
            });
            matchCount++;
            
            if (matchCount % 100 === 0) {
                console.log(`   Found ${matchCount} stakes so far...`);
            }
        }
        
        if (stakes.length === 0) {
            console.warn('⚠️  No stakes found with regex, trying alternative approach...');
            
            // Alternative approach: look for lines containing stake_id
            const lines = data.split('\n');
            const stakeLines = lines.filter(line => line.includes('stake_id:'));
            console.log(`📝 Found ${stakeLines.length} lines with stake_id`);
            
            if (stakeLines.length > 0) {
                console.log('📄 Sample stake line:', stakeLines[0].substring(0, 100) + '...');
            }
            
            return sampleStakes;
        }
        
        console.log(`✅ Extracted ${stakes.length} stakes from file`);
        
        // Show first few extracted stakes for verification
        stakes.slice(0, 3).forEach((stake, i) => {
            console.log(`   Stake ${i + 1}: ${stake.stake_id.substring(0, 10)}... - ${(stake.principal_mist / MIST_PER_SUI).toFixed(4)} SUI`);
        });
        
        return stakes;
        
    } catch (error) {
        console.error('❌ Error reading file:', error.message);
        console.log('📝 Using sample data instead');
        return sampleStakes;
    }
}

// Main execution
function main() {
    try {
        console.log('📖 Extracting migration data...');
        const stakes = extractStakesFromFile();
        
        console.log(`✅ Found ${stakes.length} stakes to migrate`);
        console.log('');
        
        // Show first few stakes as samples
        stakes.slice(0, 3).forEach((stake, i) => {
            const sui = stake.principal_mist / MIST_PER_SUI;
            const points = calculateAlphaPoints(stake.principal_mist);
            console.log(`✅ Sample stake ${i + 1}:`, {
                stake_id: stake.stake_id?.substring(0, 10) + '...',
                owner: stake.owner?.substring(0, 10) + '...',
                amount: `${sui.toFixed(4)} SUI`,
                points: `${points.toLocaleString()} points`
            });
        });
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
        sortedStakes.slice(0, Math.min(10, stakes.length)).forEach((stake, i) => {
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
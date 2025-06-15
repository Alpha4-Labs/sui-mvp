import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const POINTS_PER_SUI = 1_100_000; // 1 SUI = 1,100,000 Alpha Points
const MIST_PER_SUI = 1_000_000_000; // 1 SUI = 1 billion MIST

console.log('🔧 Manual Stake Extraction Tool');
console.log('===============================');

// Manual extraction of stakes from the known data
// Based on the migration summary, we know there are 573 stakes totaling 7,705.5032 SUI
const knownStakeData = [
    // Top 10 largest stakes from the migration summary
    { owner: "0xfc5cd7ce4ffd3552d87df6fcf1738c8e284b8bea9c38052dda94c3eb30d1a1b8", principal_mist: 500000000000, duration_days: 30 },
    { owner: "0x26c25d11ac38064e727272797e5955c3e5f08dcc928f5d6bbb2491658eca3896", principal_mist: 420000000000, duration_days: 365 },
    { owner: "0x08b8700a6cf6a41835de61163f8dd55bccbcd9e8ed3150079b3feb8513c3e221", principal_mist: 400000000000, duration_days: 30 },
    { owner: "0x2338233efdec2d08bd9d5b340b55fc9f200ed536d8056d8b9593f1e6a20ce7fb", principal_mist: 320000000000, duration_days: 90 },
    { owner: "0x295aa592edb5d15bc696996d66711801a70ffbb7d5ff5de399169f0eeb505142", principal_mist: 300000000000, duration_days: 365 },
    { owner: "0x08b8700a6cf6a41835de61163f8dd55bccbcd9e8ed3150079b3feb8513c3e221", principal_mist: 250000000000, duration_days: 90 },
    { owner: "0x08b8700a6cf6a41835de61163f8dd55bccbcd9e8ed3150079b3feb8513c3e221", principal_mist: 247443042768, duration_days: 180 },
    { owner: "0x390ce487025ea28143245350adbc426203aea1be18918a0955601bffe682a77f", principal_mist: 180000000000, duration_days: 30 },
    { owner: "0x02646eedaa292bf58a32a554769350c7129cc735c71439619ad4fcb83dd15ac0", principal_mist: 150000000000, duration_days: 30 },
    { owner: "0x02646eedaa292bf58a32a554769350c7129cc735c71439619ad4fcb83dd15ac0", principal_mist: 150000000000, duration_days: 90 }
];

// Function to calculate Alpha Points for a stake
function calculateAlphaPoints(principalMist) {
    const sui = principalMist / MIST_PER_SUI;
    const points = Math.floor(sui * POINTS_PER_SUI);
    return points;
}

// Function to generate mint_points command
function generateMintCommand(stake, points, index) {
    return `# Stake ${index + 1}: ${(stake.principal_mist / MIST_PER_SUI).toFixed(4)} SUI → ${points.toLocaleString()} points
# Owner: ${stake.owner}
# Duration: ${stake.duration_days} days
sui client call --package YOUR_PACKAGE_ID_HERE \\
  --module ledger \\
  --function mint_points \\
  --args YOUR_LEDGER_ID_HERE ${stake.owner} ${points} "0" \\
  --gas-budget 10000000
`;
}

// Function to try different encoding approaches
function tryExtractFromFile() {
    const dataPath = path.join(__dirname, 'migration_data_complete.txt');
    
    if (!fs.existsSync(dataPath)) {
        console.log('❌ Migration file not found');
        return [];
    }
    
    console.log('🔍 Trying different extraction methods...');
    
    // Try different encodings
    const encodings = ['utf8', 'latin1', 'ascii', 'binary'];
    
    for (const encoding of encodings) {
        try {
            console.log(`   Trying ${encoding} encoding...`);
            const data = fs.readFileSync(dataPath, encoding);
            
            // Look for stake_id patterns
            const stakeIdMatches = data.match(/stake_id/g);
            console.log(`   Found ${stakeIdMatches ? stakeIdMatches.length : 0} stake_id occurrences`);
            
            // Look for owner patterns
            const ownerMatches = data.match(/owner:/g);
            console.log(`   Found ${ownerMatches ? ownerMatches.length : 0} owner occurrences`);
            
            // Look for principal_mist patterns
            const mistMatches = data.match(/principal_mist:/g);
            console.log(`   Found ${mistMatches ? mistMatches.length : 0} principal_mist occurrences`);
            
            if (stakeIdMatches && stakeIdMatches.length > 10) {
                console.log(`✅ ${encoding} encoding looks promising!`);
                
                // Try to extract a few samples
                const samplePattern = /owner:\s*"(0x[a-fA-F0-9]+)"[\s\S]*?principal_mist:\s*(\d+)/g;
                const samples = [];
                let match;
                let count = 0;
                
                while ((match = samplePattern.exec(data)) !== null && count < 5) {
                    samples.push({
                        owner: match[1],
                        principal_mist: parseInt(match[2])
                    });
                    count++;
                }
                
                if (samples.length > 0) {
                    console.log('📄 Sample extractions:');
                    samples.forEach((sample, i) => {
                        const sui = sample.principal_mist / MIST_PER_SUI;
                        console.log(`   ${i + 1}. ${sample.owner.substring(0, 10)}... - ${sui.toFixed(4)} SUI`);
                    });
                    return samples;
                }
            }
            
        } catch (error) {
            console.log(`   ❌ ${encoding} failed: ${error.message}`);
        }
    }
    
    return [];
}

// Main execution
function main() {
    console.log('📊 Known Migration Data Summary:');
    console.log(`   Top 10 stakes: ${knownStakeData.length} entries`);
    
    const totalSUI = knownStakeData.reduce((sum, stake) => sum + (stake.principal_mist / MIST_PER_SUI), 0);
    const totalPoints = knownStakeData.reduce((sum, stake) => sum + calculateAlphaPoints(stake.principal_mist), 0);
    
    console.log(`   Total SUI (top 10): ${totalSUI.toFixed(4)} SUI`);
    console.log(`   Total Points (top 10): ${totalPoints.toLocaleString()} Alpha Points`);
    console.log('');
    
    // Try to extract from file
    const extractedStakes = tryExtractFromFile();
    console.log('');
    
    // Generate commands for known stakes
    console.log('📝 Generating commands for known top 10 stakes...');
    
    const commands = knownStakeData.map((stake, index) => {
        const points = calculateAlphaPoints(stake.principal_mist);
        return generateMintCommand(stake, points, index);
    });
    
    const output = `# Alpha Points Migration - Top 10 Stakes
# Generated: ${new Date().toISOString()}
# Rate: 1 SUI = ${POINTS_PER_SUI.toLocaleString()} Alpha Points
#
# IMPORTANT: Update YOUR_PACKAGE_ID_HERE and YOUR_LEDGER_ID_HERE before execution!
#
# These are the top 10 largest stakes from the migration data.
# Total: ${totalSUI.toFixed(4)} SUI → ${totalPoints.toLocaleString()} Alpha Points

${commands.join('\n')}

# NOTE: This represents only the top 10 stakes out of 573 total stakes.
# The complete migration would require processing all 573 stakes totaling 7,705.5032 SUI.
# Estimated total points for all stakes: ${Math.floor(7705.5032 * POINTS_PER_SUI).toLocaleString()} Alpha Points
`;
    
    fs.writeFileSync(path.join(__dirname, 'TOP_10_MIGRATION_COMMANDS.sh'), output);
    console.log('✅ Top 10 migration commands saved to: TOP_10_MIGRATION_COMMANDS.sh');
    
    // Generate user summary for top 10
    const userSummary = new Map();
    knownStakeData.forEach(stake => {
        if (!userSummary.has(stake.owner)) {
            userSummary.set(stake.owner, { stakes: 0, sui: 0, points: 0 });
        }
        const userStats = userSummary.get(stake.owner);
        userStats.stakes += 1;
        userStats.sui += stake.principal_mist / MIST_PER_SUI;
        userStats.points += calculateAlphaPoints(stake.principal_mist);
    });
    
    const csvOutput = 'address,stakes,sui_amount,points_awarded\n' + 
        Array.from(userSummary.entries())
            .sort((a, b) => b[1].points - a[1].points)
            .map(([address, stats]) => `${address},${stats.stakes},${stats.sui.toFixed(4)},${stats.points}`)
            .join('\n');
    
    fs.writeFileSync(path.join(__dirname, 'top_10_user_summary.csv'), csvOutput);
    console.log('✅ Top 10 user summary saved to: top_10_user_summary.csv');
    
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('1. Test with the top 10 stakes first');
    console.log('2. Update PACKAGE_ID and LEDGER_ID in the commands');
    console.log('3. Execute a few test commands to verify the process');
    console.log('4. Work on extracting the remaining 563 stakes');
    console.log('');
    console.log('💡 RECOMMENDATION:');
    console.log('   Start with these top 10 stakes to validate the migration process.');
    console.log('   They represent significant value and will help verify the approach works.');
}

main(); 
import fs from 'fs';

const data = fs.readFileSync('migration_data_complete.txt', 'utf8');

console.log('Testing stake ID extraction...');

// Test multiple patterns
const patterns = [
    /stake_id:\s*"(0x[a-fA-F0-9]{64})"/g,
    /stake_id:\s+"(0x[a-fA-F0-9]+)"/g,
    /stake_id:\s*"(0x[a-fA-F0-9]+)"/g,
    /"stake_id":\s*"(0x[a-fA-F0-9]+)"/g
];

console.log('Trying different patterns...');
let pattern = null;
const matches = [];

for (let i = 0; i < patterns.length; i++) {
    const testPattern = patterns[i];
    console.log(`Testing pattern ${i + 1}: ${testPattern}`);
    
    let match;
    const tempMatches = [];
    
    while ((match = testPattern.exec(data)) !== null) {
        tempMatches.push(match[1]);
    }
    
    console.log(`Pattern ${i + 1} found ${tempMatches.length} matches`);
    
    if (tempMatches.length > 0) {
        matches.push(...tempMatches);
        pattern = testPattern;
        break;
    }
}

console.log(`Found ${matches.length} stake IDs`);
console.log('First 5 stake IDs:');
matches.slice(0, 5).forEach((id, i) => {
    console.log(`${i + 1}: ${id}`);
});

// Save just the stake IDs for use
const stakeIds = [...new Set(matches)]; // Remove duplicates
console.log(`Unique stake IDs: ${stakeIds.length}`);

fs.writeFileSync('extracted_stake_ids.json', JSON.stringify(stakeIds, null, 2));
console.log('✅ Stake IDs saved to extracted_stake_ids.json'); 
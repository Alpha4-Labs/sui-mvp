import fs from 'fs';

// Configuration
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const NETWORK = 'testnet';

async function createUnlockCommands() {
    console.log('🔓 CREATING STAKE UNLOCK COMMANDS');
    console.log('═══════════════════════════════════');
    console.log(`📦 Old Package ID: ${OLD_PACKAGE_ID}`);
    console.log('');

    try {
        // Read the migration data file
        const migrationData = fs.readFileSync('migration_data_complete.txt', 'utf8');
        
        // Extract stake IDs using regex - exact pattern from the file
        const stakeIdPattern = /stake_id:\s*"(0x[a-fA-F0-9]{64})"/g;
        const stakeIds = [];
        let match;
        
        while ((match = stakeIdPattern.exec(migrationData)) !== null) {
            if (!stakeIds.includes(match[1])) {
                stakeIds.push(match[1]);
            }
        }
        
        console.log(`🔍 Extracted ${stakeIds.length} unique stake IDs`);
        
        console.log(`📊 Found ${stakeIds.length} stakes to unlock`);
        console.log('');

        // Generate batch unlock commands
        const BATCH_SIZE = 50;
        const batches = [];
        for (let i = 0; i < stakeIds.length; i += BATCH_SIZE) {
            batches.push(stakeIds.slice(i, i + BATCH_SIZE));
        }

        console.log('🔧 ADMIN UNLOCK COMMANDS');
        console.log('═══════════════════════');
        console.log('');
        console.log('⚠️  IMPORTANT: These commands require ADMIN privileges');
        console.log('⚠️  Replace the following placeholders:');
        console.log('    - OLD_ADMIN_CAP_OBJECT_ID: The AdminCap object ID from the old package');
        console.log('    - CLOCK_OBJECT_ID: Usually 0x6 for system clock');
        console.log('');

        // Show summary first
        console.log(`📋 BATCH SUMMARY:`);
        console.log(`   • Total Stakes: ${stakeIds.length}`);
        console.log(`   • Batches: ${batches.length} (${BATCH_SIZE} stakes per batch)`);
        console.log(`   • Estimated Gas: ~${batches.length * 1000} SUI total`);
        console.log('');

        // Generate individual batch commands
        console.log('🚀 BATCH UNLOCK COMMANDS:');
        console.log('');
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const startStake = i * BATCH_SIZE + 1;
            const endStake = Math.min((i + 1) * BATCH_SIZE, stakeIds.length);
            
            console.log(`# ═══════════════════════════════════════════════════════════`);
            console.log(`# BATCH ${i + 1}/${batches.length}: Stakes ${startStake}-${endStake} (${batch.length} stakes)`);
            console.log(`# ═══════════════════════════════════════════════════════════`);
            console.log('');
            console.log('sui client call \\');
            console.log(`  --package ${OLD_PACKAGE_ID} \\`);
            console.log('  --module integration \\');
            console.log('  --function admin_batch_unencumber_old_stakes \\');
            console.log('  --args \\');
            console.log('    OLD_ADMIN_CAP_OBJECT_ID \\');
            console.log(`    ${OLD_PACKAGE_ID} \\`);
            console.log('    "[');
            
            batch.forEach((stakeId, index) => {
                const isLast = index === batch.length - 1;
                console.log(`      "${stakeId}"${isLast ? '' : ','}`);
            });
            
            console.log('    ]" \\');
            console.log('    0x6 \\');
            console.log('  --gas-budget 1000000000');
            console.log('');
            
            // Add a pause reminder between batches
            if (i < batches.length - 1) {
                console.log('# ⏸️  WAIT for transaction to complete before running next batch');
                console.log('');
            }
        }

        // Generate individual test commands
        console.log('');
        console.log('🧪 TEST COMMANDS (Run these first to verify):');
        console.log('════════════════════════════════════════════');
        console.log('');
        
        // Show first 3 stakes for testing
        const testStakes = stakeIds.slice(0, 3);
        
        testStakes.forEach((stakeId, index) => {
            console.log(`# Test Stake ${index + 1}: ${stakeId}`);
            console.log('sui client call \\');
            console.log(`  --package ${OLD_PACKAGE_ID} \\`);
            console.log('  --module integration \\');
            console.log('  --function old_package_admin_unencumber_stake \\');
            console.log('  --args \\');
            console.log('    OLD_ADMIN_CAP_OBJECT_ID \\');
            console.log(`    ${OLD_PACKAGE_ID} \\`);
            console.log('    OWNER_ADDRESS \\');  // This would need to be extracted from the data
            console.log(`    ${stakeId} \\`);
            console.log('    0x6 \\');
            console.log('  --gas-budget 100000000');
            console.log('');
        });

        // Generate programmatic commands
        console.log('');
        console.log('💻 PROGRAMMATIC EXECUTION (TypeScript/JavaScript):');
        console.log('═══════════════════════════════════════════════');
        console.log('');
        console.log('```typescript');
        console.log('import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";');
        console.log('import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";');
        console.log('import { Transaction } from "@mysten/sui/transactions";');
        console.log('');
        console.log('const client = new SuiClient({ url: getFullnodeUrl("testnet") });');
        console.log('const adminKeypair = Ed25519Keypair.fromSecretKey(ADMIN_SECRET_KEY);');
        console.log('const OLD_ADMIN_CAP_OBJECT_ID = "YOUR_ADMIN_CAP_OBJECT_ID";');
        console.log('');
        console.log('const allStakeIds = [');
        stakeIds.slice(0, 10).forEach((stakeId) => {
            console.log(`  "${stakeId}",`);
        });
        console.log('  // ... (remaining stake IDs)');
        console.log('];');
        console.log('');
        console.log('async function unlockStakesBatch(stakeIdsBatch) {');
        console.log('  const tx = new Transaction();');
        console.log('  tx.moveCall({');
        console.log(`    package: "${OLD_PACKAGE_ID}",`);
        console.log('    module: "integration",');
        console.log('    function: "admin_batch_unencumber_old_stakes",');
        console.log('    arguments: [');
        console.log('      tx.object(OLD_ADMIN_CAP_OBJECT_ID),');
        console.log(`      tx.pure("${OLD_PACKAGE_ID}"),`);
        console.log('      tx.pure(stakeIdsBatch),');
        console.log('      tx.object("0x6") // Clock');
        console.log('    ]');
        console.log('  });');
        console.log('');
        console.log('  const result = await client.signAndExecuteTransaction({');
        console.log('    signer: adminKeypair,');
        console.log('    transaction: tx,');
        console.log('    options: { showEffects: true }');
        console.log('  });');
        console.log('');
        console.log('  console.log(`Batch unlocked: ${result.digest}`);');
        console.log('  return result;');
        console.log('}');
        console.log('```');
        console.log('');

        // Save all commands to a file
        const commandsOutput = `# Alpha Points Stake Unlock Commands

## Summary
- Total Stakes: ${stakeIds.length}
- Batches Required: ${batches.length}
- Estimated Gas Cost: ~${batches.length * 1000} SUI

## Prerequisites
1. Access to the old package AdminCap
2. Sufficient SUI for gas fees
3. Admin privileges on the old package

## Batch Commands

${batches.map((batch, i) => `### Batch ${i + 1}/${batches.length}
\`\`\`bash
sui client call \\
  --package ${OLD_PACKAGE_ID} \\
  --module integration \\
  --function admin_batch_unencumber_old_stakes \\
  --args \\
    OLD_ADMIN_CAP_OBJECT_ID \\
    ${OLD_PACKAGE_ID} \\
    "[${batch.map(id => `"${id}"`).join(', ')}]" \\
    0x6 \\
  --gas-budget 1000000000
\`\`\`
`).join('\n')}

## All Stake IDs
\`\`\`javascript
const allStakeIds = [
${stakeIds.map(id => `  "${id}"`).join(',\n')}
];
\`\`\`

## Instructions
1. Replace OLD_ADMIN_CAP_OBJECT_ID with your actual AdminCap object ID
2. Execute each batch command sequentially
3. Wait for each transaction to complete before running the next
4. Verify stakes are unlocked before proceeding
5. Notify users they can now self-migrate their stakes
`;

        fs.writeFileSync('unlock_commands_complete.md', commandsOutput);
        
        console.log('✅ UNLOCK COMMANDS GENERATED');
        console.log('═══════════════════════════');
        console.log('');
        console.log(`📄 Commands saved to: unlock_commands_complete.md`);
        console.log(`📊 Total stakes to unlock: ${stakeIds.length}`);
        console.log(`🔀 Batches required: ${batches.length}`);
        console.log(`💰 Estimated gas cost: ~${batches.length * 1000} SUI`);
        console.log('');
        console.log('🚨 NEXT STEPS:');
        console.log('1. Obtain the old package AdminCap object ID');
        console.log('2. Test with individual stakes first');
        console.log('3. Execute batch unlock commands');
        console.log('4. Verify all stakes are unlocked');
        console.log('5. Notify users migration is ready');
        console.log('');
        console.log('⚠️  IMPORTANT: These commands require admin privileges!');

    } catch (error) {
        console.error('❌ Error creating unlock commands:', error);
        process.exit(1);
    }
}

// Run the command generator
createUnlockCommands(); 
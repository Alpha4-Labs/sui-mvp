import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import fs from 'fs';

// Configuration
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const NETWORK = 'testnet';

async function generateUnlockCommands() {
    console.log('🔓 GENERATING STAKE UNLOCK COMMANDS');
    console.log('══════════════════════════════════════');
    console.log(`📦 Old Package ID: ${OLD_PACKAGE_ID}`);
    console.log('');

    try {
        // Read the migration data we extracted earlier
        const migrationData = fs.readFileSync('migration_data_complete.txt', 'utf8');
        
        // Extract the JSON data from the file (look for start of JSON object)
        let jsonStart = migrationData.indexOf('{\n  "timestamp"');
        if (jsonStart === -1) {
            // Try alternative pattern
            jsonStart = migrationData.indexOf('{\n  ');
            if (jsonStart === -1) {
                jsonStart = migrationData.indexOf('{');
            }
        }
        
        if (jsonStart === -1) {
            throw new Error('Could not find migration data JSON in the file');
        }
        
        // Extract JSON and remove any trailing text after closing brace
        let jsonData = migrationData.substring(jsonStart);
        const lastBrace = jsonData.lastIndexOf('}');
        if (lastBrace !== -1) {
            jsonData = jsonData.substring(0, lastBrace + 1);
        }
        
        const allStakes = JSON.parse(jsonData);
        
        console.log(`📊 Found ${allStakes.stakes.length} stakes to unlock`);
        console.log(`👥 Affecting ${allStakes.unique_owners} unique owners`);
        console.log(`💰 Total value: ${allStakes.total_value_sui.toFixed(4)} SUI`);
        console.log('');

        // Extract all stake IDs
        const stakeIds = allStakes.stakes.map(stake => stake.stake_id);
        
        console.log('🔧 ADMIN UNLOCK COMMANDS');
        console.log('═══════════════════════');
        console.log('');

        // Generate batch unlock command for Sui CLI
        console.log('// === SUI CLI BATCH UNLOCK COMMAND ===');
        console.log('// Run this command with admin privileges to unlock ALL stakes at once');
        console.log('');
        
        console.log('sui client call \\');
        console.log(`  --package ${OLD_PACKAGE_ID} \\`);
        console.log('  --module integration \\');
        console.log('  --function admin_batch_unencumber_old_stakes \\');
        console.log('  --type-args "OLD_ADMIN_CAP_TYPE" \\');
        console.log('  --args \\');
        console.log('    OLD_ADMIN_CAP_OBJECT_ID \\');
        console.log(`    ${OLD_PACKAGE_ID} \\`);
        console.log('    "[');
        
        // Split into batches of 50 to avoid transaction size limits
        const BATCH_SIZE = 50;
        const batches = [];
        for (let i = 0; i < stakeIds.length; i += BATCH_SIZE) {
            batches.push(stakeIds.slice(i, i + BATCH_SIZE));
        }

        console.log(`// ${stakeIds.length} stake IDs in ${batches.length} batches:`);
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`// Batch ${i + 1}/${batches.length}: ${batch.length} stakes`);
        }
        
        // Show first batch as example
        const firstBatch = batches[0];
        firstBatch.forEach((stakeId, index) => {
            const isLast = index === firstBatch.length - 1 && batches.length === 1;
            console.log(`      "${stakeId}"${isLast ? '' : ','}`);
        });
        
        if (batches.length > 1) {
            console.log('      // ... more stake IDs (see full list below)');
        }
        
        console.log('    ]" \\');
        console.log('    CLOCK_OBJECT_ID \\');
        console.log('  --gas-budget 1000000000');
        console.log('');

        // Generate multiple batch commands if needed
        if (batches.length > 1) {
            console.log('// === MULTIPLE BATCH COMMANDS (Due to transaction size limits) ===');
            console.log('// Execute these commands sequentially:');
            console.log('');
            
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`// Batch ${i + 1}/${batches.length}: Stakes ${i * BATCH_SIZE + 1}-${Math.min((i + 1) * BATCH_SIZE, stakeIds.length)}`);
                console.log('sui client call \\');
                console.log(`  --package ${OLD_PACKAGE_ID} \\`);
                console.log('  --module integration \\');
                console.log('  --function admin_batch_unencumber_old_stakes \\');
                console.log('  --type-args "OLD_ADMIN_CAP_TYPE" \\');
                console.log('  --args \\');
                console.log('    OLD_ADMIN_CAP_OBJECT_ID \\');
                console.log(`    ${OLD_PACKAGE_ID} \\`);
                console.log('    "[');
                
                batch.forEach((stakeId, index) => {
                    const isLast = index === batch.length - 1;
                    console.log(`      "${stakeId}"${isLast ? '' : ','}`);
                });
                
                console.log('    ]" \\');
                console.log('    CLOCK_OBJECT_ID \\');
                console.log('  --gas-budget 1000000000');
                console.log('');
            }
        }

        // Generate TypeScript/JavaScript commands for programmatic execution
        console.log('// === TYPESCRIPT/JAVASCRIPT EXECUTION ===');
        console.log('// Use this code structure for programmatic execution:');
        console.log('');
        console.log('```typescript');
        console.log('import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";');
        console.log('import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";');
        console.log('import { Transaction } from "@mysten/sui/transactions";');
        console.log('');
        console.log('const client = new SuiClient({ url: getFullnodeUrl("testnet") });');
        console.log('const keypair = Ed25519Keypair.fromSecretKey(ADMIN_SECRET_KEY);');
        console.log('');
        console.log('async function unlockAllStakes() {');
        console.log('  const stakeIds = [');
        
        // Show first 10 as example
        stakeIds.slice(0, 10).forEach((stakeId, index) => {
            console.log(`    "${stakeId}",`);
        });
        console.log('    // ... (all 573 stake IDs)');
        console.log('  ];');
        console.log('');
        console.log('  const tx = new Transaction();');
        console.log('  tx.moveCall({');
        console.log(`    package: "${OLD_PACKAGE_ID}",`);
        console.log('    module: "integration",');
        console.log('    function: "admin_batch_unencumber_old_stakes",');
        console.log('    typeArguments: ["OLD_ADMIN_CAP_TYPE"],');
        console.log('    arguments: [');
        console.log('      tx.object(OLD_ADMIN_CAP_OBJECT_ID),');
        console.log(`      tx.pure("${OLD_PACKAGE_ID}"),`);
        console.log('      tx.pure(stakeIds),');
        console.log('      tx.object(CLOCK_OBJECT_ID)');
        console.log('    ]');
        console.log('  });');
        console.log('');
        console.log('  const result = await client.signAndExecuteTransaction({');
        console.log('    signer: keypair,');
        console.log('    transaction: tx');
        console.log('  });');
        console.log('');
        console.log('  console.log("Unlock transaction:", result.digest);');
        console.log('}');
        console.log('```');
        console.log('');

        // Generate individual unlock commands for testing
        console.log('// === INDIVIDUAL UNLOCK COMMANDS (For Testing) ===');
        console.log('// Test with these individual stakes first:');
        console.log('');
        
        // Show commands for the 5 smallest stakes for testing
        const sortedStakes = allStakes.stakes.sort((a, b) => a.principal_mist - b.principal_mist);
        const testStakes = sortedStakes.slice(0, 5);
        
        testStakes.forEach((stake, index) => {
            const suiValue = (stake.principal_mist / 1_000_000_000).toFixed(4);
            console.log(`// Test Stake ${index + 1}: ${suiValue} SUI - Owner: ${stake.owner.substring(0, 10)}...`);
            console.log('sui client call \\');
            console.log(`  --package ${OLD_PACKAGE_ID} \\`);
            console.log('  --module integration \\');
            console.log('  --function old_package_admin_unencumber_stake \\');
            console.log('  --type-args "OLD_ADMIN_CAP_TYPE" \\');
            console.log('  --args \\');
            console.log('    OLD_ADMIN_CAP_OBJECT_ID \\');
            console.log(`    ${OLD_PACKAGE_ID} \\`);
            console.log(`    ${stake.owner} \\`);
            console.log(`    ${stake.stake_id} \\`);
            console.log('    CLOCK_OBJECT_ID \\');
            console.log('  --gas-budget 100000000');
            console.log('');
        });

        // Generate complete stake ID list for copying
        console.log('// === COMPLETE STAKE ID LIST ===');
        console.log('// Copy and paste this list into your unlock commands:');
        console.log('');
        console.log('const allStakeIds = [');
        stakeIds.forEach((stakeId, index) => {
            const isLast = index === stakeIds.length - 1;
            console.log(`  "${stakeId}"${isLast ? '' : ','}`);
        });
        console.log('];');
        console.log('');

        // Instructions
        console.log('📋 EXECUTION INSTRUCTIONS');
        console.log('═════════════════════════');
        console.log('');
        console.log('1. **Identify Old Admin Cap**: Find the AdminCap object from the old package');
        console.log('2. **Get Clock Object**: Get the current Clock object ID (0x6)');
        console.log('3. **Replace Placeholders**:');
        console.log('   - OLD_ADMIN_CAP_TYPE: The type of the old AdminCap');
        console.log('   - OLD_ADMIN_CAP_OBJECT_ID: The object ID of the old AdminCap');
        console.log('   - CLOCK_OBJECT_ID: Usually 0x6 for system clock');
        console.log('4. **Execute**: Run the unlock commands with admin privileges');
        console.log('5. **Verify**: Check that stakes are unencumbered');
        console.log('6. **Notify Users**: Inform users they can now self-migrate');
        console.log('');

        console.log('⚠️  IMPORTANT NOTES');
        console.log('═══════════════════');
        console.log('- This is a ONE-TIME operation that unlocks ALL stakes');
        console.log('- Requires admin privileges on the old package');
        console.log('- Users can then migrate their own stakes using self_service_migrate_stake()');
        console.log('- Test with small stakes first before unlocking everything');
        console.log(`- Total gas cost estimate: ~${Math.ceil(batches.length * 1000)} SUI for all batches`);
        console.log('');

        // Save commands to file
        const commandsOutput = `# Stake Unlock Commands for Alpha Points Migration

## Summary
- Total Stakes: ${allStakes.stakes.length}
- Unique Owners: ${allStakes.unique_owners}
- Total Value: ${allStakes.total_value_sui.toFixed(4)} SUI
- Batches Required: ${batches.length}

## All Stake IDs
${stakeIds.map(id => `"${id}"`).join(',\n')}

## Batch Commands
${batches.map((batch, i) => `
### Batch ${i + 1}/${batches.length}
\`\`\`bash
sui client call \\
  --package ${OLD_PACKAGE_ID} \\
  --module integration \\
  --function admin_batch_unencumber_old_stakes \\
  --type-args "OLD_ADMIN_CAP_TYPE" \\
  --args \\
    OLD_ADMIN_CAP_OBJECT_ID \\
    ${OLD_PACKAGE_ID} \\
    "[${batch.map(id => `"${id}"`).join(', ')}]" \\
    CLOCK_OBJECT_ID \\
  --gas-budget 1000000000
\`\`\`
`).join('\n')}
`;

        fs.writeFileSync('unlock_commands.md', commandsOutput);
        console.log('✅ Commands saved to unlock_commands.md');

    } catch (error) {
        console.error('❌ Error generating unlock commands:', error);
        process.exit(1);
    }
}

// Run the generator
generateUnlockCommands()
    .then(() => {
        console.log('✅ Unlock command generation completed successfully');
        console.log('');
        console.log('🚀 NEXT STEPS:');
        console.log('1. Review the generated commands above');
        console.log('2. Identify the old package AdminCap object');
        console.log('3. Execute the unlock commands with admin privileges');
        console.log('4. Verify stakes are unlocked');
        console.log('5. Begin user migration process');
    })
    .catch((error) => {
        console.error('❌ Command generation failed:', error);
        process.exit(1);
    }); 
import fs from 'fs';

// Configuration with optimized settings
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const REALISTIC_GAS_BUDGET = 100_000_000; // 0.1 SUI per batch
const OPTIMIZED_BATCH_SIZE = 100; // Larger batches for efficiency

async function generateOptimizedUnlockCommands() {
    console.log('🚀 GENERATING OPTIMIZED UNLOCK COMMANDS');
    console.log('═════════════════════════════════════════');
    console.log(`📦 Old Package ID: ${OLD_PACKAGE_ID}`);
    console.log(`💰 Gas Budget per Batch: ${REALISTIC_GAS_BUDGET} gas units (${REALISTIC_GAS_BUDGET / 1_000_000_000} SUI)`);
    console.log(`📊 Batch Size: ${OPTIMIZED_BATCH_SIZE} stakes per batch`);
    console.log('');

    try {
        // Read the extracted stake IDs
        const stakeIdsText = fs.readFileSync('extracted_stake_ids.txt', 'utf8');
        const stakeIds = stakeIdsText.trim().split('\n').filter(id => id.length > 0);
        
        console.log(`📊 Found ${stakeIds.length} stakes to unlock`);
        console.log('');

        // Generate optimized batches
        const batches = [];
        for (let i = 0; i < stakeIds.length; i += OPTIMIZED_BATCH_SIZE) {
            batches.push(stakeIds.slice(i, i + OPTIMIZED_BATCH_SIZE));
        }

        const totalGasCost = batches.length * REALISTIC_GAS_BUDGET;
        const totalSuiCost = totalGasCost / 1_000_000_000;

        console.log('⚡ OPTIMIZED UNLOCK STRATEGY');
        console.log('═══════════════════════════');
        console.log('');
        console.log('📋 SUMMARY:');
        console.log(`   • Total Stakes: ${stakeIds.length}`);
        console.log(`   • Optimized Batches: ${batches.length} (${OPTIMIZED_BATCH_SIZE} stakes each)`);
        console.log(`   • Gas per Batch: ${REALISTIC_GAS_BUDGET} gas units`);
        console.log(`   • Total Gas Cost: ${totalGasCost} gas units`);
        console.log(`   • Total SUI Cost: ${totalSuiCost} SUI`);
        console.log(`   • Faucet Days Needed: ${Math.ceil(totalSuiCost / 3)} day(s)`);
        console.log('');

        console.log('🎯 EXECUTION STRATEGY:');
        console.log('1. Start with individual test (0.01 SUI)');
        console.log('2. Small batch test of 10 stakes (0.05 SUI)');
        console.log('3. Execute optimized batches (0.1 SUI each)');
        console.log('4. Adjust gas budget if needed');
        console.log('');

        // Generate optimized batch commands
        console.log('🚀 OPTIMIZED BATCH COMMANDS:');
        console.log('═══════════════════════════');
        console.log('');
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const startStake = i * OPTIMIZED_BATCH_SIZE + 1;
            const endStake = Math.min((i + 1) * OPTIMIZED_BATCH_SIZE, stakeIds.length);
            
            console.log(`# ═══════════════════════════════════════════════════════════`);
            console.log(`# OPTIMIZED BATCH ${i + 1}/${batches.length}: Stakes ${startStake}-${endStake}`);
            console.log(`# Contains ${batch.length} stakes | Gas: ${REALISTIC_GAS_BUDGET} (${REALISTIC_GAS_BUDGET / 1_000_000_000} SUI)`);
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
            console.log(`  --gas-budget ${REALISTIC_GAS_BUDGET}`);
            console.log('');
            
            if (i < batches.length - 1) {
                console.log('# ⏸️  WAIT for transaction completion before next batch');
                console.log('');
            }
        }

        // Test commands
        console.log('');
        console.log('🧪 INCREMENTAL TESTING COMMANDS:');
        console.log('═════════════════════════════════');
        console.log('');
        
        console.log('# STEP 1: Single stake test (Lowest gas cost)');
        console.log('sui client call \\');
        console.log(`  --package ${OLD_PACKAGE_ID} \\`);
        console.log('  --module integration \\');
        console.log('  --function old_package_admin_unencumber_stake \\');
        console.log('  --args \\');
        console.log('    OLD_ADMIN_CAP_OBJECT_ID \\');
        console.log(`    ${OLD_PACKAGE_ID} \\`);
        console.log('    OWNER_ADDRESS \\');
        console.log(`    ${stakeIds[0]} \\`);
        console.log('    0x6 \\');
        console.log('  --gas-budget 10000000');  // Even smaller for individual test
        console.log('');
        
        console.log('# STEP 2: Small batch test (10 stakes)');
        const testBatch = stakeIds.slice(0, 10);
        console.log('sui client call \\');
        console.log(`  --package ${OLD_PACKAGE_ID} \\`);
        console.log('  --module integration \\');
        console.log('  --function admin_batch_unencumber_old_stakes \\');
        console.log('  --args \\');
        console.log('    OLD_ADMIN_CAP_OBJECT_ID \\');
        console.log(`    ${OLD_PACKAGE_ID} \\`);
        console.log('    "[');
        testBatch.forEach((stakeId, index) => {
            const isLast = index === testBatch.length - 1;
            console.log(`      "${stakeId}"${isLast ? '' : ','}`);
        });
        console.log('    ]" \\');
        console.log('    0x6 \\');
        console.log('  --gas-budget 50000000');  // 0.05 SUI for small test
        console.log('');

        // Save optimized commands
        let optimizedOutput = `# Alpha Points - OPTIMIZED Stake Unlock Commands

## Optimized Summary
- **Total Stakes**: ${stakeIds.length}
- **Optimized Batches**: ${batches.length} (${OPTIMIZED_BATCH_SIZE} stakes per batch)
- **Gas per Batch**: ${REALISTIC_GAS_BUDGET} gas units (${REALISTIC_GAS_BUDGET / 1_000_000_000} SUI)
- **Total Cost**: ${totalSuiCost} SUI (achievable with faucet!)
- **Days Needed**: ${Math.ceil(totalSuiCost / 3)} day(s) with 3 SUI daily limit

## Testing Strategy
1. **Individual Test**: 0.01 SUI - Test single stake unlock
2. **Small Batch**: 0.05 SUI - Test 10 stakes batch
3. **Full Batches**: 0.1 SUI each - Execute all ${batches.length} batches

## Optimized Batch Commands

`;

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const startStake = i * OPTIMIZED_BATCH_SIZE + 1;
            const endStake = Math.min((i + 1) * OPTIMIZED_BATCH_SIZE, stakeIds.length);
            
            optimizedOutput += `### Batch ${i + 1}/${batches.length} - Stakes ${startStake}-${endStake} (${batch.length} stakes)

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
  --gas-budget ${REALISTIC_GAS_BUDGET}
\`\`\`

`;
        }

        optimizedOutput += `
## Gas Budget Adjustment
If you encounter gas errors, you can increase the gas budget incrementally:
- Current: ${REALISTIC_GAS_BUDGET} (${REALISTIC_GAS_BUDGET / 1_000_000_000} SUI)
- Conservative: ${REALISTIC_GAS_BUDGET * 2} (${REALISTIC_GAS_BUDGET * 2 / 1_000_000_000} SUI)
- Maximum: ${REALISTIC_GAS_BUDGET * 5} (${REALISTIC_GAS_BUDGET * 5 / 1_000_000_000} SUI)

## Post-Unlock User Migration
Once unlocked, users can migrate with:
\`\`\`bash
sui client call \\
  --package NEW_PACKAGE_ID \\
  --module integration \\
  --function self_service_migrate_stake \\
  --args \\
    NEW_ADMIN_CAP_OBJECT_ID \\
    ${OLD_PACKAGE_ID} \\
    THEIR_STAKE_ID \\
    0x6 \\
  --gas-budget 50000000
\`\`\`
`;

        fs.writeFileSync('OPTIMIZED_UNLOCK_COMMANDS.md', optimizedOutput);
        
        console.log('✅ OPTIMIZED COMMANDS GENERATED');
        console.log('═══════════════════════════════');
        console.log('');
        console.log(`📄 Optimized commands: OPTIMIZED_UNLOCK_COMMANDS.md`);
        console.log(`📊 Total cost: ${totalSuiCost} SUI (down from 12 SUI!)`);
        console.log(`🔀 Batches: ${batches.length} (down from 12!)`);
        console.log(`⏱️  Faucet time: ${Math.ceil(totalSuiCost / 3)} day(s)`);
        console.log('');
        console.log('🚀 READY TO EXECUTE:');
        console.log('1. Get AdminCap object ID');
        console.log('2. Test with single stake (0.01 SUI)');
        console.log('3. Test small batch (0.05 SUI)');
        console.log('4. Execute optimized batches (0.1 SUI each)');
        console.log('5. Adjust gas if needed');

    } catch (error) {
        console.error('❌ Error generating optimized commands:', error);
        process.exit(1);
    }
}

// Run the optimized generator
generateOptimizedUnlockCommands(); 
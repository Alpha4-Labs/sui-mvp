import fs from 'fs';

// Final configuration with actual AdminCap ID
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const ADMIN_CAP_ID = "0x4d1b5bebf54ff564bcedc93e66a53461bb821f3de9b6c1dd473866bca72155d8";
const GAS_BUDGET = 100_000_000; // 0.1 SUI per batch
const BATCH_SIZE = 100;

async function generateFinalUnlockCommands() {
    console.log('🎯 GENERATING FINAL UNLOCK COMMANDS');
    console.log('═══════════════════════════════════');
    console.log(`📦 Old Package ID: ${OLD_PACKAGE_ID}`);
    console.log(`🔑 AdminCap ID: ${ADMIN_CAP_ID}`);
    console.log(`💰 Gas Budget: ${GAS_BUDGET} gas units (${GAS_BUDGET / 1_000_000_000} SUI)`);
    console.log('');

    try {
        // Read the extracted stake IDs
        const stakeIdsText = fs.readFileSync('extracted_stake_ids.txt', 'utf8');
        const stakeIds = stakeIdsText.trim().split('\n').filter(id => id.length > 0);
        
        console.log(`📊 Total Stakes: ${stakeIds.length}`);
        
        // Generate batches
        const batches = [];
        for (let i = 0; i < stakeIds.length; i += BATCH_SIZE) {
            batches.push(stakeIds.slice(i, i + BATCH_SIZE));
        }

        const totalCost = batches.length * GAS_BUDGET / 1_000_000_000;
        
        console.log(`🚀 Ready to execute ${batches.length} batches`);
        console.log(`💸 Total cost: ${totalCost} SUI`);
        console.log('');

        // Generate test commands first
        console.log('🧪 TESTING COMMANDS (Execute in Order):');
        console.log('═══════════════════════════════════════');
        console.log('');
        
        console.log('# STEP 1: Single stake test (0.01 SUI)');
        console.log('sui client call \\');
        console.log(`  --package ${OLD_PACKAGE_ID} \\`);
        console.log('  --module integration \\');
        console.log('  --function old_package_admin_unencumber_stake \\');
        console.log('  --args \\');
        console.log(`    ${ADMIN_CAP_ID} \\`);
        console.log(`    ${OLD_PACKAGE_ID} \\`);
        console.log('    OWNER_ADDRESS \\');
        console.log(`    ${stakeIds[0]} \\`);
        console.log('    0x6 \\');
        console.log('  --gas-budget 10000000');
        console.log('');
        
        console.log('# STEP 2: Small batch test (10 stakes - 0.05 SUI)');
        const testBatch = stakeIds.slice(0, 10);
        console.log('sui client call \\');
        console.log(`  --package ${OLD_PACKAGE_ID} \\`);
        console.log('  --module integration \\');
        console.log('  --function admin_batch_unencumber_old_stakes \\');
        console.log('  --args \\');
        console.log(`    ${ADMIN_CAP_ID} \\`);
        console.log(`    ${OLD_PACKAGE_ID} \\`);
        console.log(`    "[${testBatch.map(id => `"${id}"`).join(', ')}]" \\`);
        console.log('    0x6 \\');
        console.log('  --gas-budget 50000000');
        console.log('');
        
        console.log('🚀 PRODUCTION BATCHES:');
        console.log('═════════════════════');
        console.log('');
        
        // Generate production batch commands
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const batchNum = i + 1;
            
            console.log(`# BATCH ${batchNum}/${batches.length} - ${batch.length} stakes (0.1 SUI)`);
            console.log('sui client call \\');
            console.log(`  --package ${OLD_PACKAGE_ID} \\`);
            console.log('  --module integration \\');
            console.log('  --function admin_batch_unencumber_old_stakes \\');
            console.log('  --args \\');
            console.log(`    ${ADMIN_CAP_ID} \\`);
            console.log(`    ${OLD_PACKAGE_ID} \\`);
            console.log(`    "[${batch.map(id => `"${id}"`).join(', ')}]" \\`);
            console.log('    0x6 \\');
            console.log(`  --gas-budget ${GAS_BUDGET}`);
            console.log('');
            
            if (i < batches.length - 1) {
                console.log('# ⏸️  Wait for transaction completion before next batch');
                console.log('');
            }
        }

        console.log('✅ FINAL COMMANDS READY FOR EXECUTION!');
        console.log('═════════════════════════════════════');
        console.log(`🎯 Execute testing commands first, then ${batches.length} production batches`);
        console.log(`💰 Total cost: ${totalCost} SUI`);
        console.log('🔓 After unlock, users can self-migrate with self_service_migrate_stake()');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

generateFinalUnlockCommands(); 
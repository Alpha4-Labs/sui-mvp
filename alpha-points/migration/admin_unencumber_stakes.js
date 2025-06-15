const { execSync } = require('child_process');
const fs = require('fs');

// Configuration - UPDATE THESE VALUES
const CONFIG = {
    OLD_PACKAGE_ID: "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf", // Replace with your old package ID
    OLD_ADMIN_CAP_ID: "0x27e8bf2681b5b0fc0d497bdf114da1a79cb54944aa0e24867ea8c69307bb024a", // Replace with your old admin cap object ID
    NEW_PACKAGE_ID: "0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec", // Replace with your new package ID
    NETWORK: "testnet", // or "mainnet"
    ADMIN_ADDRESS: "0x4308ee685cb8b79c6bc5dc7b458c37156609bd430f34baddbae9c7f011204327", // Replace with admin wallet address
    // Paste the stake IDs from the query script here:
    STAKE_IDS: [
        // "0x...",
        // "0x...",
        // Add more stake IDs here
    ]
};

function validateConfig() {
    const requiredFields = ['OLD_PACKAGE_ID', 'OLD_ADMIN_CAP_ID', 'NEW_PACKAGE_ID', 'ADMIN_ADDRESS'];
    
    for (const field of requiredFields) {
        if (!CONFIG[field] || CONFIG[field] === "0x...") {
            throw new Error(`❌ Please update ${field} in the CONFIG object`);
        }
    }
    
    if (CONFIG.STAKE_IDS.length === 0) {
        throw new Error(`❌ Please add stake IDs to CONFIG.STAKE_IDS array`);
    }
    
    console.log('✅ Configuration validated');
}

function buildAdminUnencumberCommand() {
    // Build the vector of stake IDs for the Move function
    const stakeIdsVector = `vector[${CONFIG.STAKE_IDS.map(id => `@${id}`).join(', ')}]`;
    
    const command = [
        'sui', 'client', 'call',
        '--package', CONFIG.NEW_PACKAGE_ID,
        '--module', 'integration',
        '--function', 'admin_batch_unencumber_old_stakes',
        '--type-args', `${CONFIG.OLD_PACKAGE_ID}::admin::AdminCap`, // Old admin cap type
        '--args',
        CONFIG.OLD_ADMIN_CAP_ID, // old_admin_cap
        CONFIG.OLD_PACKAGE_ID,   // old_package_id
        stakeIdsVector,          // stake_ids vector
        '0x6',                   // clock object
        '--gas-budget', '100000000', // 0.1 SUI
        '--network', CONFIG.NETWORK
    ].join(' ');
    
    return command;
}

function buildMoveCallForConsole() {
    // Alternative: Generate Move call syntax for sui console
    const stakeIdsFormatted = CONFIG.STAKE_IDS.map(id => `@${id}`).join(', ');
    
    return `
    // Move call for Sui Console:
    ${CONFIG.NEW_PACKAGE_ID}::integration::admin_batch_unencumber_old_stakes<${CONFIG.OLD_PACKAGE_ID}::admin::AdminCap>(
        old_admin_cap: &${CONFIG.OLD_PACKAGE_ID}::admin::AdminCap,
        old_package_id: @${CONFIG.OLD_PACKAGE_ID},
        stake_ids: vector[${stakeIdsFormatted}],
        clock: &0x6::clock::Clock,
        ctx: &mut TxContext
    )
    `;
}

function executeAdminUnencumber() {
    console.log('🔄 Executing admin batch unencumber...');
    
    try {
        const command = buildAdminUnencumberCommand();
        console.log('📝 Command to execute:');
        console.log(command);
        console.log('\n⏳ Executing...');
        
        const result = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
        
        console.log('✅ Command executed successfully!');
        console.log('📊 Result:', result);
        
        // Parse transaction digest from result
        const digestMatch = result.match(/Transaction Digest: ([A-Za-z0-9]+)/);
        if (digestMatch) {
            const digest = digestMatch[1];
            console.log(`🔗 Transaction: https://suiscan.xyz/${CONFIG.NETWORK}/tx/${digest}`);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Command failed:', error.message);
        console.error('🔍 Error details:', error.stderr?.toString() || 'No additional details');
        return false;
    }
}

function generateManualInstructions() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 MANUAL EXECUTION INSTRUCTIONS');
    console.log('='.repeat(80));
    
    console.log('\n1️⃣ Via Sui CLI:');
    console.log('-'.repeat(40));
    const command = buildAdminUnencumberCommand();
    console.log(command);
    
    console.log('\n2️⃣ Via Sui Console/UI:');
    console.log('-'.repeat(40));
    console.log(buildMoveCallForConsole());
    
    console.log('\n3️⃣ Parameters Breakdown:');
    console.log('-'.repeat(40));
    console.log(`Package ID: ${CONFIG.NEW_PACKAGE_ID}`);
    console.log(`Module: integration`);
    console.log(`Function: admin_batch_unencumber_old_stakes`);
    console.log(`Old Admin Cap: ${CONFIG.OLD_ADMIN_CAP_ID}`);
    console.log(`Old Package: ${CONFIG.OLD_PACKAGE_ID}`);
    console.log(`Stakes to unencumber: ${CONFIG.STAKE_IDS.length}`);
    console.log(`Network: ${CONFIG.NETWORK}`);
    
    console.log('\n📝 Stake IDs:');
    CONFIG.STAKE_IDS.forEach((id, index) => {
        console.log(`   ${index + 1}. ${id}`);
    });
}

function main() {
    console.log('🚀 Admin Batch Unencumber Stakes Script');
    console.log('='.repeat(50));
    
    try {
        // Validate configuration
        validateConfig();
        
        console.log(`\n📊 Summary:`);
        console.log(`   Stakes to unencumber: ${CONFIG.STAKE_IDS.length}`);
        console.log(`   Old Package: ${CONFIG.OLD_PACKAGE_ID}`);
        console.log(`   New Package: ${CONFIG.NEW_PACKAGE_ID}`);
        console.log(`   Network: ${CONFIG.NETWORK}`);
        
        // Generate manual instructions
        generateManualInstructions();
        
        // Ask for confirmation before executing
        console.log('\n⚠️  WARNING: This will unencumber all stakes in the old package!');
        console.log('💡 Review the configuration above before proceeding.');
        
        // Uncomment the line below to actually execute the command
        // executeAdminUnencumber();
        
        console.log('\n✅ Script completed. Uncomment executeAdminUnencumber() to run the actual command.');
        
    } catch (error) {
        console.error('💥 Script failed:', error.message);
        process.exit(1);
    }
}

// Export for testing
module.exports = {
    CONFIG,
    validateConfig,
    buildAdminUnencumberCommand,
    executeAdminUnencumber
};

// Run if called directly
if (require.main === module) {
    main();
} 
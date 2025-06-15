import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const PACKAGE_ID = "0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec";
const ADMIN_CAP_ID = "0x4d1b5bebf54ff564bcedc93e66a53461bb821f3de9b6c1dd473866bca72155d8";
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";

// Test with just the first stake
const testStakeIds = [
    "0x31b73dc192dacfe80ce7929eb34b40f1d3a038ff8a05b18c72e3d5b1249f430e"
];

async function testSingleBatch() {
    console.log('🧪 TESTING SINGLE BATCH UNLOCK');
    console.log('═══════════════════════════════');
    console.log(`📦 Package: ${PACKAGE_ID}`);
    console.log(`🔑 Admin Cap: ${ADMIN_CAP_ID}`);
    console.log(`📋 Test Stakes: ${testStakeIds.length}`);
    console.log('');

    // Format stake IDs for command - using proper JSON array format
    const stakeIdsFormatted = JSON.stringify(testStakeIds);
    
    // Build the command
    const command = `sui client call --package ${PACKAGE_ID} --module integration --function admin_batch_unencumber_old_stakes --args ${ADMIN_CAP_ID} ${OLD_PACKAGE_ID} '${stakeIdsFormatted}' 0x6 --gas-budget 50000000`;
    
    console.log('📝 Command:');
    console.log(command);
    console.log('');
    
    try {
        console.log('⏳ Executing...');
        const { stdout, stderr } = await execAsync(command);
        
        console.log('✅ SUCCESS!');
        console.log('📊 Output:', stdout);
        if (stderr) {
            console.log('📋 Details:', stderr);
        }
        
    } catch (error) {
        console.log('❌ ERROR:', error.message);
        if (error.stderr) {
            console.log('📋 Error Details:', error.stderr);
        }
    }
}

testSingleBatch(); 
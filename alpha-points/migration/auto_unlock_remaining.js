import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const PACKAGE_ID = "0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec";
const ADMIN_CAP_ID = "0x4d1b5bebf54ff564bcedc93e66a53461bb821f3de9b6c1dd473866bca72155d8";
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const TYPE_ARG = "0xfd761a2a5979db53f7f3176c0778695f6abafbb7c0eec8ce03136ae10dc2b47d::admin::AdminCap";
const BATCH_SIZE = 15;
const GAS_BUDGET = 10000000;

// Progress tracking
let PROCESSED_STAKES = 70; // Already processed 70 stakes
let TOTAL_STAKES = 574;

async function processRemainingStakes() {
    console.log('🚀 AUTOMATED UNLOCK PROCESSING');
    console.log('═════════════════════════════════');
    console.log(`📊 Starting from stake ${PROCESSED_STAKES + 1}`);
    console.log(`📊 Remaining stakes: ${TOTAL_STAKES - PROCESSED_STAKES}`);
    console.log('');

    try {
        // Read all stake IDs
        const stakeIdsText = fs.readFileSync('extracted_stake_ids.txt', 'utf8');
        const allStakeIds = stakeIdsText.trim().split('\n');
        
        console.log(`✅ Loaded ${allStakeIds.length} total stake IDs`);
        
        // Process remaining stakes in batches
        const remainingStakes = allStakeIds.slice(PROCESSED_STAKES);
        const batches = [];
        
        for (let i = 0; i < remainingStakes.length; i += BATCH_SIZE) {
            batches.push(remainingStakes.slice(i, i + BATCH_SIZE));
        }
        
        console.log(`📦 Created ${batches.length} batches to process`);
        console.log('');
        
        // Process each batch
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            const startStake = PROCESSED_STAKES + (batchIndex * BATCH_SIZE) + 1;
            const endStake = startStake + batch.length - 1;
            
            console.log(`🔄 BATCH ${batchIndex + 5}/38 - Stakes ${startStake}-${endStake} (${batch.length} stakes)`);
            
            // Format stake IDs for command
            const stakeIdsFormatted = `[${batch.join(',')}]`;
            
            // Build the command
            const command = `sui client call ` +
                `--package ${PACKAGE_ID} ` +
                `--module integration ` +
                `--function admin_batch_unencumber_old_stakes ` +
                `--type-args ${TYPE_ARG} ` +
                `--args ${ADMIN_CAP_ID} ${OLD_PACKAGE_ID} ${stakeIdsFormatted} 0x6 ` +
                `--gas-budget ${GAS_BUDGET}`;
            
            try {
                console.log(`⏳ Executing batch ${batchIndex + 5}...`);
                const { stdout, stderr } = await execAsync(command);
                
                if (stderr && stderr.includes('Status: Success')) {
                    const stakesMatch = stdout.match(/stakes_unencumbered.*?(\d+)/);
                    const stakesProcessed = stakesMatch ? parseInt(stakesMatch[1]) : batch.length;
                    
                    console.log(`✅ Batch ${batchIndex + 5} SUCCESS - ${stakesProcessed} stakes unlocked`);
                    PROCESSED_STAKES += stakesProcessed;
                } else if (stderr) {
                    console.log(`❌ Batch ${batchIndex + 5} FAILED:`, stderr.substring(0, 200));
                    break;
                } else {
                    console.log(`✅ Batch ${batchIndex + 5} SUCCESS - ${batch.length} stakes unlocked`);
                    PROCESSED_STAKES += batch.length;
                }
                
                // Progress update
                const remaining = TOTAL_STAKES - PROCESSED_STAKES;
                const percentComplete = ((PROCESSED_STAKES / TOTAL_STAKES) * 100).toFixed(1);
                console.log(`📊 Progress: ${PROCESSED_STAKES}/${TOTAL_STAKES} (${percentComplete}%) - ${remaining} remaining`);
                console.log('');
                
                // Short delay between batches
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`❌ Batch ${batchIndex + 5} ERROR:`, error.message.substring(0, 200));
                break;
            }
        }
        
        console.log('🎉 AUTOMATED PROCESSING COMPLETE!');
        console.log(`📊 Final Status: ${PROCESSED_STAKES}/${TOTAL_STAKES} stakes processed`);
        
    } catch (error) {
        console.error('❌ Automation Error:', error);
    }
}

processRemainingStakes(); 
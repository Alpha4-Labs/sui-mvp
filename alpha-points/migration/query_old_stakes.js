const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');

// Configuration
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf"; // Replace with your old package ID
const NETWORK = 'testnet'; // or 'mainnet'
const OLD_LEDGER_PACKAGE_ID= '0xc6e43029177ccc41afe2c4836fae1843492e8477cd95f7d2465e27d7722bc31d';
const

async function queryOldPackageStakes() {
    const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
    
    console.log(`🔍 Querying old package ${OLD_PACKAGE_ID} for locked stakes...`);
    
    try {
        // Query for StakePosition objects from the old package using multiGetObjects
        // First, let's try to find objects by querying events, then get the objects
        console.log('🔍 First trying to find stakes via events...');
        
        // Query for the actual events that exist in the old package (found via debug)
        const possibleEventTypes = [
            `${OLD_PACKAGE_ID}::integration::StakeDeposited<0x3::staking_pool::StakedSui>`,
            `${OLD_PACKAGE_ID}::stake_position::StakeCreated<0x3::staking_pool::StakedSui>`,
            `${OLD_PACKAGE_ID}::staking_manager::NativeStakeStored`
        ];
        
        let allStakeEvents = [];
        
        for (const eventType of possibleEventTypes) {
            try {
                const events = await client.queryEvents({
                    query: { MoveEventType: eventType },
                    order: 'ascending',
                    limit: 1000
                });
                
                if (events.data.length > 0) {
                    console.log(`📡 Found ${events.data.length} events of type: ${eventType.split('::').pop()}`);
                    allStakeEvents.push(...events.data);
                }
            } catch (error) {
                console.log(`⚠️ Error querying ${eventType}: ${error.message}`);
            }
        }
        
        console.log(`📊 Total events found: ${allStakeEvents.length}`);
        
        // Extract stake IDs from events
        const stakeIdsFromEvents = [];
        for (const event of allStakeEvents) {
            const eventData = event.parsedJson;
            console.log(`\n🔍 Processing event: ${event.type.split('::').pop()}`);
            console.log(`   Event data:`, JSON.stringify(eventData, null, 2));
            
            // Try different field names for stake IDs
            const stakeId = eventData?.stake_position_id || 
                           eventData?.stake_id || 
                           eventData?.position_id ||
                           eventData?.object_id ||
                           eventData?.id;
                           
            if (stakeId) {
                stakeIdsFromEvents.push(stakeId);
                console.log(`   ✅ Found stake ID: ${stakeId}`);
            } else {
                console.log(`   ⚠️ No stake ID found in event data`);
            }
        }
        
        console.log(`📋 Found ${stakeIdsFromEvents.length} stake IDs from events`);
        
        // Now query the actual objects in batches
        const response = { data: [] };
        const batchSize = 50; // Sui has limits on batch queries
        
        for (let i = 0; i < stakeIdsFromEvents.length; i += batchSize) {
            const batch = stakeIdsFromEvents.slice(i, i + batchSize);
            try {
                const batchResponse = await client.multiGetObjects({
                    ids: batch,
                    options: {
                        showContent: true,
                        showType: true,
                        showOwner: true,
                        showPreviousTransaction: true
                    }
                });
                
                // Filter out null responses and add to main response
                const validObjects = batchResponse.filter(obj => obj.data !== null);
                response.data.push(...validObjects);
                
            } catch (batchError) {
                console.warn(`⚠️ Batch ${i}-${i + batchSize} failed:`, batchError.message);
            }
        }

        console.log(`📊 Found ${response.data.length} stake objects`);
        
        const lockedStakes = [];
        const allStakeIds = [];
        
        for (const stake of response.data) {
            const stakeId = stake.data.objectId;
            const owner = stake.data.owner;
            const content = stake.data.content;
            
            allStakeIds.push(stakeId);
            
            // Check if stake is encumbered/locked
            if (content?.fields) {
                const fields = content.fields;
                const isEncumbered = fields.encumbered || fields.is_encumbered || false;
                const principal = fields.principal || fields.principal_mist || '0';
                const duration = fields.duration_days || fields.duration || '0';
                const startTime = fields.start_time_ms || fields.start_time || '0';
                
                console.log(`\n📍 Stake ID: ${stakeId}`);
                console.log(`   Owner: ${typeof owner === 'object' ? owner.AddressOwner : owner}`);
                console.log(`   Principal: ${principal} MIST (${(parseInt(principal) / 1_000_000_000).toFixed(2)} SUI)`);
                console.log(`   Duration: ${duration} days`);
                console.log(`   Encumbered: ${isEncumbered}`);
                
                if (isEncumbered) {
                    lockedStakes.push({
                        id: stakeId,
                        owner: typeof owner === 'object' ? owner.AddressOwner : owner,
                        principal,
                        duration,
                        startTime
                    });
                }
            }
        }
        
        console.log(`\n🔒 Found ${lockedStakes.length} locked/encumbered stakes`);
        console.log(`📋 Total stakes found: ${allStakeIds.length}`);
        
        // Output stake IDs for the admin function
        console.log(`\n📝 Stake IDs for admin batch unencumber:`);
        console.log(JSON.stringify(allStakeIds, null, 2));
        
        // Output locked stakes summary
        if (lockedStakes.length > 0) {
            console.log(`\n🔒 Locked Stakes Summary:`);
            let totalLockedSUI = 0;
            for (const stake of lockedStakes) {
                const suiAmount = parseInt(stake.principal) / 1_000_000_000;
                totalLockedSUI += suiAmount;
                console.log(`   ${stake.id}: ${suiAmount.toFixed(2)} SUI (Owner: ${stake.owner})`);
            }
            console.log(`   Total Locked: ${totalLockedSUI.toFixed(2)} SUI`);
        }
        
        return {
            allStakeIds,
            lockedStakes,
            totalStakes: allStakeIds.length,
            totalLocked: lockedStakes.length
        };
        
    } catch (error) {
        console.error('❌ Error querying old package stakes:', error);
        throw error;
    }
}

// Alternative query method using events
async function queryStakeEventsFromOldPackage() {
    const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
    
    console.log(`🔍 Querying stake creation events from old package...`);
    
    try {
        // Query for the actual events that exist in the old package (found via debug)
        const possibleEventTypes = [
            `${OLD_PACKAGE_ID}::integration::StakeDeposited<0x3::staking_pool::StakedSui>`,
            `${OLD_PACKAGE_ID}::stake_position::StakeCreated<0x3::staking_pool::StakedSui>`,
            `${OLD_PACKAGE_ID}::staking_manager::NativeStakeStored`
        ];
        
        const stakeIds = [];
        
        for (const eventType of possibleEventTypes) {
            try {
                const events = await client.queryEvents({
                    query: { MoveEventType: eventType },
                    order: 'ascending',
                    limit: 1000
                });
                
                console.log(`📊 Found ${events.data.length} events of type: ${eventType.split('::').pop()}`);
                
                for (const event of events.data) {
                    const eventData = event.parsedJson;
                    
                    // Try different field names for stake IDs
                    const stakeId = eventData?.stake_position_id || 
                                   eventData?.stake_id || 
                                   eventData?.position_id ||
                                   eventData?.object_id ||
                                   eventData?.id;
                                   
                    if (stakeId) {
                        stakeIds.push(stakeId);
                        console.log(`📍 Event Stake ID: ${stakeId}`);
                        console.log(`   Owner: ${eventData.owner || eventData.staker || eventData.user || 'Unknown'}`);
                        console.log(`   Principal: ${eventData.principal || eventData.principal_mist || eventData.amount || '0'} MIST`);
                    }
                }
            } catch (error) {
                console.log(`⚠️ Error querying ${eventType}: ${error.message}`);
            }
        }
        
        return stakeIds;
        
    } catch (error) {
        console.error('❌ Error querying stake events:', error);
        return [];
    }
}

// Main execution
async function main() {
    try {
        console.log('🚀 Starting old package stake query...\n');
        
        // Method 1: Query stake objects directly
        const objectResults = await queryOldPackageStakes();
        
        // Method 2: Query through events (backup method)
        console.log('\n' + '='.repeat(60));
        console.log('📡 Trying alternative method via events...\n');
        const eventStakeIds = await queryStakeEventsFromOldPackage();
        
        console.log('\n' + '='.repeat(60));
        console.log('📋 SUMMARY');
        console.log('='.repeat(60));
        console.log(`Stakes found via objects: ${objectResults.totalStakes}`);
        console.log(`Stakes found via events: ${eventStakeIds.length}`);
        console.log(`Locked stakes: ${objectResults.totalLocked}`);
        
        // Combine and deduplicate stake IDs
        const allUniqueStakeIds = [...new Set([...objectResults.allStakeIds, ...eventStakeIds])];
        
        console.log('\n🎯 FINAL STAKE IDS FOR ADMIN FUNCTION:');
        console.log('='.repeat(60));
        console.log(JSON.stringify(allUniqueStakeIds, null, 2));
        
        console.log(`\n✅ Total unique stakes to unencumber: ${allUniqueStakeIds.length}`);
        
    } catch (error) {
        console.error('💥 Script failed:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { queryOldPackageStakes, queryStakeEventsFromOldPackage }; 
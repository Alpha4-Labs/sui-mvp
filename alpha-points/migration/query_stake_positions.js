import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// Configuration
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const NETWORK = 'testnet';
const MIST_PER_SUI = 1_000_000_000;

async function queryStakePositions() {
    const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
    
    console.log('🔍 Detailed StakePosition Query');
    console.log('═══════════════════════════════');
    console.log(`📦 Package ID: ${OLD_PACKAGE_ID}`);
    console.log('');

    let allStakes = [];
    let allTxDigests = new Set();

    try {
        // 1. Get all NativeStakeStored events to find transaction digests
        console.log('1️⃣ Getting NativeStakeStored Events...');
        console.log('────────────────────────────────────');
        
        const nativeStakeEvents = await client.queryEvents({
            query: {
                MoveEventType: `${OLD_PACKAGE_ID}::staking_manager::NativeStakeStored`
            },
            limit: 200, // Increase limit to get more events
            order: 'ascending'
        });

        console.log(`Found ${nativeStakeEvents.data.length} NativeStakeStored events`);
        
        for (const event of nativeStakeEvents.data) {
            allTxDigests.add(event.id.txDigest);
        }

        console.log(`Found ${allTxDigests.size} unique transaction digests`);
        console.log('');

        // 2. For each transaction, get the transaction details to find created objects
        console.log('2️⃣ Analyzing Transactions for StakePosition Objects...');
        console.log('──────────────────────────────────────────────────────');
        
        let processedCount = 0;
        for (const txDigest of allTxDigests) {
            if (processedCount >= 10) { // Limit to first 10 transactions for demo
                console.log(`... limiting to first 10 transactions for demonstration`);
                break;
            }
            
            try {
                const txBlock = await client.getTransactionBlock({
                    digest: txDigest,
                    options: {
                        showEvents: true,
                        showEffects: true,
                        showInput: true,
                        showObjectChanges: true
                    }
                });

                console.log(`📝 TX: ${txDigest}`);
                
                // Look for created objects that are StakePosition types
                if (txBlock.objectChanges) {
                    for (const change of txBlock.objectChanges) {
                        if (change.type === 'created') {
                            const objType = change.objectType;
                            
                            // Check if this is a StakePosition object
                            if (objType && objType.includes('stake_position::StakePosition')) {
                                console.log(`   🎯 Found StakePosition: ${change.objectId}`);
                                console.log(`      Type: ${objType}`);
                                console.log(`      Owner: ${JSON.stringify(change.owner)}`);
                                
                                // Try to get the object details
                                try {
                                    const stakeObj = await client.getObject({
                                        id: change.objectId,
                                        options: {
                                            showContent: true,
                                            showOwner: true,
                                            showType: true
                                        }
                                    });
                                    
                                    if (stakeObj.data?.content?.fields) {
                                        const fields = stakeObj.data.content.fields;
                                        const stake = {
                                            objectId: change.objectId,
                                            owner: fields.owner,
                                            amount: parseInt(fields.amount),
                                            startTime: parseInt(fields.start_time_ms),
                                            unlockTime: parseInt(fields.unlock_time_ms),
                                            encumbered: fields.encumbered,
                                            stakedSuiId: fields.staked_sui_id,
                                            txDigest: txDigest,
                                            source: 'StakePosition Object from TX'
                                        };
                                        
                                        allStakes.push(stake);
                                        
                                        console.log(`      💰 Amount: ${(stake.amount / MIST_PER_SUI).toFixed(4)} SUI`);
                                        console.log(`      📅 Duration: ${Math.round((stake.unlockTime - stake.startTime) / (24 * 60 * 60 * 1000))} days`);
                                        console.log(`      🔒 Encumbered: ${stake.encumbered}`);
                                        console.log(`      🆔 Native Stake ID: ${stake.stakedSuiId}`);
                                    }
                                } catch (objError) {
                                    console.log(`      ❌ Error getting object details: ${objError.message}`);
                                }
                            }
                        }
                    }
                }

                // Also check events for StakeCreated
                if (txBlock.events) {
                    for (const event of txBlock.events) {
                        if (event.type.includes('stake_position::StakeCreated')) {
                            console.log(`   📢 StakeCreated Event:`);
                            console.log(`      ${JSON.stringify(event.parsedJson, null, 6)}`);
                        }
                    }
                }
                
                processedCount++;
                console.log('');
                
            } catch (txError) {
                console.log(`❌ Error getting transaction ${txDigest}: ${txError.message}`);
            }
        }

        // 3. Try alternative approach: scan for objects by type
        console.log('3️⃣ Alternative Approach: Direct Object Scan...');
        console.log('──────────────────────────────────────────────');
        
        try {
            // Try different variations of the StakePosition type
            const stakePositionTypes = [
                `${OLD_PACKAGE_ID}::stake_position::StakePosition<0x3::staking_pool::StakedSui>`,
                `${OLD_PACKAGE_ID}::stake_position::StakePosition<0x2::staking_pool::StakedSui>`,
                `${OLD_PACKAGE_ID}::stake_position::StakePosition`
            ];
            
            for (const stakeType of stakePositionTypes) {
                try {
                    console.log(`Trying type: ${stakeType}`);
                    
                    // Since getOwnedObjects doesn't work, try multiGetObjects with specific IDs
                    // We can try the object IDs we found from transactions
                    if (allStakes.length > 0) {
                        const objectIds = allStakes.map(stake => stake.objectId);
                        const objects = await client.multiGetObjects({
                            ids: objectIds,
                            options: {
                                showContent: true,
                                showOwner: true,
                                showType: true
                            }
                        });
                        
                        console.log(`Retrieved ${objects.length} objects via multiGet`);
                        
                        for (const obj of objects) {
                            if (obj.data?.content?.fields) {
                                console.log(`✅ Object ${obj.data.objectId} is accessible`);
                                console.log(`   Type: ${obj.data.content.type}`);
                                console.log(`   Owner: ${JSON.stringify(obj.data.owner)}`);
                            }
                        }
                    }
                    
                } catch (typeError) {
                    console.log(`❌ Error with type ${stakeType}: ${typeError.message}`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Error in alternative approach: ${error.message}`);
        }

        // Summary
        console.log('📊 STAKE POSITIONS SUMMARY');
        console.log('═══════════════════════════');
        console.log(`Stakes Found: ${allStakes.length}`);
        
        if (allStakes.length > 0) {
            let totalValue = 0;
            console.log('');
            console.log('📋 DETAILED STAKE LIST:');
            console.log('─────────────────────');
            
            allStakes.forEach((stake, index) => {
                totalValue += stake.amount;
                console.log(`${index + 1}. Stake ID: ${stake.objectId}`);
                console.log(`   Owner: ${stake.owner}`);
                console.log(`   Amount: ${(stake.amount / MIST_PER_SUI).toFixed(4)} SUI (${stake.amount} MIST)`);
                console.log(`   Duration: ${Math.round((stake.unlockTime - stake.startTime) / (24 * 60 * 60 * 1000))} days`);
                console.log(`   Encumbered: ${stake.encumbered}`);
                console.log(`   Native Stake ID: ${stake.stakedSuiId}`);
                console.log(`   TX: ${stake.txDigest}`);
                console.log('');
            });
            
            console.log(`Total Value: ${(totalValue / MIST_PER_SUI).toFixed(4)} SUI (${totalValue} MIST)`);
            console.log('');

            // Generate migration commands
            console.log('🔧 MIGRATION COMMANDS:');
            console.log('──────────────────────');
            
            console.log('// Individual migration commands:');
            allStakes.forEach((stake, index) => {
                console.log(`// Stake ${index + 1}:`);
                console.log(`await migrate_single_stake({`);
                console.log(`  stake_id: "${stake.objectId}",`);
                console.log(`  owner: "${stake.owner}",`);
                console.log(`  principal_mist: ${stake.amount},`);
                console.log(`  duration_days: ${Math.round((stake.unlockTime - stake.startTime) / (24 * 60 * 60 * 1000))},`);
                console.log(`  start_time_ms: ${stake.startTime},`);
                console.log(`  encumbered: ${stake.encumbered}`);
                console.log(`});`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('❌ Fatal error during query:', error);
        process.exit(1);
    }
}

// Run the query
queryStakePositions()
    .then(() => {
        console.log('✅ StakePosition query completed successfully');
    })
    .catch((error) => {
        console.error('❌ Query failed:', error);
        process.exit(1);
    }); 
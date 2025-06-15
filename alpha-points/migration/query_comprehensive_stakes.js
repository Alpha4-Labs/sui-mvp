import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// Configuration
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const OLD_LEDGER_OBJECT_ID = "0xc6e43029177ccc41afe2c4836fae1843492e8477cd95f7d2465e27d7722bc31d";
const OLD_STAKING_MANAGER_ID = "0xa16cefcddf869a44b74a859b2f77b0d00d48cf0cb57b804802a750e8283dbee2";
const NETWORK = 'testnet';

const MIST_PER_SUI = 1_000_000_000;

async function queryComprehensiveStakes() {
    const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
    
    console.log('🔍 Comprehensive Old Package Stakes Query');
    console.log('═══════════════════════════════════════');
    console.log(`📦 Package ID: ${OLD_PACKAGE_ID}`);
    console.log(`💰 Ledger ID: ${OLD_LEDGER_OBJECT_ID}`);
    console.log(`🏦 Staking Manager ID: ${OLD_STAKING_MANAGER_ID}`);
    console.log('');

    let allStakes = [];
    let totalValue = 0;

    try {
        // 1. Query StakePosition objects owned by users
        console.log('1️⃣ Querying StakePosition Objects...');
        console.log('────────────────────────────────────');
        
        const stakePositionType = `${OLD_PACKAGE_ID}::stake_position::StakePosition<0x2::staking_pool::StakedSui>`;
        
        try {
            const stakePositions = await client.getOwnedObjects({
                filter: {
                    StructType: stakePositionType
                },
                options: {
                    showContent: true,
                    showDisplay: true,
                    showOwner: true,
                    showType: true
                }
            });

            console.log(`Found ${stakePositions.data.length} StakePosition objects`);
            
            for (const stakeObj of stakePositions.data) {
                if (stakeObj.data?.content?.fields) {
                    const fields = stakeObj.data.content.fields;
                    const stake = {
                        objectId: stakeObj.data.objectId,
                        owner: fields.owner,
                        amount: parseInt(fields.amount),
                        startTime: parseInt(fields.start_time_ms),
                        unlockTime: parseInt(fields.unlock_time_ms),
                        encumbered: fields.encumbered,
                        stakedSuiId: fields.staked_sui_id,
                        source: 'StakePosition Object'
                    };
                    
                    allStakes.push(stake);
                    totalValue += stake.amount;
                    
                    console.log(`📍 Stake ID: ${stake.objectId}`);
                    console.log(`   Owner: ${stake.owner}`);
                    console.log(`   Amount: ${(stake.amount / MIST_PER_SUI).toFixed(4)} SUI (${stake.amount} MIST)`);
                    console.log(`   Duration: ${Math.round((stake.unlockTime - stake.startTime) / (24 * 60 * 60 * 1000))} days`);
                    console.log(`   Encumbered: ${stake.encumbered}`);
                    console.log('');
                }
            }
        } catch (error) {
            console.log('❌ Error querying StakePosition objects:', error.message);
        }

        // 2. Query StakeCreated events
        console.log('2️⃣ Querying StakeCreated Events...');
        console.log('───────────────────────────────────');
        
        try {
            const stakeCreatedEvents = await client.queryEvents({
                query: {
                    MoveEventType: `${OLD_PACKAGE_ID}::stake_position::StakeCreated<0x2::staking_pool::StakedSui>`
                },
                limit: 50,
                order: 'ascending'
            });

            console.log(`Found ${stakeCreatedEvents.data.length} StakeCreated events`);
            
            for (const event of stakeCreatedEvents.data) {
                if (event.parsedJson) {
                    const eventData = event.parsedJson;
                    const stake = {
                        stakeId: eventData.stake_id,
                        owner: eventData.owner,
                        amount: parseInt(eventData.amount),
                        durationDays: parseInt(eventData.duration_days),
                        unlockTime: parseInt(eventData.unlock_time_ms),
                        assetType: eventData.asset_type,
                        txDigest: event.id.txDigest,
                        source: 'StakeCreated Event'
                    };
                    
                    // Check if we already have this stake
                    const existing = allStakes.find(s => s.objectId === stake.stakeId || s.stakeId === stake.stakeId);
                    if (!existing) {
                        allStakes.push(stake);
                        totalValue += stake.amount;
                    }
                    
                    console.log(`🆕 Event - Stake ID: ${stake.stakeId}`);
                    console.log(`   Owner: ${stake.owner}`);
                    console.log(`   Amount: ${(stake.amount / MIST_PER_SUI).toFixed(4)} SUI`);
                    console.log(`   Duration: ${stake.durationDays} days`);
                    console.log(`   TX: ${stake.txDigest}`);
                    console.log('');
                }
            }
        } catch (error) {
            console.log('❌ Error querying StakeCreated events:', error.message);
        }

        // 3. Query StakeDeposited events from integration module
        console.log('3️⃣ Querying StakeDeposited Events...');
        console.log('────────────────────────────────────');
        
        try {
            const stakeDepositedEvents = await client.queryEvents({
                query: {
                    MoveEventType: `${OLD_PACKAGE_ID}::integration::StakeDeposited<0x2::staking_pool::StakedSui>`
                },
                limit: 50,
                order: 'ascending'
            });

            console.log(`Found ${stakeDepositedEvents.data.length} StakeDeposited events`);
            
            for (const event of stakeDepositedEvents.data) {
                if (event.parsedJson) {
                    const eventData = event.parsedJson;
                    console.log(`💰 Deposit - Staker: ${eventData.staker}`);
                    console.log(`   Amount: ${(parseInt(eventData.amount_staked) / MIST_PER_SUI).toFixed(4)} SUI`);
                    console.log(`   Duration: ${eventData.duration_days} days`);
                    console.log(`   Native Stake ID: ${eventData.native_stake_id}`);
                    console.log(`   TX: ${event.id.txDigest}`);
                    console.log('');
                }
            }
        } catch (error) {
            console.log('❌ Error querying StakeDeposited events:', error.message);
        }

        // 4. Query NativeStakeStored events from staking_manager
        console.log('4️⃣ Querying NativeStakeStored Events...');
        console.log('──────────────────────────────────────');
        
        try {
            const nativeStakeEvents = await client.queryEvents({
                query: {
                    MoveEventType: `${OLD_PACKAGE_ID}::staking_manager::NativeStakeStored`
                },
                limit: 50,
                order: 'ascending'
            });

            console.log(`Found ${nativeStakeEvents.data.length} NativeStakeStored events`);
            
            for (const event of nativeStakeEvents.data) {
                if (event.parsedJson) {
                    const eventData = event.parsedJson;
                    console.log(`🏦 Native Stake - ID: ${eventData.stake_id}`);
                    console.log(`   Amount: ${(parseInt(eventData.amount) / MIST_PER_SUI).toFixed(4)} SUI`);
                    console.log(`   Manager ID: ${eventData.manager_id}`);
                    console.log(`   TX: ${event.id.txDigest}`);
                    console.log('');
                }
            }
        } catch (error) {
            console.log('❌ Error querying NativeStakeStored events:', error.message);
        }

        // 5. Try to query objects in the staking manager
        console.log('5️⃣ Querying Staking Manager State...');
        console.log('───────────────────────────────────');
        
        try {
            const stakingManager = await client.getObject({
                id: OLD_STAKING_MANAGER_ID,
                options: {
                    showContent: true,
                    showType: true
                }
            });
            
            if (stakingManager.data?.content?.fields) {
                console.log('🏦 Staking Manager found with content');
                console.log(`   Type: ${stakingManager.data.content.type}`);
                
                // Try to access native_stakes table if available
                const fields = stakingManager.data.content.fields;
                if (fields.native_stakes) {
                    console.log(`   Native stakes table: ${JSON.stringify(fields.native_stakes, null, 2)}`);
                }
            }
        } catch (error) {
            console.log('❌ Error querying Staking Manager:', error.message);
        }

        // Summary
        console.log('📊 COMPREHENSIVE SUMMARY');
        console.log('════════════════════════');
        console.log(`Total Stakes Found: ${allStakes.length}`);
        console.log(`Total Value: ${(totalValue / MIST_PER_SUI).toFixed(4)} SUI (${totalValue} MIST)`);
        console.log('');

        if (allStakes.length > 0) {
            console.log('📋 DETAILED STAKE LIST:');
            console.log('─────────────────────');
            
            allStakes.forEach((stake, index) => {
                console.log(`${index + 1}. ${stake.source}`);
                console.log(`   ID: ${stake.objectId || stake.stakeId}`);
                console.log(`   Owner: ${stake.owner}`);
                console.log(`   Amount: ${(stake.amount / MIST_PER_SUI).toFixed(4)} SUI`);
                if (stake.durationDays) {
                    console.log(`   Duration: ${stake.durationDays} days`);
                }
                if (stake.encumbered !== undefined) {
                    console.log(`   Encumbered: ${stake.encumbered}`);
                }
                console.log('');
            });

            // Generate migration data
            console.log('🔧 MIGRATION DATA:');
            console.log('──────────────────');
            
            const migrationData = {
                old_package_id: OLD_PACKAGE_ID,
                stakes: allStakes.map(stake => ({
                    stake_id: stake.objectId || stake.stakeId,
                    owner: stake.owner,
                    principal_mist: stake.amount,
                    duration_days: stake.durationDays || Math.round((stake.unlockTime - stake.startTime) / (24 * 60 * 60 * 1000)),
                    start_time_ms: stake.startTime || 0,
                    encumbered: stake.encumbered || false
                }))
            };
            
            console.log(JSON.stringify(migrationData, null, 2));
        }

    } catch (error) {
        console.error('❌ Fatal error during query:', error);
        process.exit(1);
    }
}

// Run the query
queryComprehensiveStakes()
    .then(() => {
        console.log('✅ Comprehensive query completed successfully');
    })
    .catch((error) => {
        console.error('❌ Query failed:', error);
        process.exit(1);
    }); 
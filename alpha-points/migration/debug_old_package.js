const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');

// Configuration
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const NETWORK = 'testnet';

async function debugOldPackage() {
    const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
    
    console.log(`🔍 Debugging old package ${OLD_PACKAGE_ID}...`);
    
    try {
        // 1. Check if the package object exists
        console.log('\n📦 1. Checking package object...');
        try {
            const packageObj = await client.getObject({
                id: OLD_PACKAGE_ID,
                options: { showContent: true }
            });
            
            if (packageObj.data) {
                console.log('✅ Package object exists');
                console.log(`   Version: ${packageObj.data.version}`);
                console.log(`   Type: ${packageObj.data.type}`);
            } else {
                console.log('❌ Package object not found');
            }
        } catch (error) {
            console.log('❌ Error fetching package:', error.message);
        }

        // 2. Query ALL events from this package to see what event types exist
        console.log('\n🔍 2. Querying ALL events from package...');
        try {
            // Use MoveModule query instead
            const allEvents = await client.queryEvents({
                query: { MoveModule: { package: OLD_PACKAGE_ID, module: 'integration' } },
                order: 'descending',
                limit: 100
            });
            
            console.log(`📊 Found ${allEvents.data.length} events from package`);
            
            // Group events by type
            const eventTypes = {};
            for (const event of allEvents.data) {
                const eventType = event.type;
                if (!eventTypes[eventType]) {
                    eventTypes[eventType] = 0;
                }
                eventTypes[eventType]++;
            }
            
            console.log('\n📋 Event types found:');
            for (const [type, count] of Object.entries(eventTypes)) {
                console.log(`   ${type}: ${count} events`);
            }
            
            // Show first few events as examples
            if (allEvents.data.length > 0) {
                console.log('\n📝 Sample events:');
                for (let i = 0; i < Math.min(5, allEvents.data.length); i++) {
                    const event = allEvents.data[i];
                    console.log(`\n   Event ${i + 1}:`);
                    console.log(`     Type: ${event.type}`);
                    console.log(`     Digest: ${event.id.txDigest}`);
                    console.log(`     Data:`, JSON.stringify(event.parsedJson, null, 6));
                    
                    // Extract potential stake IDs
                    const eventData = event.parsedJson;
                    const possibleIds = [
                        eventData?.stake_position_id,
                        eventData?.stake_id,
                        eventData?.position_id,
                        eventData?.object_id,
                        eventData?.id
                    ].filter(id => id);
                    
                    if (possibleIds.length > 0) {
                        console.log(`     🎯 Possible stake IDs:`, possibleIds);
                    }
                }
            }
            
        } catch (error) {
            console.log('❌ Error querying package events:', error.message);
        }

        // 3. Try different possible event names for stakes
        const possibleStakeEvents = [
            'StakeCreated',
            'StakePositionCreated', 
            'StakeDeposited',
            'NewStake',
            'Staked',
            'PositionCreated'
        ];
        
        console.log('\n🎯 3. Trying different stake event names...');
        for (const eventName of possibleStakeEvents) {
            try {
                const events = await client.queryEvents({
                    query: {
                        MoveEventType: `${OLD_PACKAGE_ID}::integration::${eventName}`
                    },
                    order: 'descending',
                    limit: 10
                });
                
                if (events.data.length > 0) {
                    console.log(`✅ Found ${events.data.length} events for ${eventName}`);
                    console.log(`   Sample event data:`, JSON.stringify(events.data[0].parsedJson, null, 4));
                } else {
                    console.log(`   ${eventName}: 0 events`);
                }
            } catch (error) {
                console.log(`   ${eventName}: Error - ${error.message}`);
            }
        }

        // 4. Try different modules (not just integration)
        const possibleModules = [
            'integration',
            'staking',
            'stake_manager',
            'ledger',
            'main'
        ];
        
        console.log('\n🏗️ 4. Checking different modules...');
        for (const module of possibleModules) {
            try {
                const events = await client.queryEvents({
                    query: { MoveModule: { package: OLD_PACKAGE_ID, module } },
                    order: 'descending',
                    limit: 5
                });
                
                if (events.data.length > 0) {
                    console.log(`✅ Module ${module}: ${events.data.length} events`);
                    const eventTypes = [...new Set(events.data.map(e => e.type.split('::').pop()))];
                    console.log(`   Event types: ${eventTypes.join(', ')}`);
                } else {
                    console.log(`   Module ${module}: 0 events`);
                }
            } catch (error) {
                console.log(`   Module ${module}: Error - ${error.message}`);
            }
        }

        // 5. Query transactions that interacted with this package
        console.log('\n💸 5. Checking recent transactions...');
        try {
            const txs = await client.queryTransactionBlocks({
                filter: { InputObject: OLD_PACKAGE_ID },
                order: 'descending', 
                limit: 10,
                options: {
                    showEvents: true,
                    showEffects: true
                }
            });
            
            console.log(`📊 Found ${txs.data.length} transactions involving package`);
            
            for (const tx of txs.data.slice(0, 3)) {
                console.log(`\n   Transaction: ${tx.digest}`);
                if (tx.events && tx.events.length > 0) {
                    console.log(`     Events: ${tx.events.length}`);
                    for (const event of tx.events.slice(0, 2)) {
                        console.log(`       - ${event.type}`);
                    }
                }
            }
            
        } catch (error) {
            console.log('❌ Error querying transactions:', error.message);
        }

    } catch (error) {
        console.error('💥 Debug script failed:', error);
    }
}

async function main() {
    console.log('🔧 Old Package Debug Script');
    console.log('='.repeat(50));
    await debugOldPackage();
    console.log('\n✅ Debug completed!');
}

if (require.main === module) {
    main();
}

module.exports = { debugOldPackage }; 
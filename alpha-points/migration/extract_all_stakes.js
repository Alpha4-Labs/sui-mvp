import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// Configuration
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const NETWORK = 'testnet';
const MIST_PER_SUI = 1_000_000_000;

async function extractAllStakes() {
    const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
    
    console.log('🔍 COMPREHENSIVE STAKE EXTRACTION');
    console.log('════════════════════════════════════');
    console.log(`📦 Package ID: ${OLD_PACKAGE_ID}`);
    console.log('');

    let allStakes = [];
    let allTxDigests = new Set();

    try {
        // 1. Get ALL NativeStakeStored events (no limit)
        console.log('1️⃣ Getting ALL NativeStakeStored Events...');
        console.log('─────────────────────────────────────────');
        
        let hasMore = true;
        let cursor = null;
        let totalEvents = 0;

        while (hasMore) {
            const queryParams = {
                query: {
                    MoveEventType: `${OLD_PACKAGE_ID}::staking_manager::NativeStakeStored`
                },
                limit: 50,
                order: 'ascending'
            };
            
            if (cursor) {
                queryParams.cursor = cursor;
            }

            const nativeStakeEvents = await client.queryEvents(queryParams);
            
            if (nativeStakeEvents.data.length === 0) {
                hasMore = false;
                break;
            }

            totalEvents += nativeStakeEvents.data.length;
            
            for (const event of nativeStakeEvents.data) {
                allTxDigests.add(event.id.txDigest);
            }

            // Set cursor for next page
            if (nativeStakeEvents.hasNextPage && nativeStakeEvents.nextCursor) {
                cursor = nativeStakeEvents.nextCursor;
            } else {
                hasMore = false;
            }
        }

        console.log(`Found ${totalEvents} total NativeStakeStored events`);
        console.log(`Found ${allTxDigests.size} unique transaction digests`);
        console.log('');

        // 2. Process ALL transactions to extract StakeCreated events
        console.log('2️⃣ Processing ALL Transactions...');
        console.log('──────────────────────────────────');
        
        let processedCount = 0;
        const txDigestsArray = Array.from(allTxDigests);
        
        for (const txDigest of txDigestsArray) {
            try {
                const txBlock = await client.getTransactionBlock({
                    digest: txDigest,
                    options: {
                        showEvents: true,
                        showEffects: true
                    }
                });

                // Process events for StakeCreated
                if (txBlock.events) {
                    for (const event of txBlock.events) {
                        if (event.type.includes('stake_position::StakeCreated')) {
                            const eventData = event.parsedJson;
                            
                            if (eventData) {
                                const stake = {
                                    stakeId: eventData.stake_id,
                                    owner: eventData.owner,
                                    amount: parseInt(eventData.amount),
                                    durationDays: parseInt(eventData.duration_days),
                                    unlockTimeMs: parseInt(eventData.unlock_time_ms),
                                    assetType: eventData.asset_type,
                                    txDigest: txDigest,
                                    source: 'StakeCreated Event'
                                };
                                
                                allStakes.push(stake);
                                
                                if (processedCount < 10) { // Show first 10 for progress
                                    console.log(`📍 Stake ${allStakes.length}: ${(stake.amount / MIST_PER_SUI).toFixed(4)} SUI for ${stake.durationDays} days`);
                                } else if (processedCount === 10) {
                                    console.log('... continuing processing (showing summary only) ...');
                                }
                            }
                        }
                    }
                }
                
                processedCount++;
                
                // Progress indicator
                if (processedCount % 50 === 0) {
                    console.log(`Processed ${processedCount}/${txDigestsArray.length} transactions...`);
                }
                
            } catch (txError) {
                console.log(`❌ Error processing transaction ${txDigest}: ${txError.message}`);
            }
        }

        console.log(`Processed ${processedCount} transactions total`);
        console.log('');

        // 3. Analysis and Summary
        console.log('📊 COMPREHENSIVE ANALYSIS');
        console.log('═════════════════════════');
        console.log(`Total Stakes Found: ${allStakes.length}`);
        
        if (allStakes.length === 0) {
            console.log('❌ No stakes found! Check the package ID and event types.');
            return;
        }

        // Calculate statistics
        let totalValue = 0;
        let ownerCounts = {};
        let durationCounts = {};
        
        for (const stake of allStakes) {
            totalValue += stake.amount;
            
            // Count by owner
            ownerCounts[stake.owner] = (ownerCounts[stake.owner] || 0) + 1;
            
            // Count by duration
            durationCounts[stake.durationDays] = (durationCounts[stake.durationDays] || 0) + 1;
        }

        console.log(`Total Value: ${(totalValue / MIST_PER_SUI).toFixed(4)} SUI (${totalValue} MIST)`);
        console.log(`Average Stake: ${(totalValue / allStakes.length / MIST_PER_SUI).toFixed(4)} SUI`);
        console.log(`Unique Owners: ${Object.keys(ownerCounts).length}`);
        console.log('');

        console.log('Duration Distribution:');
        for (const [duration, count] of Object.entries(durationCounts)) {
            console.log(`  ${duration} days: ${count} stakes`);
        }
        console.log('');

        // Show largest stakes
        const sortedStakes = allStakes.sort((a, b) => b.amount - a.amount);
        console.log('🏆 TOP 10 LARGEST STAKES:');
        console.log('─────────────────────────');
        
        for (let i = 0; i < Math.min(10, sortedStakes.length); i++) {
            const stake = sortedStakes[i];
            console.log(`${i + 1}. ${(stake.amount / MIST_PER_SUI).toFixed(4)} SUI - ${stake.owner.substring(0, 10)}... (${stake.durationDays} days)`);
        }
        console.log('');

        // 4. Generate Migration Data
        console.log('🔧 MIGRATION DATA GENERATION');
        console.log('════════════════════════════');

        // Generate JavaScript migration commands
        console.log('// === BATCH MIGRATION COMMANDS ===');
        console.log('// Copy and paste these into your admin migration script');
        console.log('');
        
        console.log('const allStakesToMigrate = [');
        for (const stake of allStakes) {
            const startTimeMs = stake.unlockTimeMs - (stake.durationDays * 24 * 60 * 60 * 1000);
            console.log(`  {`);
            console.log(`    stake_id: "${stake.stakeId}",`);
            console.log(`    owner: "${stake.owner}",`);
            console.log(`    principal_mist: ${stake.amount},`);
            console.log(`    duration_days: ${stake.durationDays},`);
            console.log(`    start_time_ms: ${startTimeMs},`);
            console.log(`    unlock_time_ms: ${stake.unlockTimeMs},`);
            console.log(`    tx_digest: "${stake.txDigest}"`);
            console.log(`  },`);
        }
        console.log('];');
        console.log('');

        // Generate Sui CLI commands
        console.log('// === SUI CLI MIGRATION COMMANDS ===');
        console.log('// Use these for manual migration via Sui CLI');
        console.log('');
        
        // Group by owner for batch processing
        const stakesByOwner = {};
        for (const stake of allStakes) {
            if (!stakesByOwner[stake.owner]) {
                stakesByOwner[stake.owner] = [];
            }
            stakesByOwner[stake.owner].push(stake);
        }

        console.log(`// ${Object.keys(stakesByOwner).length} unique owners need migration`);
        console.log('');

        let batchCount = 1;
        for (const [owner, ownerStakes] of Object.entries(stakesByOwner)) {
            if (ownerStakes.length === 1) {
                // Single stake migration
                const stake = ownerStakes[0];
                const startTimeMs = stake.unlockTimeMs - (stake.durationDays * 24 * 60 * 60 * 1000);
                
                console.log(`// Owner ${owner} - Single Stake`);
                console.log(`sui client call --package NEW_PACKAGE_ID --module integration \\`);
                console.log(`  --function emergency_migrate_old_stake \\`);
                console.log(`  --args ADMIN_CAP_ID CONFIG_ID MANAGER_ID LEDGER_ID \\`);
                console.log(`  ${stake.amount} ${owner} ${stake.durationDays} ${startTimeMs} \\`);
                console.log(`  COMPENSATION_COIN_ID CLOCK_ID \\`);
                console.log(`  --gas-budget 100000000`);
                console.log('');
            } else {
                // Batch migration
                console.log(`// Batch ${batchCount}: Owner ${owner} - ${ownerStakes.length} Stakes`);
                console.log(`// Principals: [${ownerStakes.map(s => s.amount).join(', ')}]`);
                console.log(`// Owners: [${ownerStakes.map(s => `"${s.owner}"`).join(', ')}]`);
                console.log(`// Durations: [${ownerStakes.map(s => s.durationDays).join(', ')}]`);
                console.log(`// Start Times: [${ownerStakes.map(s => s.unlockTimeMs - (s.durationDays * 24 * 60 * 60 * 1000)).join(', ')}]`);
                console.log('');
                batchCount++;
            }
        }

        // Generate summary report
        console.log('📋 MIGRATION SUMMARY REPORT');
        console.log('═══════════════════════════');
        
        const migrationReport = {
            timestamp: new Date().toISOString(),
            old_package_id: OLD_PACKAGE_ID,
            total_stakes: allStakes.length,
            total_value_mist: totalValue,
            total_value_sui: totalValue / MIST_PER_SUI,
            unique_owners: Object.keys(ownerCounts).length,
            duration_distribution: durationCounts,
            largest_stake_mist: Math.max(...allStakes.map(s => s.amount)),
            smallest_stake_mist: Math.min(...allStakes.map(s => s.amount)),
            stakes: allStakes.map(stake => ({
                stake_id: stake.stakeId,
                owner: stake.owner,
                principal_mist: stake.amount,
                duration_days: stake.durationDays,
                unlock_time_ms: stake.unlockTimeMs,
                tx_digest: stake.txDigest
            }))
        };

        console.log(JSON.stringify(migrationReport, null, 2));

    } catch (error) {
        console.error('❌ Fatal error during extraction:', error);
        process.exit(1);
    }
}

// Run the extraction
extractAllStakes()
    .then(() => {
        console.log('✅ Comprehensive stake extraction completed successfully');
    })
    .catch((error) => {
        console.error('❌ Extraction failed:', error);
        process.exit(1);
    }); 
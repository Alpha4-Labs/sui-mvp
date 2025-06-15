const { SuiClient, getFullnodeUrl } = require('@mysten/sui.js/client');

// Configuration
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const TESTNET_RPC = getFullnodeUrl('testnet');

/**
 * Debug script to help users understand why their migration button isn't showing
 * Usage: node debug_migration_button.js <wallet_address>
 */
async function debugMigrationButton(walletAddress) {
  console.log('🔍 MIGRATION BUTTON DEBUG TOOL');
  console.log('==============================');
  console.log(`📦 Old Package ID: ${OLD_PACKAGE_ID}`);
  console.log(`👤 Wallet Address: ${walletAddress}`);
  console.log('');

  const client = new SuiClient({ url: TESTNET_RPC });

  try {
    // Step 1: Check for old package stakes (exact same query as frontend)
    console.log('🎯 Step 1: Checking for old package stakes...');
    const stakeQuery = await client.getOwnedObjects({
      owner: walletAddress,
      filter: {
        StructType: `${OLD_PACKAGE_ID}::stake_position::StakePosition`
      },
      options: {
        showContent: true,
        showType: true
      }
    });

    console.log(`📊 Query Results:`);
    console.log(`   - Total objects returned: ${stakeQuery.data.length}`);
    console.log(`   - Has more pages: ${stakeQuery.hasNextPage}`);
    console.log(`   - Next cursor: ${stakeQuery.nextCursor || 'none'}`);

    const validOldStakes = stakeQuery.data.filter(obj => 
      obj.data?.content && 
      'fields' in obj.data.content
    );

    console.log(`✅ Valid old stakes found: ${validOldStakes.length}`);

    if (validOldStakes.length > 0) {
      console.log('🎉 MIGRATION BUTTON SHOULD BE VISIBLE!');
      console.log('');
      console.log('📋 Old Stakes Details:');
      validOldStakes.forEach((stake, index) => {
        console.log(`   ${index + 1}. Object ID: ${stake.data?.objectId}`);
        console.log(`      Type: ${stake.data?.type || 'unknown'}`);
        if (stake.data?.content && 'fields' in stake.data.content) {
          const fields = stake.data.content.fields;
          console.log(`      Principal: ${fields.principal || 'unknown'}`);
          console.log(`      Duration: ${fields.duration_days || 'unknown'} days`);
        }
        console.log('');
      });
      
      console.log('✅ DIAGNOSIS: You have legacy stakes that can be migrated!');
      console.log('💡 ACTION: The migration button should appear in the UI.');
      console.log('❗ If you don\'t see it, try refreshing the page or check browser console for errors.');
      
    } else {
      console.log('❌ NO OLD PACKAGE STAKES FOUND');
      console.log('');
      
      // Step 2: Check for any stake-related objects
      console.log('🔍 Step 2: Checking for any stake-related objects...');
      const allObjects = await client.getOwnedObjects({
        owner: walletAddress,
        options: {
          showType: true
        }
      });
      
      const stakeRelated = allObjects.data.filter(obj => 
        obj.data?.type?.toLowerCase().includes('stake')
      );
      
      console.log(`📊 Analysis of ${allObjects.data.length} total objects:`);
      console.log(`   - Stake-related objects: ${stakeRelated.length}`);
      
      if (stakeRelated.length > 0) {
        console.log('');
        console.log('📋 Stake-related objects found:');
        stakeRelated.forEach((obj, index) => {
          console.log(`   ${index + 1}. ${obj.data?.objectId}: ${obj.data?.type}`);
        });
        console.log('');
        console.log('🤔 POSSIBLE ISSUES:');
        console.log('   1. Your stakes might be in the NEW package (not eligible for migration)');
        console.log('   2. Your stakes might have already been migrated');
        console.log('   3. Your stakes might be in a different old package version');
      } else {
        console.log('');
        console.log('❌ DIAGNOSIS: No stake-related objects found at all');
        console.log('💡 POSSIBLE REASONS:');
        console.log('   1. This wallet has never created any stakes');
        console.log('   2. All stakes have been unstaked/withdrawn');
        console.log('   3. Stakes are in a different wallet address');
      }
    }

    // Step 3: Check for current package stakes
    console.log('');
    console.log('🎯 Step 3: Checking for current package stakes...');
    try {
      // Try to find any modern stake positions
      const modernStakeTypes = [
        'stake_position::StakePosition',
        'staking::StakePosition',
        'integration::StakePosition'
      ];
      
      let modernStakesFound = 0;
      for (const stakeType of modernStakeTypes) {
        try {
          const modernQuery = await client.getOwnedObjects({
            owner: walletAddress,
            filter: {
              MatchAny: [
                { StructType: stakeType },
                { StructType: `::${stakeType}` }
              ]
            },
            options: {
              showType: true
            }
          });
          modernStakesFound += modernQuery.data.length;
        } catch (e) {
          // Ignore type errors for non-existent types
        }
      }
      
      if (modernStakesFound > 0) {
        console.log(`✅ Found ${modernStakesFound} modern stake positions`);
        console.log('💡 This suggests you have stakes in the current system');
      } else {
        console.log('❌ No modern stake positions found');
      }
      
    } catch (error) {
      console.log('⚠️  Could not check for modern stakes:', error.message);
    }

    // Final recommendations
    console.log('');
    console.log('🎯 FINAL RECOMMENDATIONS:');
    console.log('==============================');
    
    if (validOldStakes.length > 0) {
      console.log('✅ You have legacy stakes ready for migration!');
      console.log('👉 Look for the blue "Claim αP" button in the Staked Positions section');
      console.log('👉 If missing, refresh the page and check browser console for errors');
    } else {
      console.log('❌ No legacy stakes found for migration');
      console.log('👉 Migration button will not appear (this is correct behavior)');
      console.log('👉 If you expected to have legacy stakes, verify:');
      console.log('   - You\'re using the correct wallet address');
      console.log('   - Your stakes haven\'t already been migrated');
      console.log('   - Your stakes are actually from the old package system');
    }

  } catch (error) {
    console.error('❌ Error during migration debug:', error);
    console.log('');
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify the wallet address is correct and valid');
    console.log('   3. Try again in a few minutes (RPC might be temporarily unavailable)');
  }
}

// Main execution
if (require.main === module) {
  const walletAddress = process.argv[2];
  
  if (!walletAddress) {
    console.log('❌ Usage: node debug_migration_button.js <wallet_address>');
    console.log('');
    console.log('Example:');
    console.log('  node debug_migration_button.js 0x1234567890abcdef1234567890abcdef12345678');
    process.exit(1);
  }
  
  if (!walletAddress.startsWith('0x') || walletAddress.length !== 66) {
    console.log('❌ Invalid wallet address format. Expected 0x followed by 64 hex characters.');
    process.exit(1);
  }
  
  debugMigrationButton(walletAddress).catch(console.error);
}

module.exports = { debugMigrationButton }; 
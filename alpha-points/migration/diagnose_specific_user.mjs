import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// Configuration
const OLD_PACKAGE_ID = "0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf";
const USER_ADDRESS = "0x3bf81770d42f4fe826e644fe6fe74c0a2ea3348c9ec5d843aa7a8b5e8990800c";

async function diagnoseUser() {
  console.log('🔬 COMPREHENSIVE USER DIAGNOSIS');
  console.log('===============================');
  console.log(`👤 User: ${USER_ADDRESS}`);
  console.log(`📦 Old Package: ${OLD_PACKAGE_ID}`);
  console.log('');

  const client = new SuiClient({ url: getFullnodeUrl('testnet') });

  try {
    // 1. Check for old package stakes
    console.log('📋 Step 1: Checking for old package stakes...');
    const stakeQuery = await client.getOwnedObjects({
      owner: USER_ADDRESS,
      filter: {
        StructType: `${OLD_PACKAGE_ID}::stake_position::StakePosition`
      },
      options: {
        showContent: true,
        showType: true
      }
    });

    console.log(`   - Objects found: ${stakeQuery.data.length}`);
    
    if (stakeQuery.data.length > 0) {
      console.log('✅ OLD STAKES FOUND!');
      stakeQuery.data.forEach((stake, index) => {
        console.log(`   ${index + 1}. Object ID: ${stake.data?.objectId}`);
        console.log(`      Type: ${stake.data?.type}`);
        if (stake.data?.content && 'fields' in stake.data.content) {
          const fields = stake.data.content.fields;
          console.log(`      Content fields:`, Object.keys(fields));
          console.log(`      Principal: ${fields.principal}`);
          console.log(`      Encumbered: ${fields.encumbered}`);
          console.log(`      Duration: ${fields.duration_days}`);
        }
        console.log('');
      });
    } else {
      console.log('❌ NO OLD STAKES FOUND');
    }

    // 2. Check ALL objects owned by this user
    console.log('📋 Step 2: Checking ALL owned objects...');
    const allObjects = await client.getOwnedObjects({
      owner: USER_ADDRESS,
      options: {
        showType: true,
        showContent: true
      }
    });

    console.log(`   - Total objects owned: ${allObjects.data.length}`);
    
    // Filter for any stake-related objects
    const stakeRelated = allObjects.data.filter(obj => 
      obj.data?.type?.toLowerCase().includes('stake')
    );
    
    console.log(`   - Stake-related objects: ${stakeRelated.length}`);
    
    if (stakeRelated.length > 0) {
      console.log('🎯 Stake-related objects found:');
      stakeRelated.forEach((obj, index) => {
        console.log(`   ${index + 1}. ${obj.data?.objectId}`);
        console.log(`      Type: ${obj.data?.type}`);
        console.log(`      Package: ${obj.data?.type?.split('::')[0]}`);
      });
    }

    // 3. Check transaction history for migration events
    console.log('\n📋 Step 3: Checking recent transactions...');
    try {
      const txs = await client.queryTransactionBlocks({
        filter: {
          FromAddress: USER_ADDRESS
        },
        options: {
          showEvents: true,
          showEffects: true
        },
        limit: 20
      });

      console.log(`   - Recent transactions: ${txs.data.length}`);
      
      // Look for migration-related events
      const migrationTxs = txs.data.filter(tx => 
        tx.events?.some(event => 
          event.type?.includes('migration') || 
          event.type?.includes('Migration') ||
          event.type?.includes('migrate') ||
          event.type?.includes('Migrate')
        )
      );
      
      if (migrationTxs.length > 0) {
        console.log('🎉 MIGRATION TRANSACTIONS FOUND!');
        migrationTxs.forEach((tx, index) => {
          console.log(`   ${index + 1}. Digest: ${tx.digest}`);
          tx.events?.forEach(event => {
            if (event.type?.toLowerCase().includes('migrat')) {
              console.log(`      Event: ${event.type}`);
              console.log(`      Data:`, event.parsedJson);
            }
          });
        });
      } else {
        console.log('❌ NO MIGRATION TRANSACTIONS FOUND');
      }
      
    } catch (txError) {
      console.log('⚠️ Could not fetch transaction history:', txError.message);
    }

    // 4. Summary and diagnosis
    console.log('\n🎯 DIAGNOSIS SUMMARY:');
    console.log('=====================');
    
    if (stakeQuery.data.length > 0) {
      console.log('✅ User HAS old stakes - Migration button SHOULD appear');
      console.log('💡 If button is not showing, check:');
      console.log('   - Frontend detection logic');
      console.log('   - Browser console for errors');
      console.log('   - Wallet connection state');
    } else {
      console.log('❌ User has NO old stakes - Migration button correctly hidden');
      console.log('💡 Possible reasons:');
      console.log('   - User already completed self-service migration');
      console.log('   - User was part of emergency admin migration');
      console.log('   - User never had stakes in the old package');
      console.log('   - Stakes were in a different package version');
    }

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  }
}

diagnoseUser().catch(console.error); 
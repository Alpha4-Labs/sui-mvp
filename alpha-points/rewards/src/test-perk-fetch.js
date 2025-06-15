// Test script to fetch the real PerkDefinition
import { SuiClient } from '@mysten/sui/client';

const PACKAGE_ID = '0x775538cc8a9fca6bd4f3d769e2c17bb322846abbc162b4904f8bef035bf725b';
const PERK_DEFINITION_ID = '0xf1644c13e20f438df3881fae1bd5f1b9a4b4d776efbe6cd8b703136085253cd0';
const RPC_URL = 'https://fullnode.testnet.sui.io';

async function testPerkDefinitionFetch() {
  console.log('🔍 Testing PerkDefinition fetch...');
  console.log('📦 Package ID:', PACKAGE_ID);
  console.log('🎯 PerkDefinition ID:', PERK_DEFINITION_ID);
  
  const client = new SuiClient({ url: RPC_URL });
  
  try {
    // Fetch the PerkDefinition object
    const response = await client.getObject({
      id: PERK_DEFINITION_ID,
      options: {
        showContent: true,
        showType: true,
      },
    });
    
    console.log('✅ Successfully fetched PerkDefinition!');
    console.log('📋 Raw response:', JSON.stringify(response, null, 2));
    
    if (response.data?.content && response.data.content.dataType === 'moveObject') {
      const fields = response.data.content.fields;
      console.log('📄 PerkDefinition fields:');
      console.log('  - Name:', fields.name);
      console.log('  - Description:', fields.description);
      console.log('  - Perk Type:', fields.perk_type);
      console.log('  - USDC Price:', fields.usdc_price);
      console.log('  - Alpha Points Price:', fields.current_alpha_points_price);
      console.log('  - Is Active:', fields.is_active);
      console.log('  - Total Claims:', fields.total_claims_count);
      console.log('  - Max Claims:', fields.max_claims);
      console.log('  - Creator Partner Cap:', fields.creator_partner_cap_id);
      console.log('  - Tags:', fields.tags);
      
      if (fields.revenue_split_policy) {
        console.log('💰 Revenue Split Policy:');
        console.log('  - Partner Share:', fields.revenue_split_policy.partner_share_percentage + '%');
        console.log('  - Platform Share:', fields.revenue_split_policy.platform_share_percentage + '%');
      }
    }
    
  } catch (error) {
    console.error('❌ Error fetching PerkDefinition:', error);
  }
}

// Also test if we can query for PerkDefinitions by type
async function testPerkDefinitionQuery() {
  console.log('\n🔍 Testing PerkDefinition query by type...');
  
  const client = new SuiClient({ url: RPC_URL });
  const perkDefinitionType = `${PACKAGE_ID}::perk_manager::PerkDefinition`;
  
  try {
    // Query for all PerkDefinition objects of this package
    const response = await client.getOwnedObjects({
      owner: '0x0', // This won't work for shared objects, but let's try
      filter: { 
        StructType: perkDefinitionType 
      },
      options: {
        showContent: true,
        showType: true,
      },
    });
    
    console.log(`📊 Found ${response.data.length} PerkDefinition objects`);
    
  } catch (error) {
    console.log('ℹ️ Note: PerkDefinitions are shared objects, so direct querying might not work');
    console.log('   This is expected behavior - we\'ll fetch them individually by ID');
  }
}

// Run the tests
testPerkDefinitionFetch().then(() => {
  return testPerkDefinitionQuery();
}).then(() => {
  console.log('\n✅ Test completed!');
}).catch(console.error); 
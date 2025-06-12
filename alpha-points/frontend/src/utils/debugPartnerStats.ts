/**
 * Debug utility for PartnerPerkStatsV2 object detection
 * This helps diagnose why the system isn't finding existing stats objects
 */

import { PACKAGE_ID } from '../config/contract';

// Helper to validate partner cap ID format
export const validatePartnerCapId = (partnerCapId: string) => {
  console.log('🐛 ===== PARTNER CAP ID VALIDATION =====');
  console.log('🐛 Raw Partner Cap ID:', partnerCapId);
  console.log('🐛 Type:', typeof partnerCapId);
  console.log('🐛 Length:', partnerCapId.length);
  console.log('🐛 Starts with 0x:', partnerCapId.startsWith('0x'));
  console.log('🐛 Is valid hex:', /^0x[a-fA-F0-9]+$/.test(partnerCapId));
  console.log('🐛 Expected length (66 chars):', partnerCapId.length === 66);
  
  if (partnerCapId.length !== 66) {
    console.warn('🐛 ⚠️ Partner Cap ID length is not 66 characters!');
  }
  
  if (!partnerCapId.startsWith('0x')) {
    console.warn('🐛 ⚠️ Partner Cap ID does not start with 0x!');
  }
  
  if (!/^0x[a-fA-F0-9]+$/.test(partnerCapId)) {
    console.warn('🐛 ⚠️ Partner Cap ID contains invalid hex characters!');
  }
  
  console.log('🐛 ===== END VALIDATION =====');
};

// Helper to search for PartnerPerkStatsV2 objects by transaction digest
export const findStatsObjectByTransaction = async (
  suiClient: any,
  transactionDigest: string
) => {
  console.log('🐛 Searching for PartnerPerkStatsV2 in transaction:', transactionDigest);
  
  try {
    const txResponse = await suiClient.getTransactionBlock({
      digest: transactionDigest,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true
      }
    });
    
    console.log('🐛 Transaction response:', JSON.stringify(txResponse, null, 2));
    
    // Check object changes for created objects
    if (txResponse.objectChanges) {
      console.log('🐛 Object changes found:', txResponse.objectChanges.length);
      
      for (const change of txResponse.objectChanges) {
        if (change.type === 'created') {
          console.log('🐛 Created object:', change);
          
          // Check if this is a PartnerPerkStatsV2 object
          if (change.objectType && change.objectType.includes('PartnerPerkStatsV2')) {
            console.log('🐛 ✅ Found PartnerPerkStatsV2 object:', change.objectId);
            return change.objectId;
          }
        }
      }
    }
    
    // Check events for PartnerPerkStatsCreatedV2
    if (txResponse.events) {
      console.log('🐛 Events found:', txResponse.events.length);
      
      for (const event of txResponse.events) {
        console.log('🐛 Event:', event);
        
        if (event.type && event.type.includes('PartnerPerkStatsCreatedV2')) {
          console.log('🐛 ✅ Found PartnerPerkStatsCreatedV2 event:', event);
          if (event.parsedJson && event.parsedJson.stats_id) {
            console.log('🐛 ✅ Stats ID from event:', event.parsedJson.stats_id);
            return event.parsedJson.stats_id;
          }
        }
      }
    }
    
    console.log('🐛 ❌ No PartnerPerkStatsV2 object found in transaction');
    return null;
    
  } catch (error) {
    console.error('🐛 Error searching transaction:', error);
    return null;
  }
};

export const debugPartnerStatsDetection = async (
  suiClient: any,
  partnerCapId: string
) => {
  console.log('🐛 ===== DEBUG PARTNER STATS DETECTION =====');
  console.log('🐛 Partner Cap ID:', partnerCapId);
  console.log('🐛 Package ID:', PACKAGE_ID);
  
  // First validate the partner cap ID format
  validatePartnerCapId(partnerCapId);
  
  const objectType = `${PACKAGE_ID}::perk_manager::PartnerPerkStatsV2`;
  console.log('🐛 Expected object type:', objectType);

  // Test 0: Try to find the object by known transaction digest
  console.log('\n🐛 TEST 0: Search by Known Transaction');
  // From the screenshot, the transaction digest appears to be 7L7izq...vodd
  // Let's try to search recent transactions for PartnerPerkStatsV2 creation
  try {
    // Get recent transactions and look for PartnerPerkStatsV2 creation
    const recentTxs = await suiClient.queryTransactionBlocks({
      filter: {
        MoveFunction: {
          package: PACKAGE_ID,
          module: 'perk_manager',
          function: 'create_partner_perk_stats_v2'
        }
      },
      limit: 10,
      order: 'descending'
    });
    
    console.log('🐛 Found', recentTxs.data.length, 'recent PartnerPerkStatsV2 creation transactions');
    
    for (const tx of recentTxs.data) {
      console.log('🐛 Checking transaction:', tx.digest);
      const statsId = await findStatsObjectByTransaction(suiClient, tx.digest);
      if (statsId) {
        console.log('🐛 ✅ Found stats object in transaction:', statsId);
        
        // Check if this stats object belongs to our partner cap
        try {
          const objectResponse = await suiClient.getObject({
            id: statsId,
            options: { showContent: true }
          });
          
          if (objectResponse.data?.content?.dataType === 'moveObject') {
            const fields = (objectResponse.data.content as any).fields;
            console.log('🐛 Stats object fields:', fields);
            
            if (fields.partner_cap_id === partnerCapId) {
              console.log('🐛 ✅ FOUND MATCHING STATS OBJECT:', statsId);
              console.log('🐛 ✅ This should have been detected by our normal search!');
            }
          }
        } catch (error) {
          console.log('🐛 Error accessing stats object:', error);
        }
      }
    }
  } catch (error) {
    console.error('🐛 Transaction search failed:', error);
  }

  // Test 1: Check if we can query events at all
  console.log('\n🐛 TEST 1: Event Query Test');
  try {
    const eventsResponse = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::perk_manager::PartnerPerkStatsCreatedV2`
      },
      limit: 100,
      order: 'descending'
    });
    
    console.log('🐛 Events found:', eventsResponse.data.length);
    
    if (eventsResponse.data.length > 0) {
      console.log('🐛 Sample event structure:', JSON.stringify(eventsResponse.data[0], null, 2));
      
      // Check all events for our partner cap
      const matchingEvents = eventsResponse.data.filter((event: any) => 
        event.parsedJson?.partner_cap_id === partnerCapId
      );
      console.log('🐛 Matching events for our partner cap:', matchingEvents.length);
      
      if (matchingEvents.length > 0) {
        console.log('🐛 Matching event details:', JSON.stringify(matchingEvents[0], null, 2));
      } else {
        // Show all partner cap IDs found in events for comparison
        console.log('🐛 All partner cap IDs found in events:');
        eventsResponse.data.forEach((event: any, index: number) => {
          if (event.parsedJson?.partner_cap_id) {
            console.log(`🐛   Event ${index + 1}: ${event.parsedJson.partner_cap_id}`);
            console.log(`🐛   Matches our ID: ${event.parsedJson.partner_cap_id === partnerCapId}`);
          }
        });
      }
    }
  } catch (error) {
    console.error('🐛 Event query failed:', error);
  }

  // Test 2: Try to query objects by type (if supported)
  console.log('\n🐛 TEST 2: Direct Object Query Test');
  try {
    const queryResponse = await suiClient.queryObjects({
      filter: {
        StructType: objectType
      },
      options: {
        showContent: true,
        showType: true
      }
    });
    
    console.log('🐛 Objects found via queryObjects:', queryResponse?.data?.length || 0);
    
    if (queryResponse?.data?.length > 0) {
      console.log('🐛 Sample object structure:', JSON.stringify(queryResponse.data[0], null, 2));
      
      // Check all objects for our partner cap
      const matchingObjects = queryResponse.data.filter((obj: any) => {
        if (obj.data?.content?.dataType === 'moveObject') {
          const fields = (obj.data.content as any).fields;
          return fields.partner_cap_id === partnerCapId;
        }
        return false;
      });
      
      console.log('🐛 Matching objects for our partner cap:', matchingObjects.length);
      
      if (matchingObjects.length > 0) {
        console.log('🐛 Matching object details:', JSON.stringify(matchingObjects[0], null, 2));
      } else {
        // Show all partner cap IDs found in objects for comparison
        console.log('🐛 All partner cap IDs found in objects:');
        queryResponse.data.forEach((obj: any, index: number) => {
          if (obj.data?.content?.dataType === 'moveObject') {
            const fields = (obj.data.content as any).fields;
            if (fields.partner_cap_id) {
              console.log(`🐛   Object ${index + 1}: ${fields.partner_cap_id}`);
              console.log(`🐛   Matches our ID: ${fields.partner_cap_id === partnerCapId}`);
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('🐛 Direct object query failed:', error);
  }

  // Test 3: Try getAllObjects (if supported)
  console.log('\n🐛 TEST 3: GetAllObjects Test');
  try {
    const allObjectsResponse = await suiClient.getAllObjects({
      filter: {
        StructType: objectType
      },
      options: {
        showContent: true,
        showType: true
      }
    });
    
    console.log('🐛 Objects found via getAllObjects:', allObjectsResponse?.data?.length || 0);
    
    if (allObjectsResponse?.data?.length > 0) {
      console.log('🐛 Sample object structure:', JSON.stringify(allObjectsResponse.data[0], null, 2));
    }
  } catch (error) {
    console.error('🐛 getAllObjects failed:', error);
  }

  // Test 4: Try to access the specific object we can see in the transaction
  console.log('\n🐛 TEST 4: Direct Object Access Test');
  console.log('🐛 Attempting to access the PartnerPerkStatsV2 object from the transaction...');
  
  // Based on the transaction screenshot, try to access the created object
  // The full object ID from the transaction should be longer than what's shown
  const knownStatsObjectId = '0x76a1935d'; // Truncated from screenshot - we'll try this first
  try {
    await debugDirectObjectAccess(suiClient, knownStatsObjectId);
  } catch (error) {
    console.log('🐛 Could not access known stats object:', error);
  }
  
  // Test 5: Check if there's an issue with the event type name
  console.log('\n🐛 TEST 5: Alternative Event Type Test');
  try {
    // Try different possible event type names
    const alternativeEventTypes = [
      `${PACKAGE_ID}::perk_manager::PartnerPerkStatsCreated`,
      `${PACKAGE_ID}::perk_manager::StatsCreated`,
      `${PACKAGE_ID}::perk_manager::PartnerStatsCreated`
    ];
    
    for (const eventType of alternativeEventTypes) {
      console.log('🐛 Trying event type:', eventType);
      try {
        const altEventsResponse = await suiClient.queryEvents({
          query: {
            MoveEventType: eventType
          },
          limit: 10,
          order: 'descending'
        });
        console.log('🐛 Found', altEventsResponse.data.length, 'events for', eventType);
        if (altEventsResponse.data.length > 0) {
          console.log('🐛 Sample event:', JSON.stringify(altEventsResponse.data[0], null, 2));
        }
      } catch (error) {
        console.log('🐛 Event type', eventType, 'failed:', error);
      }
    }
  } catch (error) {
    console.error('🐛 Alternative event type test failed:', error);
  }
  
  console.log('\n🐛 ===== END DEBUG =====');
};

export const debugDirectObjectAccess = async (
  suiClient: any,
  objectId: string
) => {
  console.log('🐛 Testing direct access to object:', objectId);
  
  try {
    const objectResponse = await suiClient.getObject({
      id: objectId,
      options: {
        showContent: true,
        showType: true,
        showOwner: true
      }
    });
    
    console.log('🐛 Object access successful:', JSON.stringify(objectResponse, null, 2));
    
    if (objectResponse.data?.content?.dataType === 'moveObject') {
      const fields = (objectResponse.data.content as any).fields;
      console.log('🐛 Object fields:', fields);
      console.log('🐛 Partner Cap ID in object:', fields.partner_cap_id);
    }
  } catch (error) {
    console.error('🐛 Direct object access failed:', error);
  }
};

// Helper to test with a specific partner cap and known stats object
export const debugSpecificCase = async (
  suiClient: any,
  partnerCapId: string,
  knownStatsObjectId?: string
) => {
  console.log('🐛 ===== SPECIFIC CASE DEBUG =====');
  console.log('🐛 Partner Cap ID:', partnerCapId);
  
  if (knownStatsObjectId) {
    console.log('🐛 Known Stats Object ID:', knownStatsObjectId);
    await debugDirectObjectAccess(suiClient, knownStatsObjectId);
  }
  
  await debugPartnerStatsDetection(suiClient, partnerCapId);
}; 
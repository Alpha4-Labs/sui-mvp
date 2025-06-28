/**
 * Utility functions to help identify and manage duplicate PartnerPerkStatsV2 objects
 * This addresses the issue where multiple stats objects exist for the same partner cap
 */

import { PACKAGE_ID } from '../config/contract';

export interface DuplicateStatsInfo {
  partnerCapId: string;
  statsIds: string[];
  duplicateCount: number;
  recommendedStatsId: string; // The one to keep
  duplicatesToRemove: string[]; // The ones that should be removed
}

/**
 * Finds all duplicate PartnerPerkStatsV2 objects across all partner caps
 * @param suiClient SUI client instance
 * @returns Array of duplicate information for each partner cap with duplicates
 */
export const findAllDuplicateStats = async (
  suiClient: any
): Promise<DuplicateStatsInfo[]> => {
  try {
    console.log('🔍 Scanning for duplicate PartnerPerkStatsV2 objects...');
    
    // NOTE: PartnerPerkStatsV2 objects are no longer used in the current contract version
    // This function is deprecated but kept for historical reference
    console.warn('⚠️ PartnerPerkStatsV2 objects are no longer used in the current contract version');
    return []; // Return empty array since no duplicates exist for obsolete objects
    
    // Get all PartnerPerkStatsCreatedV2 events
    const eventsResponse = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::perk_manager::PartnerPerkStatsCreatedV2`
      },
      limit: 200,
      order: 'descending'
    });
    
    console.log('🔍 Found', eventsResponse.data.length, 'PartnerPerkStatsCreatedV2 events');
    
    // Group by partner_cap_id
    const statsByPartnerCap = new Map<string, string[]>();
    
    for (const event of eventsResponse.data) {
      if (event.parsedJson && event.parsedJson.partner_cap_id && event.parsedJson.stats_id) {
        const partnerCapId = event.parsedJson.partner_cap_id;
        const statsId = event.parsedJson.stats_id;
        
        if (!statsByPartnerCap.has(partnerCapId)) {
          statsByPartnerCap.set(partnerCapId, []);
        }
        
        const existing = statsByPartnerCap.get(partnerCapId)!;
        if (!existing.includes(statsId)) {
          existing.push(statsId);
        }
      }
    }
    
    // Find duplicates
    for (const [partnerCapId, statsIds] of statsByPartnerCap.entries()) {
      if (statsIds.length > 1) {
        console.warn('⚠️ Found', statsIds.length, 'stats objects for partner cap:', partnerCapId);
        console.warn('⚠️ Stats IDs:', statsIds);
        
        // Verify which ones still exist
        const validStatsIds: string[] = [];
        
        for (const statsId of statsIds) {
          try {
            const objectResponse = await suiClient.getObject({
              id: statsId,
              options: { showContent: true }
            });
            
            if (objectResponse.data && objectResponse.data.content) {
              validStatsIds.push(statsId);
            }
          } catch (error) {
            console.log('❌ Stats object no longer exists:', statsId);
          }
        }
        
        if (validStatsIds.length > 1) {
          // Use the first valid one as the recommended one to keep
          const recommendedStatsId = validStatsIds[0];
          const duplicatesToRemove = validStatsIds.slice(1);
          
          duplicates.push({
            partnerCapId,
            statsIds: validStatsIds,
            duplicateCount: validStatsIds.length,
            recommendedStatsId,
            duplicatesToRemove
          });
        }
      }
    }
    
    console.log('🔍 Found', duplicates.length, 'partner caps with duplicate stats objects');
    return duplicates;
    
  } catch (error) {
    console.error('Error finding duplicate stats:', error);
    return [];
  }
};

/**
 * Generates a report of duplicate stats objects
 * @param suiClient SUI client instance
 * @returns Human-readable report string
 */
export const generateDuplicateStatsReport = async (
  suiClient: any
): Promise<string> => {
  const duplicates = await findAllDuplicateStats(suiClient);
  
  if (duplicates.length === 0) {
    return '✅ No duplicate PartnerPerkStatsV2 objects found. All partner caps have exactly one stats object.';
  }
  
  let report = `⚠️ DUPLICATE STATS OBJECTS DETECTED\n\n`;
  report += `Found ${duplicates.length} partner caps with duplicate stats objects:\n\n`;
  
  for (let i = 0; i < duplicates.length; i++) {
    const duplicate = duplicates[i];
    report += `${i + 1}. Partner Cap: ${duplicate.partnerCapId}\n`;
    report += `   Duplicate Count: ${duplicate.duplicateCount}\n`;
    report += `   Recommended to Keep: ${duplicate.recommendedStatsId}\n`;
    report += `   Should Remove: ${duplicate.duplicatesToRemove.join(', ')}\n\n`;
  }
  
  report += `IMPACT:\n`;
  report += `- Each partner should have exactly ONE PartnerPerkStatsV2 object\n`;
  report += `- Multiple objects can cause data inconsistency\n`;
  report += `- The system will use the first found object, but this is unpredictable\n\n`;
  
  report += `RECOMMENDATION:\n`;
  report += `- Contact the smart contract admin to remove duplicate objects\n`;
  report += `- Implement stricter creation checks to prevent future duplicates\n`;
  report += `- Consider adding a unique constraint in the smart contract\n`;
  
  return report;
};

/**
 * Console-friendly function to log duplicate stats information
 * @param suiClient SUI client instance
 */
export const logDuplicateStatsReport = async (suiClient: any) => {
  const report = await generateDuplicateStatsReport(suiClient);
  console.log(report);
};

/**
 * Check if a specific partner cap has duplicate stats objects
 * @param suiClient SUI client instance
 * @param partnerCapId Partner cap ID to check
 * @returns Duplicate information for this specific partner cap, or null if no duplicates
 */
export const checkPartnerCapForDuplicates = async (
  suiClient: any,
  partnerCapId: string
): Promise<DuplicateStatsInfo | null> => {
  const allDuplicates = await findAllDuplicateStats(suiClient);
  return allDuplicates.find(d => d.partnerCapId === partnerCapId) || null;
}; 
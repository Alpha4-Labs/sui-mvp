/**
 * Partner Perk Validation Utilities
 * 
 * NOTE: This module was originally designed to validate PartnerPerkStatsV2 objects,
 * but those are no longer required by the current contract version.
 * Most validation functions now return successful states since perks no longer depend on stats objects.
 */

import { PerkDefinition } from '../hooks/usePerkData';
import { findPartnerStatsId, ensurePartnerStatsExists } from './transaction';

export interface PerkValidationResult {
  perkId: string;
  perkName: string;
  partnerCapId: string;
  isValid: boolean;
  hasPartnerStats: boolean;
  canBePurchased: boolean;
  issues: string[];
  recommendations: string[];
}

export interface PartnerValidationSummary {
  partnerCapId: string;
  partnerName?: string;
  totalPerks: number;
  validPerks: number;
  invalidPerks: number;
  hasPartnerStats: boolean;
  unpurchasablePerks: PerkValidationResult[];
  recommendations: string[];
}

/**
 * Validates a single perk to check if it can be purchased
 */
export const validatePerk = async (
  suiClient: any,
  perk: PerkDefinition
): Promise<PerkValidationResult> => {
  const result: PerkValidationResult = {
    perkId: perk.id,
    perkName: perk.name,
    partnerCapId: perk.creator_partner_cap_id,
    isValid: true,
    hasPartnerStats: true, // Always true since stats objects are no longer required
    canBePurchased: true, // Always true since stats objects are no longer required
    issues: [],
    recommendations: []
  };

  // NOTE: PartnerPerkStatsV2 checks are no longer needed since the contract was updated
  console.log(`✅ Perk "${perk.name}" is valid - PartnerPerkStatsV2 objects are no longer required`);
  
  // Commented out deprecated stats validation:
  /*
  try {
    // Check if partner has PartnerPerkStatsV2
    const statsId = await findPartnerStatsId(suiClient, perk.creator_partner_cap_id);
    result.hasPartnerStats = true;
    result.canBePurchased = true;
    
    console.log(`✅ Perk "${perk.name}" is valid - partner has PartnerPerkStatsV2: ${statsId}`);
    
  } catch (error) {
    result.hasPartnerStats = false;
    result.canBePurchased = false;
    result.isValid = false;
    
    result.issues.push('Partner missing PartnerPerkStatsV2 object');
    result.issues.push('Perk cannot be purchased by users');
    
    result.recommendations.push('Partner must create PartnerPerkStatsV2 object');
    result.recommendations.push('Go to Partner Dashboard → Settings → Create Stats Object');
    
    console.warn(`❌ Perk "${perk.name}" is invalid - no PartnerPerkStatsV2 found`);
  }
  */

  // Additional validations
  if (!perk.is_active) {
    result.issues.push('Perk is not active');
    result.recommendations.push('Partner should activate the perk');
  }

  if (perk.expiration_timestamp_ms && Date.now() > perk.expiration_timestamp_ms) {
    result.issues.push('Perk has expired');
    result.recommendations.push('Partner should update expiration date or create new perk');
  }

  return result;
};

/**
 * Validates all perks for a specific partner
 */
export const validatePartnerPerks = async (
  suiClient: any,
  partnerCapId: string,
  perks: PerkDefinition[],
  partnerName?: string
): Promise<PartnerValidationSummary> => {
  const partnerPerks = perks.filter(perk => perk.creator_partner_cap_id === partnerCapId);
  
  const summary: PartnerValidationSummary = {
    partnerCapId,
    partnerName,
    totalPerks: partnerPerks.length,
    validPerks: 0,
    invalidPerks: 0,
    hasPartnerStats: false,
    unpurchasablePerks: [],
    recommendations: []
  };

  if (partnerPerks.length === 0) {
    summary.recommendations.push('No perks found for this partner');
    return summary;
  }

  // NOTE: PartnerPerkStatsV2 checks are no longer needed - always mark as having stats
  summary.hasPartnerStats = true; // Always true since stats objects are no longer required
  
  // Commented out deprecated stats validation:
  /*
  // Check if partner has PartnerPerkStatsV2
  try {
    await findPartnerStatsId(suiClient, partnerCapId);
    summary.hasPartnerStats = true;
  } catch (error) {
    summary.hasPartnerStats = false;
    summary.recommendations.push('🚨 CRITICAL: Create PartnerPerkStatsV2 object immediately');
    summary.recommendations.push('All perks are currently unpurchasable without this object');
  }
  */

  // Validate each perk
  for (const perk of partnerPerks) {
    const validation = await validatePerk(suiClient, perk);
    
    if (validation.isValid) {
      summary.validPerks++;
    } else {
      summary.invalidPerks++;
      summary.unpurchasablePerks.push(validation);
    }
  }

  // Generate summary recommendations
  if (summary.invalidPerks > 0) {
    if (!summary.hasPartnerStats) {
      summary.recommendations.push(`${summary.invalidPerks} perks cannot be purchased - create PartnerPerkStatsV2 object`);
    }
    summary.recommendations.push('Check individual perk issues for specific fixes needed');
  }

  if (summary.validPerks === summary.totalPerks) {
    summary.recommendations.push('✅ All perks are valid and purchasable');
  }

  return summary;
};

/**
 * Scans all perks in the marketplace for validation issues
 */
export const validateMarketplacePerks = async (
  suiClient: any,
  allPerks: PerkDefinition[]
): Promise<{
  totalPerks: number;
  validPerks: number;
  invalidPerks: number;
  partnersWithIssues: PartnerValidationSummary[];
  overallRecommendations: string[];
}> => {
  const partnerGroups = new Map<string, PerkDefinition[]>();
  
  // Group perks by partner
  allPerks.forEach(perk => {
    const existing = partnerGroups.get(perk.creator_partner_cap_id) || [];
    existing.push(perk);
    partnerGroups.set(perk.creator_partner_cap_id, existing);
  });

  const results = {
    totalPerks: allPerks.length,
    validPerks: 0,
    invalidPerks: 0,
    partnersWithIssues: [] as PartnerValidationSummary[],
    overallRecommendations: [] as string[]
  };

  // Validate each partner's perks
  for (const [partnerCapId, perks] of partnerGroups) {
    const partnerSummary = await validatePartnerPerks(suiClient, partnerCapId, perks);
    
    results.validPerks += partnerSummary.validPerks;
    results.invalidPerks += partnerSummary.invalidPerks;
    
    if (partnerSummary.invalidPerks > 0) {
      results.partnersWithIssues.push(partnerSummary);
    }
  }

  // Generate overall recommendations
  if (results.invalidPerks === 0) {
    results.overallRecommendations.push('✅ All marketplace perks are valid and purchasable');
  } else {
    results.overallRecommendations.push(`🚨 ${results.invalidPerks} perks have issues and cannot be purchased`);
    results.overallRecommendations.push(`${results.partnersWithIssues.length} partners need to fix their setup`);
    
    const statsIssueCount = results.partnersWithIssues.filter(p => !p.hasPartnerStats).length;
    if (statsIssueCount > 0) {
      results.overallRecommendations.push(`${statsIssueCount} partners missing PartnerPerkStatsV2 objects`);
    }
  }

  return results;
};

/**
 * Attempts to automatically fix partner setup issues
 */
export const autoFixPartnerSetup = async (
  suiClient: any,
  signAndExecuteTransaction: any,
  partnerCapId: string
): Promise<{
  success: boolean;
  message: string;
  statsId?: string;
}> => {
  try {
    console.log(`🔧 Attempting to auto-fix setup for partner: ${partnerCapId}`);
    
    const statsId = await ensurePartnerStatsExists(
      suiClient,
      partnerCapId,
      signAndExecuteTransaction
    );
    
    return {
      success: true,
      message: `✅ Successfully created PartnerPerkStatsV2 object: ${statsId}`,
      statsId
    };
    
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Failed to fix setup: ${error.message || 'Unknown error'}`
    };
  }
};

/**
 * Generates a detailed report for partners about their perk issues
 */
export const generatePartnerReport = (summary: PartnerValidationSummary): string => {
  let report = `# Partner Perk Validation Report\n\n`;
  report += `**Partner:** ${summary.partnerName || 'Unknown'}\n`;
  report += `**Partner Cap ID:** ${summary.partnerCapId.substring(0, 8)}...\n\n`;
  
  report += `## Summary\n`;
  report += `- Total Perks: ${summary.totalPerks}\n`;
  report += `- Valid Perks: ${summary.validPerks} ✅\n`;
  report += `- Invalid Perks: ${summary.invalidPerks} ❌\n`;
  report += `- Has PartnerPerkStatsV2: ${summary.hasPartnerStats ? 'Yes ✅' : 'No ❌'}\n\n`;
  
  if (summary.invalidPerks > 0) {
    report += `## Issues Found\n\n`;
    summary.unpurchasablePerks.forEach((perk, index) => {
      report += `### ${index + 1}. "${perk.perkName}"\n`;
      report += `**Perk ID:** ${perk.perkId.substring(0, 8)}...\n`;
      report += `**Issues:**\n`;
      perk.issues.forEach(issue => report += `- ${issue}\n`);
      report += `**Recommendations:**\n`;
      perk.recommendations.forEach(rec => report += `- ${rec}\n`);
      report += `\n`;
    });
  }
  
  if (summary.recommendations.length > 0) {
    report += `## Action Items\n\n`;
    summary.recommendations.forEach(rec => report += `- ${rec}\n`);
  }
  
  return report;
}; 
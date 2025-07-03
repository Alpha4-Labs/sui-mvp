/**
 * Partner-specific transaction builder utilities for Alpha Points
 * Extracted from main transaction.ts for partner dashboard app
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID, SHARED_OBJECTS, CLOCK_ID } from '../config/contract';
import { SuinsClient } from '@mysten/suins';
import { 
  usdToMicroUSDC, 
  usdToAlphaPointsForSettingsViaOracle, 
  logConversionDebug, 
  CONVERSION_RATES,
  convertSettingsForDisplay, 
  convertSettingsForStorage,
  type SettingsConversion,
  alphaPointsToUSDViaOracle,
  transformUsdcForBuggyContract
} from './conversionUtils';

// Environment variables for SuiNS integration
const VITE_SUINS_PARENT_OBJECT_ID = import.meta.env['VITE_SUINS_PARENT_OBJECT_ID'];
const VITE_SUINS_PARENT_DOMAIN_NAME = import.meta.env['VITE_SUINS_PARENT_DOMAIN_NAME'] || '';

// =======================
// PARTNER CAP CREATION
// =======================

/**
 * Builds a transaction to create a ProxyCap for a partner.
 * @param partnerCapId The object ID of the PartnerCap (must be a reference)
 * @param suinsNftId The object ID of the SuiNS Parent NFT (must be owned by the sender)
 * @param suinsNftType The full type string of the SuiNS Parent NFT (e.g., "0x2::suins::DomainName")
 * @param packageId (optional) The package ID to use (defaults to PACKAGE_ID)
 * @param sponsorAddress Optional sponsor address to pay for gas fees (typically deployer/admin)
 * @returns Transaction object ready for execution
 */
export const buildCreateProxyCapTransaction = (
  partnerCapId: string,
  suinsNftId: string,
  suinsNftType: string,
  packageId: string = PACKAGE_ID, // Use main PACKAGE_ID by default
  sponsorAddress?: string
) => {
  console.log("[PROXYCAP DEBUG] buildCreateProxyCapTransaction - packageId input:", packageId); // Log the actual packageId being used
  console.log("[PROXYCAP DEBUG] buildCreateProxyCapTransaction - suinsNftType input:", suinsNftType);
  const target = `${packageId}::partner::create_proxy_cap<${suinsNftType}>`;
  console.log("[PROXYCAP DEBUG] buildCreateProxyCapTransaction - constructed target:", target);

  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored ProxyCap creation: Gas fees will be paid by deployer/admin ${sponsorAddress}`);
  }
  
  tx.moveCall({
    target: target,
    arguments: [
      tx.object(partnerCapId), // &PartnerCap
      tx.object(suinsNftId),   // SuiNSNft (to be moved)
    ],
  });
  return tx;
};

/**
 * Builds a transaction for creating a basic PartnerCap (legacy)
 * @deprecated Use buildCreatePartnerCapFlexTransaction for the V2 system
 */
export const buildCreatePartnerCapTransaction = (
  partnerName: string
): Transaction => {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::partner::create_partner_cap`,
    arguments: [
      tx.pure.string(partnerName),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for creating a PartnerCapFlex with SUI collateral
 */
export const buildCreatePartnerCapFlexTransaction = (
  partnerName: string,
  suiAmountMist: bigint
): Transaction => {
  const tx = new Transaction();

  const [collateralCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(suiAmountMist.toString())]);

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::create_partner_cap_flex_with_collateral`,
    arguments: [
      collateralCoin,
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.string(partnerName),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for creating a PartnerCapFlex with USDC collateral
 */
export const buildCreatePartnerCapFlexWithUSDCTransaction = (
  partnerName: string,
  usdcCoinId: string
): Transaction => {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::create_partner_cap_flex_with_usdc_collateral`,
    arguments: [
      tx.object(usdcCoinId),
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.string(partnerName),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for creating a PartnerCapFlex with NFT collateral
 */
export const buildCreatePartnerCapFlexWithNFTTransaction = (
  partnerName: string,
  kioskId: string,
  collectionType: string,
  estimatedFloorValueUsdc: number
): Transaction => {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::create_partner_cap_flex_with_nft_collateral`,
    arguments: [
      tx.object(kioskId),
      tx.pure.string(collectionType),
      tx.pure.u64(estimatedFloorValueUsdc.toString()),
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.string(partnerName),
    ],
  });

  return tx;
};

/**
 * Builds a sponsored transaction for creating a PartnerCapFlex
 */
export const buildCreatePartnerCapFlexTransactionSponsored = (
  partnerName: string,
  suiAmountMist: bigint,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored PartnerCapFlex creation: Gas fees will be paid by ${sponsorAddress}`);
  }

  const [collateralCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(suiAmountMist.toString())]);

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::create_partner_cap_flex_with_collateral`,
    arguments: [
      collateralCoin,
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.string(partnerName),
    ],
  });

  return tx;
};

// =======================
// PARTNER SETTINGS
// =======================

/**
 * Builds a consolidated transaction for updating all perk settings at once
 */
export const buildUpdateAllPerkSettingsTransaction = (
  partnerCapId: string,
  settings: {
    maxPerksPerPartner?: number;
    maxClaimsPerPerk?: number;
    maxCostPerPerkUsd?: number;
    minPartnerSharePercentage?: number;
    maxPartnerSharePercentage?: number;
    allowConsumablePerks?: boolean;
    allowExpiringPerks?: boolean;
    allowUniqueMetadata?: boolean;
  },
  allowedPerkTypes: string[] = [],
  allowedTags: string[] = [],
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored settings update: Gas fees will be paid by ${sponsorAddress}`);
  }

  // Update perk control settings
  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::update_perk_control_settings_v2_entry`,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.u64(settings.maxPerksPerPartner || 100),
      tx.pure.u64(settings.maxClaimsPerPerk || 1000),
      tx.pure.u64(Math.floor((settings.maxCostPerPerkUsd || 100) * 100)),
      tx.pure.u8(settings.minPartnerSharePercentage || 50),
      tx.pure.u8(settings.maxPartnerSharePercentage || 90),
      tx.pure.bool(settings.allowConsumablePerks || true),
      tx.pure.bool(settings.allowExpiringPerks || true),
      tx.pure.bool(settings.allowUniqueMetadata || true)
    ],
  });

  // Update allowed perk types if provided
  if (allowedPerkTypes.length > 0) {
    tx.moveCall({
      target: `${PACKAGE_ID}::partner_flex::update_allowed_perk_types_entry`,
      arguments: [
        tx.object(partnerCapId),
        tx.pure(bcs.vector(bcs.string()).serialize(allowedPerkTypes))
      ],
    });
  }

  // Update allowed tags if provided
  if (allowedTags.length > 0) {
    tx.moveCall({
      target: `${PACKAGE_ID}::partner_flex::update_allowed_tags_entry`,
      arguments: [
        tx.object(partnerCapId),
        tx.pure(bcs.vector(bcs.string()).serialize(allowedTags))
      ],
    });
  }

  return tx;
};

// =======================
// COLLATERAL MANAGEMENT
// =======================

/**
 * Builds a transaction to add SUI collateral to an existing PartnerCapFlex
 */
export const buildAddSuiCollateralTransaction = (
  partnerCapId: string,
  suiAmountMist: bigint,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored SUI collateral addition: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::add_sui_collateral`,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.u64(suiAmountMist.toString()),
      tx.object(SHARED_OBJECTS.oracle)
    ],
  });

  return tx;
};

/**
 * Builds a transaction to create an initial SUI vault for a PartnerCapFlex
 */
export const buildCreateInitialSuiVaultTransaction = (
  partnerCapId: string,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored vault creation: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::create_initial_sui_vault`,
    arguments: [
      tx.object(partnerCapId),
      tx.object(SHARED_OBJECTS.oracle)
    ],
  });

  return tx;
};

/**
 * Builds a transaction to add USDC collateral to an existing PartnerCapFlex
 */
export const buildAddUsdcCollateralTransaction = (
  partnerCapId: string,
  usdcCoinId: string,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored USDC collateral addition: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::add_usdc_collateral`,
    arguments: [
      tx.object(partnerCapId),
      tx.object(usdcCoinId),
      tx.object(SHARED_OBJECTS.oracle)
    ],
  });

  return tx;
};

/**
 * Builds a transaction to add NFT collateral to an existing PartnerCapFlex
 */
export const buildAddNftCollateralTransaction = (
  partnerCapId: string,
  kioskId: string,
  nftId: string,
  estimatedValueCents: number,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored NFT collateral addition: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::add_nft_collateral`,
    arguments: [
      tx.object(partnerCapId),
      tx.object(kioskId),
      tx.object(nftId),
      tx.pure.u64(estimatedValueCents.toString()),
      tx.object(SHARED_OBJECTS.oracle)
    ],
  });

  return tx;
};

/**
 * Builds a transaction to withdraw collateral from a PartnerCapFlex
 */
export const buildWithdrawCollateralTransaction = (
  partnerCapId: string,
  withdrawAmountMist: bigint,
  collateralType: 'sui' | 'usdc' | 'nft' = 'sui',
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored collateral withdrawal: Gas fees will be paid by ${sponsorAddress}`);
  }

  const target = collateralType === 'usdc' 
    ? `${PACKAGE_ID}::partner_flex::withdraw_usdc_collateral`
    : `${PACKAGE_ID}::partner_flex::withdraw_sui_collateral`;

  tx.moveCall({
    target,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.u64(withdrawAmountMist.toString()),
      tx.object(SHARED_OBJECTS.oracle)
    ],
  });

  return tx;
};

// =======================
// PARTNER STATS
// =======================

/**
 * Finds the PartnerPerkStatsV2 object ID for a given partner cap
 */
export const findPartnerStatsId = async (
  suiClient: any,
  partnerCapId: string
): Promise<string | null> => {
  try {
    console.log('🔍 Searching for PartnerPerkStatsV2 for partner cap:', partnerCapId);

    const eventsResponse = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::perk_manager::PartnerPerkStatsCreatedV2`
      },
      limit: 50,
      order: 'descending'
    });

    console.log('🔍 Found', eventsResponse.data.length, 'PartnerPerkStatsCreatedV2 events');

    for (const event of eventsResponse.data) {
      try {
        const eventData = event.parsedJson;
        
        if (eventData && eventData.partner_cap_id === partnerCapId) {
          if (eventData.stats_id && typeof eventData.stats_id === 'string') {
            console.log('✅ Found valid PartnerPerkStatsV2:', event.parsedJson.stats_id);
            return eventData.stats_id;
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Could not parse event data:', parseError);
      }
    }

    console.log('ℹ️ No PartnerPerkStatsV2 found for partner cap:', partnerCapId);
    return null;

  } catch (error) {
    console.error('❌ Error searching for PartnerPerkStatsV2:', error);
    return null;
  }
};

/**
 * Builds a transaction to create a PartnerPerkStatsV2 object
 */
export const buildCreatePartnerStatsIfNeededTransaction = (
  partnerCapId: string,
  dailyQuotaLimit: number = 10000
): Transaction => {
  console.log('🔨 Building create PartnerPerkStatsV2 transaction for partner cap:', partnerCapId);
  
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::perk_manager::create_partner_perk_stats_v2`,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.u64(dailyQuotaLimit),
    ],
  });

  return tx;
};

/**
 * Alias for buildCreatePartnerStatsIfNeededTransaction for compatibility
 */
export const buildCreatePartnerStatsIfNotExistsTransaction = buildCreatePartnerStatsIfNeededTransaction;

/**
 * Builds a sponsored transaction for creating a PartnerPerkStatsV2 object
 */
export const buildCreatePartnerPerkStatsTransaction = (
  partnerCapId: string,
  dailyQuotaLimit: number = 10000,
  sponsorAddress?: string
): Transaction => {
  
  if (sponsorAddress) {
    console.log(`🎁 Sponsored PartnerPerkStats creation: Gas fees will be paid by ${sponsorAddress}`);
  }

  console.log('🔨 Building create PartnerPerkStatsV2 transaction for partner cap:', partnerCapId);
  
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::perk_manager::create_partner_perk_stats_v2`,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.u64(dailyQuotaLimit),
    ],
  });

  return tx;
};

/**
 * Checks partner quota status
 */
export const checkPartnerQuotaStatus = async (
  suiClient: any,
  partnerCapId: string
): Promise<{
  statsId?: string;
  dailyQuotaLimit?: number;
  dailyPointsMinted?: number;
  remainingQuota?: number;
  totalPointsMinted?: number;
  totalPerksClaimedToday?: number;
  currentEpoch?: number;
  lastResetEpoch?: number;
  needsEpochReset?: boolean;
  error?: string;
}> => {
  try {
    console.log('🔍 Checking partner quota status for:', partnerCapId);

    const statsId = await findPartnerStatsId(suiClient, partnerCapId);

    if (!statsId) {
      return { 
        error: 'No PartnerPerkStatsV2 found for this partner.'
      };
    }

    const statsObject = await suiClient.getObject({
      id: statsId,
      options: { showContent: true }
    });

    if (!statsObject?.data?.content?.fields) {
      return { error: 'Could not read PartnerPerkStatsV2 object content' };
    }

    const fields = statsObject.data.content.fields;
    
    return {
      statsId,
      dailyQuotaLimit: parseInt(fields.daily_quota_limit || '0'),
      dailyPointsMinted: parseInt(fields.daily_points_minted || '0'),
      remainingQuota: parseInt(fields.daily_quota_limit || '0') - parseInt(fields.daily_points_minted || '0'),
      totalPointsMinted: parseInt(fields.total_points_minted || '0'),
      totalPerksClaimedToday: parseInt(fields.total_perks_claimed_today || '0'),
      currentEpoch: parseInt(fields.current_epoch || '0'),
      lastResetEpoch: parseInt(fields.last_reset_epoch || '0'),
      needsEpochReset: parseInt(fields.current_epoch || '0') > parseInt(fields.last_reset_epoch || '0')
    };

  } catch (error: any) {
    console.error('❌ Error checking partner quota status:', error);
    return { 
      error: `Failed to check quota status: ${error.message || 'Unknown error'}`
    };
  }
};

// =======================
// PERK MANAGEMENT
// =======================

/**
 * Builds a transaction to create a new perk definition
 */
export const buildCreatePerkDefinitionTransaction = (
  partnerCapId: string,
  name: string,
  description: string,
  perkType: string,
  tags: string[],
  usdcPriceCents: number,
  partnerSharePercentage: number = 80,
  icon: string = '🎁',
  expiryTimestamp: number = 0,
  maxUsesPerClaim: number = 0,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored perk creation: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::perk_manager::create_perk_definition_fixed`,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.string(name),
      tx.pure.string(description),
      tx.pure.string(perkType),
      tx.pure.u64(usdcPriceCents.toString()),
      tx.pure.u8(partnerSharePercentage),
      tx.pure(bcs.option(bcs.u64()).serialize(maxUsesPerClaim > 0 ? maxUsesPerClaim : null)),
      tx.pure(bcs.option(bcs.u64()).serialize(expiryTimestamp > 0 ? expiryTimestamp : null)),
      tx.pure.bool(false), // generates_unique_claim_metadata
      tx.pure(bcs.vector(bcs.String).serialize(tags)),
      tx.pure(bcs.option(bcs.u64()).serialize(null)), // max_claims
      tx.pure(bcs.vector(bcs.String).serialize([])), // metadata_keys
      tx.pure(bcs.vector(bcs.String).serialize([])), // metadata_values
      tx.pure.bool(true), // is_active
      tx.object(CLOCK_ID)
    ],
  });

  return tx;
};

/**
 * Builds a transaction to create a perk definition with custom metadata
 */
export const buildCreatePerkDefinitionWithMetadataTransaction = (
  partnerCapId: string,
  name: string,
  description: string,
  perkType: string,
  tags: string[],
  usdcPrice: number,
  partnerSharePercentage: number = 80,
  icon: string = '🎁',
  expiryTimestamp: number = 0,
  maxUsesPerClaim: number = 0,
  metadataKeys: string[] = [],
  metadataValues: string[] = [],
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored perk creation with metadata: Gas fees will be paid by ${sponsorAddress}`);
  }

  // Validate metadata arrays have same length
  if (metadataKeys.length !== metadataValues.length) {
    throw new Error(`Metadata keys (${metadataKeys.length}) and values (${metadataValues.length}) arrays must have the same length`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::perk_manager::create_perk_definition_fixed`,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.string(name),
      tx.pure.string(description),
      tx.pure.string(perkType),
      tx.pure.u64(usdcPrice.toString()),
      tx.pure.u8(partnerSharePercentage),
      tx.pure(bcs.option(bcs.u64()).serialize(maxUsesPerClaim > 0 ? maxUsesPerClaim : null)),
      tx.pure(bcs.option(bcs.u64()).serialize(expiryTimestamp > 0 ? expiryTimestamp : null)),
      tx.pure.bool(false), // generates_unique_claim_metadata
      tx.pure(bcs.vector(bcs.String).serialize(tags)),
      tx.pure(bcs.option(bcs.u64()).serialize(null)), // max_claims
      tx.pure(bcs.vector(bcs.String).serialize(metadataKeys)),
      tx.pure(bcs.vector(bcs.String).serialize(metadataValues)),
      tx.pure.bool(true), // is_active
      tx.object(CLOCK_ID)
    ],
  });

  return tx;
};

/**
 * Builds a transaction for setting a perk's active status
 * This allows partners to enable or disable their perks
 * 
 * @param partnerCapId Partner Cap ID that owns the perk
 * @param perkDefinitionId Perk definition ID to update
 * @param isActive Whether the perk should be active or inactive
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildSetPerkActiveStatusTransaction = (
  partnerCapId: string,
  perkDefinitionId: string,
  isActive: boolean,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored perk status update: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::perk_manager::set_perk_definition_active_status`,
    arguments: [
      tx.object(partnerCapId), // First argument: partner_cap
      tx.object(perkDefinitionId), // Second argument: perk_definition
      tx.pure.bool(isActive) // Third argument: is_active
    ],
  });

  return tx;
};

/**
 * Builds a transaction for updating perk control settings
 * This updates various settings for a partner's perk management
 * 
 * @param partnerCapId Partner Cap ID to update settings for
 * @param settings Object containing the settings to update
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildUpdatePerkControlSettingsTransaction = (
  partnerCapId: string,
  settings: {
    maxCostPerPerkCents?: number;
    requiresMetadata?: boolean;
    metadataFields?: string[];
    salt?: string;
  },
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored settings update: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::update_perk_control_settings`,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.u64((settings.maxCostPerPerkCents || 0).toString()),
      tx.pure.bool(settings.requiresMetadata || false),
      tx.pure(bcs.vector(bcs.String).serialize(settings.metadataFields || [])),
      tx.pure.string(settings.salt || '')
    ],
  });

  return tx;
};

/**
 * Builds a transaction for updating partner perk type allowlists/blocklists
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param allowedPerkTypes Array of allowed perk type strings
 * @param blacklistedPerkTypes Array of blacklisted perk type strings
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildUpdatePerkTypeListsTransaction = (
  partnerCapFlexId: string,
  allowedPerkTypes: string[],
  blacklistedPerkTypes: string[],
  sponsorAddress?: string
) => {
  if (!PACKAGE_ID) {
    throw new Error("PACKAGE_ID not configured");
  }

  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored transaction: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::update_perk_type_lists_entry`,
    arguments: [
      tx.object(partnerCapFlexId),
      tx.pure(bcs.vector(bcs.String).serialize(allowedPerkTypes)),
      tx.pure(bcs.vector(bcs.String).serialize(blacklistedPerkTypes)),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for updating partner perk tag allowlists/blocklists
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param allowedTags Array of allowed tag strings
 * @param blacklistedTags Array of blacklisted tag strings
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildUpdatePerkTagListsTransaction = (
  partnerCapFlexId: string,
  allowedTags: string[],
  blacklistedTags: string[],
  sponsorAddress?: string
) => {
  if (!PACKAGE_ID) {
    throw new Error("PACKAGE_ID not configured");
  }

  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored transaction: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::update_perk_tag_lists_entry`,
    arguments: [
      tx.object(partnerCapFlexId),
      tx.pure(bcs.vector(bcs.String).serialize(allowedTags)),
      tx.pure(bcs.vector(bcs.String).serialize(blacklistedTags)),
    ],
  });

  return tx;
};

// =======================
// GENERATION MANAGEMENT
// =======================

/**
 * Builds a transaction to create an embedded generation
 */
export const buildCreateEmbeddedGenerationTransaction = (
  partnerCapId: string,
  registryId: string,
  name: string,
  description: string,
  category: string,
  walrusBlobId: string,
  codeHash: string,
  templateType: string,
  quotaCostPerExecution: number,
  maxExecutionsPerUser?: number,
  maxTotalExecutions?: number,
  expirationTimestamp?: number,
  tags: string[] = [],
  icon?: string,
  estimatedCompletionMinutes?: number,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored generation creation: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::generation_manager::create_embedded_generation`,
    arguments: [
      tx.object(partnerCapId),
      tx.object(registryId),
      tx.pure.string(name),
      tx.pure.string(description),
      tx.pure.string(category),
      tx.pure.string(walrusBlobId),
      tx.pure.string(codeHash),
      tx.pure.string(templateType),
      tx.pure.u64(quotaCostPerExecution),
      tx.pure.option("u64", maxExecutionsPerUser ? maxExecutionsPerUser.toString() : null),
      tx.pure.option("u64", maxTotalExecutions ? maxTotalExecutions.toString() : null),
      tx.pure.option("u64", expirationTimestamp ? expirationTimestamp.toString() : null),
      tx.pure(bcs.vector(bcs.string()).serialize(tags)),
      tx.pure.option("string", icon || null),
      tx.pure.option("u64", estimatedCompletionMinutes ? estimatedCompletionMinutes.toString() : null),
    ],
  });

  return tx;
};

/**
 * Builds a transaction to create an external generation
 */
export const buildCreateExternalGenerationTransaction = (
  partnerCapId: string,
  registryId: string,
  name: string,
  description: string,
  category: string,
  targetUrl: string,
  redirectType: string,
  returnCallbackUrl: string | null,
  requiresAuthentication: boolean,
  quotaCostPerExecution: number,
  maxExecutionsPerUser?: number,
  maxTotalExecutions?: number,
  expirationTimestamp?: number,
  tags: string[] = [],
  icon?: string,
  estimatedCompletionMinutes?: number,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored external generation creation: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::generation_manager::create_external_generation`,
    arguments: [
      tx.object(partnerCapId),
      tx.object(registryId),
      tx.pure.string(name),
      tx.pure.string(description),
      tx.pure.string(category),
      tx.pure.string(targetUrl),
      tx.pure.string(redirectType),
      tx.pure.option("string", returnCallbackUrl),
      tx.pure.bool(requiresAuthentication),
      tx.pure.u64(quotaCostPerExecution),
      tx.pure.option("u64", maxExecutionsPerUser ? maxExecutionsPerUser.toString() : null),
      tx.pure.option("u64", maxTotalExecutions ? maxTotalExecutions.toString() : null),
      tx.pure.option("u64", expirationTimestamp ? expirationTimestamp.toString() : null),
      tx.pure(bcs.vector(bcs.string()).serialize(tags)),
      tx.pure.option("string", icon || null),
      tx.pure.option("u64", estimatedCompletionMinutes ? estimatedCompletionMinutes.toString() : null),
    ],
  });

  return tx;
};

/**
 * Builds a transaction to set generation active status
 */
export const buildSetGenerationActiveStatusTransaction = (
  generationId: string,
  partnerCapId: string,
  isActive: boolean,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored generation status update: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::generation_manager::set_generation_active_status`,
    arguments: [
      tx.object(generationId),
      tx.object(partnerCapId),
      tx.pure.bool(isActive),
    ],
  });

  return tx;
};

// =======================
// UTILITY FUNCTIONS
// =======================

/**
 * Calculate expected partner share
 */
export const calculateExpectedPartnerShare = (
  perkCostAlphaPoints: number,
  partnerSharePercentage: number = 80
): number => {
  return Math.floor(perkCostAlphaPoints * (partnerSharePercentage / 100));
};

/**
 * Find generation registry
 */
export const findGenerationRegistry = async (suiClient: any): Promise<string> => {
  try {
    const eventsResponse = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::generation_manager::GenerationRegistryCreated`
      },
      limit: 1,
      order: 'descending'
    });

    if (eventsResponse.data.length > 0) {
      const registryId = eventsResponse.data[0].parsedJson?.registry_id;
      if (registryId) {
        console.log('✅ Found Generation Registry:', registryId);
        return registryId;
      }
    }

    throw new Error('Generation Registry not found');
  } catch (error) {
    console.error('❌ Error finding Generation Registry:', error);
    throw error;
  }
};

/**
 * Get generation registry ID with caching
 */
export const getGenerationRegistryId = async (suiClient: any): Promise<string> => {
  return await findGenerationRegistry(suiClient);
};

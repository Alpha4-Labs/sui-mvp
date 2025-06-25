/**
 * Transaction builder utilities for Alpha Points operations
 * Updated with proper BCS serialization for Sui SDK v1.0+
 * Adjusted for two-transaction native staking flow.
 * Now includes TVL-backed PartnerCapFlex system functions
 */

import { Transaction, TransactionArgument, TransactionObjectArgument } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID, PACKAGE_ID_V4, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';

// Add commonly used shared object IDs for easier access
const LEDGER_ID = SHARED_OBJECTS.ledger;
import { SuinsClient, SuinsTransaction } from '@mysten/suins'; // Import actual SuiNS SDK components
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



// VITE_SUINS_PARENT_NFT_ID should be the OBJECT ID of your registered parent *.sui name NFT
const VITE_SUINS_PARENT_OBJECT_ID = import.meta.env['VITE_SUINS_PARENT_OBJECT_ID']; // Renamed for clarity
// Add parent domain string (e.g., "alpha4.sui")
const VITE_SUINS_PARENT_DOMAIN_NAME = import.meta.env['VITE_SUINS_PARENT_DOMAIN_NAME'] || '';

// Define constant for Sui System State Object ID
const SUI_SYSTEM_STATE_ID = '0x5';

/**
 * Transaction 1: Builds a transaction to request adding stake to the Sui system.
 * This transaction, when executed, will result in a StakedSui object being
 * transferred to the sender.
 * 
 * @param amount Amount in MIST (SUI * 10^9)
 * @param validatorAddress Validator's address
 * @returns Transaction object ready for execution
 */
export const buildRequestAddStakeTransaction = (
  amount: bigint,
  validatorAddress: string
) => {
  const tx = new Transaction();
  
  // Create the coin for staking by splitting from tx.gas
  const stakeCoin = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  
  // 2. Request to add stake to a validator
  // This transfers the resulting StakedSui object to the sender.
  tx.moveCall({
    target: `0x3::sui_system::request_add_stake`, // Use 0x3 for sui_system module
    arguments: [
      tx.object(SUI_SYSTEM_STATE_ID), // SuiSystemState object ID
      stakeCoin,                    // The Coin<SUI> to stake (split from gas)
      tx.pure.address(validatorAddress)     // Validator's address, using tx.pure.address() helper
    ]
  });
  
  // Note: The StakedSui object is NOT returned as a result usable in the same PTB.
  // The user needs to find this object in their account after executing this transaction.
  return tx;
};

/**
 * Transaction 2: Builds a transaction to register a StakedSui object with our protocol
 * and receive a StakePosition NFT.
 * 
 * @param stakedSuiObjectId The Object ID of the StakedSui object obtained from Transaction 1.
 * @param durationDays The desired staking duration in days.
 * @returns Transaction object ready for execution
 */
export const buildRegisterStakeTransaction = (
  stakedSuiObjectId: string,
  durationDays: number
) => {
  const tx = new Transaction();

  // Call the integration module's function, passing the StakedSui object by ID.
  // The function expects the object itself, so we pass the object ID as an argument.
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::route_stake_sui`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.stakingManager),
      tx.object(CLOCK_ID),
      tx.object(stakedSuiObjectId),
      tx.pure.u64(BigInt(durationDays)),
      tx.pure(bcs.option(bcs.Address).serialize(null))
    ]
  });
  
  return tx;
};

/**
 * Builds a transaction for unstaking a position
 * 
 * @param stakeId Object ID of the stake position
 * @returns Transaction object ready for execution
 */
export const buildUnstakeTransaction = (
  stakeId: string
) => {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::request_unstake_native_sui`,
    arguments: [
      tx.object(SHARED_OBJECTS.stakingManager), // Arg0
      tx.object(SHARED_OBJECTS.config),         // Arg1
      tx.object(SUI_SYSTEM_STATE_ID),           // Arg2
      tx.object(stakeId),                       // Arg3
      tx.object(CLOCK_ID),                      // Arg4 - Added Clock
      tx.object(SHARED_OBJECTS.ledger)          // Arg5 - Added Ledger
    ]
  });
  
  return tx;
};

/**
 * Builds a transaction for converting a mature stake to Alpha Points
 * User gets Alpha Points equal to their stake value (1 SUI = 3,280 αP) 
 * Also receives a SUI withdrawal ticket that can be claimed after cooldown
 * Note: Stake must be mature (reached unlock time) and not encumbered
 * 
 * @param stakeId Object ID of the mature stake position
 * @returns Transaction object ready for execution
 */
export const buildEarlyUnstakeTransaction = (
  stakeId: string
) => {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::liquid_unstake_as_loan_native_sui_v2`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),        // Config
      tx.object(SHARED_OBJECTS.loanConfig),    // LoanConfig
      tx.object(SHARED_OBJECTS.ledger),        // Ledger for minting Alpha Points
      tx.object(stakeId),                      // StakePosition to convert
      tx.object(CLOCK_ID),                     // Clock for timestamp
      tx.object(SHARED_OBJECTS.stakingManager), // StakingManager
      tx.object('0x5')                         // SuiSystemState
    ]
  });
  
  return tx;
};

/**
 * Builds a transaction for redeeming Alpha Points for SUI
 * 
 * @param pointsAmount Amount of Alpha Points to redeem
 * @returns Transaction object ready for execution
 */
export const buildRedeemPointsTransaction = (pointsToRedeem: string): Transaction => {
  if (!PACKAGE_ID || !SHARED_OBJECTS.ledger) {
    throw new Error("Alpha Points package or ledger ID is not configured.");
  }
  const tx = new Transaction();
  tx.moveCall({
    // Assuming redeem_points_for_sui is in the integration module for consistency
    target: `${PACKAGE_ID}::integration::redeem_points_for_sui`,
    arguments: [
      tx.object(SHARED_OBJECTS.config), // Config might be needed
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.escrowVault), // EscrowVault<SUI> is needed
      tx.object(SHARED_OBJECTS.oracle), // Oracle might be needed
      tx.pure.u64(BigInt(pointsToRedeem)),
      tx.object(CLOCK_ID) // Clock is often needed
    ],
  });
  return tx;
};

/**
 * Builds a transaction for reclaiming principal SUI from a matured early-withdrawn stake
 * User returns the Alpha Points they received during early withdrawal to get their principal SUI back
 * 
 * @param stakeId Object ID of the matured early-withdrawn stake position
 * @param alphaPointsToReturn Amount of Alpha Points to return (should match what was received during early withdrawal)
 * @returns Transaction object ready for execution
 */
export const buildReclaimPrincipalTransaction = (
  stakeId: string,
  alphaPointsToReturn: string
) => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::reclaim_principal_from_matured_early_withdrawal`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(stakeId),
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.u64(BigInt(alphaPointsToReturn)),
      tx.object(CLOCK_ID)
    ]
  });
  return tx;
};

/**
 * Builds a transaction for creating a loan against a staked position
 * 
 * @param stakeId Object ID of the stake position to use as collateral
 * @param pointsAmount Amount of Alpha Points to borrow
 * @returns Transaction object ready for execution
 */
export const buildCreateLoanTransaction = (
  stakeId: string,
  pointsAmount: number
) => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::loan::open_loan`,
    typeArguments: ['0x3::staking_pool::StakedSui'],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.loanConfig),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(stakeId),
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.u64(BigInt(pointsAmount)),
      tx.object(CLOCK_ID)
    ]
  });
  return tx;
};

/**
 * Builds a transaction for repaying a loan
 * 
 * @param loanId Object ID of the loan
 * @param stakeId Object ID of the stake position used as collateral
 * @param pointsToRepay Amount of points to repay for the loan principal
 * @returns Transaction object ready for execution
 */
export const buildRepayLoanTransaction = (
  loanId: string,
  stakeId: string,
  pointsToRepay: string | bigint
) => {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::loan::repay_loan`,
    typeArguments: ['0x3::staking_pool::StakedSui'],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(loanId),
      tx.object(stakeId),
      tx.pure.u64(BigInt(pointsToRepay))
    ]
  });
  
  return tx;
};

/**
 * @deprecated This function calls the old purchase_marketplace_perk transaction which includes 
 * deprecated SuiNS subname creation logic. Use buildClaimPerkWithMetadataTransaction instead.
 */
export const buildPurchaseAlphaPerkTransaction = (
  amount: number, 
  partnerCapId: string, 
  perkId: string, 
  uniqueCode: string, 
  userAddress: string,
  suinsClientInstance: SuinsClient // Use the actual SuinsClient type
): never => {
  throw new Error("❌ DEPRECATED: buildPurchaseAlphaPerkTransaction is no longer supported. Use buildClaimPerkWithMetadataTransaction instead for metadata-based perks.");
};

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
 * 
 * @param partnerName Name of the partner
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerCapTransaction = (
  partnerName: string
): Transaction => {
  const tx = new Transaction();

  // Call the legacy PartnerCap creation function
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
 * This is the advanced V2 partner system with flexible collateral management
 * 
 * @param partnerName Name of the partner
 * @param suiAmountMist Amount of SUI collateral in MIST (1 SUI = 1,000,000,000 MIST)
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerCapFlexTransaction = (
  partnerName: string,
  suiAmountMist: bigint
): Transaction => {
  const tx = new Transaction();

  // Split SUI from gas coin for collateral
  const [collateralCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(suiAmountMist.toString())]);

  // Call the new PartnerCapFlex creation function
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
 * This allows partners to use USDC instead of SUI for their collateral requirements
 * 
 * @param partnerName Name of the partner
 * @param usdcCoinId Object ID of the USDC coin to use as collateral
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerCapFlexWithUSDCTransaction = (
  partnerName: string,
  usdcCoinId: string
): Transaction => {
  const tx = new Transaction();

  // Call the USDC collateral PartnerCapFlex creation function
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
 * This allows partners to use valuable NFTs as collateral for their partnership
 * 
 * @param partnerName Name of the partner
 * @param kioskId Object ID of the kiosk containing the NFT
 * @param collectionType Type identifier for the NFT collection
 * @param estimatedFloorValueUsdc Estimated floor value of the NFT in USDC cents
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerCapFlexWithNFTTransaction = (
  partnerName: string,
  kioskId: string,
  collectionType: string,
  estimatedFloorValueUsdc: number
): Transaction => {
  const tx = new Transaction();

  // Call the NFT collateral PartnerCapFlex creation function
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
 * Builds a transaction for creating a TVL-backed PartnerCapFlex with collateral
 * This is the new recommended way to create partner capabilities
 * 
 * @param partnerName Partner name string
 * @param suiAmountMist Amount of SUI to lock as collateral (in MIST)
 * @param sponsorAddress Optional sponsor address to pay for gas fees (typically deployer/admin)
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerCapFlexTransactionSponsored = (
  partnerName: string,
  suiAmountMist: bigint,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored PartnerCapFlex creation: Gas fees will be paid by ${sponsorAddress}`);
  }

  // Split SUI from gas coin for collateral
  const [collateralCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(suiAmountMist.toString())]);

  // Call the new PartnerCapFlex creation function
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
 * Builds a consolidated transaction for updating all perk settings at once
 * This replaces the need for separate calls to update control settings, perk types, and tags
 * 
 * @param partnerCapId Partner Cap ID to update settings for
 * @param settings Object containing all the settings to update
 * @param allowedPerkTypes Array of allowed perk types
 * @param allowedTags Array of allowed tags
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
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

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored settings update: Gas fees will be paid by ${sponsorAddress}`);
  }

  // 1. Update perk control settings
  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::update_perk_control_settings_v2_entry`,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.u64(settings.maxPerksPerPartner || 100),
      tx.pure.u64(settings.maxClaimsPerPerk || 1000),
      tx.pure.u64(Math.floor((settings.maxCostPerPerkUsd || 100) * 100)), // FIXED: Convert USD to cents, not micro-USDC
      tx.pure.u8(settings.minPartnerSharePercentage || 50),
      tx.pure.u8(settings.maxPartnerSharePercentage || 90),
      tx.pure.bool(settings.allowConsumablePerks || true),
      tx.pure.bool(settings.allowExpiringPerks || true),
      tx.pure.bool(settings.allowUniqueMetadata || true)
    ],
  });

  // 2. Update perk type lists
  if (allowedPerkTypes.length > 0) {
    tx.moveCall({
      target: `${PACKAGE_ID}::partner_flex::update_perk_type_lists_entry`,
      arguments: [
        tx.object(partnerCapId),
        tx.pure(bcs.vector(bcs.String).serialize(allowedPerkTypes)),
        tx.pure(bcs.vector(bcs.String).serialize([])) // No blacklisted types
      ],
    });
  }

  // 3. Update perk tag lists
  if (allowedTags.length > 0) {
    tx.moveCall({
      target: `${PACKAGE_ID}::partner_flex::update_perk_tag_lists_entry`,
      arguments: [
        tx.object(partnerCapId),
        tx.pure(bcs.vector(bcs.String).serialize(allowedTags)),
        tx.pure(bcs.vector(bcs.String).serialize([])) // No blacklisted tags
      ],
    });
  }

  return tx;
};

/**
 * Builds a transaction for adding SUI collateral to a partner's vault
 * 
 * @param partnerCapId Partner Cap ID to add collateral for
 * @param suiAmountMist Amount of SUI to add in MIST
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildAddSuiCollateralTransaction = (
  partnerCapId: string,
  suiAmountMist: bigint,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored SUI collateral addition: Gas fees will be paid by ${sponsorAddress}`);
  }

  // Split SUI from gas coin for collateral
  const [collateralCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(suiAmountMist.toString())]);

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::add_sui_collateral`,
    arguments: [
      tx.object(partnerCapId),
      collateralCoin,
      tx.object(SHARED_OBJECTS.oracle)
    ],
  });

  return tx;
};

/**
 * Builds a transaction for creating an initial SUI vault for a partner
 * 
 * @param partnerCapId Partner Cap ID to create vault for
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildCreateInitialSuiVaultTransaction = (
  partnerCapId: string,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
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
 * Builds a transaction for adding USDC collateral to a partner's vault
 * 
 * @param partnerCapId Partner Cap ID to add collateral for
 * @param usdcCoinId USDC coin object ID to use as collateral
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildAddUsdcCollateralTransaction = (
  partnerCapId: string,
  usdcCoinId: string,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
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
 * Builds a transaction for adding NFT collateral to a partner's vault
 * 
 * @param partnerCapId Partner Cap ID to add collateral for
 * @param kioskId Kiosk object ID containing the NFT
 * @param nftId NFT object ID
 * @param estimatedValueCents Estimated value of the NFT in USDC cents
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildAddNftCollateralTransaction = (
  partnerCapId: string,
  kioskId: string,
  nftId: string,
  estimatedValueCents: number,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
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
 * Builds a transaction for withdrawing collateral from a partner's vault
 * 
 * @param partnerCapId Partner Cap ID to withdraw collateral from
 * @param withdrawAmountMist Amount to withdraw in MIST (for SUI) or base units
 * @param collateralType Type of collateral to withdraw ('sui', 'usdc', 'nft')
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildWithdrawCollateralTransaction = (
  partnerCapId: string,
  withdrawAmountMist: bigint,
  collateralType: 'sui' | 'usdc' | 'nft' = 'sui',
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored collateral withdrawal: Gas fees will be paid by ${sponsorAddress}`);
  }

  const targetFunction = collateralType === 'sui' ? 'withdraw_sui_collateral' :
                       collateralType === 'usdc' ? 'withdraw_usdc_collateral' :
                       'withdraw_nft_collateral';

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::${targetFunction}`,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.u64(withdrawAmountMist.toString()),
      tx.object(SHARED_OBJECTS.oracle)
    ],
  });

  return tx;
};

// === CROSS-PACKAGE RECOVERY FUNCTIONS ===
// Functions to interact with cross-package recovery for old package stakes

/**
 * Build transaction to rescue a single stake from old package using AdminCap
 */
export function buildRescueSingleStakeTransaction(
  oldAdminCapId: string,
  oldPackageId: string,
  rescuedStakeOwner: string,
  rescuedStakeId: string,
  rescuedPrincipalMist: string,
  rescuedDurationDays: number,
  rescuedStartTimeMs: string
) {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::rescue_stake_from_old_package`,
    typeArguments: [
      `${oldPackageId}::admin::AdminCap` // AdminCap type from old package
    ],
    arguments: [
      tx.object(oldAdminCapId), // old_admin_cap
      tx.object(SHARED_OBJECTS.config), // new_config
      tx.object(SHARED_OBJECTS.ledger), // new_ledger
      tx.pure.address(oldPackageId), // old_package_id
      tx.pure.address(rescuedStakeOwner), // rescued_stake_owner
      tx.pure.id(rescuedStakeId), // rescued_stake_id
      tx.pure.u64(rescuedPrincipalMist), // rescued_principal_mist
      tx.pure.u64(rescuedDurationDays), // rescued_duration_days
      tx.pure.u64(rescuedStartTimeMs), // rescued_start_time_ms
      tx.object(CLOCK_ID), // clock
    ],
  });
  
  return tx;
}

/**
 * Build transaction to batch rescue multiple stakes from old package
 */
export function buildRescueBatchStakesTransaction(
  oldAdminCapId: string,
  oldPackageId: string,
  rescuedStakeOwners: string[],
  rescuedStakeIds: string[],
  rescuedPrincipalsMist: string[],
  rescuedDurationsDays: number[],
  rescuedStartTimesMs: string[]
) {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::rescue_batch_stakes_from_old_package`,
    typeArguments: [
      `${oldPackageId}::admin::AdminCap`
    ],
    arguments: [
      tx.object(oldAdminCapId), // old_admin_cap
      tx.object(SHARED_OBJECTS.config), // new_config
      tx.object(SHARED_OBJECTS.ledger), // new_ledger
      tx.pure.address(oldPackageId), // old_package_id
      tx.pure.vector('address', rescuedStakeOwners), // rescued_stake_owners
      tx.pure.vector('id', rescuedStakeIds), // rescued_stake_ids
      tx.pure.vector('u64', rescuedPrincipalsMist), // rescued_principals_mist
      tx.pure.vector('u64', rescuedDurationsDays), // rescued_durations_days
      tx.pure.vector('u64', rescuedStartTimesMs), // rescued_start_times_ms
      tx.object(CLOCK_ID), // clock
    ],
  });
  
  return tx;
}

/**
 * Build transaction to unencumber a stake in the old package
 */
export function buildOldPackageUnencumberStakeTransaction(
  oldAdminCapId: string,
  oldPackageId: string,
  stakeOwner: string,
  stakeId: string
) {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::old_package_admin_unencumber_stake`,
    typeArguments: [
      `${oldPackageId}::admin::AdminCap`
    ],
    arguments: [
      tx.object(oldAdminCapId), // old_admin_cap
      tx.pure.address(oldPackageId), // old_package_id
      tx.pure.address(stakeOwner), // stake_owner
      tx.pure.id(stakeId), // stake_id
      tx.object(CLOCK_ID), // clock
    ],
  });
  
  return tx;
}

/**
 * Build transaction to initiate validator withdrawal for old package native stakes
 */
export function buildOldPackageValidatorWithdrawalTransaction(
  oldAdminCapId: string,
  oldPackageId: string,
  stakeOwner: string,
  nativeStakeId: string,
  validatorAddress: string
) {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::old_package_initiate_validator_withdrawal`,
    typeArguments: [
      `${oldPackageId}::admin::AdminCap`
    ],
    arguments: [
      tx.object(oldAdminCapId), // old_admin_cap
      tx.object(SUI_SYSTEM_STATE_ID), // sui_system_state
      tx.pure.address(oldPackageId), // old_package_id
      tx.pure.address(stakeOwner), // stake_owner
      tx.pure.id(nativeStakeId), // native_stake_id
      tx.pure.address(validatorAddress), // validator_address
      tx.object(CLOCK_ID), // clock
    ],
  });
  
  return tx;
}

/**
 * Build transaction to verify old package admin access
 */
export function buildVerifyOldPackageAdminAccessTransaction(
  oldAdminCapId: string,
  oldPackageId: string
) {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::verify_old_package_admin_access`,
    typeArguments: [
      `${oldPackageId}::admin::AdminCap`
    ],
    arguments: [
      tx.object(oldAdminCapId), // old_admin_cap
      tx.pure.address(oldPackageId), // old_package_id
    ],
  });
  
  return tx;
}

/**
 * Build transaction for self-service migration of user's own old package stake (no admin required)
 * Converts old wrapped withdrawal tickets to current package format with no data loss
 * Requires the old packages to be upgraded with extraction functions first
 * 
 * @param oldStakeObjectId Object ID of the old package stake position to migrate
 * @param oldPackageId Address of the old package containing the stake
 * @returns Transaction object ready for execution
 */
export function buildSelfServiceMigrateStakeTransaction(
  oldStakeObjectId: string,
  oldPackageId: string
) {
  // Determine which specific migration function to use based on package ID
  const tx = new Transaction();
  
  if (oldPackageId === '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf') {
    tx.moveCall({
      target: `${PACKAGE_ID}::integration::self_service_migrate_stake_db62a7c`,
      arguments: [
        tx.object(SHARED_OBJECTS.config), // config
        tx.object(SHARED_OBJECTS.stakingManager), // manager
        tx.object(SUI_SYSTEM_STATE_ID), // sui_system_state
        tx.object(SHARED_OBJECTS.ledger), // ledger
        tx.object(oldStakeObjectId), // old_stake_position
        tx.object(CLOCK_ID), // clock
      ],
    });
  } else if (oldPackageId === '0xbae3eef628211af44c386e621142118bdee8825b059e0514bf3729638109cd3a') {
    tx.moveCall({
      target: `${PACKAGE_ID}::integration::self_service_migrate_stake_bae3eef`,
      arguments: [
        tx.object(SHARED_OBJECTS.config), // config
        tx.object(SHARED_OBJECTS.stakingManager), // manager
        tx.object(SUI_SYSTEM_STATE_ID), // sui_system_state
        tx.object(SHARED_OBJECTS.ledger), // ledger
        tx.object(oldStakeObjectId), // old_stake_position
        tx.object(CLOCK_ID), // clock
      ],
    });
  } else {
    throw new Error(
      `Self-service migration not supported for package ${oldPackageId}. ` +
      `Supported packages: 0xdb62a7c..., 0xbae3eef... ` +
      `Note: This requires the old packages to be upgraded with extraction functions first.`
    );
  }
  
  return tx;
}

/**
 * Build transaction for self-service batch migration of multiple old package stakes (no admin required)
 * Currently not implementable due to Move package upgrade constraints
 * 
 * @param oldStakeObjectIds Array of object IDs of old package stakes to migrate
 * @param oldPackageId Address of the old package containing the stakes
 * @returns Transaction object ready for execution
 */
export function buildSelfServiceBatchMigrateStakesTransaction(
  oldStakeObjectIds: string[],
  oldPackageId: string
) {
  const tx = new Transaction();
  
  // Convert object IDs to transaction objects
  const oldStakeObjects = oldStakeObjectIds.map(id => tx.object(id));
  
  if (oldPackageId === '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf') {
    tx.moveCall({
      target: `${PACKAGE_ID}::integration::self_service_batch_migrate_stakes_db62a7c`,
      arguments: [
        tx.object(SHARED_OBJECTS.config), // config
        tx.object(SHARED_OBJECTS.stakingManager), // manager
        tx.object(SUI_SYSTEM_STATE_ID), // sui_system_state
        tx.object(SHARED_OBJECTS.ledger), // ledger
        tx.makeMoveVec({ elements: oldStakeObjects }), // old_stake_positions vector
        tx.object(CLOCK_ID), // clock
      ],
    });
  } else if (oldPackageId === '0xbae3eef628211af44c386e621142118bdee8825b059e0514bf3729638109cd3a') {
    tx.moveCall({
      target: `${PACKAGE_ID}::integration::self_service_batch_migrate_stakes_bae3eef`,
      arguments: [
        tx.object(SHARED_OBJECTS.config), // config
        tx.object(SHARED_OBJECTS.stakingManager), // manager
        tx.object(SUI_SYSTEM_STATE_ID), // sui_system_state
        tx.object(SHARED_OBJECTS.ledger), // ledger
        tx.makeMoveVec({ elements: oldStakeObjects }), // old_stake_positions vector
        tx.object(CLOCK_ID), // clock
      ],
    });
  } else {
    throw new Error(
      `Self-service batch migration not supported for package ${oldPackageId}. ` +
      `Supported packages: 0xdb62a7c..., 0xbae3eef... ` +
      `Note: These functions are currently not implementable due to Move package upgrade constraints. ` +
      `Users should use the old package's own unstaking functions instead.`
    );
  }
  
  return tx;
}

// === HELPER FUNCTIONS FOR CROSS-PACKAGE RECOVERY ===

/**
 * Convert SUI amount to Alpha Points using 1:1000 USD ratio (1 SUI = 3,280 αP)
 */
export function convertSuiToAlphaPoints(suiAmount: string): string {
  const suiAmountBN = BigInt(suiAmount);
  const suiPriceUsdMilli = BigInt(3280); // 3.28 USD * 1000
  const suiToMistConversion = BigInt(1_000_000_000);
  
  // Formula: (suiAmount * 3,280) / 1,000,000,000
  const alphaPoints = (suiAmountBN * suiPriceUsdMilli) / suiToMistConversion;
  return alphaPoints.toString();
}

/**
 * Get current timestamp in milliseconds
 */
export function getCurrentTimestampMs(): string {
  return Date.now().toString();
}

/**
 * Calculate Alpha Points that would be minted for a given SUI stake amount
 */
export function calculateRecoveryAlphaPoints(principalMist: string): string {
  return convertSuiToAlphaPoints(principalMist);
}

/**
 * ENHANCED SAFE: Creates a PartnerPerkStatsV2 object only if one doesn't already exist
 * This prevents duplicate creation by checking for existing stats first
 * Used by the Partner Dashboard to safely create stats objects
 * 
 * @param suiClient SUI client instance for querying the blockchain
 * @param partnerCapId Partner Cap ID to create stats for
 * @param dailyQuotaLimit Daily quota limit for the partner
 * @returns Object containing transaction (if needed) and existence status
 */
export const buildCreatePartnerStatsIfNotExistsTransaction = async (
  suiClient: any,
  partnerCapId: string,
  dailyQuotaLimit: number = 10000
): Promise<{ transaction: Transaction | null; alreadyExists: boolean; existingStatsId?: string; duplicateCount?: number }> => {
  try {
    console.log('🔍 Checking for existing PartnerPerkStatsV2 before creation...');
    
    // First check if stats already exist - this prevents duplicate creation
    const existingStatsId = await findPartnerStatsId(suiClient, partnerCapId);
    
    console.log('⚠️ DUPLICATE PREVENTION: PartnerPerkStatsV2 already exists for this partner cap:', existingStatsId);
    console.log('⚠️ Skipping creation to prevent duplicate objects');
    
    return { 
      transaction: null, 
      alreadyExists: true, 
      existingStatsId 
    };
  } catch (error) {
    // Stats don't exist, safe to create
    console.log('✅ No existing PartnerPerkStatsV2 found, safe to create new one...');
    
    const transaction = buildCreatePartnerStatsIfNeededTransaction(partnerCapId, dailyQuotaLimit);
    return { 
      transaction, 
      alreadyExists: false 
    };
  }
};

/**
 * Finds the PartnerPerkStatsV2 object ID for a given partner cap
 * Searches through blockchain events and transactions to locate existing stats objects
 * 
 * @param suiClient SUI client instance for querying the blockchain
 * @param partnerCapId Partner Cap ID to find stats for
 * @returns String containing the stats object ID
 * @throws Error if no stats object is found
 */
export const findPartnerStatsId = async (
  suiClient: any,
  partnerCapId: string
): Promise<string> => {
  try {
    console.log('🔍 Searching for PartnerPerkStatsV2 for partner cap:', partnerCapId);
    
    // Method 1: Search through PartnerPerkStatsCreatedV2 events
    const eventsResponse = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::perk_manager::PartnerPerkStatsCreatedV2`
      },
      limit: 100,
      order: 'descending'
    });
    
    console.log('🔍 Found', eventsResponse.data.length, 'PartnerPerkStatsCreatedV2 events');
    
    const matchingStatsIds: string[] = [];
    
    for (const event of eventsResponse.data) {
      if (event.parsedJson && 
          event.parsedJson.partner_cap_id === partnerCapId && 
          event.parsedJson.stats_id) {
        
        // Verify the object still exists
        try {
          const objectResponse = await suiClient.getObject({
            id: event.parsedJson.stats_id,
            options: { showContent: true }
          });
          
          if (objectResponse.data && objectResponse.data.content) {
            matchingStatsIds.push(event.parsedJson.stats_id);
            console.log('✅ Found valid PartnerPerkStatsV2:', event.parsedJson.stats_id);
          }
        } catch (error) {
          console.log('❌ Stats object no longer exists:', event.parsedJson.stats_id);
        }
      }
    }
    
    if (matchingStatsIds.length === 0) {
      throw new Error(`No PartnerPerkStatsV2 found for partner cap: ${partnerCapId}`);
    }
    
    if (matchingStatsIds.length > 1) {
      console.warn('⚠️ DUPLICATE STATS OBJECTS DETECTED for partner cap:', partnerCapId);
      console.warn('⚠️ Found', matchingStatsIds.length, 'stats objects:', matchingStatsIds);
      console.warn('⚠️ Using the first one found, but this should be investigated');
    }
    
    return matchingStatsIds[0];
  } catch (error) {
    console.error('❌ Error searching for PartnerPerkStatsV2:', error);
    throw error;
  }
};

/**
 * Builds a transaction to create a PartnerPerkStatsV2 object
 * This is the core function that creates the actual Move transaction
 * 
 * @param partnerCapId Partner Cap ID to create stats for
 * @param dailyQuotaLimit Daily quota limit for the partner
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerStatsIfNeededTransaction = (
  partnerCapId: string,
  dailyQuotaLimit: number = 10000
): Transaction => {
  const tx = new Transaction();
  
  console.log('🔨 Building create PartnerPerkStatsV2 transaction for partner cap:', partnerCapId);
  console.log('🔨 Daily quota limit:', dailyQuotaLimit);
  
  tx.moveCall({
    target: `${PACKAGE_ID}::perk_manager::create_partner_perk_stats_v2`,
    arguments: [
      tx.object(partnerCapId),           // Partner Cap object
      tx.pure.u64(BigInt(dailyQuotaLimit)), // Daily quota limit
      tx.object(CLOCK_ID)                // Clock for timestamp
    ]
  });
  
  return tx;
};

/**
 * Builds a transaction for creating a PartnerPerkStatsV2 object
 * This creates the quota tracking and analytics system for a partner
 * 
 * @param partnerCapId Partner Cap ID to create stats for
 * @param dailyQuotaLimit Daily quota limit for the partner (default: 10000)
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerPerkStatsTransaction = (
  partnerCapId: string,
  dailyQuotaLimit: number = 10000,
  sponsorAddress?: string
): Transaction => {
  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored PartnerPerkStats creation: Gas fees will be paid by ${sponsorAddress}`);
  }
  
  console.log('🔨 Building create PartnerPerkStatsV2 transaction for partner cap:', partnerCapId);
  console.log('🔨 Daily quota limit:', dailyQuotaLimit);
  
  tx.moveCall({
    target: `${PACKAGE_ID}::perk_manager::create_partner_perk_stats_v2`,
    arguments: [
      tx.object(partnerCapId),           // Partner Cap object
      tx.pure.u64(BigInt(dailyQuotaLimit)), // Daily quota limit
      tx.object(CLOCK_ID)                // Clock for timestamp
    ]
  });
  
  return tx;
};

/**
 * Ensures PartnerPerkStatsV2 exists for a partner, creating it if necessary
 * This is an auto-creation helper used by the marketplace to ensure stats objects exist
 * 
 * @param suiClient SUI client instance for querying the blockchain
 * @param partnerCapId Partner Cap ID to ensure stats for
 * @param signAndExecuteTransaction Function to sign and execute transactions
 * @param dailyQuotaLimit Daily quota limit for new stats objects
 * @returns Promise with the stats object ID
 * @throws Error if stats cannot be found or created
 */
export const ensurePartnerStatsExists = async (
  suiClient: any,
  partnerCapId: string,
  signAndExecuteTransaction: any,
  dailyQuotaLimit: number = 10000
): Promise<string> => {
  try {
    console.log('🔍 Ensuring PartnerPerkStatsV2 exists for partner:', partnerCapId);
    
    // First, try to find existing stats
    try {
      const existingStatsId = await findPartnerStatsId(suiClient, partnerCapId);
      console.log('✅ Found existing PartnerPerkStatsV2:', existingStatsId);
      return existingStatsId;
    } catch (error) {
      console.log('❌ No existing PartnerPerkStatsV2 found, need to create one');
    }
    
    // Stats don't exist, try to create them automatically
    console.log('🔨 Auto-creating PartnerPerkStatsV2 for partner...');
    
    const result = await buildCreatePartnerStatsIfNotExistsTransaction(
      suiClient,
      partnerCapId,
      dailyQuotaLimit
    );
    
    if (result.alreadyExists && result.existingStatsId) {
      console.log('✅ Stats object was already created by another process:', result.existingStatsId);
      return result.existingStatsId;
    }
    
    if (!result.transaction) {
      throw new Error('Failed to build stats creation transaction');
    }
    
    console.log('📝 Executing PartnerPerkStatsV2 creation transaction...');
    
    const txResult = await signAndExecuteTransaction({
      transaction: result.transaction,
      chain: 'sui:testnet',
    });
    
    if (!txResult?.digest) {
      throw new Error('Transaction execution failed - no digest returned');
    }
    
    console.log('✅ PartnerPerkStatsV2 creation transaction successful:', txResult.digest);
    
    // Wait briefly for the transaction to be indexed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to find the newly created stats object
    try {
      const newStatsId = await findPartnerStatsId(suiClient, partnerCapId);
      console.log('✅ Successfully created and found new PartnerPerkStatsV2:', newStatsId);
      return newStatsId;
    } catch (error) {
      console.error('❌ Failed to find newly created stats object:', error);
      throw new Error('Stats object was created but could not be located. Please try again in a moment.');
    }
    
  } catch (error: any) {
    console.error('❌ Error ensuring PartnerPerkStatsV2 exists:', error);
    
    if (error.message?.includes('already exists')) {
      // Try one more time to find the existing stats
      try {
        const existingStatsId = await findPartnerStatsId(suiClient, partnerCapId);
        console.log('✅ Found stats object on retry:', existingStatsId);
        return existingStatsId;
      } catch (retryError) {
        throw new Error('Unable to create required PartnerPerkStatsV2 object');
      }
    }
    
    throw new Error(`Unable to create required PartnerPerkStatsV2 object: ${error.message || 'Unknown error'}`);
  }
};

/**
 * OPTION 1: Call old package's request_unstake_native_sui directly to get SUI back from validators
 * This is the preferred migration method since users get their actual SUI back
 * 
 * @param oldStakeObjectId Object ID of the old package stake position
 * @param oldPackageId Address of the old package containing the stake
 * @param oldSharedObjects Object containing the old package's shared object IDs
 * @returns Transaction object ready for execution
 */
export function buildOldPackageUnstakeForSuiTransaction(
  oldStakeObjectId: string,
  oldPackageId: string,
  oldSharedObjects: {
    stakingManager?: string;
    config?: string;
    ledger?: string;
  }
) {
  const tx = new Transaction();
  
  const packageInfo = getPackageSignatureInfo(oldPackageId);
  
  if (!packageInfo.functionExists) {
    throw new Error(`Unsupported package for migration: ${oldPackageId.substring(0, 10)}...`);
  }
  
  // Validate shared object IDs
  validateSharedObjectIds(oldSharedObjects, oldPackageId);
  
  if (packageInfo.argumentCount === 4) {
    // Package 0xbae3eef has 4 arguments (simpler version)
    const moveCall: any = {
      target: `${oldPackageId}::integration::request_unstake_native_sui`,
      arguments: [
        tx.object(oldSharedObjects.stakingManager!), // manager
        tx.object(oldSharedObjects.config!),         // config  
        tx.object(SUI_SYSTEM_STATE_ID),              // sui_system_state
        tx.object(oldStakeObjectId),                 // stake_position
      ]
    };
    
    if (packageInfo.needsTypeArguments) {
      moveCall.typeArguments = [`${oldPackageId}::stake_position::StakePosition`];
    }
    
    tx.moveCall(moveCall);
  } else if (packageInfo.argumentCount === 6) {
    // Package 0xdb62a7c has 6 arguments + ctx (handled automatically)
    if (!oldSharedObjects.ledger || oldSharedObjects.ledger === '0x0') {
      throw new Error(`Missing ledger for package ${oldPackageId.substring(0, 10)}...`);
    }
    
    const moveCall: any = {
      target: `${oldPackageId}::integration::request_unstake_native_sui`,
      arguments: [
        tx.object(oldSharedObjects.stakingManager!), // manager
        tx.object(oldSharedObjects.config!),         // config
        tx.object(SUI_SYSTEM_STATE_ID),              // sui_system_state
        tx.object(oldStakeObjectId),                 // stake_position
        tx.object(CLOCK_ID),                         // clock
        tx.object(oldSharedObjects.ledger!),         // ledger
        // ctx is handled automatically by Sui runtime
      ]
    };
    
    if (packageInfo.needsTypeArguments) {
      moveCall.typeArguments = [`${oldPackageId}::stake_position::StakePosition`];
    }
    
    tx.moveCall(moveCall);
  } else {
    throw new Error(`Unsupported argument count ${packageInfo.argumentCount} for package ${oldPackageId.substring(0, 10)}...`);
  }
  
  return tx;
}

/**
 * OPTION 1 BATCH: Call old package's request_unstake_native_sui for multiple stakes
 * Processes multiple stakes from the same old package
 * 
 * @param oldStakeObjectIds Array of object IDs of old package stakes
 * @param oldPackageId Address of the old package containing the stakes
 * @param oldSharedObjects Object containing the old package's shared object IDs
 * @returns Transaction object ready for execution
 */
export function buildOldPackageBatchUnstakeForSuiTransaction(
  oldStakeObjectIds: string[],
  oldPackageId: string,
  oldSharedObjects: {
    stakingManager?: string;
    config?: string;
    ledger?: string;
  }
) {
  const tx = new Transaction();
  
  const packageInfo = getPackageSignatureInfo(oldPackageId);
  
  if (!packageInfo.functionExists) {
    throw new Error(`Unsupported package for batch migration: ${oldPackageId.substring(0, 10)}...`);
  }
  
  // Validate shared object IDs
  validateSharedObjectIds(oldSharedObjects, oldPackageId);
  
  // Process each stake individually in the same transaction
  for (const stakeObjectId of oldStakeObjectIds) {
    if (packageInfo.argumentCount === 4) {
      // Package 0xbae3eef has 4 arguments (simpler version)
      const moveCall: any = {
        target: `${oldPackageId}::integration::request_unstake_native_sui`,
        arguments: [
          tx.object(oldSharedObjects.stakingManager!), // manager
          tx.object(oldSharedObjects.config!),         // config  
          tx.object(SUI_SYSTEM_STATE_ID),              // sui_system_state
          tx.object(stakeObjectId),                    // stake_position
        ]
      };
      
      if (packageInfo.needsTypeArguments) {
        moveCall.typeArguments = [`${oldPackageId}::stake_position::StakePosition`];
      }
      
      tx.moveCall(moveCall);
    } else if (packageInfo.argumentCount === 6) {
      // Package 0xdb62a7c has 6 arguments + ctx (handled automatically)
      if (!oldSharedObjects.ledger || oldSharedObjects.ledger === '0x0') {
        throw new Error(`Missing ledger for package ${oldPackageId.substring(0, 10)}...`);
      }
      
      const moveCall: any = {
        target: `${oldPackageId}::integration::request_unstake_native_sui`,
        arguments: [
          tx.object(oldSharedObjects.stakingManager!), // manager
          tx.object(oldSharedObjects.config!),         // config
          tx.object(SUI_SYSTEM_STATE_ID),              // sui_system_state
          tx.object(stakeObjectId),                    // stake_position
          tx.object(CLOCK_ID),                         // clock
          tx.object(oldSharedObjects.ledger!),         // ledger
        ]
      };
      
      if (packageInfo.needsTypeArguments) {
        moveCall.typeArguments = [`${oldPackageId}::stake_position::StakePosition`];
      }
      
      tx.moveCall(moveCall);
    }
  }
  
  return tx;
}

/**
 * Helper function to get old package shared object IDs
 * These would need to be discovered or hardcoded based on the old package deployment
 * 
 * @param oldPackageId Address of the old package
 * @returns Object containing the old package's shared object IDs
 */
export function getOldPackageSharedObjects(oldPackageId: string): {
  stakingManager?: string;
  config?: string;
  ledger?: string;
} {
  // Package 0xdb62a7c - Actual shared object IDs from deployment transaction
  if (oldPackageId === '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf') {
    return {
      stakingManager: '0xa16cefcddf869a44b74a859b2f77b0d00d48cf0cb57b804802a750e8283dbee2',
      config: '0x1a5dee16d572830a43e86cad2562be36c6b7350600cff1dcb4496fafaa203ef9',
      ledger: '0xc6e43029177ccc41afe2c4836fae1843492e8477cd95f7d2465e27d7722bc31d'
    };
  }
  
  // Package 0xbae3eef - Actual shared object IDs from deployment transaction
  if (oldPackageId === '0xbae3eef628211af44c386e621142118bdee8825b059e0514bf3729638109cd3a') {
    return {
      stakingManager: '0xf4f96a8211465553dd477e0471f4a57dc5ec3f1810d457e90d9bf9f9539262eb',
      config: '0xf180290c291c7c9628e90e04484ec9e5688802273997e9a05df5431798342f05',
      ledger: '0x46d8bcb53f05d758b4b77924095a8358da5b7005a9b3e08a4e970ef617690335'
    };
  }
  
  // Default fallback
  return {
    stakingManager: '0x0',
    config: '0x0', 
    ledger: '0x0',
  };
}

/**
 * Get package-specific function signature info
 * @param oldPackageId Address of the old package
 * @returns Object containing function signature details
 */
function getPackageSignatureInfo(oldPackageId: string): {
  argumentCount: number;
  needsTypeArguments: boolean;
  functionExists: boolean;
} {
  switch (oldPackageId) {
    case '0xbae3eef628211af44c386e621142118bdee8825b059e0514bf3729638109cd3a':
      return {
        argumentCount: 4,
        needsTypeArguments: false,
        functionExists: true
      };
    case '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf':
      return {
        argumentCount: 6, // Excluding ctx which is handled automatically
        needsTypeArguments: true,
        functionExists: true
      };
    default:
      return {
        argumentCount: 0,
        needsTypeArguments: false,
        functionExists: false
      };
  }
}

/**
 * Validate that shared object IDs are properly formatted and not zero addresses
 * @param sharedObjects Object containing shared object IDs to validate
 * @param packageId Package ID for context in error messages
 * @throws Error if validation fails
 */
function validateSharedObjectIds(
  sharedObjects: { stakingManager?: string; config?: string; ledger?: string },
  packageId: string
) {
  const validateObjectId = (id: string | undefined, name: string) => {
    if (!id || id === '0x0' || id.length < 10) {
      throw new Error(`Invalid ${name} ID for package ${packageId.substring(0, 10)}...: ${id}`);
    }
    if (!id.startsWith('0x')) {
      throw new Error(`${name} ID must start with 0x for package ${packageId.substring(0, 10)}...: ${id}`);  
    }
  };

  validateObjectId(sharedObjects.stakingManager, 'stakingManager');
  validateObjectId(sharedObjects.config, 'config');
  
  // ledger is only required for certain packages
  if (packageId === '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf') {
    validateObjectId(sharedObjects.ledger, 'ledger');
  }
}

/**
 * Builds a 3-step transaction for claiming SUI from encumbered withdrawal tickets
 * Step 1: Migrate old package StakePosition to current package
 * Step 2: Extract StakedSui from the new StakePosition wrapper  
 * Step 3: Call native Sui withdrawal to claim the SUI
 * 
 * @param withdrawalTicketId Object ID of the withdrawal ticket (encumbered StakePosition)
 * @param oldPackageId Package ID that originally created this StakePosition
 * @returns Transaction object ready for execution
 */
export const buildClaimWithdrawalTicketTransaction = (
  withdrawalTicketId: string,
  oldPackageId?: string
) => {
  // Auto-detect package ID from common known packages if not provided
  if (!oldPackageId) {
    // For now, we'll need the package ID to be provided
    // In the future, we could query the object to determine its type
    throw new Error(
      "Package ID required for migration. Please specify which old package created this withdrawal ticket:\n" +
      "• 0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf (6-argument version)\n" +
      "• 0xbae3eef628211af44c386e621142118bdee8825b059e0514bf3729638109cd3a (4-argument version)"
    );
  }

  const tx = new Transaction();

  // Step 1: Migrate the old StakePosition to current package format
  // This will automatically unstake and give Alpha Points if the stake is mature
  if (oldPackageId === '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf') {
    tx.moveCall({
      target: `${PACKAGE_ID}::integration::self_service_migrate_stake_db62a7c`,
      arguments: [
        tx.object(SHARED_OBJECTS.config), // config
        tx.object(SHARED_OBJECTS.stakingManager), // manager
        tx.object(SUI_SYSTEM_STATE_ID), // sui_system_state
        tx.object(SHARED_OBJECTS.ledger), // ledger
        tx.object(withdrawalTicketId), // old_stake_position
        tx.object(CLOCK_ID), // clock
      ],
    });
  } else if (oldPackageId === '0xbae3eef628211af44c386e621142118bdee8825b059e0514bf3729638109cd3a') {
    tx.moveCall({
      target: `${PACKAGE_ID}::integration::self_service_migrate_stake_bae3eef`,
      arguments: [
        tx.object(SHARED_OBJECTS.config), // config
        tx.object(SHARED_OBJECTS.stakingManager), // manager
        tx.object(SUI_SYSTEM_STATE_ID), // sui_system_state
        tx.object(SHARED_OBJECTS.ledger), // ledger
        tx.object(withdrawalTicketId), // old_stake_position
        tx.object(CLOCK_ID), // clock
      ],
    });
  } else {
    throw new Error(
      `Unsupported package ID: ${oldPackageId}\n` +
      `Supported packages:\n` +
      `• 0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf\n` +
      `• 0xbae3eef628211af44c386e621142118bdee8825b059e0514bf3729638109cd3a`
    );
  }

  // Note: Steps 2 and 3 are handled automatically by the migration function
  // If the stake is mature, it will:
  // - Extract the StakedSui from the wrapper
  // - Call native withdrawal 
  // - Mint Alpha Points to the user
  // - Destroy the temporary StakePosition
  
  return tx;
};

/**
 * Builds a transaction for extracting StakedSui from Alpha Points StakePosition wrapper
 * This is needed when users have StakePosition<StakedSui> objects instead of raw StakedSui
 * 
 * @param stakePositionId Object ID of the StakePosition wrapper
 * @returns Transaction object ready for execution
 */
export const buildExtractStakedSuiTransaction = (
  stakePositionId: string
) => {
  const tx = new Transaction();
  
  // Call Alpha Points function to extract the StakedSui from StakePosition wrapper
  tx.moveCall({
    target: `${PACKAGE_ID}::stake_position::extract_staked_sui`,
    arguments: [
      tx.object(stakePositionId) // The StakePosition wrapper object
    ]
  });
  
  return tx;
};

export function buildEmergencyUnstakeTransaction(
  stakePositionId: string,
  adminCapId: string = "0x123" // You'll need to provide the actual AdminCap ID
): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::emergency_unstake_native_sui_v2`,
    arguments: [
      tx.object(adminCapId), // admin_cap: &AdminCap
      tx.object(SHARED_OBJECTS.config), // config: &Config  
      tx.object(SHARED_OBJECTS.stakingManager), // manager: &mut StakingManager
      tx.object(SUI_SYSTEM_STATE_ID), // sui_system_state: &mut SuiSystemState
      tx.object(stakePositionId), // stake_position: StakePosition<StakedSui>
      tx.object(CLOCK_ID), // clock: &Clock
      tx.object(SHARED_OBJECTS.ledger), // ledger: &mut Ledger
    ],
  });

  return tx;
}

// === GENERATION MANAGER FUNCTIONS ===
// Functions for creating and managing generation opportunities

/**
 * Builds a transaction for creating an embedded generation opportunity
 * 
 * @param partnerCapId Object ID of the PartnerCapFlex
 * @param name Generation name
 * @param description Generation description
 * @param category Generation category
 * @param walrusBlobId Walrus storage blob ID for the code
 * @param codeHash SHA-256 hash of the code
 * @param templateType Template type for the generation
 * @param quotaCostPerExecution Quota cost per execution
 * @param maxExecutionsPerUser Maximum executions per user (optional)
 * @param maxTotalExecutions Maximum total executions (optional)
 * @param expirationTimestamp Expiration timestamp (optional)
 * @param tags Array of tags
 * @param icon Icon URL (optional)
 * @param estimatedCompletionMinutes Estimated completion time (optional)
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildCreateEmbeddedGenerationTransaction = (
  partnerCapId: string,
  registryId: string, // Add registry parameter
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

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored generation creation: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::generation_manager::create_embedded_generation`,
    arguments: [
      tx.object(partnerCapId),
      tx.object(registryId), // Add registry object
      tx.pure.string(name),
      tx.pure.string(description),
      tx.pure.string(category),
      tx.pure.string(walrusBlobId),
      tx.pure(bcs.vector(bcs.u8()).serialize(Array.from(new TextEncoder().encode(codeHash)))),
      tx.pure.string(templateType),
      tx.pure.u64(BigInt(quotaCostPerExecution)),
      maxExecutionsPerUser ? tx.pure(bcs.option(bcs.u64()).serialize(BigInt(maxExecutionsPerUser))) : tx.pure(bcs.option(bcs.u64()).serialize(null)),
      maxTotalExecutions ? tx.pure(bcs.option(bcs.u64()).serialize(BigInt(maxTotalExecutions))) : tx.pure(bcs.option(bcs.u64()).serialize(null)),
      expirationTimestamp ? tx.pure(bcs.option(bcs.u64()).serialize(BigInt(expirationTimestamp))) : tx.pure(bcs.option(bcs.u64()).serialize(null)),
      tx.pure(bcs.vector(bcs.String).serialize(tags)),
      icon ? tx.pure(bcs.option(bcs.String).serialize(icon)) : tx.pure(bcs.option(bcs.String).serialize(null)),
      estimatedCompletionMinutes ? tx.pure(bcs.option(bcs.u64()).serialize(BigInt(estimatedCompletionMinutes))) : tx.pure(bcs.option(bcs.u64()).serialize(null)),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for creating an external generation opportunity
 * 
 * @param partnerCapId Object ID of the PartnerCapFlex
 * @param name Generation name
 * @param description Generation description
 * @param category Generation category
 * @param targetUrl Target URL for the generation
 * @param redirectType Redirect type ('iframe' | 'new_tab' | 'popup')
 * @param returnCallbackUrl Return callback URL (optional)
 * @param requiresAuthentication Whether authentication is required
 * @param quotaCostPerExecution Quota cost per execution
 * @param maxExecutionsPerUser Maximum executions per user (optional)
 * @param maxTotalExecutions Maximum total executions (optional)
 * @param expirationTimestamp Expiration timestamp (optional)
 * @param tags Array of tags
 * @param icon Icon URL (optional)
 * @param estimatedCompletionMinutes Estimated completion time (optional)
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildCreateExternalGenerationTransaction = (
  partnerCapId: string,
  registryId: string, // Add registry parameter
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

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored generation creation: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::generation_manager::create_external_generation`,
    arguments: [
      tx.object(partnerCapId),
      tx.object(registryId), // Add registry object
      tx.pure.string(name),
      tx.pure.string(description),
      tx.pure.string(category),
      tx.pure.string(targetUrl),
      tx.pure.string(redirectType),
      returnCallbackUrl ? tx.pure(bcs.option(bcs.String).serialize(returnCallbackUrl)) : tx.pure(bcs.option(bcs.String).serialize(null)),
      tx.pure.bool(requiresAuthentication),
      tx.pure.u64(BigInt(quotaCostPerExecution)),
      maxExecutionsPerUser ? tx.pure(bcs.option(bcs.u64()).serialize(BigInt(maxExecutionsPerUser))) : tx.pure(bcs.option(bcs.u64()).serialize(null)),
      maxTotalExecutions ? tx.pure(bcs.option(bcs.u64()).serialize(BigInt(maxTotalExecutions))) : tx.pure(bcs.option(bcs.u64()).serialize(null)),
      expirationTimestamp ? tx.pure(bcs.option(bcs.u64()).serialize(BigInt(expirationTimestamp))) : tx.pure(bcs.option(bcs.u64()).serialize(null)),
      tx.pure(bcs.vector(bcs.String).serialize(tags)),
      icon ? tx.pure(bcs.option(bcs.String).serialize(icon)) : tx.pure(bcs.option(bcs.String).serialize(null)),
      estimatedCompletionMinutes ? tx.pure(bcs.option(bcs.u64()).serialize(BigInt(estimatedCompletionMinutes))) : tx.pure(bcs.option(bcs.u64()).serialize(null)),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};

// === ZERO-DEV INTEGRATION SYSTEM ===
// Event-based point minting system for frontend/backend integration

/**
 * Builds a transaction for configuring Zero-Dev integration settings on an existing PartnerCapFlex
 * This enables event-based point minting without requiring a new partner capability
 * 
 * @param partnerCapFlexId Object ID of the existing PartnerCapFlex
 * @param allowedOrigins Array of whitelisted domains that can submit events
 * @param webhookUrl Optional webhook URL for server-side integration
 * @param apiKeyHash Optional API key hash for authentication
 * @param rateLimitPerMinute Rate limit for event submissions per minute
 * @param requireUserSignature Whether events require user wallet signature
 * @param integrationEnabled Master switch for the integration
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildUpdateIntegrationSettingsTransaction = (
  partnerCapFlexId: string,
  allowedOrigins: string[] = [],
  webhookUrl?: string,
  apiKeyHash?: string,
  rateLimitPerMinute: number = 60,
  requireUserSignature: boolean = true,
  integrationEnabled: boolean = true,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored integration settings update: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::update_integration_settings`,
    arguments: [
      tx.object(partnerCapFlexId),
      tx.pure(bcs.vector(bcs.String).serialize(allowedOrigins)),
      webhookUrl ? tx.pure(bcs.option(bcs.String).serialize(webhookUrl)) : tx.pure(bcs.option(bcs.String).serialize(null)),
      apiKeyHash ? tx.pure(bcs.option(bcs.String).serialize(apiKeyHash)) : tx.pure(bcs.option(bcs.String).serialize(null)),
      tx.pure.u64(BigInt(rateLimitPerMinute)),
      tx.pure.bool(requireUserSignature),
      tx.pure.bool(integrationEnabled),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for configuring event mappings on a PartnerCapFlex
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param eventType Event type identifier (e.g., 'user_signup', 'purchase_completed')
 * @param pointsPerEvent Points to award per event occurrence
 * @param maxEventsPerUser Maximum events per user (0 = unlimited)
 * @param maxEventsPerDay Maximum events per day (0 = unlimited)
 * @param cooldownSeconds Cooldown between events in seconds (0 = no cooldown)
 * @param eventConditions JSON string of conditions that must be met
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildConfigureEventMappingTransaction = (
  partnerCapFlexId: string,
  eventType: string,
  pointsPerEvent: number,
  maxEventsPerUser: number = 0,
  maxEventsPerDay: number = 0,
  cooldownSeconds: number = 0,
  eventConditions: string = '{}',
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored event mapping configuration: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::configure_event_mapping`,
    arguments: [
      tx.object(partnerCapFlexId),
      tx.pure.string(eventType),
      tx.pure.u64(BigInt(pointsPerEvent)),
      tx.pure.u64(BigInt(maxEventsPerUser)),
      tx.pure.u64(BigInt(maxEventsPerDay)),
      tx.pure.u64(BigInt(cooldownSeconds)),
      tx.pure.string(eventConditions),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for submitting a partner event and minting points
 * This is the core function for Zero-Dev integration
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param eventType Event type that was configured
 * @param userAddress Address to mint points for
 * @param eventData Additional event data as bytes
 * @param eventHash Unique hash to prevent replay attacks
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildSubmitPartnerEventTransaction = (
  partnerCapFlexId: string,
  eventType: string,
  userAddress: string,
  eventData: Uint8Array,
  eventHash: string,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored event submission: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::submit_partner_event`,
    arguments: [
      tx.object(partnerCapFlexId),
      tx.pure.string(eventType),
      tx.pure.address(userAddress),
      tx.pure(bcs.vector(bcs.u8()).serialize(Array.from(eventData))),
      tx.pure.string(eventHash),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for updating allowed origins for a PartnerCapFlex
 * This is a convenience function that updates just the allowed origins
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param allowedOrigins New array of whitelisted domains
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildUpdateAllowedOriginsTransaction = (
  partnerCapFlexId: string,
  allowedOrigins: string[],
  sponsorAddress?: string
) => {
  // This is a convenience wrapper that preserves other settings
  // In practice, partners would use buildUpdateIntegrationSettingsTransaction
  // with their current settings to update just origins
  return buildUpdateIntegrationSettingsTransaction(
    partnerCapFlexId,
    allowedOrigins,
    undefined, // preserve webhook
    undefined, // preserve api key
    60, // default rate limit
    true, // default signature requirement
    true, // default enabled
    sponsorAddress
  );
};

/**
 * Builds a transaction for removing an event mapping from a PartnerCapFlex
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param eventType Event type to remove
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildRemoveEventMappingTransaction = (
  partnerCapFlexId: string,
  eventType: string,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored event mapping removal: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::remove_event_mapping`,
    arguments: [
      tx.object(partnerCapFlexId),
      tx.pure.string(eventType),
    ],
  });

  return tx;
};

/**
 * Helper function to generate event hash for replay protection
 * 
 * @param eventType Event type
 * @param userAddress User address
 * @param eventData Event data
 * @param timestamp Current timestamp
 * @returns SHA-256 hash string
 */
export const generateEventHash = async (
  eventType: string,
  userAddress: string,
  eventData: Uint8Array,
  timestamp: number
): Promise<string> => {
  const encoder = new TextEncoder();
  const data = new Uint8Array([
    ...encoder.encode(eventType),
    ...encoder.encode(userAddress),
    ...eventData,
    ...encoder.encode(timestamp.toString())
  ]);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Client-side helper to validate event data before submission
 * 
 * @param eventType Event type
 * @param eventData Event data object
 * @param eventConfig Event configuration from partner
 * @returns Validation result
 */
export const validateEventData = (
  eventType: string,
  eventData: any,
  eventConfig: any
): { valid: boolean; error?: string } => {
  try {
    // Basic validation
    if (!eventType || typeof eventType !== 'string') {
      return { valid: false, error: 'Invalid event type' };
    }

    // Validate against event conditions if provided
    if (eventConfig?.conditions) {
      const conditions = JSON.parse(eventConfig.conditions);
      
      // Example condition checks (extend as needed)
      if (conditions.minValue && eventData.value < conditions.minValue) {
        return { valid: false, error: `Value must be at least ${conditions.minValue}` };
      }
      
      if (conditions.requiredFields) {
        for (const field of conditions.requiredFields) {
          if (!(field in eventData)) {
            return { valid: false, error: `Missing required field: ${field}` };
          }
        }
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid event configuration' };
  }
};

/**
 * Finds PartnerPerkStatsV2 for a partner or suggests creation if not found
 * This function provides detailed information about the partner's stats status
 * Used by the marketplace to provide better error messages and user guidance
 * 
 * @param suiClient SUI client instance for querying the blockchain
 * @param partnerCapId Partner Cap ID to check
 * @returns Object containing stats status and suggestions
 */
export const findOrSuggestCreatePartnerStats = async (
  suiClient: any,
  partnerCapId: string
): Promise<{
  statsId?: string;
  needsCreation: boolean;
  suggestion?: string;
}> => {
  try {
    console.log('🔍 Checking PartnerPerkStatsV2 status for partner:', partnerCapId);
    
    // Try to find existing stats
    const statsId = await findPartnerStatsId(suiClient, partnerCapId);
    
    console.log('✅ Found existing PartnerPerkStatsV2:', statsId);
    return {
      statsId,
      needsCreation: false
    };
    
  } catch (error) {
    console.log('❌ No PartnerPerkStatsV2 found for partner:', partnerCapId);
    
    return {
      needsCreation: true,
      suggestion: 'This partner needs to create their PartnerPerkStatsV2 object before users can purchase perks. Please contact the partner to complete their setup.'
    };
  }
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

/**
 * DIAGNOSTIC: Check partner quota status for debugging Error 110 issues
 * Shows current quota usage, limits, and remaining capacity
 * 
 * @param suiClient SUI client instance
 * @param partnerCapId Object ID of the PartnerCapFlex
 * @returns Promise with detailed quota information
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
    console.log('🔍 DIAGNOSTIC: Checking partner quota status for:', partnerCapId);
    
    // Find the PartnerPerkStatsV2 object
    const statsId = await findPartnerStatsId(suiClient, partnerCapId);
    console.log('✅ Found PartnerPerkStatsV2:', statsId);
    
    // Get the object details
    const objectResponse = await suiClient.getObject({
      id: statsId,
      options: {
        showContent: true,
        showType: true
      }
    });
    
    if (!objectResponse.data?.content || !('fields' in objectResponse.data.content)) {
      return { error: 'Could not read PartnerPerkStatsV2 object content' };
    }
    
    const fields = objectResponse.data.content.fields as any;
    
    // Extract quota information
    const dailyQuotaLimit = parseInt(fields.daily_quota_limit);
    const dailyPointsMinted = parseInt(fields.daily_points_minted);
    const totalPointsMinted = parseInt(fields.total_points_minted);
    const totalPerksClaimedToday = parseInt(fields.total_perks_claimed);
    const lastResetEpoch = parseInt(fields.daily_reset_epoch);
    
    const remainingQuota = Math.max(0, dailyQuotaLimit - dailyPointsMinted);
    
    // Get current epoch for comparison
    let currentEpoch = 0;
    try {
      // This would need to be implemented based on how you get current epoch
      // For now, we'll estimate based on timestamp
      currentEpoch = Math.floor(Date.now() / (24 * 60 * 60 * 1000)); // Rough daily epoch
    } catch (epochError) {
      console.warn('Could not determine current epoch');
    }
    
    const needsEpochReset = currentEpoch > lastResetEpoch;
    
    const quotaStatus = {
      statsId,
      dailyQuotaLimit,
      dailyPointsMinted,
      remainingQuota: needsEpochReset ? dailyQuotaLimit : remainingQuota,
      totalPointsMinted,
      totalPerksClaimedToday,
      currentEpoch,
      lastResetEpoch,
      needsEpochReset
    };
    
    console.log('🔍 QUOTA STATUS:', quotaStatus);
    
    // Provide diagnostic information
    if (dailyQuotaLimit === 0) {
      console.log('❌ ISSUE: Daily quota limit is 0 - partner needs to set a quota');
    } else if (dailyQuotaLimit < 1000) {
      console.log('⚠️ WARNING: Daily quota limit is very low:', dailyQuotaLimit);
    }
    
    if (!needsEpochReset && remainingQuota <= 0) {
      console.log('❌ ISSUE: Partner has exhausted daily quota');
    }
    
    if (needsEpochReset) {
      console.log('⚠️ INFO: Daily stats need epoch reset - quota should refresh');
    }
    
    return quotaStatus;
    
  } catch (error) {
    console.error('❌ Error checking partner quota status:', error);
    return { 
      error: `Failed to check quota status: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

/**
 * DIAGNOSTIC: Calculate expected partner share for a perk purchase  
 * Helps determine what quota amount will be consumed
 * 
 * @param perkCostAlphaPoints Cost of the perk in Alpha Points
 * @param partnerSharePercentage Partner's revenue share percentage (default 80%)
 * @returns Expected partner share that will be deducted from quota
 */
export const calculateExpectedPartnerShare = (
  perkCostAlphaPoints: number,
  partnerSharePercentage: number = 80
): number => {
  const partnerShare = Math.floor((perkCostAlphaPoints * partnerSharePercentage) / 100);
  console.log('🔍 QUOTA IMPACT CALCULATION:', {
    perkCost: perkCostAlphaPoints,
    partnerSharePercentage,
    expectedPartnerShare: partnerShare
  });
  return partnerShare;
};

/**
 * Builds a transaction for claiming a perk (QUOTA-FREE VERSION)
 * Uses the claim_perk_by_user function which bypasses quota validation
 * This treats perk sales as REVENUE, not quota-limited minting
 * 
 * @param perkDefinitionId Object ID of the perk definition
 * @returns Transaction object ready for execution
 */
export const buildClaimPerkQuotaFreeTransaction = (
  perkDefinitionId: string
): Transaction => {
  if (!PACKAGE_ID || !SHARED_OBJECTS.config || !SHARED_OBJECTS.ledger) {
    throw new Error("Alpha Points package or shared objects are not configured.");
  }

  const tx = new Transaction();

  tx.moveCall({
    // QUOTA-FREE: Use function that treats perk sales as revenue, not quota consumption
    target: `${PACKAGE_ID}::perk_manager::claim_perk_by_user`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(perkDefinitionId),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(CLOCK_ID)
    ],
  });

  return tx;
};

/**
 * Builds a transaction for claiming a perk with metadata (QUOTA-FREE VERSION)
 * Uses the claim_perk_with_metadata_by_user function which bypasses quota validation
 * This treats perk sales as REVENUE, not quota-limited minting
 * 
 * @param perkDefinitionId Object ID of the perk definition
 * @param metadataKey Key for the claim-specific metadata
 * @param metadataValue Value for the claim-specific metadata
 * @returns Transaction object ready for execution
 */
export const buildClaimPerkWithMetadataQuotaFreeTransaction = (
  perkDefinitionId: string,
  metadataKey: string,
  metadataValue: string
): Transaction => {
  if (!PACKAGE_ID || !SHARED_OBJECTS.config || !SHARED_OBJECTS.ledger) {
    throw new Error("Alpha Points package or shared objects are not configured.");
  }

  const tx = new Transaction();

  tx.moveCall({
    // QUOTA-FREE: Use function that treats perk sales as revenue, not quota consumption
    target: `${PACKAGE_ID}::perk_manager::claim_perk_with_metadata_by_user`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(perkDefinitionId),
      tx.object(SHARED_OBJECTS.ledger),
      tx.pure.string(metadataKey),
      tx.pure.string(metadataValue),
      tx.object(CLOCK_ID)
    ],
  });

  return tx;
};

/**
 * Builds a transaction for claiming a perk (QUOTA-VALIDATED VERSION)
 * Uses the claim_perk_with_quota_validation function which checks partner quotas
 * This treats perk sales as QUOTA consumption and validates against partner limits
 * 
 * @param perkDefinitionId Object ID of the perk definition
 * @param partnerStatsId Object ID of the partner's PartnerPerkStatsV2 object for quota validation
 * @returns Transaction object ready for execution
 */
export const buildClaimPerkTransaction = (
  perkDefinitionId: string,
  partnerStatsId: string
): Transaction => {
  if (!PACKAGE_ID || !SHARED_OBJECTS.config || !SHARED_OBJECTS.ledger) {
    throw new Error("Alpha Points package or shared objects are not configured.");
  }

  const tx = new Transaction();

  tx.moveCall({
    // QUOTA-VALIDATED: Use function that validates quota consumption against partner limits
    target: `${PACKAGE_ID}::perk_manager::claim_perk_with_quota_validation`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(perkDefinitionId),
      tx.object(partnerStatsId),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(CLOCK_ID)
    ],
  });

  return tx;
};

/**
 * Builds a transaction for claiming a perk with metadata (QUOTA-VALIDATED VERSION)
 * Uses the claim_perk_with_metadata_and_quota_validation function which checks partner quotas
 * This treats perk sales as QUOTA consumption and validates against partner limits
 * 
 * @param perkDefinitionId Object ID of the perk definition
 * @param partnerStatsId Object ID of the partner's PartnerPerkStatsV2 object for quota validation
 * @param metadataKey Key for the claim-specific metadata
 * @param metadataValue Value for the claim-specific metadata
 * @returns Transaction object ready for execution
 */
export const buildClaimPerkWithMetadataTransaction = (
  perkDefinitionId: string,
  partnerStatsId: string,
  metadataKey: string,
  metadataValue: string
): Transaction => {
  if (!PACKAGE_ID || !SHARED_OBJECTS.config || !SHARED_OBJECTS.ledger) {
    throw new Error("Alpha Points package or shared objects are not configured.");
  }

  const tx = new Transaction();

  tx.moveCall({
    // QUOTA-VALIDATED: Use function that validates quota consumption against partner limits
    target: `${PACKAGE_ID}::perk_manager::claim_perk_with_metadata_and_quota_validation`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(perkDefinitionId),
      tx.object(partnerStatsId),
      tx.object(SHARED_OBJECTS.ledger),
      tx.pure.string(metadataKey),
      tx.pure.string(metadataValue),
      tx.object(CLOCK_ID)
    ],
  });

  return tx;
};

/**
 * Builds a transaction for creating a perk definition
 * This creates a new perk that partners can offer to users
 * 
 * @param partnerCapId Partner Cap ID to create the perk for
 * @param name Name of the perk
 * @param description Description of the perk
 * @param perkType Type of perk (e.g., "Access", "Discount", "Physical", etc.)
 * @param tags Array of tags for the perk
 * @param usdcPriceCents Price in USDC cents (100 = $1.00)
 * @param partnerSharePercentage Percentage of revenue that goes to partner (default: 80)
 * @param icon Emoji icon for the perk
 * @param expiryTimestamp Optional expiry timestamp (0 for no expiry)
 * @param maxUsesPerClaim Optional max uses per claim (0 for unlimited)
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
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

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored perk creation: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::perk_manager::create_perk_definition`,
    arguments: [
      tx.object(partnerCapId),
      tx.pure.string(name),
      tx.pure.string(description),
      tx.pure.string(perkType),
      tx.pure(bcs.vector(bcs.String).serialize(tags)),
      tx.pure.u64(usdcPriceCents.toString()),
      tx.pure.u8(partnerSharePercentage),
      tx.pure.string(icon),
      tx.pure.u64(expiryTimestamp.toString()),
      tx.pure.u64(maxUsesPerClaim.toString())
    ],
  });

  return tx;
};

/**
 * Builds a transaction for setting a perk's active status
 * This allows partners to enable or disable their perks
 * 
 * @param perkDefinitionId Perk definition ID to update
 * @param isActive Whether the perk should be active or inactive
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildSetPerkActiveStatusTransaction = (
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
    target: `${PACKAGE_ID}::perk_manager::set_perk_active_status`,
    arguments: [
      tx.object(perkDefinitionId),
      tx.pure.bool(isActive)
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
 * Builds a transaction for setting generation active status
 * 
 * @param generationId Object ID of the GenerationDefinition
 * @param partnerCapId Object ID of the PartnerCapFlex
 * @param isActive Whether the generation should be active
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildSetGenerationActiveStatusTransaction = (
  generationId: string,
  partnerCapId: string,
  isActive: boolean,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
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
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for executing a generation and earning points
 * 
 * @param generationId Object ID of the GenerationDefinition
 * @param partnerCapId Object ID of the PartnerCapFlex
 * @param userAddress Address of the user executing the generation
 * @param executionMetadata JSON metadata about the execution
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildExecuteGenerationTransaction = (
  generationId: string,
  partnerCapId: string,
  userAddress: string,
  executionMetadata: string = '{}',
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored generation execution: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::generation_manager::execute_generation`,
    arguments: [
      tx.object(generationId),
      tx.object(partnerCapId),
      tx.object(LEDGER_ID), // Add ledger object
      tx.pure.address(userAddress),
      tx.pure.string(executionMetadata),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for approving a generation (admin only)
 * 
 * @param generationId Object ID of the GenerationDefinition
 * @param safetyScore Safety score (0-100, higher = safer)
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildApproveGenerationTransaction = (
  generationId: string,
  safetyScore: number,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored generation approval: Gas fees will be paid by ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::generation_manager::approve_generation`,
    arguments: [
      tx.object(generationId),
      tx.pure.u64(BigInt(safetyScore)),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};

/**
 * Finds the GenerationRegistry object ID by querying for objects of the generation_manager module
 * 
 * @param suiClient Sui client instance
 * @returns Promise<string> The registry object ID
 */
export const findGenerationRegistry = async (suiClient: any): Promise<string> => {
  try {
    const response = await suiClient.getOwnedObjects({
      filter: {
        StructType: `${PACKAGE_ID}::generation_manager::GenerationRegistry`
      },
      options: {
        showContent: true,
        showType: true,
      }
    });

    if (response.data && response.data.length > 0) {
      return response.data[0].data.objectId;
    }

    // If not found, query all objects of this type (since registry is shared)
    const allRegistries = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::generation_manager::GenerationCreated`
      },
      limit: 1,
      order: 'ascending'
    });

    // If we have events, we can extract registry from the first generation creation
    if (allRegistries.data && allRegistries.data.length > 0) {
      // Registry would be created during module init - we need to query shared objects
      const sharedObjects = await suiClient.getOwnedObjects({
        filter: {
          StructType: `${PACKAGE_ID}::generation_manager::GenerationRegistry`
        },
        options: {
          showContent: true,
        }
      });

      if (sharedObjects.data && sharedObjects.data.length > 0) {
        return sharedObjects.data[0].data.objectId;
      }
    }

    throw new Error('GenerationRegistry not found - module may not be initialized');
  } catch (error) {
    console.error('Error finding GenerationRegistry:', error);
    throw error;
  }
};

/**
 * Gets the generation registry ID with caching
 * 
 * @param suiClient Sui client instance
 * @returns Promise<string> The registry object ID
 */
let cachedRegistryId: string | null = null;
export const getGenerationRegistryId = async (suiClient: any): Promise<string> => {
  if (cachedRegistryId) {
    return cachedRegistryId;
  }
  
  cachedRegistryId = await findGenerationRegistry(suiClient);
  return cachedRegistryId;
};



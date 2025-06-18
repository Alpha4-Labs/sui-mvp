/**
 * Transaction builder utilities for Alpha Points operations
 * Updated with proper BCS serialization for Sui SDK v1.0+
 * Adjusted for two-transaction native staking flow.
 * Now includes TVL-backed PartnerCapFlex system functions
 */

import { Transaction, TransactionArgument, TransactionObjectArgument } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID, PACKAGE_ID_V4, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';
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
 * Builds a transaction for early unstaking (before maturity) to receive Alpha Points
 * User gets Alpha Points as a loan against their stake position
 * 
 * @param stakeId Object ID of the stake position
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
      tx.object(stakeId),                      // StakePosition to early unstake
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
 * Builds a transaction for creating a TVL-backed PartnerCapFlex with collateral
 * This is the new recommended way to create partner capabilities
 * 
 * @param partnerName Partner name string
 * @param suiAmountMist Amount of SUI to lock as collateral (in MIST)
 * @param sponsorAddress Optional sponsor address to pay for gas fees (typically deployer/admin)
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerCapFlexTransaction = (
  partnerName: string,
  suiAmountMist: bigint,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided (typically deployer/admin wallet)
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored PartnerCapFlex creation: Gas fees will be paid by deployer/admin ${sponsorAddress}`);
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
 * Builds a transaction for earning points using PartnerCapFlex with TVL-backed quota validation
 * This is the new recommended way for partners to mint points
 * 
 * @param userAddress Address to mint points for
 * @param pointsAmount Amount of Alpha Points to mint
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param sponsorAddress Optional sponsor address to pay for gas fees (typically deployer/admin)
 * @returns Transaction object ready for execution
 */
export const buildEarnPointsByPartnerFlexTransaction = (
  userAddress: string,
  pointsAmount: bigint,
  partnerCapFlexId: string,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored points minting: Gas fees will be paid by deployer/admin ${sponsorAddress}`);
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::integration::earn_points_by_partner_flex`,
    arguments: [
      tx.pure.address(userAddress),
      tx.pure.u64(pointsAmount.toString()),
      tx.object(partnerCapFlexId),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(CLOCK_ID),
      tx.object(SHARED_OBJECTS.config),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for creating a loan using PartnerCapFlex with TVL-backed quota validation
 * This is the new recommended way for partners to facilitate loans
 * 
 * @param stakeId Object ID of the stake position to use as collateral
 * @param pointsAmount Amount of Alpha Points to borrow
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param sponsorAddress Optional sponsor address to pay for gas fees (typically deployer/admin)
 * @returns Transaction object ready for execution
 */
export const buildCreateLoanWithPartnerFlexTransaction = (
  stakeId: string,
  pointsAmount: number,
  partnerCapFlexId: string,
  sponsorAddress?: string
) => {
  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored loan creation: Gas fees will be paid by deployer/admin ${sponsorAddress}`);
  }
  
  tx.moveCall({
    target: `${PACKAGE_ID}::loan::open_loan_with_partner_flex`,
    typeArguments: ['0x3::staking_pool::StakedSui'],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.loanConfig),
      tx.object(partnerCapFlexId),
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
 * Builds a transaction to check PartnerCapFlex quota status
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param sponsorAddress Optional sponsor address to pay for gas fees (typically deployer/admin)
 * @returns Transaction object ready for execution (view function)
 */
export const buildCheckPartnerQuotaTransaction = (
  partnerCapFlexId: string,
  sponsorAddress?: string
) => {
  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored quota check: Gas fees will be paid by deployer/admin ${sponsorAddress}`);
  }
  
  // This would be a view function to check quotas
  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::get_available_mint_quota_today`,
    arguments: [
      tx.object(partnerCapFlexId),
    ],
  });
  
  return tx;
};

/**
 * Builds a transaction for creating a PartnerCapFlex with USDC stable collateral
 * Provides 100% LTV ratio for stable collateral backing
 * 
 * @param partnerName Partner name string
 * @param usdcCoinId Object ID of the USDC coin to use as collateral
 * @param sponsorAddress Optional sponsor address to pay for gas fees (typically deployer/admin)
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerCapFlexWithUSDCTransaction = (
  partnerName: string,
  usdcCoinId: string,
  sponsorAddress?: string
) => {
  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored PartnerCapFlex USDC creation: Gas fees will be paid by deployer/admin ${sponsorAddress}`);
  }
  
  // Use the provided USDC coin object directly
  const usdcCoin = tx.object(usdcCoinId);
  
  // Call the PartnerCapFlex creation function with USDC collateral
  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::create_partner_cap_flex_with_usdc_collateral`,
    typeArguments: ['0x2::coin::Coin<0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN>'], // USDC type
    arguments: [
      usdcCoin,
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.string(partnerName),
    ],
  });
  
  return tx;
};

/**
 * Builds a transaction for creating a PartnerCapFlex with NFT bundle collateral
 * Provides 70% LTV ratio for NFT collection backing with kiosk owner capabilities
 * 
 * @param partnerName Partner name string
 * @param kioskId Object ID of the kiosk containing NFTs
 * @param collectionType Type identifier for the NFT collection
 * @param estimatedFloorValueUsdc Estimated floor value in USDC for risk assessment
 * @param sponsorAddress Optional sponsor address to pay for gas fees (typically deployer/admin)
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerCapFlexWithNFTTransaction = (
  partnerName: string,
  kioskId: string,
  collectionType: string,
  estimatedFloorValueUsdc: number,
  sponsorAddress?: string
) => {
  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored PartnerCapFlex NFT creation: Gas fees will be paid by deployer/admin ${sponsorAddress}`);
  }
  
  // Reference the kiosk object
  const kiosk = tx.object(kioskId);
  
  // Call the PartnerCapFlex creation function with NFT collateral
  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::create_partner_cap_flex_with_nft_collateral`,
    typeArguments: [collectionType], // Dynamic NFT collection type
    arguments: [
      kiosk,
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.string(partnerName),
      tx.pure.u64(BigInt(estimatedFloorValueUsdc * 1_000_000)), // Convert to USDC micro units
    ],
  });
  
  return tx;
};

// === Collateral Management Functions ===

/**
 * Builds a transaction for adding additional SUI collateral to an existing PartnerCapFlex
 * This increases the TVL backing and expands minting quotas
 * 
 * @param partnerCapFlexId Object ID of the existing PartnerCapFlex
 * @param vaultId Object ID of the CollateralVault associated with the PartnerCapFlex
 * @param additionalSuiAmountMist Amount of additional SUI to add (in MIST)
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildAddSuiCollateralTransaction = (
  partnerCapFlexId: string,
  vaultId: string,
  additionalSuiAmountMist: bigint,
  sponsorAddress?: string
) => {
  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored SUI collateral addition: Gas fees will be paid by ${sponsorAddress}`);
  }
  
  // Split additional SUI from gas coin
  const [additionalCollateral] = tx.splitCoins(tx.gas, [tx.pure.u64(additionalSuiAmountMist.toString())]);
  
  // Call the add collateral function with all required parameters
  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::add_sui_collateral`,
    arguments: [
      tx.object(partnerCapFlexId),  // cap: &mut PartnerCapFlex
      tx.object(vaultId),           // vault: &mut CollateralVault
      additionalCollateral,         // additional_sui_coin: Coin<SUI>
      tx.object(SHARED_OBJECTS.oracle), // rate_oracle: &RateOracle
    ],
  });
  
  return tx;
};

/**
 * Builds a transaction for creating an initial SUI vault for existing PartnerCapFlex without one
 * This is for partners who were created without SUI collateral (admin-granted, USDC-only, NFT-only)
 * 
 * @param partnerCapFlexId Object ID of the existing PartnerCapFlex
 * @param initialSuiAmountMist Amount of initial SUI to add (in MIST)
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildCreateInitialSuiVaultTransaction = (
  partnerCapFlexId: string,
  initialSuiAmountMist: bigint,
  sponsorAddress?: string
) => {
  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored initial SUI vault creation: Gas fees will be paid by ${sponsorAddress}`);
  }
  
  // Split initial SUI from gas coin
  const [initialCollateral] = tx.splitCoins(tx.gas, [tx.pure.u64(initialSuiAmountMist.toString())]);
  
  // Call the create_initial_sui_vault function
  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::create_initial_sui_vault`,
    arguments: [
      tx.object(partnerCapFlexId),      // cap: &mut PartnerCapFlex
      initialCollateral,               // initial_sui_coin: Coin<SUI>
      tx.object(SHARED_OBJECTS.oracle), // rate_oracle: &RateOracle
    ],
  });
  
  return tx;
};

/**
 * Builds a transaction for adding USDC collateral to an existing PartnerCapFlex
 * This diversifies the collateral base and provides stable backing
 * 
 * @param partnerCapFlexId Object ID of the existing PartnerCapFlex
 * @param usdcCoinId Object ID of the USDC coin to add as collateral
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildAddUsdcCollateralTransaction = (
  partnerCapFlexId: string,
  usdcCoinId: string,
  sponsorAddress?: string
) => {
  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored USDC collateral addition: Gas fees will be paid by ${sponsorAddress}`);
  }
  
  // Use the provided USDC coin object
  const usdcCoin = tx.object(usdcCoinId);
  
  // Call the add USDC collateral function
  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::add_usdc_collateral`,
    typeArguments: ['0x2::coin::Coin<0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN>'], // USDC type
    arguments: [
      tx.object(partnerCapFlexId),
      usdcCoin,
      tx.object(SHARED_OBJECTS.oracle),
    ],
  });
  
  return tx;
};

/**
 * Builds a transaction for adding NFT collateral to an existing PartnerCapFlex
 * This diversifies the collateral base with NFT collection backing
 * 
 * @param partnerCapFlexId Object ID of the existing PartnerCapFlex
 * @param kioskId Object ID of the kiosk containing NFTs
 * @param collectionType Type identifier for the NFT collection
 * @param estimatedFloorValueUsdc Estimated floor value in USDC for risk assessment
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildAddNftCollateralTransaction = (
  partnerCapFlexId: string,
  kioskId: string,
  collectionType: string,
  estimatedFloorValueUsdc: number,
  sponsorAddress?: string
) => {
  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored NFT collateral addition: Gas fees will be paid by ${sponsorAddress}`);
  }
  
  // Reference the kiosk object
  const kiosk = tx.object(kioskId);
  
  // Call the add NFT collateral function
  tx.moveCall({
    target: `${PACKAGE_ID}::partner_flex::add_nft_collateral`,
    typeArguments: [collectionType], // Dynamic NFT collection type
    arguments: [
      tx.object(partnerCapFlexId),
      kiosk,
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.u64(BigInt(estimatedFloorValueUsdc * 1_000_000)), // Convert to USDC micro units
    ],
  });
  
  return tx;
};

/**
 * Builds a transaction for withdrawing collateral from a PartnerCapFlex
 * This reduces TVL backing and may affect minting quotas
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param collateralType Type of collateral to withdraw ('SUI' | 'USDC' | 'NFT')
 * @param amountToWithdraw Amount to withdraw (for SUI/USDC) or empty for NFT
 * @param nftCollectionType Optional NFT collection type for NFT withdrawals
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildWithdrawCollateralTransaction = (
  partnerCapFlexId: string,
  collateralType: 'SUI' | 'USDC' | 'NFT',
  amountToWithdraw?: bigint,
  nftCollectionType?: string,
  sponsorAddress?: string
) => {
  const tx = new Transaction();
  
  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored collateral withdrawal: Gas fees will be paid by ${sponsorAddress}`);
  }
  
  switch (collateralType) {
    case 'SUI':
      if (!amountToWithdraw) {
        throw new Error("Amount to withdraw is required for SUI collateral");
      }
      tx.moveCall({
        target: `${PACKAGE_ID}::partner_flex::withdraw_sui_collateral`,
        arguments: [
          tx.object(partnerCapFlexId),
          tx.pure.u64(amountToWithdraw.toString()),
          tx.object(SHARED_OBJECTS.oracle),
        ],
      });
      break;
      
    case 'USDC':
      if (!amountToWithdraw) {
        throw new Error("Amount to withdraw is required for USDC collateral");
      }
      tx.moveCall({
        target: `${PACKAGE_ID}::partner_flex::withdraw_usdc_collateral`,
        typeArguments: ['0x2::coin::Coin<0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN>'], // USDC type
        arguments: [
          tx.object(partnerCapFlexId),
          tx.pure.u64(amountToWithdraw.toString()),
          tx.object(SHARED_OBJECTS.oracle),
        ],
      });
      break;
      
    case 'NFT':
      if (!nftCollectionType) {
        throw new Error("NFT collection type is required for NFT collateral withdrawal");
      }
      tx.moveCall({
        target: `${PACKAGE_ID}::partner_flex::withdraw_nft_collateral`,
        typeArguments: [nftCollectionType],
        arguments: [
          tx.object(partnerCapFlexId),
          tx.object(SHARED_OBJECTS.oracle),
        ],
      });
      break;
      
    default:
      throw new Error(`Unsupported collateral type: ${collateralType}`);
  }
  
  return tx;
};

// === Legacy Functions (Deprecated but maintained for backward compatibility) ===

/**
 * @deprecated Use buildCreatePartnerCapFlexTransaction for TVL-backed quotas
 * Builds a transaction for creating a legacy PartnerCap
 * @param partnerName Partner name string
 * @param suiAmountMist Amount of SUI to lock as collateral (in MIST)
 * @param sponsorAddress Optional sponsor address to pay for gas fees (typically deployer/admin)
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerCapTransaction = (
  partnerName: string,
  suiAmountMist: bigint,
  sponsorAddress?: string
) => {
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored legacy PartnerCap creation: Gas fees will be paid by deployer/admin ${sponsorAddress}`);
  }

  const [collateralCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(suiAmountMist.toString())]);

  tx.moveCall({
    target: `${PACKAGE_ID}::partner::create_partner_cap_with_collateral`,
    arguments: [
      collateralCoin,
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.string(partnerName),
    ],
  });

  return tx;
};

/**
 * @deprecated Use buildCreateLoanWithPartnerFlexTransaction for TVL-backed quotas  
 * Builds a transaction for creating a loan against a staked position (legacy)
 */

// === Perk Management Functions ===

/**
 * Builds a transaction for creating a perk definition
 * Now uses upgrade-safe version with Config parameter
 * 
 * @param partnerCapId Object ID of the partner capability
 * @param perkData Perk definition data
 * @returns Transaction object ready for execution
 */
/**
 * Builds a transaction for creating partner perk stats tracking object (V2)
 * Businesses need to create this shared object to enable user-friendly perk claiming
 * 
 * @param partnerCapFlexId Object ID of business's PartnerCapFlex
 * @param dailyQuotaLimit Daily quota limit for perk claims (in Alpha Points)
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerPerkStatsTransaction = (
  partnerCapFlexId: string,
  dailyQuotaLimit: number,
  sponsorAddress?: string
): Transaction => {
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
    target: `${PACKAGE_ID}::perk_manager::create_partner_perk_stats_v2`,
    arguments: [
      tx.object(partnerCapFlexId),
      tx.pure.u64(BigInt(dailyQuotaLimit)),
    ],
  });

  return tx;
};

export const buildCreatePerkDefinitionTransaction = (
  partnerCapId: string,
  perkData: {
    name: string;
    description: string;
    perkType: string;
    usdcPrice: number;
    partnerSharePercentage: number;
    maxUsesPerClaim?: number;
    expirationTimestampMs?: number;
    generatesUniqueClaimMetadata: boolean;
    tags: string[];
    maxClaims?: number;
    initialDefinitionMetadataKeys: string[];
    initialDefinitionMetadataValues: string[];
    isActive: boolean;
  }
): Transaction => {
  if (!PACKAGE_ID || !SHARED_OBJECTS.config) {
    throw new Error("Alpha Points package or config ID is not configured.");
  }

  const tx = new Transaction();

  tx.moveCall({
    // UPDATED: Use upgrade-safe version that takes Config parameter
    target: `${PACKAGE_ID}::perk_manager::create_perk_definition_deployer_fixed`,
    arguments: [
      tx.object(SHARED_OBJECTS.config), // Config parameter for deployer address
      tx.object(partnerCapId),
      tx.pure.string(perkData.name),
      tx.pure.string(perkData.description),
      tx.pure.string(perkData.perkType),
      tx.pure.u64(BigInt(perkData.usdcPrice)),
      tx.pure.u8(perkData.partnerSharePercentage),
      perkData.maxUsesPerClaim ? tx.pure.option("u64", BigInt(perkData.maxUsesPerClaim)) : tx.pure.option("u64", null),
      perkData.expirationTimestampMs ? tx.pure.option("u64", BigInt(perkData.expirationTimestampMs)) : tx.pure.option("u64", null),
      tx.pure.bool(perkData.generatesUniqueClaimMetadata),
      tx.pure.vector("string", perkData.tags),
      perkData.maxClaims ? tx.pure.option("u64", BigInt(perkData.maxClaims)) : tx.pure.option("u64", null),
      tx.pure.vector("string", perkData.initialDefinitionMetadataKeys),
      tx.pure.vector("string", perkData.initialDefinitionMetadataValues),
      tx.pure.bool(perkData.isActive),
      tx.object(CLOCK_ID)
    ],
  });

  return tx;
};

/**
 * Find the PartnerPerkStatsV2 object ID for a given PartnerCapFlex ID
 * This function queries the blockchain to find the correct stats object
 * 
 * @param suiClient SUI client instance for blockchain queries
 * @param partnerCapId Object ID of the PartnerCapFlex
 * @returns Promise resolving to the PartnerPerkStatsV2 object ID
 */
export const findPartnerStatsId = async (
  suiClient: any,
  partnerCapId: string
): Promise<string> => {
  try {
    console.log('🔍 ===== SEARCHING FOR PARTNERPERKSTATSV2 =====');
    console.log('🔍 Partner Cap ID:', partnerCapId);
    console.log('🔍 Package ID:', PACKAGE_ID);
    console.log('🔍 Expected object type:', `${PACKAGE_ID}::perk_manager::PartnerPerkStatsV2`);

    if (!PACKAGE_ID) {
      throw new Error('PACKAGE_ID not configured');
    }

    const allFoundStatsIds: string[] = [];

    // Multi-approach search strategy for PartnerPerkStatsV2 objects
    const objectType = `${PACKAGE_ID}::perk_manager::PartnerPerkStatsV2`;
    console.log('🔍 Looking for objects of type:', objectType);
    
    // Approach 1: Search via transaction history (most reliable)
    console.log('🔍 Approach 1: Searching via transaction history...');
    try {
      // Search for recent transactions that created PartnerPerkStatsV2 objects
      const recentTxs = await suiClient.queryTransactionBlocks({
        filter: {
          MoveFunction: {
            package: PACKAGE_ID,
            module: 'perk_manager',
            function: 'create_partner_perk_stats_v2'
          }
        },
        limit: 50,
        order: 'descending'
      });
      
      console.log('🔍 Found', recentTxs.data.length, 'recent PartnerPerkStatsV2 creation transactions');
      
      for (const tx of recentTxs.data) {
        try {
          const txResponse = await suiClient.getTransactionBlock({
            digest: tx.digest,
            options: {
              showObjectChanges: true,
              showEvents: true
            }
          });
          
          // Check object changes for created PartnerPerkStatsV2 objects
          if (txResponse.objectChanges) {
            for (const change of txResponse.objectChanges) {
              if (change.type === 'created' && 
                  change.objectType && 
                  change.objectType.includes('PartnerPerkStatsV2')) {
                
                console.log('🔍 Found PartnerPerkStatsV2 object:', change.objectId);
                
                // Check if this object belongs to our partner cap
                try {
                  const objectResponse = await suiClient.getObject({
                    id: change.objectId,
                    options: { showContent: true }
                  });
                  
                  if (objectResponse.data?.content?.dataType === 'moveObject') {
                    const fields = (objectResponse.data.content as any).fields;
                    console.log('🔍 Object fields:', fields);
                    
                    if (fields.partner_cap_id === partnerCapId) {
                      console.log('✅ Found matching PartnerPerkStatsV2:', change.objectId);
                      allFoundStatsIds.push(change.objectId);
                    }
                  }
                } catch (error) {
                  console.log('❌ Error accessing object:', change.objectId, error);
                }
              }
            }
          }
          
          // Also check events as fallback
          if (txResponse.events) {
            for (const event of txResponse.events) {
              if (event.type && event.type.includes('PartnerPerkStatsCreated')) {
                console.log('🔍 Found PartnerPerkStatsCreated event:', event);
                if (event.parsedJson && 
                    event.parsedJson.partner_cap_id === partnerCapId &&
                    event.parsedJson.stats_id) {
                  console.log('✅ Found matching stats ID from event:', event.parsedJson.stats_id);
                  if (!allFoundStatsIds.includes(event.parsedJson.stats_id)) {
                    allFoundStatsIds.push(event.parsedJson.stats_id);
                  }
                }
              }
            }
          }
        } catch (txError) {
          console.log('❌ Error processing transaction:', tx.digest, txError);
        }
      }
    } catch (searchError) {
      console.log('🔍 Transaction-based search failed:', (searchError as Error).message);
    }

    // Approach 2: Fallback event search (in case transaction search missed something)
    console.log('🔍 Approach 2: Fallback event search...');
    try {
      // Try different event type variations
      const eventTypes = [
        `${PACKAGE_ID}::perk_manager::PartnerPerkStatsCreatedV2`,
        `${PACKAGE_ID}::perk_manager::PartnerPerkStatsCreated`,
        `${PACKAGE_ID}::perk_manager::StatsCreated`
      ];
      
      for (const eventType of eventTypes) {
        try {
          console.log('🔍 Trying event type:', eventType);
          const eventsResponse = await suiClient.queryEvents({
            query: {
              MoveEventType: eventType
            },
            limit: 100,
            order: 'descending'
          });
          
          console.log('🔍 Found', eventsResponse.data.length, 'events for', eventType);
          
          for (const event of eventsResponse.data) {
            if (event.parsedJson && event.parsedJson.partner_cap_id === partnerCapId) {
              const statsId = event.parsedJson.stats_id;
              if (statsId && !allFoundStatsIds.includes(statsId)) {
                console.log('✅ Found matching stats ID from event:', statsId);
                
                // Verify the object exists
                try {
                  const objectResponse = await suiClient.getObject({
                    id: statsId,
                    options: { showContent: true }
                  });
                  
                  if (objectResponse.data?.content) {
                    console.log('✅ Verified stats object exists:', statsId);
                    allFoundStatsIds.push(statsId);
                  }
                } catch (verifyError) {
                  console.log('❌ Stats object from event no longer exists:', statsId);
                }
              }
            }
          }
          
          // If we found events with this type, no need to try others
          if (eventsResponse.data.length > 0) {
            break;
          }
        } catch (eventError) {
          console.log('🔍 Event type', eventType, 'failed:', (eventError as Error).message);
        }
      }
    } catch (searchError) {
      console.log('🔍 Fallback event search failed:', (searchError as Error).message);
    }

    // Handle results - check for duplicates and return appropriate response
    if (allFoundStatsIds.length === 0) {
      console.error('❌ No PartnerPerkStatsV2 found for partner cap:', partnerCapId);
      throw new Error(`No PartnerPerkStatsV2 found for partner cap ${partnerCapId}. The partner needs to create their stats object first using the partner dashboard.`);
    } else if (allFoundStatsIds.length === 1) {
      const statsId = allFoundStatsIds[0];
      if (statsId) {
        console.log('✅ Found exactly one PartnerPerkStatsV2:', statsId);
        return statsId;
      }
    } else {
      console.warn('⚠️ DUPLICATE STATS OBJECTS DETECTED!');
      console.warn('⚠️ Found', allFoundStatsIds.length, 'PartnerPerkStatsV2 objects for partner cap:', partnerCapId);
      console.warn('⚠️ Stats IDs:', allFoundStatsIds);
      console.warn('⚠️ This should not happen - each partner should have only one stats object!');
      console.warn('⚠️ Using the first one found, but this needs to be resolved.');
      
      // Return the first one but log the issue
      const firstStatsId = allFoundStatsIds[0];
      if (firstStatsId) {
        return firstStatsId;
      }
    }
    
    // Fallback if somehow we get here
    console.error('❌ Unexpected error: Found stats IDs but none are valid');
    throw new Error(`Found ${allFoundStatsIds.length} stats objects but none are accessible for partner cap ${partnerCapId}`);
    
  } catch (error) {
    console.error('Error finding partner stats ID:', error);
    throw new Error(`Failed to find partner stats for cap ${partnerCapId}: ${error}`);
  }
};

/**
 * Creates a PartnerPerkStatsV2 object for a partner if one doesn't exist
 * This is a fallback function to ensure partners have the required stats object
 * 
 * @param partnerCapId Object ID of the PartnerCapFlex
 * @param dailyQuotaLimit Daily quota limit for the partner
 * @returns Transaction object ready for execution
 */
export const buildCreatePartnerStatsIfNeededTransaction = (
  partnerCapId: string,
  dailyQuotaLimit: number = 10000 // Default quota
): Transaction => {
  if (!PACKAGE_ID) {
    throw new Error("PACKAGE_ID not configured");
  }

  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::perk_manager::create_partner_perk_stats_v2`,
    arguments: [
      tx.object(partnerCapId), // PartnerCapFlex object
      tx.pure.u64(dailyQuotaLimit), // Daily quota limit
    ],
  });

  return tx;
};

/**
 * Comprehensive function to find or create PartnerPerkStatsV2 object
 * First tries to find existing stats, if not found, suggests creating one
 * 
 * @param suiClient SUI client instance
 * @param partnerCapId Object ID of the PartnerCapFlex
 * @returns Promise with stats ID or instructions for creation
 */
export const findOrSuggestCreatePartnerStats = async (
  suiClient: any,
  partnerCapId: string
): Promise<{ statsId?: string; needsCreation?: boolean; createTransaction?: Transaction }> => {
  try {
    const statsId = await findPartnerStatsId(suiClient, partnerCapId);
    return { statsId };
  } catch (error) {
    console.warn('PartnerPerkStatsV2 not found, suggesting creation for partner:', partnerCapId);
    
    // Create a transaction that the partner can execute to create their stats object
    const createTransaction = buildCreatePartnerStatsIfNeededTransaction(partnerCapId);
    
    return { 
      needsCreation: true, 
      createTransaction,
    };
  }
};

/**
 * ENHANCED: Automatically handle PartnerPerkStatsV2 creation during perk claiming
 * This eliminates the need for users to manually create stats objects
 * 
 * @param suiClient SUI client instance
 * @param partnerCapId Object ID of the PartnerCapFlex
 * @param signAndExecuteTransaction Function to execute transactions (optional)
 * @returns Promise with stats ID (creates if needed and possible)
 */
export const ensurePartnerStatsExists = async (
  suiClient: any,
  partnerCapId: string,
  signAndExecuteTransaction?: any
): Promise<string> => {
  try {
    // First, try to find existing stats
    const statsId = await findPartnerStatsId(suiClient, partnerCapId);
    console.log('✅ Found existing PartnerPerkStatsV2:', statsId);
    return statsId;
  } catch (error) {
    console.log('⚡ PartnerPerkStatsV2 not found...');
    
    // Only attempt auto-creation if signAndExecuteTransaction is available
    if (!signAndExecuteTransaction) {
      console.log('❌ Cannot auto-create PartnerPerkStatsV2 - no transaction function available');
      throw new Error(
        `No PartnerPerkStatsV2 found for partner cap ${partnerCapId}. ` +
        `The partner needs to create their stats object first using the partner dashboard.`
      );
    }
    
    console.log('⚡ Attempting auto-creation of PartnerPerkStatsV2...');
    
    // Calculate appropriate daily quota based on partner collateral
    // This should match the partner's actual quota from their PartnerCapFlex
    const defaultDailyQuota = 50000; // Conservative default - partners can adjust later
    
    try {
      // Create the stats object automatically
      const createTransaction = buildCreatePartnerStatsIfNeededTransaction(partnerCapId, defaultDailyQuota);
      
      const result = await signAndExecuteTransaction({
        transaction: createTransaction,
        chain: 'sui:testnet',
      });
      
      if (result?.digest) {
        console.log('✅ PartnerPerkStatsV2 created automatically:', result.digest);
        
        // Extract the newly created stats ID from the transaction
        const newStatsId = await extractStatsIdFromCreationTransaction(suiClient, result.digest);
        if (newStatsId) {
          console.log('✅ Extracted new stats ID:', newStatsId);
          return newStatsId;
        } else {
          throw new Error('Failed to extract stats ID from creation transaction');
        }
      } else {
        throw new Error('Failed to create PartnerPerkStatsV2 - no transaction digest');
      }
    } catch (creationError) {
      console.error('❌ Failed to auto-create PartnerPerkStatsV2:', creationError);
      throw new Error(
        `Unable to create required PartnerPerkStatsV2 object. ` +
        `The partner needs to create their stats object first using the partner dashboard. ` +
        `Error: ${creationError instanceof Error ? creationError.message : 'Unknown error'}`
      );
    }
  }
};

/**
 * Extract PartnerPerkStatsV2 ID from a creation transaction
 * Parses transaction effects to find the newly created stats object
 */
export const extractStatsIdFromCreationTransaction = async (
  suiClient: any,
  txDigest: string
): Promise<string | null> => {
  try {
    console.log('🔍 Extracting stats ID from transaction:', txDigest);
    
    // Get transaction details including effects
    const txResponse = await suiClient.getTransactionBlock({
      digest: txDigest,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });
    
    // Method 1: Check events for PartnerPerkStatsCreatedV2
    if (txResponse.events) {
      for (const event of txResponse.events) {
        if (event.type.includes('::perk_manager::PartnerPerkStatsCreatedV2') && event.parsedJson) {
          const statsId = event.parsedJson.stats_id;
          console.log('✅ Found stats ID from creation event:', statsId);
          return statsId;
        }
      }
    }
    
    // Method 2: Check object changes for created shared objects
    if (txResponse.objectChanges) {
      for (const change of txResponse.objectChanges) {
        if (change.type === 'created' && 
            change.objectType && 
            change.objectType.includes('::perk_manager::PartnerPerkStatsV2')) {
          const statsId = change.objectId;
          console.log('✅ Found stats ID from object changes:', statsId);
          return statsId;
        }
      }
    }
    
    console.warn('⚠️ Could not extract stats ID from transaction');
    return null;
  } catch (error) {
    console.error('❌ Error extracting stats ID:', error);
    return null;
  }
};

/**
 * Builds a transaction for claiming a perk (V2 - with partner stats)
 * Uses the new claim_perk_by_user_v2 function with full partner stats tracking
 * 
 * @param perkDefinitionId Object ID of the perk definition
 * @param partnerStatsId Object ID of the PartnerPerkStatsV2 tracking object
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
    // V2: Use function with proper partner stats tracking
    target: `${PACKAGE_ID}::perk_manager::claim_perk_by_user_v2`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(perkDefinitionId),
      tx.object(partnerStatsId), // Now using the correct PartnerPerkStatsV2 object ID
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(CLOCK_ID)
    ],
  });

  return tx;
};

/**
 * Builds a transaction for claiming a perk with metadata (V2 - with partner stats)
 * Uses the new claim_perk_with_metadata_by_user_v2 function with full partner stats tracking
 * 
 * @param perkDefinitionId Object ID of the perk definition
 * @param partnerStatsId Object ID of the PartnerPerkStatsV2 tracking object
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
    // V2: Use function with proper partner stats tracking
    target: `${PACKAGE_ID}::perk_manager::claim_perk_with_metadata_by_user_v2`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(perkDefinitionId),
      tx.object(partnerStatsId), // Now using the correct PartnerPerkStatsV2 object ID
      tx.object(SHARED_OBJECTS.ledger),
      tx.pure.string(metadataKey),
      tx.pure.string(metadataValue),
      tx.object(CLOCK_ID)
    ],
  });

  return tx;
};

/**
 * Builds a transaction for updating perk definition activity status
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex (must be perk creator)
 * @param perkDefinitionId Object ID of the PerkDefinition to update
 * @param isActive New active status
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildSetPerkActiveStatusTransaction = (
  partnerCapFlexId: string,
  perkDefinitionId: string,
  isActive: boolean,
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
    target: `${PACKAGE_ID}::perk_manager::set_perk_definition_active_status`,
    arguments: [
      tx.object(partnerCapFlexId),
      tx.object(perkDefinitionId),
      tx.pure.bool(isActive),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for updating perk definition settings
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex (must be perk creator)
 * @param perkDefinitionId Object ID of the PerkDefinition to update
 * @param maxUsesPerClaim Optional new max uses per claim
 * @param expirationTimestampMs Optional new expiration timestamp
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildUpdatePerkSettingsTransaction = (
  partnerCapFlexId: string,
  perkDefinitionId: string,
  maxUsesPerClaim?: number,
  expirationTimestampMs?: number,
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

  const maxUsesOption = maxUsesPerClaim 
    ? bcs.option(bcs.u64()).serialize(BigInt(maxUsesPerClaim))
    : bcs.option(bcs.u64()).serialize(undefined);

  const expirationOption = expirationTimestampMs
    ? bcs.option(bcs.u64()).serialize(BigInt(expirationTimestampMs))
    : bcs.option(bcs.u64()).serialize(undefined);

  tx.moveCall({
    target: `${PACKAGE_ID}::perk_manager::update_perk_definition_settings`,
    arguments: [
      tx.object(partnerCapFlexId),
      tx.object(perkDefinitionId),
      tx.pure(maxUsesOption),
      tx.pure(expirationOption),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for updating perk tags
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex (must be perk creator)
 * @param perkDefinitionId Object ID of the PerkDefinition to update
 * @param newTags Array of new tag strings
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildUpdatePerkTagsTransaction = (
  partnerCapFlexId: string,
  perkDefinitionId: string,
  newTags: string[],
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
    target: `${PACKAGE_ID}::perk_manager::update_perk_tags`,
    arguments: [
      tx.object(partnerCapFlexId),
      tx.object(perkDefinitionId),
      tx.pure(bcs.vector(bcs.String).serialize(newTags)),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for updating perk price (Alpha Points conversion)
 * 
 * 🚨 WORKAROUND NOTE: This function now includes a fix for the contract pricing bug.
 * The contract incorrectly uses oracle conversion for USDC→Alpha Points, so we need
 * to transform the stored USDC price to make the buggy conversion produce correct results.
 * 
 * @param perkDefinitionId Object ID of the PerkDefinition to update
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildUpdatePerkPriceTransaction = (
  perkDefinitionId: string,
  sponsorAddress?: string
) => {
  if (!PACKAGE_ID || !SHARED_OBJECTS.oracle || !CLOCK_ID) {
    throw new Error("Required contract objects not configured");
  }

  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
    console.log(`🎁 Sponsored transaction: Gas fees will be paid by ${sponsorAddress}`);
  }

  // 🚨 IMPORTANT: The buildUpdatePerkPriceTransaction function only triggers a price recalculation
  // based on the existing stored usdc_price in the contract. Since existing perks have the 
  // original USDC values stored, the contract will apply the buggy oracle conversion to those.
  //
  // To fix existing perks, we would need to:
  // 1. Read the current perk data
  // 2. Calculate the correct transformed USDC value  
  // 3. Update the stored usdc_price field (if such a function exists)
        // 4. Then call update_perk_price_fixed()
  //
  // Since there's no direct way to update the stored usdc_price, this function will
  // still produce buggy results for existing perks. The real fix requires contract deployment.

  console.log(`⚠️  WARNING: Price update for existing perks will still use buggy oracle conversion!`);
  console.log(`   This function can only fix the pricing when the contract is updated.`);
  console.log(`   For immediate fix: Create new perks with the corrected frontend workaround.`);

  tx.moveCall({
            target: `${PACKAGE_ID}::perk_manager::update_perk_price_fixed`,
    arguments: [
      tx.object(perkDefinitionId),
      tx.object(SHARED_OBJECTS.oracle),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};

/**
 * Builds a transaction for updating partner perk control settings
 * 
 * @param partnerCapFlexId Object ID of the PartnerCapFlex
 * @param maxPerksPerPartner Maximum number of perks this partner can create
 * @param maxClaimsPerPerk Maximum number of claims allowed per perk
 * @param maxCostPerPerk Maximum USDC cost allowed per perk (user inputs $1000, we convert to micro-USDC)
 * @param minPartnerSharePercentage Minimum revenue share percentage for partner (0-100)
 * @param maxPartnerSharePercentage Maximum revenue share percentage for partner (0-100)
 * @param allowConsumablePerks Whether partner can create consumable perks
 * @param allowExpiringPerks Whether partner can create perks with expiration
 * @param allowUniqueMetadata Whether partner can create perks with unique metadata
 * @param sponsorAddress Optional sponsor address to pay for gas fees
 * @returns Transaction object ready for execution
 */
export const buildUpdatePerkControlSettingsTransaction = (
  partnerCapFlexId: string,
  maxPerksPerPartner: number,
  maxClaimsPerPerk: number,
  maxCostPerPerk: number,
  minPartnerSharePercentage: number,
  maxPartnerSharePercentage: number,
  allowConsumablePerks: boolean,
  allowExpiringPerks: boolean,
  allowUniqueMetadata: boolean,
  sponsorAddress?: string
) => {
  if (!PACKAGE_ID) {
    throw new Error("PACKAGE_ID not configured");
  }

  // Validate inputs
  if (!partnerCapFlexId || partnerCapFlexId.length < 10) {
    throw new Error(`Invalid partnerCapFlexId: ${partnerCapFlexId}`);
  }
  
  if (maxPerksPerPartner < 0 || maxClaimsPerPerk < 0 || maxCostPerPerk < 0) {
    throw new Error("Quota values cannot be negative");
  }
  
  if (minPartnerSharePercentage < 0 || minPartnerSharePercentage > 100 ||
      maxPartnerSharePercentage < 0 || maxPartnerSharePercentage > 100) {
    throw new Error("Share percentages must be between 0 and 100");
  }
  
  if (minPartnerSharePercentage > maxPartnerSharePercentage) {
    throw new Error("Min share percentage cannot be greater than max share percentage");
  }

  // FIXED: Use oracle conversion to match smart contract validation
  // Smart contract: converts USD → oracle → Alpha Points for validation
  // Settings: should store the same Alpha Points the smart contract expects
  const maxCostPerPerkAlphaPoints = usdToAlphaPointsForSettingsViaOracle(maxCostPerPerk);
  
  const tx = new Transaction();

  // Set up sponsorship if sponsor address is provided
  if (sponsorAddress) {
    tx.setSender(sponsorAddress);
  }

  try {
    tx.moveCall({
      target: `${PACKAGE_ID}::partner_flex::update_perk_control_settings_v2_entry`,
      arguments: [
        tx.object(partnerCapFlexId),
        tx.pure.u64(BigInt(maxPerksPerPartner)),
        tx.pure.u64(BigInt(maxClaimsPerPerk)),
        tx.pure.u64(BigInt(maxCostPerPerkAlphaPoints)), // FIXED: Pass Alpha Points to match smart contract expectation
        tx.pure.u8(minPartnerSharePercentage),
        tx.pure.u8(maxPartnerSharePercentage),
        tx.pure.bool(allowConsumablePerks),
        tx.pure.bool(allowExpiringPerks),
        tx.pure.bool(allowUniqueMetadata),
      ],
    });
  } catch (error) {
    console.error('[ERROR] Failed to build transaction:', error);
    throw new Error(`Failed to build transaction: ${error}`);
  }

  return tx;
};

/**
 * Builds a sponsored transaction for creating a TVL-backed PartnerCapFlex with collateral
 * This is the new recommended way to create partner capabilities with sponsorship
 * 
 * @param partnerName Partner name string
 * @param suiAmountMist Amount of SUI to lock as collateral (in MIST)
 * @param sponsorAddress Optional sponsor address to pay for gas fees
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
 * Safely creates a PartnerPerkStatsV2 object only if one doesn't already exist
 * This prevents duplicate stats objects for the same partner cap
 * 
 * @param suiClient SUI client instance
 * @param partnerCapId Object ID of the PartnerCapFlex
 * @param dailyQuotaLimit Daily quota limit for the partner
 * @returns Transaction object ready for execution, or null if stats already exist
 */
export const buildCreatePartnerStatsIfNotExistsTransaction = async (
  suiClient: any,
  partnerCapId: string,
  dailyQuotaLimit: number = 10000
): Promise<{ transaction: Transaction | null; alreadyExists: boolean; existingStatsId?: string; duplicateCount?: number }> => {
  try {
    // First check if stats already exist
    const existingStatsId = await findPartnerStatsId(suiClient, partnerCapId);
    
    console.log('⚠️ PartnerPerkStatsV2 already exists for this partner cap:', existingStatsId);
    return { 
      transaction: null, 
      alreadyExists: true, 
      existingStatsId 
    };
  } catch (error) {
    // Stats don't exist, safe to create
    console.log('✅ No existing PartnerPerkStatsV2 found, creating new one...');
    
    const transaction = buildCreatePartnerStatsIfNeededTransaction(partnerCapId, dailyQuotaLimit);
    return { 
      transaction, 
      alreadyExists: false 
    };
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
 * Builds a transaction to extract StakedSui from Alpha Points StakePosition wrapper
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

// === CROSS-PACKAGE RECOVERY FUNCTIONS ===




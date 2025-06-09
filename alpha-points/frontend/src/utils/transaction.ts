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
 * Builds a transaction to purchase an Alpha Perk from the marketplace.
 * This calls the `purchase_marketplace_perk` function in `integration.move`.
 * If the perk is a role perk, it also creates a SuiNS subname.
 * 
 * @param pointsToSpend The amount of Alpha Points the user is spending.
 * @param partnerCapId The Object ID of the PartnerCap for the perk provider.
 * @param perkIdentifier Optional string to identify the perk for on-chain events.
 * @param uniqueCode The subname to register if it's a role perk.
 * @param userAddress The user's Sui address.
 * @param suinsClientInstance An instance of SuinsClient for SuiNS operations.
 * @returns A Transaction object ready for signing and execution.
 */
export const buildPurchaseAlphaPerkTransaction = (
  amount: number, 
  partnerCapId: string, 
  perkId: string, 
  uniqueCode: string, 
  userAddress: string,
  suinsClientInstance: SuinsClient // Use the actual SuinsClient type
): Transaction => {
  if (!PACKAGE_ID) {
    throw new Error("PACKAGE_ID is not configured in your contract config.");
  }
  if (!SHARED_OBJECTS.config) {
    throw new Error("SHARED_OBJECTS.config is not configured in your contract config.");
  }
  if (!SHARED_OBJECTS.ledger) {
    throw new Error("SHARED_OBJECTS.ledger (Ledger ID) is not configured in your contract config. Cannot build transaction.");
  }
  if (!CLOCK_ID) {
    throw new Error("CLOCK_ID is not configured in your contract config.");
  }
  if (!SHARED_OBJECTS.partnerCap) {
    throw new Error("partnerCap is missing. Cannot build transaction.");
  }

  const tx = new Transaction();

  // 1. Call the purchase_marketplace_perk function from integration.move
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::purchase_marketplace_perk`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.partnerCap),
      tx.pure.u64(BigInt(amount)),
      tx.object(CLOCK_ID),
    ],
  });

  // 2. If it's a role perk, create SuiNS subname and set metadata
  if ((perkId === 'alpha4-tester-role' || perkId === 'alpha4-veteran-role') && 
      uniqueCode && VITE_SUINS_PARENT_DOMAIN_NAME && userAddress && suinsClientInstance) {
    // Use the proxy to mint the subname
    const suinsTx = new SuinsTransaction(suinsClientInstance, tx);
    const fullNameWithSui = `${uniqueCode}.${VITE_SUINS_PARENT_DOMAIN_NAME}`;
    try {
      // Call the proxy function instead of direct SuiNS call
      tx.moveCall({
        target: `${PACKAGE_ID}::sui_ns_proxy::proxy_mint_subname`,
        arguments: [
          tx.object(SHARED_OBJECTS.partnerCap), // Always use the proxy PartnerCap
          tx.pure(bcs.Address.serialize(userAddress)), // User address
          tx.pure(bcs.String.serialize(fullNameWithSui)), // Full subname
          tx.pure(bcs.String.serialize(VITE_SUINS_PARENT_DOMAIN_NAME)), // Parent domain
        ],
      });
    } catch (error: any) {
      console.error('[SuiNS Debug] proxy_mint_subname failed:', error);
      throw error;
    }
  }

  return tx;
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
 * Builds a transaction for claiming a perk
 * Now uses upgrade-safe version with Config parameter
 * 
 * @param perkDefinitionId Object ID of the perk definition
 * @param partnerCapId Object ID of the partner capability
 * @returns Transaction object ready for execution
 */
export const buildClaimPerkTransaction = (
  perkDefinitionId: string,
  partnerCapId: string
): Transaction => {
  if (!PACKAGE_ID || !SHARED_OBJECTS.config || !SHARED_OBJECTS.ledger || !SHARED_OBJECTS.oracle) {
    throw new Error("Alpha Points package or shared objects are not configured.");
  }

  const tx = new Transaction();

  tx.moveCall({
    // NEW: Use configurable revenue split function that respects RevenueSplitPolicy percentages from the frontend slider
    target: `${PACKAGE_ID}::perk_manager::claim_perk_configurable_split`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(perkDefinitionId),
      tx.object(partnerCapId),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(CLOCK_ID)
    ],
  });

  return tx;
};

/**
 * Builds a transaction for claiming a perk with metadata
 * Now uses upgrade-safe version with Config parameter
 * 
 * @param perkDefinitionId Object ID of the perk definition
 * @param partnerCapId Object ID of the partner capability
 * @param metadataKey Key for the claim-specific metadata
 * @param metadataValue Value for the claim-specific metadata
 * @returns Transaction object ready for execution
 */
export const buildClaimPerkWithMetadataTransaction = (
  perkDefinitionId: string,
  partnerCapId: string,
  metadataKey: string,
  metadataValue: string
): Transaction => {
  if (!PACKAGE_ID || !SHARED_OBJECTS.config || !SHARED_OBJECTS.ledger || !SHARED_OBJECTS.oracle) {
    throw new Error("Alpha Points package or shared objects are not configured.");
  }

  const tx = new Transaction();

  tx.moveCall({
    // NEW: Use configurable revenue split function that respects RevenueSplitPolicy percentages from the frontend slider
    target: `${PACKAGE_ID}::perk_manager::claim_perk_with_metadata_configurable_split`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(perkDefinitionId),
      tx.object(partnerCapId),
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
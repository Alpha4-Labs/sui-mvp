/**
 * Transaction builder utilities for Alpha4 Rewards system
 * Based on the comprehensive frontend transaction utilities and aligned with perk_manager.move
 * Handles Alpha Points spending, perk claiming, and Discord role assignment
 */

import { Transaction } from '@mysten/sui/transactions';
// import { bcs } from '@mysten/sui/bcs'; // Not currently used
import { SUI_CONFIG } from '../config/sui';
import type { Alpha4Perk } from '../types/index';

// Constants for Sui system
const CLOCK_ID = '0x6';
// const SUI_SYSTEM_STATE_ID = '0x5'; // Not currently used

// Environment variables for contract configuration
const PACKAGE_ID = import.meta.env['VITE_PACKAGE_ID'] || SUI_CONFIG.packageIds.perkManager;
const LEDGER_ID = import.meta.env['VITE_LEDGER_ID'];
const CONFIG_ID = import.meta.env['VITE_CONFIG_ID'];
const ORACLE_ID = import.meta.env['VITE_ORACLE_ID'];
const PARTNER_CAP_ID = import.meta.env['VITE_PARTNER_CAP_ID'];

// Shared objects configuration
const SHARED_OBJECTS = {
  config: CONFIG_ID,
  ledger: LEDGER_ID,
  oracle: ORACLE_ID,
  partnerCap: PARTNER_CAP_ID,
} as const;

/**
 * Enhanced transaction builder class aligned with perk_manager.move contract
 */
export class TransactionBuilder {
  /**
   * Builds a transaction for claiming a perk from a PerkDefinition
   * Uses the claim_perk function from perk_manager.move
   * 
   * @param perkDefinitionId Object ID of the PerkDefinition to claim
   * @param partnerCapId Object ID of the PartnerCapFlex for the perk creator
   * @param userAddress User's Sui address
   * @returns Transaction object ready for signing and execution
   */
  static buildClaimPerkTransaction(
    perkDefinitionId: string,
    partnerCapId: string,
    userAddress: string
  ): Transaction {
    if (!PACKAGE_ID || !SHARED_OBJECTS.ledger || !SHARED_OBJECTS.oracle || !CLOCK_ID) {
      throw new Error("Required contract objects not configured");
    }

    const tx = new Transaction();

    console.log('🔧 Building perk claim transaction:', {
      perkDefinitionId,
      partnerCapId,
      userAddress
    });

    try {
      // Call the claim_perk function from perk_manager.move
      // claim_perk(perk_definition, partner_cap, ledger, rate_oracle, clock_obj, ctx)
      tx.moveCall({
        target: `${PACKAGE_ID}::perk_manager::claim_perk`,
        arguments: [
          tx.object(perkDefinitionId),        // perk_definition: &mut PerkDefinition
          tx.object(partnerCapId),            // partner_cap: &mut PartnerCapFlex
          tx.object(SHARED_OBJECTS.ledger),   // ledger: &mut Ledger
          tx.object(SHARED_OBJECTS.oracle),   // rate_oracle: &RateOracle
          tx.object(CLOCK_ID),                // clock_obj: &Clock
        ],
      });

      tx.setGasBudget(15_000_000); // 0.015 SUI - higher budget for complex perk claiming

      console.log('✅ Perk claim transaction built successfully');
      return tx;

    } catch (error) {
      console.error('❌ Error building perk claim transaction:', error);
      throw new Error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds a transaction for purchasing an Alpha Perk from the marketplace
   * This integrates Alpha Points spending with optional Discord role assignment
   * 
   * @param userAddress User's Sui address
   * @param perk The Alpha4 perk being purchased
   * @param uniqueCode Optional unique code for role perks (e.g., SuiNS subname)
   * @returns Transaction object ready for signing and execution
   */
  static buildPurchaseAlphaPerkTransaction(
    userAddress: string,
    perk: Alpha4Perk,
    uniqueCode?: string
  ): Transaction {
    if (!PACKAGE_ID) {
      throw new Error("PACKAGE_ID is not configured in your contract config.");
    }
    if (!SHARED_OBJECTS.config) {
      throw new Error("SHARED_OBJECTS.config is not configured.");
    }
    if (!SHARED_OBJECTS.ledger) {
      throw new Error("SHARED_OBJECTS.ledger is not configured. Cannot build transaction.");
    }
    if (!CLOCK_ID) {
      throw new Error("CLOCK_ID is not configured.");
    }

    const tx = new Transaction();

    console.log('🔧 Building Alpha Perk purchase transaction:', {
      perkName: perk.name,
      cost: perk.alphaPointCost,
      userAddress,
      uniqueCode
    });

    try {
      // 1. Call the main perk purchase function (custom Alpha4 marketplace function)
      tx.moveCall({
        target: `${PACKAGE_ID}::integration::purchase_marketplace_perk`,
        arguments: [
          tx.object(SHARED_OBJECTS.config),
          tx.object(SHARED_OBJECTS.ledger),
          tx.object(SHARED_OBJECTS.partnerCap || ''),
          tx.pure.u64(BigInt(perk.alphaPointCost)),
          tx.object(CLOCK_ID),
        ],
      });

      // 2. For Discord role perks, add additional role assignment logic
      if (this.isDiscordRolePerk(perk) && uniqueCode) {
        // Add Discord role assignment transaction call
        // This would be implemented based on your specific Discord integration contract
        console.log('🔧 Adding Discord role assignment for perk:', perk.name);
      }

      // Set appropriate gas budget
      tx.setGasBudget(10_000_000); // 0.01 SUI

      console.log('✅ Transaction built successfully');
      return tx;

    } catch (error) {
      console.error('❌ Error building perk purchase transaction:', error);
      throw new Error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds a transaction for updating a perk's Alpha Points price
   * Uses the update_perk_price function from perk_manager.move
   * 
   * @param perkDefinitionId Object ID of the PerkDefinition to update
   * @param userAddress User's Sui address (should be authorized)
   * @returns Transaction object ready for signing and execution
   */
  static buildUpdatePerkPriceTransaction(
    perkDefinitionId: string,
    userAddress: string
  ): Transaction {
    if (!PACKAGE_ID || !SHARED_OBJECTS.oracle || !CLOCK_ID) {
      throw new Error("Required contract objects not configured for price update");
    }

    const tx = new Transaction();

    console.log('🔧 Building perk price update transaction:', {
      perkDefinitionId,
      userAddress
    });

    try {
      // Call the update_perk_price function from perk_manager.move
      // update_perk_price(perk_definition, rate_oracle, clock_obj, ctx)
      tx.moveCall({
        target: `${PACKAGE_ID}::perk_manager::update_perk_price`,
        arguments: [
          tx.object(perkDefinitionId),        // perk_definition: &mut PerkDefinition
          tx.object(SHARED_OBJECTS.oracle),   // rate_oracle: &RateOracle
          tx.object(CLOCK_ID),                // clock_obj: &Clock
        ],
      });

      tx.setGasBudget(5_000_000); // 0.005 SUI - simple price update

      console.log('✅ Perk price update transaction built successfully');
      return tx;

    } catch (error) {
      console.error('❌ Error building perk price update transaction:', error);
      throw new Error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds a transaction for consuming a use of a consumable perk
   * Uses the consume_perk_use function from perk_manager.move
   * 
   * @param claimedPerkId Object ID of the ClaimedPerk to consume
   * @param perkDefinitionId Object ID of the associated PerkDefinition
   * @param userAddress User's Sui address
   * @returns Transaction object ready for execution
   */
  static buildConsumePerkTransaction(
    claimedPerkId: string,
    perkDefinitionId: string,
    userAddress: string
  ): Transaction {
    if (!PACKAGE_ID) {
      throw new Error("Package ID is not configured.");
    }

    const tx = new Transaction();

    console.log('🔧 Building perk consumption transaction:', {
      claimedPerkId,
      perkDefinitionId,
      userAddress
    });

    try {
      // Call the consume_perk_use function from perk_manager.move
      // consume_perk_use(claimed_perk, perk_definition, ctx)
      tx.moveCall({
        target: `${PACKAGE_ID}::perk_manager::consume_perk_use`,
        arguments: [
          tx.object(claimedPerkId),           // claimed_perk: &mut ClaimedPerk
          tx.object(perkDefinitionId),        // perk_definition: &PerkDefinition
        ],
      });

      tx.setGasBudget(5_000_000); // 0.005 SUI - simple consumption

      console.log('✅ Perk consumption transaction built successfully');
      return tx;

    } catch (error) {
      console.error('❌ Error building perk consumption transaction:', error);
      throw new Error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds a transaction for redeeming Alpha Points for SUI
   * Based on the frontend implementation
   * 
   * @param pointsToRedeem Amount of Alpha Points to redeem
   * @param userAddress User's Sui address
   * @returns Transaction object ready for execution
   */
  static buildRedeemPointsTransaction(
    pointsToRedeem: string,
    userAddress: string
  ): Transaction {
    if (!PACKAGE_ID || !SHARED_OBJECTS.ledger) {
      throw new Error("Alpha Points package or ledger ID is not configured.");
    }

    const tx = new Transaction();

    console.log('🔧 Building Alpha Points redemption transaction:', {
      pointsToRedeem,
      userAddress
    });

    try {
      tx.moveCall({
        target: `${PACKAGE_ID}::integration::redeem_points_for_sui`,
        arguments: [
          tx.object(SHARED_OBJECTS.config || ''),
          tx.object(SHARED_OBJECTS.ledger),
          tx.object(SHARED_OBJECTS.oracle || ''), // Escrow vault might be needed
          tx.object(SHARED_OBJECTS.oracle || ''), // Oracle for conversion rates
          tx.pure.u64(BigInt(pointsToRedeem)),
          tx.object(CLOCK_ID)
        ],
      });

      tx.setGasBudget(10_000_000); // 0.01 SUI

      console.log('✅ Points redemption transaction built successfully');
      return tx;

    } catch (error) {
      console.error('❌ Error building points redemption transaction:', error);
      throw new Error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds a simple test transaction for connectivity testing
   * Transfers a tiny amount to self to verify wallet connectivity
   * 
   * @param userAddress User's Sui address
   * @returns Transaction object ready for testing
   */
  static buildTestTransaction(userAddress: string): Transaction {
    const tx = new Transaction();

    console.log('🔧 Building test transaction for:', userAddress);

    try {
      // Create a simple coin split and merge back for testing
      const coin = tx.splitCoins(tx.gas, [1]); // Split 1 MIST
      tx.mergeCoins(tx.gas, [coin]); // Merge it back

      tx.setGasBudget(1_000_000); // 0.001 SUI - minimal for testing

      console.log('✅ Test transaction built successfully');
      return tx;

    } catch (error) {
      console.error('❌ Error building test transaction:', error);
      throw new Error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds a transaction for earning Alpha Points (partner-side operation)
   * 
   * @param userAddress User's Sui address
   * @param pointsAmount Amount of points to earn
   * @param partnerCapId Optional partner capability ID
   * @returns Transaction object ready for execution
   */
  static buildEarnPointsTransaction(
    userAddress: string,
    pointsAmount: bigint,
    partnerCapId?: string
  ): Transaction {
    if (!PACKAGE_ID || !SHARED_OBJECTS.ledger) {
      throw new Error("Alpha Points package or ledger ID is not configured.");
    }

    const tx = new Transaction();

    console.log('🔧 Building Alpha Points earning transaction:', {
      userAddress,
      pointsAmount: pointsAmount.toString(),
      partnerCapId
    });

    try {
      tx.moveCall({
        target: `${PACKAGE_ID}::ledger::internal_earn`,
        arguments: [
          tx.object(SHARED_OBJECTS.ledger),
          tx.pure.address(userAddress),
          tx.pure.u64(pointsAmount),
        ],
      });

      tx.setGasBudget(5_000_000); // 0.005 SUI

      console.log('✅ Points earning transaction built successfully');
      return tx;

    } catch (error) {
      console.error('❌ Error building points earning transaction:', error);
      throw new Error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a perk requires Discord role assignment
   */
  private static isDiscordRolePerk(perk: Alpha4Perk): boolean {
    return perk.requiredPerkType === 'discord_access' || 
           !!(perk.requiredTags && perk.requiredTags.includes('discord'));
  }

  /**
   * Validates transaction parameters before building
   */
  static validateTransactionParams(params: {
    userAddress?: string;
    perk?: Alpha4Perk;
    amount?: number | bigint;
  }): void {
    if (params.userAddress && !params.userAddress.startsWith('0x')) {
      throw new Error('Invalid user address format');
    }

    if (params.perk && !params.perk.isAvailable) {
      throw new Error('Perk is not available for claiming');
    }

    if (params.amount && (typeof params.amount === 'number' ? params.amount <= 0 : params.amount <= 0n)) {
      throw new Error('Amount must be greater than zero');
    }
  }

  /**
   * Get estimated gas cost for different transaction types
   */
  static getEstimatedGasCost(transactionType: 'perk_claim' | 'perk_purchase' | 'price_update' | 'consume_perk' | 'redeem_points' | 'test'): number {
    const gasMap = {
      'perk_claim': 15_000_000,     // 0.015 SUI - complex operation with partner cap and revenue split
      'perk_purchase': 10_000_000,   // 0.01 SUI - marketplace purchase
      'price_update': 5_000_000,     // 0.005 SUI - simple price update
      'consume_perk': 5_000_000,     // 0.005 SUI - simple consumption
      'redeem_points': 10_000_000,   // 0.01 SUI - points redemption
      'test': 1_000_000,             // 0.001 SUI - minimal test
    };
    
    return gasMap[transactionType] || gasMap.test;
  }
}

/**
 * Helper functions for transaction building
 */
export const TransactionHelpers = {
  /**
   * Convert USD to micro-USDC (multiply by 1,000,000)
   */
  usdToMicroUSDC: (usd: number): number => {
    return Math.floor(usd * 1_000_000);
  },

  /**
   * Convert Alpha Points to display format
   */
  formatAlphaPoints: (points: number | bigint): string => {
    const pointsNum = typeof points === 'bigint' ? Number(points) : points;
    return pointsNum.toLocaleString();
  },

  /**
   * Check if contract configuration is complete
   */
  isConfigurationComplete: (): boolean => {
    return !!(PACKAGE_ID && SHARED_OBJECTS.ledger && SHARED_OBJECTS.config);
  },

  /**
   * Get configuration status for debugging
   */
  getConfigurationStatus: () => ({
    packageId: PACKAGE_ID ? '✅ Configured' : '❌ Missing',
    ledger: SHARED_OBJECTS.ledger ? '✅ Configured' : '❌ Missing',
    config: SHARED_OBJECTS.config ? '✅ Configured' : '❌ Missing',
    oracle: SHARED_OBJECTS.oracle ? '✅ Configured' : '❌ Missing',
    partnerCap: SHARED_OBJECTS.partnerCap ? '✅ Configured' : '❌ Missing',
  })
};

// Export the transaction builder as default
export default TransactionBuilder; 
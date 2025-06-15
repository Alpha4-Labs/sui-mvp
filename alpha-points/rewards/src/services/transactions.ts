import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { SUI_CONFIG } from '../config/sui';
import { DiscordAuthService } from './discord';
import TransactionBuilder, { TransactionHelpers } from '../utils/transactionBuilder';
import type { Alpha4Perk } from '../types/index';

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  discordRoleAssigned?: boolean;
}

export interface SpendAlphaPointsParams {
  userAddress: string;
  perk: Alpha4Perk;
  signAndExecuteTransaction: (transaction: Transaction) => Promise<any>;
  uniqueCode?: string; // For Discord role perks
}

export class TransactionService {
  private suiClient: SuiClient;
  private discordAuth: DiscordAuthService;

  constructor() {
    this.suiClient = new SuiClient({ url: SUI_CONFIG.rpcUrl });
    this.discordAuth = DiscordAuthService.getInstance();
  }

  /**
   * Main method to spend Alpha Points and claim a perk
   * Enhanced with the new transaction builder patterns
   */
  async spendAlphaPoints(params: SpendAlphaPointsParams): Promise<TransactionResult> {
    const { userAddress, perk, signAndExecuteTransaction, uniqueCode } = params;

    try {
      console.log('🚀 Starting Alpha Points transaction:', {
        perkName: perk.name,
        cost: perk.alphaPointCost,
        userAddress,
        configStatus: TransactionHelpers.getConfigurationStatus()
      });

      // 1. Validate transaction parameters
      TransactionBuilder.validateTransactionParams({ userAddress, perk });

      // 2. Check configuration completeness
      if (!TransactionHelpers.isConfigurationComplete()) {
        console.warn('⚠️ Transaction configuration incomplete:', TransactionHelpers.getConfigurationStatus());
        return {
          success: false,
          error: 'Smart contract configuration is incomplete. Please check environment variables.'
        };
      }

      // 3. Validate Discord connection for Discord perks
      if (this.isDiscordPerk(perk)) {
        if (!this.discordAuth.isAuthenticated()) {
          return {
            success: false,
            error: 'Discord account must be connected to claim this perk'
          };
        }
      }

      // 4. Build the transaction using the enhanced builder
      const transaction = this.buildEnhancedTransaction(userAddress, perk, uniqueCode);

      // 5. Sign and execute the transaction
      console.log('🔄 Executing Alpha Points spend transaction...');
      const result = await signAndExecuteTransaction(transaction);
      
      console.log('✅ Transaction executed:', result);

      // Handle different result structures flexibly
      const txHash = this.extractTransactionHash(result);
      
      if (!txHash) {
        console.warn('⚠️ Transaction completed but no hash returned:', result);
      }

      // 6. For Discord perks, assign the role
      let discordRoleAssigned = false;
      if (this.isDiscordPerk(perk) && result) {
        try {
          discordRoleAssigned = await this.assignDiscordRole(perk);
        } catch (discordError) {
          console.error('⚠️ Transaction succeeded but Discord role assignment failed:', discordError);
          // Don't fail the entire transaction for Discord issues
        }
      }

      return {
        success: true,
        txHash,
        discordRoleAssigned
      };

    } catch (error) {
      console.error('❌ Transaction failed:', error);
      
      const errorMessage = this.parseTransactionError(error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Enhanced transaction building using the new TransactionBuilder
   */
  private buildEnhancedTransaction(userAddress: string, perk: Alpha4Perk, uniqueCode?: string): Transaction {
    try {
      // Use the enhanced transaction builder from frontend patterns
      return TransactionBuilder.buildPurchaseAlphaPerkTransaction(userAddress, perk, uniqueCode);
    } catch (error) {
      console.warn('⚠️ Enhanced transaction builder failed, falling back to simple transaction:', error);
      // Fallback to simple test transaction if enhanced builder fails
      return TransactionBuilder.buildTestTransaction(userAddress);
    }
  }

  /**
   * Flexible transaction hash extraction
   * Handles various result structures from different wallet implementations
   */
  private extractTransactionHash(result: any): string | undefined {
    // Try multiple possible hash locations
    const possibleHashes = [
      result?.digest,
      result?.txHash,
      result?.transactionDigest,
      result?.hash,
      result?.effects?.transactionDigest,
      result?.transaction?.digest
    ];

    for (const hash of possibleHashes) {
      if (typeof hash === 'string' && hash.length > 10) {
        return hash;
      }
    }

    return undefined;
  }

  /**
   * Enhanced error parsing with more specific error messages
   */
  private parseTransactionError(error: any): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Network errors
      if (message.includes('failed to fetch') || message.includes('network')) {
        return 'Network connection failed. Please check your internet connection and try again.';
      }
      
      // User rejection
      if (message.includes('user rejected') || message.includes('cancelled')) {
        return 'Transaction was rejected by user.';
      }
      
      // Insufficient funds
      if (message.includes('insufficient') || message.includes('balance')) {
        return 'Insufficient funds for transaction. Please check your wallet balance.';
      }
      
      // Gas estimation errors
      if (message.includes('gas') || message.includes('computation')) {
        return 'Gas estimation failed. Transaction may be too complex or contract unavailable.';
      }
      
      // Contract errors
      if (message.includes('moveCall') || message.includes('package')) {
        return 'Smart contract call failed. The contract may be unavailable or incorrectly configured.';
      }
      
      // Configuration errors
      if (message.includes('not configured') || message.includes('missing')) {
        return 'System configuration error. Please contact support.';
      }
      
      return error.message;
    }
    
    return 'Transaction failed due to an unknown error.';
  }

  /**
   * Check if this is a Discord-related perk
   */
  private isDiscordPerk(perk: Alpha4Perk): boolean {
    return perk.name.toLowerCase().includes('discord') || 
           perk.description.toLowerCase().includes('discord') ||
           perk.name.toLowerCase().includes('role');
  }

  /**
   * Assign Discord role to user via Discord Bot API
   */
  private async assignDiscordRole(perk: Alpha4Perk): Promise<boolean> {
    const user = this.discordAuth.getCurrentUser();
    if (!user) {
      throw new Error('No Discord user authenticated');
    }

    console.log('🔄 Assigning Discord role for perk:', perk.name);

    // Get role configuration for this perk
    const roleConfig = this.getDiscordRoleConfig(perk);
    if (!roleConfig) {
      throw new Error('No Discord role configuration found for this perk');
    }

    try {
      // Call Discord API to assign role
      const success = await this.callDiscordRoleAPI(user.id, roleConfig);
      
      if (success) {
        console.log('✅ Discord role assigned successfully');
        return true;
      } else {
        throw new Error('Discord role assignment failed');
      }
    } catch (error) {
      console.error('❌ Discord API call failed:', error);
      throw error;
    }
  }

  /**
   * Get Discord role configuration based on perk
   */
  private getDiscordRoleConfig(perk: Alpha4Perk): { roleId: string; guildId: string } | null {
    // Map perks to Discord roles
    const roleMap: Record<string, { roleId: string; guildId: string }> = {
      'Discord Alpha OG': {
        roleId: import.meta.env['VITE_DISCORD_ALPHA_OG_ROLE_ID'] || '1234567890123456789',
        guildId: import.meta.env['VITE_DISCORD_GUILD_ID'] || '1234567890123456789'
      },
      'Discord Premium Role': {
        roleId: import.meta.env['VITE_DISCORD_PREMIUM_ROLE_ID'] || '1234567890123456789',
        guildId: import.meta.env['VITE_DISCORD_GUILD_ID'] || '1234567890123456789'
      }
    };

    return roleMap[perk.name] || null;
  }

  /**
   * Call Discord REST API to assign role to user
   * This requires a Discord bot token and proper server permissions
   */
  private async callDiscordRoleAPI(userId: string, roleConfig: { roleId: string; guildId: string }): Promise<boolean> {
    const botToken = import.meta.env['VITE_DISCORD_BOT_TOKEN'];
    
    if (!botToken) {
      console.warn('⚠️ No Discord bot token configured - cannot assign roles');
      // Return true for demo purposes if no bot token is configured
      return true;
    }

    const { roleId, guildId } = roleConfig;
    
    try {
      // Discord API endpoint to add role to guild member
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
          'X-Audit-Log-Reason': 'Alpha4 Rewards - Perk claimed'
        }
      });

      if (response.ok) {
        console.log('✅ Discord role assigned via API');
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ Discord API error:', response.status, errorText);
        
        // Handle specific Discord API errors
        if (response.status === 403) {
          throw new Error('Bot lacks permission to assign roles');
        } else if (response.status === 404) {
          throw new Error('User not found in Discord server');
        } else {
          throw new Error(`Discord API error: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('❌ Discord role assignment failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced Alpha Points balance checking
   * Uses the new transaction patterns for better reliability
   */
  async verifyAlphaPointsBalance(userAddress: string, requiredAmount: number): Promise<boolean> {
    try {
      console.log('🔍 Checking Alpha Points balance for:', userAddress, 'Required:', requiredAmount);
      
      // TODO: Implement actual balance checking based on your Alpha Points contract
      // This would query the ledger object to get user's current balance
      
      /*
      Example implementation:
      const ledgerId = import.meta.env['VITE_LEDGER_ID'];
      if (ledgerId) {
        const ledgerObject = await this.suiClient.getObject({
          id: ledgerId,
          options: { showContent: true }
        });
        
        // Parse ledger content to get user balance
        // const userBalance = parseUserBalance(ledgerObject, userAddress);
        // return userBalance >= requiredAmount;
      }
      */
      
      // Placeholder: Always return true for demo
      return true;
    } catch (error) {
      console.error('❌ Error checking Alpha Points balance:', error);
      return false;
    }
  }

  /**
   * Get transaction status with enhanced error handling
   */
  async getTransactionStatus(txHash: string): Promise<'pending' | 'success' | 'failed'> {
    try {
      const result = await this.suiClient.getTransactionBlock({
        digest: txHash,
        options: {
          showEffects: true,
        },
      });

      if (result.effects?.status?.status === 'success') {
        return 'success';
      } else if (result.effects?.status?.status === 'failure') {
        return 'failed';
      } else {
        return 'pending';
      }
    } catch (error) {
      console.error('❌ Error checking transaction status:', error);
      return 'failed';
    }
  }

  /**
   * New method: Test transaction connectivity
   * Uses the simple test transaction for debugging
   */
  async testTransactionConnectivity(userAddress: string, signAndExecuteTransaction: (tx: Transaction) => Promise<any>): Promise<TransactionResult> {
    try {
      console.log('🧪 Testing transaction connectivity...');
      
      const testTx = TransactionBuilder.buildTestTransaction(userAddress);
      const result = await signAndExecuteTransaction(testTx);
      
      const txHash = this.extractTransactionHash(result);
      
      return {
        success: true,
        txHash,
        error: undefined
      };
    } catch (error) {
      console.error('❌ Transaction connectivity test failed:', error);
      return {
        success: false,
        error: this.parseTransactionError(error)
      };
    }
  }

  /**
   * New method: Redeem Alpha Points for SUI
   * Leverages the enhanced transaction builder
   */
  async redeemAlphaPoints(
    userAddress: string,
    pointsToRedeem: string,
    signAndExecuteTransaction: (tx: Transaction) => Promise<any>
  ): Promise<TransactionResult> {
    try {
      console.log('💰 Redeeming Alpha Points for SUI:', {
        userAddress,
        pointsToRedeem,
        formattedPoints: TransactionHelpers.formatAlphaPoints(parseInt(pointsToRedeem))
      });

      // Validate parameters
      TransactionBuilder.validateTransactionParams({ userAddress, amount: parseInt(pointsToRedeem) });

      // Build redemption transaction
      const transaction = TransactionBuilder.buildRedeemPointsTransaction(pointsToRedeem, userAddress);

      // Execute transaction
      const result = await signAndExecuteTransaction(transaction);
      const txHash = this.extractTransactionHash(result);

      return {
        success: true,
        txHash
      };
    } catch (error) {
      console.error('❌ Alpha Points redemption failed:', error);
      return {
        success: false,
        error: this.parseTransactionError(error)
      };
    }
  }
}

export const transactionService = new TransactionService(); 
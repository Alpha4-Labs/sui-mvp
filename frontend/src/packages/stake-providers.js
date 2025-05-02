// src/packages/stake-providers.js

/**
 * Configuration for stake providers supported by the Alpha Points system
 * This allows routing different assets to appropriate protocols
 */

// Provider Types
export const PROVIDER_TYPES = {
    NATIVE: 'native',      // Native Alpha Points staking
    DEX_LP: 'dex_lp',      // DEX liquidity provider
    LENDING: 'lending',    // Lending protocols
    YIELD: 'yield'         // Yield aggregators
  };
  
  // Asset Types
  export const ASSET_TYPES = {
    SUI: 'sui',          // Native SUI token
    ALPHA: 'alpha',      // Alpha token
    LP_TOKEN: 'lp_token' // Liquidity provider token
  };
  
  // Configuration for stake providers
  export const STAKE_PROVIDERS = [
    {
      id: 'alpha_native',
      name: 'Alpha Staking',
      type: PROVIDER_TYPES.NATIVE,
      description: 'Stake ALPHA tokens directly with Alpha Points',
      supportedAssets: [ASSET_TYPES.ALPHA],
      pointsMultiplier: 1.0,        // Base multiplier
      minDuration: 7,               // Minimum 7 days
      maxDuration: 365,             // Maximum 365 days
      active: true,                 // Provider is active
      testnet: true,                // Available on testnet
      mainnet: false,               // Not yet on mainnet
      logoUrl: '/assets/alpha-logo.svg',
      
      // Function mapping for this provider
      functions: {
        stake: 'alpha_points::integration::route_stake',
        unstake: 'alpha_points::integration::redeem_stake',
        getBalance: 'alpha_points::ledger::get_staked_amount'
      },
      
      // Required objects specific to this provider
      requiredObjects: {
        config: true,        // Needs config object
        escrow: true,        // Needs escrow vault
        clock: true          // Needs clock
      }
    },
    {
      id: 'sui_native',
      name: 'SUI Staking',
      type: PROVIDER_TYPES.NATIVE,
      description: 'Stake SUI tokens to earn Alpha Points',
      supportedAssets: [ASSET_TYPES.SUI],
      pointsMultiplier: 0.8,        // Slightly lower rate than ALPHA
      minDuration: 7,               // Minimum 7 days
      maxDuration: 365,             // Maximum 365 days
      active: true,                 // Provider is active
      testnet: true,                // Available on testnet
      mainnet: false,               // Not yet on mainnet
      logoUrl: '/assets/sui-logo.svg',
      
      // Function mapping for this provider
      functions: {
        stake: 'alpha_points::integration::route_stake',
        unstake: 'alpha_points::integration::redeem_stake',
        getBalance: 'alpha_points::ledger::get_staked_amount'
      },
      
      // Required objects specific to this provider
      requiredObjects: {
        config: true,        // Needs config object
        escrow: true,        // Needs escrow vault for SUI
        clock: true          // Needs clock
      }
    },
    {
      id: 'aftermath_lp',
      name: 'Aftermath LP',
      type: PROVIDER_TYPES.DEX_LP,
      description: 'Stake Aftermath DEX LP tokens to earn boosted points',
      supportedAssets: [ASSET_TYPES.LP_TOKEN],
      pointsMultiplier: 1.2,        // Higher multiplier for LP tokens
      minDuration: 14,              // Minimum 14 days
      maxDuration: 180,             // Maximum 180 days
      active: false,                // Not active yet
      testnet: true,                // Available on testnet
      mainnet: false,               // Not yet on mainnet
      logoUrl: '/assets/aftermath-logo.svg',
      partnerUrl: 'https://aftermath.finance/',
      
      // Function mapping for this provider
      functions: {
        stake: 'alpha_points::integration::route_stake',
        unstake: 'alpha_points::integration::redeem_stake',
        getBalance: 'alpha_points::ledger::get_staked_amount'
      },
      
      // Required objects specific to this provider
      requiredObjects: {
        config: true,        // Needs config object
        escrow: true,        // Needs escrow vault for LP tokens
        clock: true          // Needs clock
      },
      
      // External contract for integration
      externalContract: {
        packageId: '0x...aftermath_package_id...',
        functions: {
          getLpTokens: 'aftermath::amm::get_lp_tokens'
        }
      }
    },
    {
      id: 'suilend',
      name: 'SuiLend',
      type: PROVIDER_TYPES.LENDING,
      description: 'Stake SuiLend positions to earn Alpha Points',
      supportedAssets: [ASSET_TYPES.SUI, ASSET_TYPES.ALPHA],
      pointsMultiplier: 1.1,        // Higher multiplier for lending positions
      minDuration: 30,              // Minimum 30 days
      maxDuration: 90,              // Maximum 90 days
      active: false,                // Not active yet
      testnet: true,                // Available on testnet
      mainnet: false,               // Not yet on mainnet
      logoUrl: '/assets/suilend-logo.svg',
      partnerUrl: 'https://suilend.com/',
      
      // Function mapping for this provider
      functions: {
        stake: 'alpha_points::integration::route_stake',
        unstake: 'alpha_points::integration::redeem_stake',
        getBalance: 'alpha_points::ledger::get_staked_amount'
      },
      
      // Required objects specific to this provider
      requiredObjects: {
        config: true,        // Needs config object
        escrow: true,        // Needs escrow vault
        clock: true          // Needs clock
      },
      
      // External contract for integration
      externalContract: {
        packageId: '0x...suilend_package_id...',
        functions: {
          getLendingPositions: 'suilend::lending::get_positions'
        }
      }
    }
  ];
  
  /**
   * Get a stake provider by ID
   * @param {string} providerId - The provider ID to look up
   * @returns {object|null} - The provider object or null if not found
   */
  export function getProviderById(providerId) {
    return STAKE_PROVIDERS.find(provider => provider.id === providerId) || null;
  }
  
  /**
   * Get providers that support a specific asset type
   * @param {string} assetType - The asset type (from ASSET_TYPES)
   * @param {boolean} activeOnly - Only return active providers
   * @returns {Array} - Array of matching providers
   */
  export function getProvidersByAssetType(assetType, activeOnly = true) {
    return STAKE_PROVIDERS.filter(provider => 
      provider.supportedAssets.includes(assetType) && 
      (!activeOnly || provider.active)
    );
  }
  
  /**
   * Get providers by type
   * @param {string} providerType - The provider type (from PROVIDER_TYPES)
   * @param {boolean} activeOnly - Only return active providers
   * @returns {Array} - Array of matching providers
   */
  export function getProvidersByType(providerType, activeOnly = true) {
    return STAKE_PROVIDERS.filter(provider => 
      provider.type === providerType && 
      (!activeOnly || provider.active)
    );
  }
  
  /**
   * Get all active providers
   * @param {boolean} testnet - Include testnet providers
   * @param {boolean} mainnet - Include mainnet providers
   * @returns {Array} - Array of active providers
   */
  export function getActiveProviders(testnet = true, mainnet = true) {
    return STAKE_PROVIDERS.filter(provider => 
      provider.active && 
      ((testnet && provider.testnet) || (mainnet && provider.mainnet))
    );
  }
  
  /**
   * Calculate points generation rate for a provider
   * @param {string} providerId - Provider ID
   * @param {number} amount - Stake amount
   * @param {number} duration - Stake duration in days
   * @returns {object} - Points generation info including daily and total rate
   */
  export function calculatePointsRate(providerId, amount, duration) {
    const provider = getProviderById(providerId);
    if (!provider) {
      return { daily: 0, total: 0, multiplier: 0 };
    }
    
    // Apply provider's points multiplier
    const baseMultiplier = provider.pointsMultiplier || 1.0;
    
    // Apply duration bonus (longer stakes earn more)
    // Formula: 1 + (duration / 365) * 0.5 (up to 50% bonus for 1 year)
    const maxDurationBonus = 0.5;
    const durationMultiplier = 1 + Math.min(duration / 365, 1) * maxDurationBonus;
    
    // Combined multiplier
    const totalMultiplier = baseMultiplier * durationMultiplier;
    
    // Base points rate: 1 point per 100 units staked per day
    const baseRate = amount / 100;
    
    // Calculate daily and total points
    const dailyPoints = baseRate * totalMultiplier;
    const totalPoints = dailyPoints * duration;
    
    return {
      daily: dailyPoints,
      total: totalPoints,
      multiplier: totalMultiplier,
      breakdown: {
        baseMultiplier,
        durationMultiplier,
        baseRate
      }
    };
  }
  
  /**
   * Get type argument for a provider and asset
   * @param {string} providerId - Provider ID
   * @param {string} assetType - Asset type
   * @returns {string} - Type argument for the Move function
   */
  export function getProviderTypeArgument(providerId, assetType) {
    // Default mapping of asset types to type arguments
    const TYPE_ARGS = {
      [ASSET_TYPES.SUI]: '0x2::sui::SUI',
      //[ASSET_TYPES.ALPHA]: '0x...::alpha_token::ALPHA', // Replace with actual package ID
      //[ASSET_TYPES.LP_TOKEN]: '0x...::lp::LP' // Replace with actual package ID
    };
    
    // Special cases for specific providers
    if (providerId === 'aftermath_lp') {
      return '0x...::aftermath::LPToken'; // Replace with actual type
    }
    
    // Default to the standard type arguments
    return TYPE_ARGS[assetType] || TYPE_ARGS[ASSET_TYPES.SUI];
  }
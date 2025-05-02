// src/mocks/providers-data.js
import { PROVIDER_TYPES, ASSET_TYPES } from '../packages/stake-providers';

/**
 * Mock data for stake providers for testing and development
 */
export const MOCK_PROVIDERS = [
  {
    id: 'alpha_native',
    name: 'Alpha Staking',
    type: PROVIDER_TYPES.NATIVE,
    description: 'Stake ALPHA tokens directly with Alpha Points to earn points at the base rate.',
    supportedAssets: [ASSET_TYPES.ALPHA],
    pointsMultiplier: 1.0,        // Base multiplier
    minDuration: 7,               // Minimum 7 days
    maxDuration: 365,             // Maximum 365 days
    active: true,                 // Provider is active
    testnet: true,                // Available on testnet
    mainnet: false,               // Not yet on mainnet
    logoUrl: '/assets/alpha-logo.svg',
    rate: 'Dynamic (1 αP per 100 ALPHA / hour)',
    
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
    description: 'Stake SUI tokens to earn Alpha Points at 0.8x the base rate.',
    supportedAssets: [ASSET_TYPES.SUI],
    pointsMultiplier: 0.8,        // Slightly lower rate than ALPHA
    minDuration: 7,               // Minimum 7 days
    maxDuration: 365,             // Maximum 365 days
    active: true,                 // Provider is active
    testnet: true,                // Available on testnet
    mainnet: false,               // Not yet on mainnet
    logoUrl: '/assets/sui-logo.svg',
    rate: '0.8 αP per 100 SUI / hour',
    
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
    description: 'Stake Aftermath DEX LP tokens to earn Alpha Points at a boosted 1.2x rate.',
    supportedAssets: [ASSET_TYPES.LP_TOKEN],
    pointsMultiplier: 1.2,        // Higher multiplier for LP tokens
    minDuration: 14,              // Minimum 14 days
    maxDuration: 180,             // Maximum 180 days
    active: false,                // Not active yet
    testnet: true,                // Available on testnet
    mainnet: false,               // Not yet on mainnet
    logoUrl: '/assets/aftermath-logo.svg',
    partnerUrl: 'https://aftermath.finance/',
    rate: '1.2 αP per $100 LP value / day',
    
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
      packageId: '0x12345...aftermath',
      functions: {
        getLpTokens: 'aftermath::amm::get_lp_tokens'
      }
    }
  },
  {
    id: 'suilend',
    name: 'SuiLend',
    type: PROVIDER_TYPES.LENDING,
    description: 'Stake SuiLend positions to earn Alpha Points at a boosted 1.1x rate.',
    supportedAssets: [ASSET_TYPES.SUI, ASSET_TYPES.ALPHA],
    pointsMultiplier: 1.1,        // Higher multiplier for lending positions
    minDuration: 30,              // Minimum 30 days
    maxDuration: 90,              // Maximum 90 days
    active: false,                // Not active yet
    testnet: true,                // Available on testnet
    mainnet: false,               // Not yet on mainnet
    logoUrl: '/assets/suilend-logo.svg',
    partnerUrl: 'https://suilend.com/',
    rate: '1.1 αP per $100 lending value / day',
    
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
      packageId: '0x54321...suilend',
      functions: {
        getLendingPositions: 'suilend::lending::get_positions'
      }
    }
  }
];

/**
 * Mock stake objects for testing
 */
export const MOCK_STAKES = [
  {
    id: '0x123abc456def789',
    owner: '0x789def456abc123',
    principal: '1000000000', // 1000 ALPHA with 9 decimals
    startEpoch: '100',       // Example epoch number
    unlockEpoch: '130',      // 30 days after start
    durationEpochs: '30',    // 30 day duration
    providerId: 'alpha_native',
    assetSymbol: 'ALPHA'
  },
  {
    id: '0x987654321abcdef',
    owner: '0x789def456abc123',
    principal: '500000000',  // 500 ALPHA with 9 decimals
    startEpoch: '105',       // Example epoch number
    unlockEpoch: '165',      // 60 days after start
    durationEpochs: '60',    // 60 day duration
    providerId: 'alpha_native',
    assetSymbol: 'ALPHA'
  },
  {
    id: '0xabcdef123456789',
    owner: '0x789def456abc123',
    principal: '10000000000', // 10000 SUI with 9 decimals
    startEpoch: '110',        // Example epoch number
    unlockEpoch: '140',       // 30 days after start
    durationEpochs: '30',     // 30 day duration
    providerId: 'sui_native',
    assetSymbol: 'SUI'
  }
];

// Helper function to get mock data for a provider
export function getMockProvider(providerId) {
  return MOCK_PROVIDERS.find(p => p.id === providerId) || null;
}

// Helper function to get all active mock providers
export function getActiveMockProviders() {
  return MOCK_PROVIDERS.filter(p => p.active);
}

// Helper function to get mock stakes for a user
export function getMockStakesForUser(userAddress) {
  return MOCK_STAKES.filter(s => s.owner === userAddress);
}

// Helper function to get mock stakes for a provider
export function getMockStakesForProvider(providerId) {
  return MOCK_STAKES.filter(s => s.providerId === providerId);
}
// src/mocks/marketplace-items.js

/**
 * Mock data for items available in the marketplace.
 * Used by MarketplaceView.jsx for simulated purchases/unlocks.
 */

// Import icons if you want to use them directly in the data
// Example: import { SparklesIcon, LockClosedIcon, BeakerIcon } from '@heroicons/react/24/solid';

export const mockMarketplaceItems = {
    perks: [
      {
        id: 'perk-premium-access',
        name: "Premium dApp Access",
        description: "Unlock advanced features and early access within partnered dApps integrated with Alpha Points.",
        cost: 5000 * (10**9), // Cost in smallest point unit (assuming 9 decimals)
        category: 'Utility',
        // icon: SparklesIcon, // Example if importing icons
        iconName: 'SparklesIcon', // Or use a name to map later
        actionType: 'unlock', // For differentiating simulation logic
        prerequisites: [], // e.g., ['badge-beta-tester']
      },
      {
        id: 'perk-content-pass',
        name: "Exclusive Content Pass",
        description: "Gain access to exclusive research reports, market analysis, and educational content.",
        cost: 10000 * (10**9),
        category: 'Information',
        // icon: LockClosedIcon,
        iconName: 'LockClosedIcon',
        actionType: 'unlock',
        prerequisites: [],
      },
      {
          id: 'perk-governance-boost',
          name: "Governance Vote Boost (Future)",
          description: "Temporarily increase your voting power in future governance proposals related to Alpha Points.",
          cost: 25000 * (10**9),
          category: 'Governance',
          // icon: BeakerIcon,
          iconName: 'BeakerIcon',
          actionType: 'unlock',
          prerequisites: ['status-active-staker'], // Example prerequisite
          disabled: true, // Example of a disabled item
        },
       {
          id: 'perk-cosmetic-item',
          name: "Profile Badge: Early Adopter",
          description: "Display a unique badge on your profile within the Alpha Points ecosystem.",
          cost: 1000 * (10**9),
          category: 'Cosmetic',
          iconName: 'IdentificationIcon', // Requires importing IdentificationIcon
          actionType: 'unlock',
          prerequisites: [],
        },
    ],
    assets: [ // Example category for other assets
      {
        id: 'asset-eth-discount',
        name: "ETH Redemption Discount",
        description: "Get a 5% bonus on your next ETH redemption via Alpha Points.",
        cost: 2000 * (10**9),
        category: 'Redemption',
        iconName: 'CurrencyDollarIcon',
        actionType: 'buy', // Treat as 'buying' a voucher/discount
        maxQuantity: 1, // Example: Can only buy one
      },
       {
        id: 'asset-partner-token',
        name: "Partner Token Voucher (Example)",
        description: "Claim a small amount of a partner project's token.",
        cost: 15000 * (10**9),
        category: 'Tokens',
        iconName: 'GiftIcon',
        actionType: 'buy',
        disabled: true,
       }
    ],
    // Add other categories as needed
  };
  
  // Helper function to get an item by ID (optional)
  export function getMarketplaceItemById(itemId) {
    for (const category in mockMarketplaceItems) {
      const item = mockMarketplaceItems[category].find(i => i.id === itemId);
      if (item) return item;
    }
    return null;
  }
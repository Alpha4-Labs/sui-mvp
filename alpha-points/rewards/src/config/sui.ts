// Sui Network Configuration
console.log('🔧 Loading environment variables:', {
  VITE_SUI_NETWORK: import.meta.env.VITE_SUI_NETWORK,
  VITE_SUI_RPC_URL: import.meta.env.VITE_SUI_RPC_URL,
  VITE_PERK_MANAGER_PACKAGE_ID: import.meta.env.VITE_PERK_MANAGER_PACKAGE_ID,
});

export const SUI_CONFIG = {
  network: (import.meta.env.VITE_SUI_NETWORK as 'mainnet' | 'testnet' | 'devnet') || 'testnet',
  rpcUrl: import.meta.env.VITE_SUI_RPC_URL || 'https://fullnode.testnet.sui.io',
  
  // Smart Contract Package IDs (update these when contracts are deployed)
  packageIds: {
    perkManager: import.meta.env.VITE_PERK_MANAGER_PACKAGE_ID || '0xf933e69aeeeebb9d1fc50b6324070d8f2bdc2595162b0616142a509c90e3cd16',
  },
  
  // Object types
  types: {
    claimedPerk: (packageId: string) => `${packageId}::perk_manager::ClaimedPerk`,
    perkDefinition: (packageId: string) => `${packageId}::perk_manager::PerkDefinition`,
  },
} as const;

console.log('🔧 Final SUI_CONFIG:', SUI_CONFIG);

// Helper to check if using real contracts or mock data
export const isUsingRealContracts = () => {
  const packageId = SUI_CONFIG.packageIds.perkManager;
  // Real contracts should be longer than 10 characters and not start with 0x1234
  return packageId && packageId.length > 10 && !packageId.startsWith('0x1234567890abcdef');
};

// Helper to get the appropriate network display name
export const getNetworkDisplayName = () => {
  switch (SUI_CONFIG.network) {
    case 'mainnet': return 'Mainnet';
    case 'testnet': return 'Testnet';
    case 'devnet': return 'Devnet';
    default: return 'Unknown';
  }
}; 
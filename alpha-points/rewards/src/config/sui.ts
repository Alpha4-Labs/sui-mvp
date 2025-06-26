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
    main: import.meta.env.VITE_PACKAGE_ID || '0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec',
    perkManager: import.meta.env.VITE_PERK_MANAGER_PACKAGE_ID || '0x8519374e972c0da6a44eea309fb8a8447722019de5186fdde98d3c2a10e704ec',
  },
  
  // Shared Objects (required for Alpha Points balance queries)
  // Using current testnet shared object IDs from environment
  sharedObjects: {
    config: import.meta.env.VITE_CONFIG_ID || '0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb',
    ledger: import.meta.env.VITE_LEDGER_ID || '0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00',
    stakingManager: import.meta.env.VITE_STAKING_MANAGER_ID || '0x3fa797fcbc0bec7390910311f432329e68e4fdf23f1a55033410e81f3ebd08f4',
    oracle: import.meta.env.VITE_ORACLE_ID || '0x4e0a8f7a9bccc7bb88dd5d0c0ac9dd6186681cde14d8c981eaa238b93e22e02f',
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
// Network configuration
export type NetworkType = 'testnet' | 'mainnet' | 'devnet' | 'localnet';

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  faucetUrl: string;
  explorerUrl: string;
  chainId?: string;
}

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  localnet: {
    name: 'Local Network',
    rpcUrl: 'http://localhost:9000',
    faucetUrl: 'http://localhost:9123/gas',
    explorerUrl: 'http://localhost:8080',
  },
  devnet: {
    name: 'Sui Devnet',
    rpcUrl: 'https://fullnode.devnet.sui.io',
    faucetUrl: 'https://faucet.devnet.sui.io',
    explorerUrl: 'https://explorer.devnet.sui.io',
  },
  testnet: {
    name: 'testnet',
    rpcUrl: 'https://fullnode.testnet.sui.io',
    faucetUrl: 'https://faucet.testnet.sui.io',
    explorerUrl: 'https://explorer.testnet.sui.io',
  },
  mainnet: {
    name: 'mainnet',
    rpcUrl: 'https://fullnode.mainnet.sui.io',
    faucetUrl: '',
    explorerUrl: 'https://explorer.sui.io',
  },
};

export const NETWORK_TYPE: NetworkType = (import.meta.env.VITE_SUI_NETWORK as NetworkType) || 'testnet';
export const CURRENT_NETWORK = NETWORKS[NETWORK_TYPE];
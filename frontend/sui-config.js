export const NETWORKS = {
    MAINNET: {
      id: "mainnet",
      name: "Sui Mainnet",
      rpcUrl: "https://fullnode.mainnet.sui.io:443",
      explorerUrl: "https://explorer.sui.io",
      chainId: "0x0" // Updated when deployed to mainnet
    },
    TESTNET: {
      id: "testnet",
      name: "Sui Testnet",
      rpcUrl: "https://fullnode.testnet.sui.io:443",
      explorerUrl: "https://explorer.testnet.sui.io",
      chainId: "0x0" // Will be the testnet chain ID
    },
    DEVNET: {
      id: "devnet",
      name: "Sui Devnet",
      rpcUrl: "https://fullnode.devnet.sui.io:443",
      explorerUrl: "https://explorer.devnet.sui.io",
      chainId: "0x0" // Will be the devnet chain ID
    },
    LOCALNET: {
      id: "localnet",
      name: "Sui Localnet",
      rpcUrl: "http://127.0.0.1:9000",
      explorerUrl: "",
      chainId: "0x0" // Local development
    }
  };
  
  // Default network
  export const DEFAULT_NETWORK = NETWORKS.TESTNET;
  
  // Required network for the app (can be changed in development)
  export const REQUIRED_NETWORK = NETWORKS.TESTNET;
  
  // Helper function to get network by ID
  export function getNetworkById(id) {
    return Object.values(NETWORKS).find(network => network.id === id) || DEFAULT_NETWORK;
  }
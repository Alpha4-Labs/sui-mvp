import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit'
import { getFullnodeUrl } from '@mysten/sui/client'
import { Toaster } from 'react-hot-toast'
import '@mysten/dapp-kit/dist/index.css'
import './index.css'
import App from './App.tsx'

// Create QueryClient for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

// Sui network configuration
const suiNetwork = 'testnet' // Change to 'mainnet' for production
const rpcUrl = import.meta.env.VITE_SUI_RPC_URL || getFullnodeUrl(suiNetwork)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider 
        url={rpcUrl}
        onError={(error) => {
          console.error('SuiClient error:', error);
        }}
      >
        <WalletProvider 
          autoConnect
          onError={(error) => {
            console.error('Wallet Provider error:', error);
          }}
        >
          <App />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1f2937',
                color: '#f9fafb',
                border: '1px solid #374151',
              },
            }}
          />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </StrictMode>,
)

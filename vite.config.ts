import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy SUI RPC requests to avoid CORS issues in development
      '/sui-rpc': {
        target: 'https://fullnode.testnet.sui.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sui-rpc/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
        },
      },
    },
  }
});
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Optional: Define server options like port
  server: {
    port: 3000, // Example: Run dev server on port 3000
    // proxy: { ... } // Configure API proxies if needed
  },
  // Optional: Define build options
  build: {
    outDir: 'dist', // Output directory for build
    // rollupOptions: { ... } // Customize Rollup build if needed
  },
   // Optional: Resolve aliases if needed
   resolve: {
    alias: {
      // Example: '@': '/src',
    },
  },
  // Optional: Optimize dependencies
  optimizeDeps: {
     // include: ['@headlessui/react', 'recharts', /* other heavy deps */],
  },
  // Define environment variables (ensure sensitive keys are handled securely)
  define: {
    // Example: 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    // You generally don't need to define NODE_ENV, Vite handles it.
    // Use import.meta.env in your code instead for Vite env variables.
  }
})
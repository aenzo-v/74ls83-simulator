import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/three') ||
            id.includes('node_modules/@react-three')
          ) {
            return 'three-vendor';
          }
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/zustand')
          ) {
            return 'framework-vendor';
          }
        },
      },
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
});

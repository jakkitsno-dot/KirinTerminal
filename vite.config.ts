import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-xterm': ['xterm', 'xterm-addon-fit', 'xterm-addon-search', 'xterm-addon-web-links'],
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge']
        }
      }
    }
  }
});

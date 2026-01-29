import path from 'path';
// FIX: Import fileURLToPath from 'url' to help define __dirname in an ES module environment
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// FIX: Define __dirname manually as it is not globally available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      // FIX: Use the manually defined __dirname for path resolution
      '@': path.resolve(__dirname, './'),
    }
  },
  build: {
    rollupOptions: {
      // FIX: Use the manually defined __dirname for path resolution
      input: path.resolve(__dirname, 'index.html')
    }
  }
});
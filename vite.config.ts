import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// Necessário para ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  // 🌐 Base correta para Vercel
  base: '/',

  // ⚛️ React
  plugins: [react()],

  server: {
    port: 3000,
    host: '0.0.0.0',
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      // 📦 Configuração de Fragmentação Manual (Manual Chunking)
      output: {
        manualChunks(id) {
          // Separa todas as bibliotecas do node_modules em um chunk chamado 'vendor'
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    // Opcional: Aumenta um pouco o limite do aviso para 600kb se necessário
    chunkSizeWarningLimit: 600,
  },
})
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

  /**
   * 📁 PUBLIC DIR
   * ✔️ Use a pasta padrão /public
   * ✔️ Não use a raiz
   * ✔️ Não desative
   */
  // publicDir: 'public', // (opcional, é o padrão)

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
    },
  },
})

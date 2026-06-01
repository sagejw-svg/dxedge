import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws':  { target: 'ws://localhost:8000', ws: true },
    }
  },
  build: {
    outDir: 'dist',
    // Chunk splitting reduces peak memory during build
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ['react', 'react-dom'],
          recharts: ['recharts'],
        }
      }
    }
  }
})

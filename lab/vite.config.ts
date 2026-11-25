import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: './',
  // En desarrollo local, reenvía las llamadas /api al server Express (:5000).
  // En producción (Vercel) esto no se usa: /api lo sirven las funciones serverless.
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
  build: {
    target: 'es2018',
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

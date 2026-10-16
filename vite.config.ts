// vite.config.ts
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    open: true,
    strictPort: true,
    port: 5173
  },
  preview: {
    port: 4173
  },
  build: {
    sourcemap: mode !== 'production',
    target: 'es2022'
  },
  esbuild: {
    target: 'es2022'
  },
  test: {
    environment: 'jsdom'
  }
}))

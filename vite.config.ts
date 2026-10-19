// vite.config.ts
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import { configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { config as gifsFunction, handleGifs } from './netlify/functions/gifs/gifs'

/**
 * Serve the Netlify GIPHY function in `vite` and `vite preview`, so local runs need no Netlify CLI.
 * GIPHY_API_KEY has no VITE_ prefix, so Vite never inlines it into the bundle.
 */
function giphyProxy(apiKey: string | undefined): Plugin {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    // Connect strips the mount path from req.url; originalUrl keeps it
    const url = new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost')
    // Connect mounts by prefix; Netlify's config.path matches the exact path only
    if (url.pathname !== gifsFunction.path) return next()

    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })
    handleGifs(new Request(url, { method: req.method, signal: controller.signal }), apiKey)
      .then(async (response) => {
        res.statusCode = response.status
        response.headers.forEach((value, name) => res.setHeader(name, value))
        res.end(await response.text())
      })
      .catch(next)
  }

  return {
    name: 'giphy-proxy',
    configureServer(server) {
      server.middlewares.use(gifsFunction.path, handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(gifsFunction.path, handle)
    }
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // Reads .env.local next to this file; a GIPHY_API_KEY already in process.env (Docker) wins
    giphyProxy(loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '').GIPHY_API_KEY)
  ],
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
    environment: 'jsdom',
    // Playwright runs e2e/ (npm run test:e2e)
    exclude: [...configDefaults.exclude, 'e2e/**']
  }
}))

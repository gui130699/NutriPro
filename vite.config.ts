import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// GitHub Actions also runs the Playwright development server. Only the Pages
// deploy step opts into the repository subpath; all other environments use /.
const base = process.env.NUTRIPRO_GITHUB_PAGES === 'true' ? '/NutriPro/' : '/'
const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
  },
  build: {
    // Keep stale hashed bundles out of the service-worker precache, especially
    // when a previous build was interrupted on a synced Windows workspace.
    emptyOutDir: true,
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/firestore/**/*.test.ts'],
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      // Activate new releases immediately. This is also the recovery path when
      // an older JavaScript bundle fails before it can request an update.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'NutriPro — Controle alimentar',
        short_name: 'NutriPro',
        description: 'Seu diário alimentar inteligente',
        theme_color: '#0f766e',
        background_color: '#f4f7f4',
        display: 'standalone',
        start_url: './',
        scope: './',
        lang: 'pt-BR',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
        skipWaiting: true,
      },
    }),
  ],
})

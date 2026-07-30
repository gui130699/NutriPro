import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/NutriPro/' : '/',
  plugins: [tailwindcss(), react(), VitePWA({ registerType: 'prompt', includeAssets: ['favicon.svg'], manifest: { name: 'NutriPro — Controle alimentar', short_name: 'NutriPro', description: 'Seu diário alimentar inteligente', theme_color: '#0f766e', background_color: '#f7faf8', display: 'standalone', lang: 'pt-BR', icons: [{ src: 'pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' }, { src: 'pwa-512.svg', sizes: '512x512', type: 'image/svg+xml' }] }, workbox: { navigateFallback: '/index.html' } })],
})

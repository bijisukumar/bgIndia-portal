import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Estate360 — Estate Management
// Build: vite build --config vite.estate360.config.js
// Deploy: estate360.luxuryvillasofguruvayur.com

export default defineConfig({
  root: 'src/apps/estate360',
  publicDir: '../../public',
  build: {
    outDir: '../../../dist/estate360',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8788', changeOrigin: true }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Estate360 — Estate Management',
        short_name: 'Estate360',
        description: 'Coconut and rubber estate tracking, ledgers, harvests',
        theme_color: '#1A1A1A',
        background_color: '#1A1A1A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ]
      },
      workbox: { skipWaiting: true, clientsClaim: true }
    })
  ]
})

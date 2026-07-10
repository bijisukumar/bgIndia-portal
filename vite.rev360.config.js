import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Rev360 — Rental Property Management
// Build: vite build --config vite.rev360.config.js
// Deploy: rev360.luxuryvillasofguruvayur.com

// Per-host config selection (SaaS onboarding) — see hosts/<hostId>/config.js.
// Defaults to 'dwarka' so existing builds are unaffected; a new host builds
// with VITE_HOST=<hostId> set before running the build command.
const host = process.env.VITE_HOST || 'dwarka'

export default defineConfig({
  root: 'src/apps/rev360',
  publicDir: '../../../public',
  resolve: {
    alias: { '@host-config': path.resolve(process.cwd(), 'hosts', host, 'config.js') }
  },
  build: {
    outDir: '../../../dist/rev360',
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
        name: 'Rev360 — Rental Management',
        short_name: 'Rev360',
        description: 'Rental property income and tenant management',
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
      workbox: { skipWaiting: true, clientsClaim: true, maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 }
    })
  ]
})

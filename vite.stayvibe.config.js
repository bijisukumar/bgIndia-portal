import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// StayVibe — Villa Management
// Build: vite build --config vite.stayvibe.config.js
// Deploy: stayvibe.luxuryvillasofguruvayur.com
//         stayvibe-[clientid].luxuryvillasofguruvayur.com

export default defineConfig({
  root: 'src/apps/stayvibe',
  publicDir: '../../../public',
  build: {
    outDir: '../../../dist/stayvibe',
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
      includeAssets: ['icons/**/*'],
      manifest: {
        name: 'StayVibe — Villa Management',
        short_name: 'StayVibe',
        description: 'Villa management portal — bookings, check-in, revenue',
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
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [{
          urlPattern: /^\/api\/.*/i,
          handler: 'NetworkFirst',
          options: { cacheName: 'api-cache', networkTimeoutSeconds: 10 }
        }]
      }
    })
  ]
})

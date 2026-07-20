import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Demovilla — sales-demo tenant (villa management, same app shell as StayVibe)
// Build: vite build --config vite.demovilla.config.js
// Deploy: demo.stayvibe360.com

const host = process.env.VITE_HOST || 'demovilla'

export default defineConfig({
  root: 'src/apps/stayvibe',
  publicDir: '../../../public',
  resolve: {
    alias: { '@host-config': path.resolve(process.cwd(), 'hosts', host, 'config.js') }
  },
  build: {
    outDir: '../../../dist/demovilla',
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
        name: 'StayVibe — Demo',
        short_name: 'StayVibe Demo',
        description: 'Villa management portal — sales demo tenant',
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

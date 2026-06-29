import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      // During local dev, proxy /api/* to Cloudflare Pages preview
      // Run: wrangler pages dev dist --d1 bgindia_db=bgindia-db
      // OR just deploy and test live on Cloudflare
      '/api': {
        target: 'http://localhost:8788',   // wrangler pages dev port
        changeOrigin: true,
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/**/*', 'fonts/**/*'],
      manifest: {
        name: 'Guruvayur Estates Portal',
        short_name: 'GE Portal',
        description: 'BG Guruvayur Estates — Property Management Portal',
        theme_color: '#1A1A1A',
        background_color: '#1A1A1A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/icon-72.png',  sizes: '72x72',   type: 'image/png' },
          { src: 'icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144.png', sizes: '144x128', type: 'image/png' },
          { src: 'icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // Raised from the 2MB default: pdf-lib + @pdf-lib/fontkit, plus
        // the two embedded DejaVu Sans font files needed for Rupee-sign
        // support in generated PDFs (see pdfGenHelpers.js), pushed the
        // main bundle past 2MB and the manage app's font assets past
        // the precache threshold -- this isn't bloat to trim, it's the
        // real cost of native PDF generation with full Unicode support.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 10 }
          }
        ]
      }
    })
  ]
})

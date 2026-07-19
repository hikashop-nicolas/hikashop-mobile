import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'HikaShop',
        short_name: 'HikaShop',
        description: 'Manage your HikaShop store and run a mobile point of sale.',
        theme_color: '#0c6d77',
        background_color: '#0c6d77',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell + assets; the API is never precached (it is
        // authenticated and handled by the app's own cache-then-network layer).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
      // The Capacitor native build ships assets locally and does not need a SW in dev.
      devOptions: { enabled: false },
    }),
  ],
})

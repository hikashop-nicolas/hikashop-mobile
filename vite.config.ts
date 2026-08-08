import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Where the app will be served from. Root by default (a custom domain, and the Capacitor
// shell, which loads from the bundle root); set PWA_BASE=/repo/ to build for a GitHub Pages
// project site. Routing is hash-based, so no server rewrite rules are needed either way.
const base = process.env.PWA_BASE || '/'

export default defineConfig({
  base,
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
        start_url: base,
        scope: base,
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

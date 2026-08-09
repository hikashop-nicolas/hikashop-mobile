import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Which build this is. An installed PWA can run for weeks without ever being closed, so when
// something looks wrong the first question is which build the person is actually running -- and
// the answer has to come from the page, not from what was last deployed.
const build = process.env.VITE_APP_BUILD || (() => {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
  catch { return 'dev' }
})()

// https://vite.dev/config/
// Where the app will be served from. Root by default (a custom domain, and the Capacitor
// shell, which loads from the bundle root); set PWA_BASE=/repo/ to build for a GitHub Pages
// project site. Routing is hash-based, so no server rewrite rules are needed either way.
const base = process.env.PWA_BASE || '/'

export default defineConfig({
  base,
  define: { __APP_BUILD__: JSON.stringify(build) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Register the worker ourselves (see src/main.tsx): the native shell must not have one.
      injectRegister: null,
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
          // A dedicated maskable variant: the plain mark loses its edges under a squircle mask.
          { src: 'pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell + assets; the API is never precached (it is
        // authenticated and handled by the app's own cache-then-network layer).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
})

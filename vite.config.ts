import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'ARAM — You are not alone',
        short_name: 'ARAM',
        description:
          'ARAM: a private, gentle wellbeing companion for students. Talk, feel supported, and reach real help when you need it.',
        theme_color: '#9B6EE0',
        background_color: '#0f0f0e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // Vector icon works for install + maskable on modern browsers. Export
        // 192/512 PNGs from pwa-icon.svg before app-store submission.
        icons: [
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Never cache API/auth responses (PII must not be persisted on device).
        navigateFallbackDenylist: [/^\/api/, /supabase/],
        // mp3 covers ARAM's voice clips. They must precache with the shell: the Emergency
        // screen is exactly the one a child may open on a dead connection, and it is the
        // one that most needs to be able to read itself aloud.
        globPatterns: ['**/*.{js,css,html,svg,woff2,mp3}'],
        // The face-api.js chunk (~1.3MB, dynamically imported — see lib/faceApi.ts) and the
        // face-recognition model weights (~7MB, json+bin) are deliberately NOT precached
        // with the shell — only S05b/S09 ever need them. Cache on first actual use instead,
        // so face login still works offline on a second visit without bloating install size.
        globIgnores: ['**/face-api.esm-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/(models\/.*\.(json|bin)|assets\/face-api\.esm-.*\.js)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'face-models',
              expiration: { maxEntries: 25, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true, // expose on LAN so it can be opened on a phone during dev
  },
})

import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.BASE || '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      // Nouvelle version : le service worker prend la main tout de suite (skipWaiting) et l'appli se recharge
      // d'elle-même (voir src/lib/update.js), sauf pendant une séance.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png', 'favicon.svg', 'push-sw.js'],
      manifest: {
        name: 'Alipto',
        short_name: 'Alipto',
        description: 'Carnet d’entraînement et de coaching',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        theme_color: '#15191e',
        background_color: '#e8ebe8',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: base + 'index.html',
        importScripts: ['push-sw.js'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ],
  build: { target: 'es2020', chunkSizeWarningLimit: 900 }
});

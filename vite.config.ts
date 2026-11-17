import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves a project site at /<repo-name>/. The deploy workflow sets
// BASE_PATH to that. Other hosts serve from the root, so the default is "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Scaling Factor',
        short_name: 'Scaling Factor',
        description: 'An RTS about building an automated war machine.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'landscape',
        theme_color: '#faeeda',
        background_color: '#faeeda',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs is in the build, so single-player also works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,otf}'],
        globIgnores: ['**/*-cyrillic*', '**/*-greek*', '**/*-vietnamese*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});

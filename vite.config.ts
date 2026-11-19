import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          name: 'Nuvra Exchange',
          short_name: 'Nuvra',
          description: 'Global multi-market execution terminal for Crypto, India NSE/BSE, US, Europe, Asia Equities & Forex.',
          theme_color: '#0B0E11',
          background_color: '#0B0E11',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          categories: ['finance', 'business', 'productivity'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallbackDenylist: [/^\/api/, /^\/ws/],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/v1\/market\/snapshot$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'nuvra-market-snapshot',
                expiration: { maxEntries: 8, maxAgeSeconds: 120 },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      cors: true,
      // Disable Vite's separate port-24678 HMR WebSocket by default so reverse proxies
      // do not reject @vite/client handshakes with "WebSocket closed without opened".
      hmr: process.env.ENABLE_HMR === 'true' ? { clientPort: 443, path: '/__vite_hmr' } : (false as const),
      ws: process.env.ENABLE_HMR === 'true' ? { clientPort: 443, path: '/__vite_hmr' } : (false as const),
      watch: process.env.ENABLE_HMR === 'true' && process.env.DISABLE_HMR !== 'true' ? {} : null,
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
    },
  };
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '2mino Back Office',
        short_name: '2mino BO',
        description: 'Panel de administración de 2mino: usuarios, segmentos, feature flags y torneos.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Panel de datos: nunca servir una respuesta de API vieja desde
        // cache. Solo el shell (JS/CSS/HTML) se cachea para poder abrir
        // offline; los datos siempre van a red.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
      },
      devOptions: {
        // Permite probar el SW con `npm run dev`, no solo en build de producción
        enabled: true,
      },
    }),
  ],
  server: {
    port: 5174,
  },
})

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const GAME_NAME = 'Bloxi';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'thumbs/*.jpg'],
      workbox: {
        // Todo se guarda en el iPad: después de abrirlo una vez funciona sin internet
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      manifest: {
        name: GAME_NAME,
        short_name: GAME_NAME,
        description: 'Arma tu Bloxi y juega minijuegos 3D. Sin cuentas, sin chat, sin internet.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#bfe6ff',
        theme_color: '#bfe6ff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});

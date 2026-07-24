import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // El id de AdSense llega de dos formas: en el build de Docker como ENV
  // real (Dockerfile, desde el ARG), en dev desde un archivo .env. loadEnv
  // cubre lo segundo; process.env lo primero.
  const env = loadEnv(mode, process.cwd(), '');
  const adsenseClient = process.env.VITE_ADSENSE_CLIENT_ID || env.VITE_ADSENSE_CLIENT_ID || '';

  return {
    plugins: [
      react(),
      {
        // AdSense tiene que ir en el HTML ESTÁTICO (no inyectado por el JS de
        // la SPA): Google verifica el sitio sin sesión iniciada, ve la
        // pantalla de login, y ahí ya tiene que estar el script. Pero se
        // inyecta SOLO si hay client id configurado. Sin él (dev local, o
        // prod sin cuenta de AdSense) el viejo placeholder
        // `%VITE_ADSENSE_CLIENT_ID%` quedaba literal en la URL —Vite no
        // reemplaza una var indefinida— y adsbygoogle.js hacía
        // decodeURIComponent('%VI...') → "URIError: URI malformed" en cada
        // carga. Omitir el script cuando no hay id evita eso por completo.
        name: 'adsense-script',
        transformIndexHtml(html) {
          if (!adsenseClient) return html;
          const tag = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}" crossorigin="anonymous"></script>`;
          return html.replace('</head>', `    ${tag}\n  </head>`);
        },
      },
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // WebSockets de ms-social (presencia/notificaciones/chat). En prod
        // nginx manda /ws/ directo a ms-social:6200 (no pasa por el gateway,
        // que es solo REST) — acá se replica para dev. Sin rewrite: ms-social
        // sirve las rutas bajo /ws/ tal cual (/ws/chat/:salaId, /ws/social).
        // Requiere que ms-social esté expuesto en el host: en Docker, vía el
        // mapeo de docker-compose.override.yml; en dev todo-local, ya corre
        // nativo en :6200.
        '/ws': {
          target: 'ws://localhost:6200',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});

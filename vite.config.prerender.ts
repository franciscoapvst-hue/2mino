import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build aparte, solo para el prerender de SEO (ver src/prerender.tsx).
// Compila esa entrada a un bundle de Node que `scripts/prerender.mjs` importa
// para generar el HTML de las rutas públicas. Va en su propio archivo de config
// —en vez de un modo dentro de vite.config.ts— para que el build del cliente no
// cargue nada de esto ni al correr `vite dev`.
export default defineConfig({
  plugins: [react()],
  build: {
    ssr: 'src/prerender.tsx',
    outDir: 'dist-prerender',
    emptyOutDir: true,
    // Los assets que importan los componentes (los .webp del landing, iconos)
    // se emiten con hash de CONTENIDO, el mismo que calcula el build del
    // cliente para el mismo archivo — así las URLs `/assets/nombre-hash.webp`
    // del HTML generado resuelven contra `dist/assets/` sin duplicar nada.
    rollupOptions: {
      output: {
        // .mjs explícito: el paquete ya es ESM ("type": "module"), pero dejar
        // la extensión a la vista evita depender de eso para que
        // scripts/prerender.mjs pueda importarlo.
        entryFileNames: 'prerender.mjs',
        format: 'es',
      },
    },
  },
});

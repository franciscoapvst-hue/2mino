// ── Entrada de prerender (SSG) para SEO ─────────────────────────────────
// La app es una SPA: el HTML que sirve nginx tiene el <body> vacío y todo se
// renderiza en el cliente, así que un crawler que no ejecuta JS no ve ni una
// palabra del contenido. Esto genera HTML real, en tiempo de build, para las
// rutas públicas con contenido propio.
//
// Por qué NO usa un navegador headless (Puppeteer/Chromium): el VPS recompila
// las imágenes él mismo en cada deploy (ver docs/DEPLOY.md), y meter Chromium
// en ese build competiría por CPU/RAM con el tráfico real. `renderToStaticMarkup`
// alcanza porque estas vistas no dependen del navegador.
//
// Clave de que esto sea simple: NINGUNA de estas vistas usa el contexto
// `useApp()` ni el bootstrap de sesión de App.tsx — solo props y `useNavigate`.
// Por eso se renderizan sueltas dentro de un StaticRouter, sin montar <App/>
// (que sí rompería: App.tsx lee `localStorage` en un inicializador de useState,
// o sea durante el render, donde no existe en Node).

import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import PieceDemo from './components/game/PieceDemo';
import PrivacidadView from './components/legal/PrivacidadView';
import TerminosView from './components/legal/TerminosView';
import { META_POR_RUTA } from './seo';

export type PaginaRenderizada = {
  /** Ruta pública, tal como la sirve el router del cliente. */
  ruta:        string;
  /** Se escribe en <title> — específico por página, no el genérico de la raíz. */
  title:       string;
  description: string;
  /** HTML del contenido, ya renderizado. */
  html:        string;
};

// `onBack` existe para el botón "Volver" del cliente; en el HTML estático no
// hay nada que manejar, así que va un noop.
const noop = () => {};

// Qué componente va en cada ruta. Los TEXTOS (title/description) no se
// repiten acá: salen de META_POR_RUTA (src/seo.ts), la misma fuente que usa
// el cliente para el <title> al navegar — así no pueden quedar desfasados.
// El slug `/reglas-domino-dominicano` describe el contenido a propósito; la
// ruta anterior (`/piece-demo`) era un nombre interno sin valor de búsqueda y
// nginx la redirige con 301 permanente.
const ELEMENTO_POR_RUTA: Record<string, ReactElement> = {
  '/reglas-domino-dominicano': <PieceDemo onBack={noop} />,
  '/privacidad':               <PrivacidadView />,
  '/terminos':                 <TerminosView />,
};

/** Renderiza cada página pública a HTML. La llama scripts/prerender.mjs. */
export function renderizarPaginas(): PaginaRenderizada[] {
  return Object.entries(ELEMENTO_POR_RUTA).map(([ruta, elemento]) => ({
    ruta,
    title:       META_POR_RUTA[ruta].title,
    description: META_POR_RUTA[ruta].description,
    // StaticRouter en vez de MemoryRouter: es el indicado para una sola
    // pasada de render en servidor y no necesita ninguna API del navegador.
    html: renderToStaticMarkup(
      <StaticRouter location={ruta}>{elemento}</StaticRouter>,
    ),
  }));
}

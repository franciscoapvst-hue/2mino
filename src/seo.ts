// ── Metadatos SEO por ruta ──────────────────────────────────────────────
// Fuente ÚNICA de verdad, usada por los dos lados:
//
//  - `src/prerender.tsx` (build): escribe estos valores en el <head> del HTML
//    estático de cada página (ver scripts/prerender.mjs).
//  - `src/App.tsx` (runtime): actualiza el <title> al navegar dentro de la
//    SPA, donde el documento no se recarga.
//
// Tenerlos acá evita que las dos copias se desincronicen: si mañana cambia el
// título de una página, cambia en el HTML servido y en la pestaña a la vez.

export type MetaPagina = {
  title:       string;
  description: string;
};

// Debe coincidir con el <title> de index.html — es el que sirve nginx para la
// raíz y para toda ruta sin archivo propio (las privadas: /home, /game/…).
export const TITULO_POR_DEFECTO =
  'Dominó online gratis — juega 1vs1 o en parejas | 2mino';

// Solo rutas PÚBLICAS con contenido propio: son las que se prerenderizan y las
// únicas que tiene sentido listar en el sitemap. Las privadas usan el título
// por defecto (no se indexan; están en el Disallow de robots.txt).
export const META_POR_RUTA: Record<string, MetaPagina> = {
  '/reglas-domino-dominicano': {
    title: 'Reglas del dominó dominicano y las 28 fichas | 2mino',
    description:
      'Cómo se juega el dominó dominicano: el set del 0 al 6 con 28 fichas, ' +
      'partida a puntos, capicúa y tranca. Con todas las fichas ilustradas.',
  },
  '/privacidad': {
    title: 'Política de privacidad | 2mino',
    description:
      'Qué datos recoge 2mino, para qué se usan y cómo ejercer tus derechos.',
  },
  '/terminos': {
    title: 'Términos y condiciones | 2mino',
    description:
      'Condiciones de uso de 2mino: cuentas, conducta en las partidas y ' +
      'compras de artículos cosméticos.',
  },
};

/** Título de una ruta; el por defecto si no es una página con meta propia. */
export function tituloDe(pathname: string): string {
  return META_POR_RUTA[pathname]?.title ?? TITULO_POR_DEFECTO;
}

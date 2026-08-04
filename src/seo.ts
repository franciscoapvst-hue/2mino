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
// Apila los términos que se buscan de verdad ("juego de dominó", "dominó
// online gratis", "dominó por parejas") en vez de una frase de marketing, y va
// sin marca porque "2mino" todavía no tiene volumen de búsqueda — ver el
// comentario largo en index.html.
export const TITULO_POR_DEFECTO =
  'Juego de dominó online gratis - Dominó por parejas y 1vs1';

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
  '/domino-en-parejas': {
    title: 'Cómo jugar dominó en parejas: reglas y estrategia | 2mino',
    description:
      'Cómo se arman las parejas en el dominó, qué se puede comunicar y qué no, ' +
      'cómo leer los pases de tu compañero y la estrategia básica de equipo.',
  },
  '/capicua-domino': {
    title: 'Qué es la capicúa en el dominó y cuánto vale | 2mino',
    description:
      'La capicúa es cerrar con una ficha que entraba por los dos extremos. ' +
      'Qué es exactamente, cuánto suma, cuándo NO se aplica el bono y por qué casi no se busca.',
  },
  '/tranca-domino': {
    title: 'La tranca en el dominó: quién gana y cuánto vale | 2mino',
    description:
      'Cuándo se traba la mano, por qué no gana el que tranca sino el que menos pips ' +
      'tiene, y por qué una tranca puede valer más que un dominó.',
  },
  '/estrategia-domino': {
    title: 'Estrategia de dominó para principiantes: 7 claves | 2mino',
    description:
      'Cómo contar las fichas, cuándo soltar las cargadas, qué dice un pase y cómo ' +
      'elegir el lado. Siete ideas para dejar de jugar de memoria.',
  },
  '/glosario-domino': {
    title: 'Glosario del dominó dominicano: todos los términos | 2mino',
    description:
      'Qué significa dominar, trancar, capicúa, pozo, palo, cargado y el resto de ' +
      'las palabras que vas a escuchar en la mesa.',
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

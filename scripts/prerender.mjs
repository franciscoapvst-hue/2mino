// ── Generador de HTML estático para SEO ─────────────────────────────────
// Corre DESPUÉS de `vite build` (cliente) y de `vite build --config
// vite.config.prerender.ts` (bundle SSR). Toma dist/index.html como cascarón,
// le inyecta el contenido ya renderizado de cada ruta pública y escribe
// dist/<ruta>.html.
//
// nginx sirve esos archivos antes del fallback de la SPA (`try_files $uri
// $uri.html $uri/ /index.html`), así que /reglas-domino-dominicano entrega HTML real en
// vez del <body> vacío. Cuando el JS carga, React monta la misma página encima
// — el contenido coincide, así que no hay parpadeo.
//
// La raíz (dist/index.html) NO se toca a propósito: es el fallback de TODAS
// las rutas, incluidas las privadas (/home, /game/...). Si le inyectáramos el
// contenido del landing, un usuario logueado entrando a /home vería ese
// contenido por un instante antes de que React lo reemplace.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderizarPaginas } from '../dist-prerender/prerender.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');

const escaparAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Reemplaza y VERIFICA que haya reemplazado. Sin esto, un cambio en
// index.html (renombrar un meta, reordenar el head) dejaría de aplicar en
// silencio y publicaríamos páginas sin title ni description.
function reemplazar(html, regex, nuevo, queCosa) {
  if (!regex.test(html)) {
    throw new Error(
      `prerender: no se encontró ${queCosa} en dist/index.html. ` +
      `Si cambió el <head>, actualizá scripts/prerender.mjs.`,
    );
  }
  return html.replace(regex, () => nuevo);
}

const shell = await readFile(join(dist, 'index.html'), 'utf8');
const paginas = renderizarPaginas();
const generadas = [];

for (const { ruta, title, description, html } of paginas) {
  const url = `https://2mino.online${ruta}`;
  let salida = shell;

  // `[^<]*` y no `[\s\S]*?`: un título no puede contener `<`, y así el match
  // no puede arrancar en una MENCIÓN de la etiqueta dentro de un comentario y
  // estirarse hasta el cierre real. Con el patrón perezoso anterior eso pasó:
  // el título terminó dentro de un comentario sin cerrar y la página quedó sin
  // title, description ni canonical — en silencio, porque el reemplazo "sí"
  // había ocurrido. La comprobación de más abajo es la red que lo detecta.
  salida = reemplazar(salida, /<title>[^<]*<\/title>/, `<title>${title}</title>`, 'la etiqueta title');
  salida = reemplazar(
    salida,
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escaparAttr(description)}" />`,
    'meta description',
  );
  salida = reemplazar(
    salida,
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${url}" />`,
    'canonical',
  );
  salida = reemplazar(
    salida,
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${escaparAttr(title)}" />`,
    'og:title',
  );
  salida = reemplazar(
    salida,
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${escaparAttr(description)}" />`,
    'og:description',
  );
  salida = reemplazar(
    salida,
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${url}" />`,
    'og:url',
  );
  salida = reemplazar(
    salida,
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${escaparAttr(title)}" />`,
    'twitter:title',
  );
  salida = reemplazar(
    salida,
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${escaparAttr(description)}" />`,
    'twitter:description',
  );

  // El <noscript> de la raíz describe el juego en general; en estas páginas
  // el contenido real ya está en el DOM, así que repetirlo sería texto
  // duplicado dentro de la misma URL.
  salida = reemplazar(salida, /<noscript>[\s\S]*?<\/noscript>\s*/, '', 'bloque <noscript>');

  salida = reemplazar(
    salida,
    /<div id="root"><\/div>/,
    `<div id="root">${html}</div>`,
    '<div id="root">',
  );

  // Se escribe `<ruta>.html` (no `<ruta>/index.html`) a propósito: con el
  // patrón de directorio, nginx responde 301 agregando la
  // barra final, y entonces la URL servida deja de coincidir con el
  // <link rel="canonical"> (que apunta sin barra) — señal contradictoria para
  // el buscador, y un redirect de más en cada link interno de la app.
  // Con `$uri.html` en el try_files de nginx, la ruta responde 200 directo.
  // Comprobación final, mirando el HTML COMO LO VE UN CRAWLER: se descartan
  // los comentarios y recién ahí se exige que los tres tags críticos existan y
  // digan lo que deben. Que un reemplazo "haya ocurrido" no alcanza — puede
  // haber dejado el tag adentro de un comentario, que es exactamente el bug
  // que motivó esto. Falla el build antes que publicar páginas sin SEO.
  const visible = salida.replace(/<!--[\s\S]*?-->/g, '');
  const comprobar = (regex, esperado, queCosa) => {
    const m = visible.match(regex);
    if (!m) throw new Error(`prerender: ${ruta} quedó SIN ${queCosa} visible (¿tag dentro de un comentario?)`);
    if (m[1] !== esperado) {
      throw new Error(`prerender: ${ruta} tiene ${queCosa} inesperado.\n  esperado: ${esperado}\n  obtenido: ${m[1]}`);
    }
  };
  comprobar(/<title>([^<]*)<\/title>/, title, 'title');
  comprobar(/<meta name="description" content="([^"]*)"/, escaparAttr(description), 'description');
  comprobar(/<link rel="canonical" href="([^"]*)"/, url, 'canonical');

  const destino = join(dist, `${ruta.replace(/^\//, '')}.html`);
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, salida, 'utf8');
  generadas.push({ ruta, kb: (Buffer.byteLength(salida) / 1024).toFixed(1) });
}

console.log(`✓ Prerender: ${generadas.length} páginas`);
for (const { ruta, kb } of generadas) console.log(`  ${ruta.padEnd(16)} ${kb} kB`);

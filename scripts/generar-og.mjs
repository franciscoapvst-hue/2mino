// ── Generador de la imagen social (og:image) ────────────────────────────
// Produce public/og.png (1200x630), la tarjeta que se ve al compartir un link
// de 2mino en WhatsApp, Facebook, X, Discord o Telegram. Importa especialmente
// por los enlaces de invitación a sala privada (/party/:codigo), que se
// comparten justo por WhatsApp: sin esto llegan como texto pelado.
//
// NO corre en el build: la imagen es un artefacto estable que se commitea en
// public/. Esto se ejecuta a mano solo cuando haya que rediseñarla:
//
//   node scripts/generar-og.mjs
//
// Depende de `sharp`, que hoy está en node_modules de forma TRANSITIVA (no
// figura en package.json). Si algún día no está: `npm i -D sharp`, regenerar,
// y listo — no se agrega como dependencia fija por ser una herramienta de un
// solo uso, y sharp trae binarios nativos pesados.
//
// El texto se rasteriza con librsvg (dentro de sharp), que NO carga fuentes
// web: se usa una pila de fuentes del sistema a propósito.

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const W = 1200;
const H = 630;

// Paleta: la misma de la app (src/styles.css, src/skins.ts, public/favicon.svg)
const FONDO      = '#04010f'; // --bg-base oscuro
const AMBAR      = '#ef9f2e'; // acento de marca, igual que el favicon
const CARA       = '#f1e8d6'; // cara de la ficha, igual que el favicon
const TEXTO      = '#f5f0e6';

// Color de pip por valor — copiado de PALETA_CLASICA (src/skins.ts).
const PIP = { 1: '#dc2626', 2: '#2563eb', 3: '#16a34a', 4: '#b45309', 5: '#ea580c', 6: '#1e1b4b' };

// Posiciones de pips dentro de una cara, con las MISMAS proporciones que
// DominoPiece.tsx (cara de 44 con pips en 14/22/30 → 0.32/0.5/0.68).
const CARA_PX = 130;
const lo = Math.round(CARA_PX * 0.32); // 42
const md = Math.round(CARA_PX * 0.50); // 65
const hi = Math.round(CARA_PX * 0.68); // 88
const R   = Math.round(CARA_PX * 0.08); // 10

const PIPS = {
  0: [],
  1: [[md, md]],
  2: [[hi, lo], [lo, hi]],
  3: [[hi, lo], [md, md], [lo, hi]],
  4: [[lo, lo], [hi, lo], [lo, hi], [hi, hi]],
  5: [[lo, lo], [hi, lo], [md, md], [lo, hi], [hi, hi]],
  6: [[lo, lo], [hi, lo], [lo, md], [hi, md], [lo, hi], [hi, hi]],
};

const pipsDe = (valor, offsetX) =>
  PIPS[valor]
    .map(([x, y]) => `<circle cx="${x + offsetX}" cy="${y}" r="${R}" fill="${PIP[valor] ?? '#1e1b4b'}"/>`)
    .join('');

/** Una ficha horizontal de 2 caras (260x130), con su divisor central. */
function ficha(a, b, x, y, rot) {
  const ancho = CARA_PX * 2;
  return `
    <g transform="translate(${x} ${y}) rotate(${rot})">
      <rect x="0" y="0" width="${ancho}" height="${CARA_PX}" rx="16"
            fill="${CARA}" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>
      <line x1="${CARA_PX}" y1="14" x2="${CARA_PX}" y2="${CARA_PX - 14}"
            stroke="rgba(30,27,75,0.35)" stroke-width="3"/>
      ${pipsDe(a, 0)}
      ${pipsDe(b, CARA_PX)}
    </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="0.72" cy="0.42" r="0.55">
      <stop offset="0%"   stop-color="${AMBAR}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${AMBAR}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${FONDO}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <!-- Filete ámbar: da borde a la tarjeta cuando se ve sobre fondo claro -->
  <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="24"
        fill="none" stroke="${AMBAR}" stroke-opacity="0.55" stroke-width="5"/>

  <!-- Fichas: pura geometría, se ven nítidas a cualquier escala -->
  ${ficha(6, 3, 700, 150, -9)}
  ${ficha(5, 5, 760, 330, 7)}

  <g font-family="Segoe UI, Noto Sans, DejaVu Sans, Arial, sans-serif">
    <text x="88" y="268" font-size="132" font-weight="700" fill="${TEXTO}">2mino</text>
    <text x="92" y="356" font-size="60"  font-weight="600" fill="${AMBAR}">Dominó online gratis</text>
    <text x="94" y="424" font-size="33"  font-weight="400" fill="${TEXTO}" fill-opacity="0.78">1vs1 o en parejas · sin descargas</text>
  </g>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
const destino = join(raiz, 'public', 'og.png');
await writeFile(destino, png);

const { width, height } = await sharp(png).metadata();
console.log(`✓ public/og.png — ${width}x${height}, ${(png.length / 1024).toFixed(1)} kB`);

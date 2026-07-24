// Cosméticos comprables ya equipados (docs/PLAN_COSMETICOS.md, Etapas 4 y
// "Tienda v2"). `clave` acá es la misma que usa `tienda_items` en la base
// — un solo lugar para parsear `opciones.skin_ficha`/`opciones.skin_tablero`
// y para describir cómo se dibuja cada skin, en vez de repetirlo en cada
// componente (GameBoard, SnakeBoard, PieceDemo, TiendaView, InventarioView).

import type { Val } from './api';

// ── Fichas ─────────────────────────────────────────
export type SkinFicha =
  | 'clasica' | 'ambar' | 'carey'    // las 3 originales (Etapa 4)
  | 'oscura' | 'nocturna' | 'numeros'; // nuevas (Tienda v2)

const SKINS_FICHA = new Set<SkinFicha>([
  'clasica', 'ambar', 'carey', 'oscura', 'nocturna', 'numeros',
]);

export function skinFichaDe(opciones: Record<string, unknown> | undefined): SkinFicha {
  const s = opciones?.skin_ficha;
  return typeof s === 'string' && SKINS_FICHA.has(s as SkinFicha) ? (s as SkinFicha) : 'clasica';
}

// Paleta de pips por valor de la ficha clásica — buen contraste sobre
// blanco, ya certificada (venía de DominoPiece.tsx). El 0 no dibuja pips.
const PALETA_CLASICA: Record<Val, string> = {
  0: 'transparent',
  1: '#dc2626', 2: '#2563eb', 3: '#16a34a',
  4: '#b45309', 5: '#ea580c', 6: '#1e1b4b',
};

// Para la skin de números: el 0 SÍ se muestra (es lo divertido/legible de
// esta variante), así que necesita color propio; el resto reusa el acento
// por valor de la clásica.
const PALETA_NUMEROS: Record<Val, string> = { ...PALETA_CLASICA, 0: '#475569' };

export type SkinFichaDef = {
  /** Fondo de la cara (estado normal — disabled/faceDown lo ignoran). */
  fillFace: string;
  /** Color de los pips/números: uniforme, o uno por valor (0–6). */
  pipColor: string | Record<Val, string>;
  /** Puntos clásicos vs. el dígito escrito. */
  render: 'pips' | 'numeros';
  /** Borde y línea divisoria en estado normal. */
  stroke: string;
};

// Catálogo de skins de ficha. Cada una verifica contraste de sus pips
// contra su propio fillFace (criterio WCAG AA, PLAN_COSMETICOS §5) —
// no se derivan colores al azar.
export const SKIN_FICHA: Record<SkinFicha, SkinFichaDef> = {
  // Blanca de siempre, pips de colores por valor.
  clasica:  { fillFace: '#ffffff', pipColor: PALETA_CLASICA, render: 'pips', stroke: '#6b7280' },
  // Miel cálida, pips marrón oscuro.
  ambar:    { fillFace: '#f6d891', pipColor: '#4a2f10', render: 'pips', stroke: '#b98b46' },
  // Carey (concha), canela claro con pips tostado oscuro.
  carey:    { fillFace: '#e7c79a', pipColor: '#3f2611', render: 'pips', stroke: '#8a5a34' },
  // Oscura: ficha pizarra, pips hueso (invierte la clásica).
  oscura:   { fillFace: '#212734', pipColor: '#f2ede3', render: 'pips', stroke: '#3a4150' },
  // Nocturna: casi negra cálida con pips ámbar — alto contraste negro/amarillo.
  nocturna: { fillFace: '#15120a', pipColor: '#f7ad3f', render: 'pips', stroke: '#3a2f16' },
  // Números: crema con el dígito escrito en vez de puntos.
  numeros:  { fillFace: '#fbf7ee', pipColor: PALETA_NUMEROS, render: 'numeros', stroke: '#6b7280' },
};

/** Color de preview plano (fallback) — la tienda/inventario ahora muestran
 *  una mini-ficha real, pero esto queda por si algún lugar necesita solo el
 *  color de fondo. */
export function skinFichaFill(clave: string): string {
  return (SKIN_FICHA[clave as SkinFicha] ?? SKIN_FICHA.clasica).fillFace;
}

// ── Tableros ───────────────────────────────────────
// Dos tipos (PLAN_COSMETICOS Tienda v2, "ambos por tipo"):
//  - 'css'    : gradiente/variables de game.css (clasico/roble/esmeralda,
//               los básicos, sin assets).
//  - 'imagen' : textura webp de una mesa real (fieltro, caoba, mármol...),
//               generada y optimizada, aplicada como background-image.
export type SkinTablero =
  | 'clasico' | 'roble' | 'esmeralda'                            // básicos (CSS)
  | 'fieltro' | 'caoba' | 'travertino' | 'baldosa'              // premium (imagen)
  | 'cuero' | 'onix' | 'petroleo' | 'arce';

// Auto-descubre las texturas de src/assets/boards/*.webp — dejar caer una
// webp nueva con el nombre = clave la habilita sin tocar este archivo.
const boardImgs = import.meta.glob<string>('./assets/boards/*.webp', {
  eager: true, query: '?url', import: 'default',
});
const TABLERO_IMAGEN: Record<string, string> = {};
for (const [path, url] of Object.entries(boardImgs)) {
  TABLERO_IMAGEN[path.split('/').pop()!.replace('.webp', '')] = url;
}

const SKINS_TABLERO = new Set<SkinTablero>([
  'clasico', 'roble', 'esmeralda',
  'fieltro', 'caoba', 'travertino', 'baldosa', 'cuero', 'onix', 'petroleo', 'arce',
]);

export function skinTableroDe(opciones: Record<string, unknown> | undefined): SkinTablero {
  const s = opciones?.skin_tablero;
  return typeof s === 'string' && SKINS_TABLERO.has(s as SkinTablero) ? (s as SkinTablero) : 'clasico';
}

export type SkinTableroDef = { tipo: 'css' } | { tipo: 'imagen'; url: string };

export function skinTableroDef(clave: string): SkinTableroDef {
  return TABLERO_IMAGEN[clave] ? { tipo: 'imagen', url: TABLERO_IMAGEN[clave] } : { tipo: 'css' };
}

// Color de preview de los tableros CSS (los de imagen muestran su textura
// real en CosmeticoPreview, no un swatch).
export const SKIN_TABLERO_PREVIEW: Record<string, string> = {
  clasico:   '#0a0f0d',
  roble:     '#1a120a',
  esmeralda: '#0a1f1a',
};

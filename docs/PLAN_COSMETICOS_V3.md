# Plan — Cosméticos v3: más fichas y nuevo enfoque de tableros

**Sesión 2** · agrupa los puntos 10 y 11. Continúa `PLAN_COSMETICOS.md` (Etapas A–F ya
hechas: skins de ficha SVG, tableros, feedback de compra, catálogo admin).

## Contexto

Ya existe el sistema de cosméticos: `src/skins.ts` (descriptor `SKIN_FICHA` con
`fillFace`/`pipColor`/`render`/`stroke`, y `SKIN_TABLERO` con tipo `css | imagen`),
`DominoPiece.tsx` (100% SVG), el catálogo en `tienda_items` y la Tienda. Dos pedidos:

- **Punto 10 — más fichas**: variantes con estética distinta (8-bit, realistas, etc.),
  **mismo tamaño** para no romper el layout, solo cambia el look.
- **Punto 11 — tableros**: el enfoque actual (una imagen 16:9 por tablero, con el logo
  horneado, escalada a `cover`) se ve **pixelado** al agrandar y "no pega con la UI".
  Nuevo enfoque: pedirle a Gemini una **textura chica y tileable** (que se repita sin
  costura) y **meter el logo nosotros** en código — así no se pierde calidad a ningún
  tamaño y el logo queda nítido y controlado.

## Alcance

**Sí:**
- **Fichas nuevas** como variantes del descriptor existente. Dos caminos según estética:
  - Las que se pueden hacer **con SVG/parámetros** (realista con sombreado suave,
    alto contraste, pastel, etc.) → extender `SKIN_FICHA` sin assets, como hoy.
  - Las que necesitan un **look de pixel/8-bit** que el SVG vectorial no da natural →
    permitir una skin de ficha basada en **sprite** (una imagen por cara/valor), con un
    segundo tipo en el descriptor (`render: 'pips' | 'numeros' | 'sprite'`). Mantener el
    **mismo viewBox/tamaño** para no romper mano/tablero/ghost.
- **Tableros tileables**: cambiar `SkinTableroDef` de "imagen full-bleed" a **textura
  que se repite** (`background-repeat`) sobre la mesa acotada (`.game-table`, ya
  introducida). El **logo va como overlay en código** (SVG/`Bone` + wordmark, opacidad
  baja, centrado o en una esquina), no horneado en la imagen.
- Regenerar las texturas de tablero con **prompts de textura seamless** (chica, ~512px,
  sin logo, sin viñeta propia) y pasarlas por el pipeline `sharp`→webp.

**No:**
- Rehacer la Tienda ni el flujo de compra/equipar (ya está).
- Animaciones de ficha nuevas.

## Dónde vive

- `src/skins.ts` — sumar claves de ficha nuevas al `SKIN_FICHA`; extender el descriptor
  para el modo `sprite` (fichas 8-bit) y para tablero `tipo: 'textura'` (tileable).
- `src/components/game/DominoPiece.tsx` — soportar el render `sprite` (dibujar la cara
  desde un sprite en vez de pips), mismo tamaño de tile.
- `src/game.css` — para tableros `textura`: `background: url(...) repeat` sobre
  `.game-table` (mesa acotada) + capa de logo overlay + viñeta interior (ya existe).
- `src/assets/boards/*.webp` — reemplazar por texturas seamless chicas.
- `src/assets/fichas/*` (nuevo, si hay sprites 8-bit) — mismo pipeline `sharp`.
- `ms-usuarios/src/db/pool.ts` — seed de las claves nuevas (fichas + tableros) en
  `tienda_items` con precio.
- `src/components/CosmeticoPreview.tsx` — que el preview de textura muestre el tile
  repetido, y el de ficha-sprite la mini-ficha correcta.

## Etapas

1. **Tableros tileables** (arregla el dolor actual): nuevo `tipo: 'textura'`, CSS
   `repeat` sobre la mesa acotada, logo overlay en código. Regenerar 3-4 texturas
   seamless con Gemini, `sharp`→webp. Reemplazar los `.webp` actuales.
2. **Fichas SVG nuevas**: agregar variantes al `SKIN_FICHA` (realista/contraste/pastel…),
   verificar contraste de pips por skin. Seed en catálogo.
3. **Fichas sprite (8-bit)**: extender `DominoPiece` con `render: 'sprite'`, cargar
   sprites, mismo tamaño. Seed en catálogo.
4. Preview correcto en Tienda/Inventario para cada tipo nuevo.

## Prompts de textura (para Gemini, punto 11)

Pedir **texturas seamless tileables, sin logo, sin viñeta, planas y parejas** (ej.
"seamless tileable green felt texture, matte, even lighting, no logo, no vignette,
512x512, repeats without visible seams"). El logo lo mete el código. Una por material
(fieltro, madera, mármol, cuero…). Detalle uniforme para que el `repeat` no cante.

## Verificación

`tsc` limpio; equipar cada ficha nueva y ver pips/sprite correctos en mano y tablero;
equipar cada tablero y confirmar que la textura se repite **nítida** a 1080p/1440p sin
pixelado, con el logo overlay legible pero sutil, y las fichas legibles encima.

## Fuera de alcance

Migrar avatares a la tienda (ya se hará en su etapa) · marcos de avatar.

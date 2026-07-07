/**
 * SnakeBoard — layout serpiente responsivo con inicio desde el centro.
 *
 * - Las fichas van pegadas (sin separación), como en una mesa real.
 * - Cuando hay pocas fichas (una sola fila sin esquinas), se centran
 *   horizontalmente dentro del contenedor.
 * - El descenso de nivel lo forman DOS fichas verticales apiladas:
 *   la primera arranca en el tope de la fila que termina y la segunda
 *   remata alineada con el fondo de la fila que empieza.
 * - El cuadrado lo da CSS (aspect-ratio: 1 en board-center); el centrado
 *   vertical lo hace flexbox (align-items: center en board-center).
 */
import type { Val, Pieza, FichaTablero } from '../../api';
import DominoPiece from './DominoPiece';

const HW0 = 100, HH0 = 54;
const VW0 = 54,  VH0 = 100;
const N    = 5;

type PlacedPiece = {
  a: Val; b: Val; orient: 'h' | 'v';
  x: number; y: number; w: number; h: number;
  placing: boolean;
};

function computeLayout(
  tablero:  FichaTablero[],
  cw:       number,
  nuevaIdx: number | null,
) {
  const S = Math.min(1, cw / (N * HW0 + 2 * VW0));

  const HW = HW0 * S,  HH = HH0 * S;
  const VW = VW0 * S,  VH = VH0 * S;
  const LEFT  = VW;
  const RIGHT = LEFT + N * HW;
  const boardW = RIGHT + VW; // = cw
  // Los dobles atravesados sobresalen (VH-HH)/2 por arriba y abajo de la
  // banda de su fila; YPAD evita coordenadas negativas en la fila 0.
  const YPAD = (VH - HH) / 2;
  // Distancia entre topes de filas: las dos verticales (2·VH) cubren
  // desde el tope de una fila hasta el fondo de la siguiente.
  const ROW_STEP = 2 * VH - HH;

  const esDoble = (f: FichaTablero) => f.izqVal === f.derVal;
  const anchoDe = (f: FichaTablero) => (esDoble(f) ? VW : HW);

  // ¿Cabe todo en una sola fila centrada?
  const totalW = tablero.reduce((s, f) => s + anchoDe(f), 0);
  const needsWrap = totalW > boardW + 0.5;

  const pieces: PlacedPiece[] = [];
  let row = 0, cornersLeft = 0, turnX = 0;
  // Cursor X dentro de la fila: avanza a la derecha en filas pares y a la
  // izquierda en impares. Los anchos varían (dobles = VW, resto = HW).
  let cursor = needsWrap ? LEFT : (boardW - totalW) / 2;

  for (let i = 0; i < tablero.length; i++) {
    const f       = tablero[i];
    const placing = i === nuevaIdx;
    const even    = row % 2 === 0;
    const w       = anchoDe(f);

    // ¿Toca girar? La ficha que ya no cabe inicia la vuelta, pegada al
    // final real de la cadena (no al borde del tablero). Los márgenes
    // VW de cada lado garantizan que la vertical siempre cabe.
    // Además, un doble no puede quedar atravesado junto a la columna del
    // giro (serían dos verticales seguidas): si después del doble ya no
    // cabría la siguiente ficha, el doble mismo baja como primera
    // vertical de la vuelta.
    if (cornersLeft === 0 && needsWrap) {
      const cabe = even ? cursor + w <= RIGHT + 0.5 : cursor - w >= LEFT - 0.5;
      const sig  = tablero[i + 1];
      const dobleJuntoAlGiro = cabe && esDoble(f) && sig !== undefined && (
        even
          ? cursor + w + anchoDe(sig) > RIGHT + 0.5
          : cursor - w - anchoDe(sig) < LEFT - 0.5
      );
      if (!cabe || dobleJuntoAlGiro) {
        cornersLeft = 2;
        turnX = even ? cursor : cursor - VW;
      }
    }

    if (cornersLeft > 0) {
      // Vuelta en U: primera vertical pegada al tope de la fila que
      // termina; segunda justo debajo, tocando la fila que empieza.
      const isPrimera = cornersLeft === 2;
      pieces.push({
        a: f.izqVal, b: f.derVal, orient: 'v',
        x: turnX,
        y: YPAD + row * ROW_STEP + (isPrimera ? 0 : VH),
        w: VW, h: VH, placing,
      });
      cornersLeft--;
      if (cornersLeft === 0) {
        row++;
        // La fila nueva arranca pegada a la columna de la vuelta
        cursor = row % 2 === 0 ? turnX + VW : turnX;
      }
      continue;
    }

    const rowTop = YPAD + row * ROW_STEP;
    const x = even ? cursor : cursor - w;

    if (esDoble(f)) {
      // Doble → atravesado (vertical), centrado en la banda de la fila
      pieces.push({
        a: f.izqVal, b: f.derVal, orient: 'v',
        x, y: rowTop - YPAD, w: VW, h: VH, placing,
      });
    } else {
      const a: Val = even ? f.izqVal : f.derVal;
      const b: Val = even ? f.derVal : f.izqVal;
      pieces.push({ a, b, orient: 'h', x, y: rowTop, w: HW, h: HH, placing });
    }
    cursor += even ? w : -w;
  }

  const boardH = pieces.length
    ? Math.max(...pieces.map(p => p.y + p.h)) + 4
    : HH + 4;

  // Posición X del contenido real (para las zonas de drop)
  const contentMinX = Math.min(...pieces.map(p => p.x));
  const contentMaxX = Math.max(...pieces.map(p => p.x + p.w));

  return { pieces, boardW, boardH, VW, VH, HW, HH, contentMinX, contentMaxX };
}

export type SnakeBoardProps = {
  tablero:        FichaTablero[];
  containerWidth: number;
  nuevaFichaIdx:  number | null;
  /** Ficha activa (arrastrando o tocada) — se previsualiza en las puntas
   *  donde de verdad se puede jugar (canIzq/canDer ya vienen evaluados
   *  contra las reglas reales, no "siempre ambos lados" al arrastrar). */
  piezaFantasma:  Pieza | null;
  canIzq:         boolean;
  canDer:         boolean;
  sobreIzq:       boolean;
  sobreDer:       boolean;
  onPlayIzq:      () => void;
  onPlayDer:      () => void;
  onDragOverIzq:  (e: React.DragEvent) => void;
  onDragOverDer:  (e: React.DragEvent) => void;
  onDragLeave:    () => void;
};

/** Orienta la ficha fantasma para el lado dado: la cara que coincide con
 *  el extremo del tablero queda pegada a él (como quedaría si se juega),
 *  la otra cara (el nuevo extremo que se abriría) queda hacia afuera. Los
 *  dobles siempre van atravesados (igual que en el tablero real). */
function orientarFantasma(pieza: Pieza, valorExtremo: Val, lado: 'izq' | 'der') {
  if (pieza.a === pieza.b) return { a: pieza.a, b: pieza.b, orient: 'v' as const };
  const otro = pieza.a === valorExtremo ? pieza.b : pieza.a;
  return lado === 'izq'
    ? { a: otro, b: valorExtremo, orient: 'h' as const }
    : { a: valorExtremo, b: otro, orient: 'h' as const };
}

export default function SnakeBoard({
  tablero, containerWidth, nuevaFichaIdx, piezaFantasma,
  canIzq, canDer, sobreIzq, sobreDer,
  onPlayIzq, onPlayDer,
  onDragOverIzq, onDragOverDer, onDragLeave,
}: SnakeBoardProps) {
  if (!tablero.length || containerWidth <= 0) return null;

  const { pieces, boardW, boardH, VW, HW, VH, HH, contentMinX, contentMaxX } =
    computeLayout(tablero, containerWidth, nuevaFichaIdx);

  const izqVal = tablero[0].izqVal;
  const derVal = tablero[tablero.length - 1].derVal;
  const fantasmaIzq = piezaFantasma && canIzq ? orientarFantasma(piezaFantasma, izqVal, 'izq') : null;
  const fantasmaDer = piezaFantasma && canDer ? orientarFantasma(piezaFantasma, derVal, 'der') : null;

  // Tamaño real de la ficha fantasma según su orientación (doble = vertical
  // atravesado, normal = horizontal), igual que cualquier ficha del tablero.
  const ZWi = fantasmaIzq?.orient === 'v' ? VW : HW;
  const ZHi = fantasmaIzq?.orient === 'v' ? VH : HH;
  const ZWd = fantasmaDer?.orient === 'v' ? VW : HW;
  const ZHd = fantasmaDer?.orient === 'v' ? VH : HH;
  const ZYi = Math.max(0, (boardH - ZHi) / 2);
  const ZYd = Math.max(0, (boardH - ZHd) / 2);

  // Junto al contenido, pero nunca fuera del tablero (board-center
  // recorta con overflow:hidden): si no hay hueco, se superponen al borde.
  const izqX = Math.max(0, Math.min(contentMinX - ZWi - 4, boardW - ZWi));
  const derX = Math.min(contentMaxX + 4, boardW - ZWd);

  return (
    <div
      className="snake-board-wrap"
      style={{ width: boardW, height: boardH }}
    >
      {pieces.map((p, i) => (
        <DominoPiece
          key={i}
          a={p.a} b={p.b}
          orient={p.orient}
          placing={p.placing}
          style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h }}
        />
      ))}

      {fantasmaIzq && (
        <div
          className={`snake-drop-zone${sobreIzq ? ' dz-sobre' : ''}`}
          style={{ position: 'absolute', left: izqX, top: ZYi, width: ZWi, height: ZHi }}
          onClick={onPlayIzq}
          onDragOver={onDragOverIzq}
          onDrop={e => { e.preventDefault(); onPlayIzq(); }}
          onDragLeave={onDragLeave}
          aria-label="Jugar por la izquierda"
        >
          <DominoPiece a={fantasmaIzq.a} b={fantasmaIzq.b} orient={fantasmaIzq.orient} ghost style={{ width: '100%', height: '100%' }} />
        </div>
      )}

      {fantasmaDer && (
        <div
          className={`snake-drop-zone${sobreDer ? ' dz-sobre' : ''}`}
          style={{ position: 'absolute', left: derX, top: ZYd, width: ZWd, height: ZHd }}
          onClick={onPlayDer}
          onDragOver={onDragOverDer}
          onDrop={e => { e.preventDefault(); onPlayDer(); }}
          onDragLeave={onDragLeave}
          aria-label="Jugar por la derecha"
        >
          <DominoPiece a={fantasmaDer.a} b={fantasmaDer.b} orient={fantasmaDer.orient} ghost style={{ width: '100%', height: '100%' }} />
        </div>
      )}
    </div>
  );
}

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

  // Estado final del cursor de la serpiente — permite calcular dónde caería
  // UNA ficha más (el fantasma) sin recomputar un layout hipotético entero.
  return {
    pieces, boardW, boardH, VW, VH, HW, HH,
    LEFT, RIGHT, YPAD, ROW_STEP, needsWrap,
    endCursor: cursor, endRow: row, cornersLeft, turnX,
  };
}

type Layout = ReturnType<typeof computeLayout>;
type GhostPos = { x: number; y: number; w: number; h: number; orient: 'h' | 'v' };

/** Dónde caería una ficha agregada al FINAL de la serpiente (lado derecho),
 *  continuando el cursor real — mismas reglas de giro que computeLayout,
 *  pero sin recalcular un tablero hipotético completo. Así el fantasma
 *  queda SIEMPRE pegado a la punta visible: nunca mezcla coordenadas de
 *  dos layouts con wrap/centrado distinto (el bug que lo dejaba fuera de
 *  sitio cuando la jugada iba a provocar un reacomodo). */
function ghostDerPos(L: Layout, esDobleG: boolean): GhostPos {
  const { VW, VH, HW, HH, LEFT, RIGHT, YPAD, ROW_STEP, needsWrap, endCursor, endRow, cornersLeft, turnX, boardW } = L;

  // La última ficha real fue la primera vertical de un giro a medias:
  // la siguiente es la segunda vertical, justo debajo.
  if (cornersLeft === 1) {
    return { x: turnX, y: YPAD + endRow * ROW_STEP + VH, w: VW, h: VH, orient: 'v' };
  }

  const even   = endRow % 2 === 0;
  const w      = esDobleG ? VW : HW;
  const rowTop = YPAD + endRow * ROW_STEP;
  const maxDer = needsWrap ? RIGHT : boardW;
  const minIzq = needsWrap ? LEFT : 0;
  const cabe   = even ? endCursor + w <= maxDer + 0.5 : endCursor - w >= minIzq - 0.5;

  if (cabe) {
    const x = even ? endCursor : endCursor - w;
    return esDobleG
      ? { x, y: rowTop - YPAD, w: VW, h: VH, orient: 'v' }
      : { x, y: rowTop,        w: HW, h: HH, orient: 'h' };
  }

  if (!needsWrap) {
    // Fila única centrada ya sin espacio: al jugar de verdad el tablero
    // pasa a serpiente y se reacomoda entero — como preview, se pega el
    // fantasma al borde (puede solaparse un poco: señal de "esto empuja").
    const x = Math.max(0, Math.min(even ? endCursor : endCursor - w, boardW - w));
    return esDobleG
      ? { x, y: rowTop - YPAD, w: VW, h: VH, orient: 'v' }
      : { x, y: rowTop,        w: HW, h: HH, orient: 'h' };
  }

  // No cabe en la fila → sería la primera vertical del giro en U
  const x = even ? endCursor : endCursor - VW;
  return { x, y: rowTop, w: VW, h: VH, orient: 'v' };
}

/** Dónde caería una ficha antepuesta a la CABEZA de la serpiente (lado
 *  izquierdo). La cabeza vive siempre al inicio de la fila 0 (fluye a la
 *  derecha), así que el fantasma va a su izquierda; si no hay espacio
 *  horizontal, se muestra vertical en el margen (la jugada real
 *  reacomodaría todo — el preview se mantiene pegado y visible). */
function ghostIzqPos(L: Layout, esDobleG: boolean): GhostPos {
  const { VW, VH, HW, HH, YPAD, pieces } = L;
  const head = pieces[0];
  const w = esDobleG ? VW : HW;
  const xh = head.x - w;
  if (xh >= -0.5) {
    return esDobleG
      ? { x: xh, y: 0,    w: VW, h: VH, orient: 'v' }
      : { x: xh, y: YPAD, w: HW, h: HH, orient: 'h' };
  }
  return { x: Math.max(0, head.x - VW), y: 0, w: VW, h: VH, orient: 'v' };
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

/** FichaTablero sintética para la ficha fantasma: izqVal/derVal son los
 *  valores semánticos de sus caras dentro de la cadena (independiente de
 *  cómo se dibuje) — la cara que toca el extremo actual, y la cara nueva
 *  que quedaría expuesta. Corriendo esto por el mismo computeLayout que
 *  el tablero real, el fantasma hereda el mismo comportamiento de vueltas
 *  y wrap de la serpiente, en vez de una posición calculada aparte. */
function fichaFantasma(pieza: Pieza, valorExtremo: Val, lado: 'izq' | 'der'): FichaTablero {
  if (pieza.a === pieza.b) return { pieza, izqVal: pieza.a, derVal: pieza.a };
  const otro = pieza.a === valorExtremo ? pieza.b : pieza.a;
  return lado === 'izq'
    ? { pieza, izqVal: otro, derVal: valorExtremo }
    : { pieza, izqVal: valorExtremo, derVal: otro };
}

export default function SnakeBoard({
  tablero, containerWidth, nuevaFichaIdx, piezaFantasma,
  canIzq, canDer, sobreIzq, sobreDer,
  onPlayIzq, onPlayDer,
  onDragOverIzq, onDragOverDer, onDragLeave,
}: SnakeBoardProps) {
  if (!tablero.length || containerWidth <= 0) return null;

  const real = computeLayout(tablero, containerWidth, nuevaFichaIdx);

  const izqVal = tablero[0].izqVal;
  const derVal = tablero[tablero.length - 1].derVal;

  // Fantasmas anclados a la geometría REAL: se calculan continuando el
  // cursor de la serpiente (der) o antecediendo la cabeza (izq) — un solo
  // sistema de coordenadas, siempre pegados a la punta visible.
  const fichaIzq = piezaFantasma && canIzq ? fichaFantasma(piezaFantasma, izqVal, 'izq') : null;
  const fichaDer = piezaFantasma && canDer ? fichaFantasma(piezaFantasma, derVal, 'der') : null;

  const fantasmaIzq = fichaIzq && (() => {
    const pos = ghostIzqPos(real, fichaIzq.izqVal === fichaIzq.derVal);
    // Fila 0 fluye a la derecha: cara "nueva" (izqVal) queda a la izquierda
    return { ...pos, a: fichaIzq.izqVal, b: fichaIzq.derVal };
  })();

  const fantasmaDer = fichaDer && (() => {
    const pos = ghostDerPos(real, fichaDer.izqVal === fichaDer.derVal);
    // Misma regla de caras que computeLayout: en filas impares (fluyen a
    // la izquierda) las horizontales se dibujan invertidas; las verticales
    // (dobles/giros) van siempre izqVal arriba.
    const evenRow = real.endRow % 2 === 0;
    const [a, b] = pos.orient === 'h' && !evenRow
      ? [fichaDer.derVal, fichaDer.izqVal]
      : [fichaDer.izqVal, fichaDer.derVal];
    return { ...pos, a, b };
  })();

  // Por si el fantasma inicia una fila nueva que el tablero real todavía
  // no tiene: no lo recortamos, agrandamos el contenedor para mostrarlo.
  const boardH = Math.max(
    real.boardH,
    fantasmaIzq ? fantasmaIzq.y + fantasmaIzq.h + 4 : 0,
    fantasmaDer ? fantasmaDer.y + fantasmaDer.h + 4 : 0,
  );

  // El contenedor (.board-center) es un cuadrado de lado containerWidth:
  // si la serpiente crece más alto que eso, se escala TODO el tablero para
  // que quepa (mismo criterio que la mano con handScale) en vez de dejar
  // que overflow:hidden lo recorte.
  const fitScale = Math.min(1, containerWidth / boardH);

  return (
    <div
      className="snake-board-wrap"
      style={{
        width: real.boardW,
        height: boardH,
        transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
        transformOrigin: 'center center',
      }}
    >
      {real.pieces.map((p, i) => (
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
          style={{ position: 'absolute', left: fantasmaIzq.x, top: fantasmaIzq.y, width: fantasmaIzq.w, height: fantasmaIzq.h }}
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
          style={{ position: 'absolute', left: fantasmaDer.x, top: fantasmaDer.y, width: fantasmaDer.w, height: fantasmaDer.h }}
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

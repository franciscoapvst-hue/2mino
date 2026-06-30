/**
 * SnakeBoard — Tablero de dominó con layout serpiente.
 *
 * Disposición:
 *   fila 0 →  [h][h]...[h]  [corner-der ↕]
 *   fila 1 ←  [h][h]...[h]  [corner-izq ↕]
 *   fila 2 →  ...
 *
 * Cada pieza tiene coordenadas absolutas (x,y) dentro del contenedor SVG.
 * Las piezas de filas impares (←) se muestran con a/b invertidos para
 * que los valores queden visualmente conectados al extremo correcto.
 */
import type { Val } from '../../api';
import type { FichaTablero } from '../../api';
import DominoPiece from './DominoPiece';

// ── Dimensiones base (antes de escalar) ─────────
const HW0 = 100, HH0 = 54;   // pieza horizontal
const VW0 = 54,  VH0 = 100;  // pieza vertical (esquinas)
const GAP0 = 5;               // gap entre piezas
const N_PER_ROW = 5;          // fichas h por fila objetivo

type PlacedPiece = {
  a: Val; b: Val;
  orient: 'h' | 'v';
  x: number; y: number;
  w: number; h: number;
  placing: boolean;
};

function computeLayout(
  tablero: FichaTablero[],
  containerWidth: number,
  nuevaFichaIdx: number | null,
): { pieces: PlacedPiece[]; boardW: number; boardH: number } {
  const N = N_PER_ROW;

  // Escala para que N fichas h + 2 esquinas quepan en containerWidth
  const S = Math.min(
    1,
    (containerWidth - (N + 1) * GAP0) / (N * HW0 + 2 * VW0),
  );

  const HW = HW0 * S, HH = HH0 * S;
  const VW = VW0 * S, VH = VH0 * S;
  const GAP = Math.round(GAP0 * S);

  // Margen superior para que esquinas no queden en y<0
  const YPAD = (VH - HH) / 2;

  // Origen X de fichas horizontales (espacio para esquinas izquierdas)
  const LEFT_X = VW + GAP;
  // Origen X de esquinas derechas
  const RIGHT_X = LEFT_X + N * (HW + GAP);

  const pieces: PlacedPiece[] = [];
  let rowNum      = 0;
  let pieceInRow  = 0;
  let nextIsCorner = false;

  for (let i = 0; i < tablero.length; i++) {
    const f       = tablero[i];
    const placing = i === nuevaFichaIdx;

    if (nextIsCorner) {
      // ── Esquina (vertical) ──────────────────────
      const isEven = rowNum % 2 === 0; // dirección de la fila que SE ACABA DE COMPLETAR
      const cx = isEven ? RIGHT_X : 0;
      const cy = rowNum * VH;          // y=k*VH para que encaje entre las dos filas

      pieces.push({
        a: f.izqVal, b: f.derVal, orient: 'v',
        x: cx, y: cy, w: VW, h: VH, placing,
      });
      rowNum++;
      pieceInRow  = 0;
      nextIsCorner = false;

    } else {
      // ── Pieza horizontal ─────────────────────────
      const isEven = rowNum % 2 === 0;
      const y = YPAD + rowNum * VH;
      let x: number, a: Val, b: Val;

      if (isEven) {
        // Fila →: izquierda a derecha, valores normales
        x = LEFT_X + pieceInRow * (HW + GAP);
        a = f.izqVal;
        b = f.derVal;
      } else {
        // Fila ←: posicionada de derecha a izquierda, valores invertidos
        // para que la punta que conecta a la esquina quede a la derecha visualmente
        x = RIGHT_X - HW - pieceInRow * (HW + GAP);
        a = f.derVal;
        b = f.izqVal;
      }

      pieces.push({ a, b, orient: 'h', x, y, w: HW, h: HH, placing });
      pieceInRow++;

      if (pieceInRow >= N && i < tablero.length - 1) {
        nextIsCorner = true;
      }
    }
  }

  const lastP  = pieces[pieces.length - 1];
  const boardW = RIGHT_X + VW + GAP;
  const boardH = lastP ? lastP.y + lastP.h + 4 : VH + 4;

  return { pieces, boardW, boardH };
}

// ── Componente ───────────────────────────────────
type Props = {
  tablero:       FichaTablero[];
  containerWidth: number;
  nuevaFichaIdx: number | null;
  // drag-and-drop: llama a onDrop('izq'|'der') cuando sueltan sobre extremos
  isDragging:   boolean;
  sobreIzq:     boolean;
  sobreDer:     boolean;
  onDragOverIzq: (e: React.DragEvent) => void;
  onDragOverDer: (e: React.DragEvent) => void;
  onDropIzq:     (e: React.DragEvent) => void;
  onDropDer:     (e: React.DragEvent) => void;
  onDragLeave:   () => void;
};

export default function SnakeBoard({
  tablero, containerWidth, nuevaFichaIdx,
  isDragging, sobreIzq, sobreDer,
  onDragOverIzq, onDragOverDer,
  onDropIzq, onDropDer, onDragLeave,
}: Props) {
  if (tablero.length === 0) return null;

  const { pieces, boardW, boardH } = computeLayout(tablero, containerWidth, nuevaFichaIdx);

  // Pieza más a la izquierda y más a la derecha para posicionar drop zones
  const minX = Math.min(...pieces.map(p => p.x));
  const maxX = Math.max(...pieces.map(p => p.x + p.w));

  return (
    <div className="snake-board-wrap" style={{ width: boardW, height: boardH }}>
      {/* Fichas */}
      {pieces.map((p, i) => (
        <DominoPiece
          key={i}
          a={p.a}
          b={p.b}
          orient={p.orient}
          placing={p.placing}
          style={{
            position: 'absolute',
            left: p.x,
            top:  p.y,
            width:  p.w,
            height: p.h,
          }}
        />
      ))}

      {/* Drop zone izquierda */}
      {isDragging && (
        <div
          className={`snake-drop-zone snake-dz-izq${sobreIzq ? ' dz-sobre' : ''}`}
          style={{ left: minX - 44, top: boardH / 2 - 26, position: 'absolute' }}
          onDragOver={onDragOverIzq}
          onDrop={onDropIzq}
          onDragLeave={onDragLeave}
        >
          ◀
        </div>
      )}

      {/* Drop zone derecha */}
      {isDragging && (
        <div
          className={`snake-drop-zone snake-dz-der${sobreDer ? ' dz-sobre' : ''}`}
          style={{ left: maxX + 4, top: boardH / 2 - 26, position: 'absolute' }}
          onDragOver={onDragOverDer}
          onDrop={onDropDer}
          onDragLeave={onDragLeave}
        >
          ▶
        </div>
      )}
    </div>
  );
}

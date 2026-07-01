/**
 * SnakeBoard — layout serpiente responsivo.
 * El GAP es fijo (4 px) para que boardW === containerWidth exactamente.
 * Las zonas de juego (◀ / ▶) sirven tanto para drag-and-drop (desktop)
 * como para tap-to-play (móvil) cuando hay una ficha seleccionada.
 */
import type { Val, FichaTablero } from '../../api';
import DominoPiece from './DominoPiece';

// ── Dimensiones base (100 % escala) ─────────────
const HW0 = 100, HH0 = 54;   // pieza horizontal
const VW0 = 54,  VH0 = 100;  // pieza vertical (esquinas)
const GAP  = 4;               // ← fijo, NO escalado
const N    = 5;               // fichas horizontales por fila

type PlacedPiece = {
  a: Val; b: Val; orient: 'h'|'v';
  x: number; y: number; w: number; h: number;
  placing: boolean;
};

function computeLayout(
  tablero: FichaTablero[],
  cw: number,               // container width en px
  nuevaIdx: number | null,
) {
  // Escala exacta: 2*VW + N*HW + (N+1)*GAP === cw
  const S = Math.min(1, (cw - (N + 1) * GAP) / (N * HW0 + 2 * VW0));

  const HW = HW0 * S,  HH = HH0 * S;
  const VW = VW0 * S,  VH = VH0 * S;
  const YPAD  = (VH - HH) / 2;   // padding superior para que esquinas no tengan y<0
  const LEFT  = VW + GAP;         // x inicio de fichas horizontales
  const RIGHT = LEFT + N * (HW + GAP); // x inicio de esquinas derechas

  const pieces: PlacedPiece[] = [];
  let row = 0, col = 0, corner = false;

  for (let i = 0; i < tablero.length; i++) {
    const f = tablero[i];
    const placing = i === nuevaIdx;

    if (corner) {
      const even = row % 2 === 0;
      pieces.push({
        a: f.izqVal, b: f.derVal, orient: 'v',
        x: even ? RIGHT : 0,
        y: row * VH,
        w: VW, h: VH, placing,
      });
      row++;
      col = 0;
      corner = false;
    } else {
      const even = row % 2 === 0;
      const y = YPAD + row * VH;
      const x = even
        ? LEFT + col * (HW + GAP)
        : RIGHT - HW - col * (HW + GAP);
      const a: Val = even ? f.izqVal : f.derVal;
      const b: Val = even ? f.derVal : f.izqVal;

      pieces.push({ a, b, orient: 'h', x, y, w: HW, h: HH, placing });
      col++;
      if (col >= N && i < tablero.length - 1) corner = true;
    }
  }

  const last  = pieces[pieces.length - 1];
  // boardW exactamente igual al container width
  const boardW = RIGHT + VW;   // = 2*VW + N*(HW+GAP) + GAP ... = cw ✓
  const boardH = last ? last.y + last.h + 4 : VH + 4;

  return { pieces, boardW, boardH, VW, VH, HH };
}

// ── Props ────────────────────────────────────────
export type SnakeBoardProps = {
  tablero:       FichaTablero[];
  containerWidth: number;
  nuevaFichaIdx: number | null;

  // Zonas de juego: muestran ◀ / ▶ para drag (desktop) Y tap (móvil)
  showZones: boolean;           // mostrar alguna zona
  canIzq:   boolean;           // zona izquierda válida
  canDer:   boolean;           // zona derecha válida
  sobreIzq: boolean;           // drag hover
  sobreDer: boolean;

  onPlayIzq:    () => void;    // clic o drop en zona izquierda
  onPlayDer:    () => void;
  onDragOverIzq: (e: React.DragEvent) => void;
  onDragOverDer: (e: React.DragEvent) => void;
  onDragLeave:   () => void;
};

export default function SnakeBoard({
  tablero, containerWidth, nuevaFichaIdx,
  showZones, canIzq, canDer, sobreIzq, sobreDer,
  onPlayIzq, onPlayDer,
  onDragOverIzq, onDragOverDer, onDragLeave,
}: SnakeBoardProps) {
  if (!tablero.length) return null;

  const { pieces, boardW, boardH, VW, HH } = computeLayout(
    tablero, containerWidth, nuevaFichaIdx,
  );

  const ZW = Math.max(36, VW);        // ancho mínimo de zona
  const ZH = Math.max(HH, 44);        // alto mínimo de zona (tap target)
  const ZY = (boardH - ZH) / 2;       // centrar verticalmente

  return (
    <div className="snake-board-wrap" style={{ width: boardW, height: boardH }}>
      {/* ── Fichas ─────────────────────────────── */}
      {pieces.map((p, i) => (
        <DominoPiece
          key={i}
          a={p.a} b={p.b} orient={p.orient} placing={p.placing}
          style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h }}
        />
      ))}

      {/* ── Zona IZQUIERDA ─────────────────────── */}
      {showZones && canIzq && (
        <div
          className={`snake-drop-zone${sobreIzq ? ' dz-sobre' : ''}`}
          style={{ position: 'absolute', left: 0, top: ZY, width: ZW, height: ZH }}
          onClick={onPlayIzq}
          onDragOver={onDragOverIzq}
          onDrop={e => { e.preventDefault(); onPlayIzq(); }}
          onDragLeave={onDragLeave}
        >
          ◀
        </div>
      )}

      {/* ── Zona DERECHA ───────────────────────── */}
      {showZones && canDer && (
        <div
          className={`snake-drop-zone${sobreDer ? ' dz-sobre' : ''}`}
          style={{ position: 'absolute', right: 0, top: ZY, width: ZW, height: ZH }}
          onClick={onPlayDer}
          onDragOver={onDragOverDer}
          onDrop={e => { e.preventDefault(); onPlayDer(); }}
          onDragLeave={onDragLeave}
        >
          ▶
        </div>
      )}
    </div>
  );
}

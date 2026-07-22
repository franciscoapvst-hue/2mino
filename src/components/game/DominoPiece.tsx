import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { Val } from '../../api';
import { SKIN_FICHA, type SkinFicha, type SkinFichaDef } from '../../skins';

// ── Dimensiones SVG ─────────────────────────────────
const F   = 44;   // tamaño de cada cara (cuadrado)
const PAD = 5;    // padding exterior del tile
const DIV = 2;    // grosor del divisor
const RX  = 6;    // radio de las esquinas
const PR  = 3.5;  // radio de los puntos

const W_H = PAD + F + DIV + F + PAD; // 100
const H_H = PAD + F + PAD;            // 54

// ── Posición de los puntos ────────────────────────────
const PIPS: Record<Val, [number, number][]> = {
  0: [],
  1: [[22, 22]],
  2: [[30, 14], [14, 30]],
  3: [[30, 14], [22, 22], [14, 30]],
  4: [[14, 14], [30, 14], [14, 30], [30, 30]],
  5: [[14, 14], [30, 14], [22, 22], [14, 30], [30, 30]],
  6: [[14, 14], [30, 14], [14, 22], [30, 22], [14, 30], [30, 30]],
};

// El color de un pip sale del descriptor de la skin: uniforme (string) o
// uno por valor (Record) — ver SKIN_FICHA en skins.ts.
function pipColorDe(def: SkinFichaDef, val: Val): string {
  return typeof def.pipColor === 'string' ? def.pipColor : def.pipColor[val];
}

// Una cara: puntos clásicos, o el dígito escrito si la skin es de 'numeros'.
// El centro de la cara está en (ox+22, oy+22) — 22 = F/2.
function Cara({ val, ox, oy, def }: { val: Val; ox: number; oy: number; def: SkinFichaDef }) {
  const color = pipColorDe(def, val);
  if (def.render === 'numeros') {
    return (
      <text
        x={ox + 22} y={oy + 22}
        fill={color}
        fontSize={30} fontWeight={800}
        fontFamily="'Space Grotesk', Inter, system-ui, sans-serif"
        textAnchor="middle" dominantBaseline="central"
      >
        {val}
      </text>
    );
  }
  return (
    <>
      {PIPS[val].map(([px, py], i) => (
        <circle key={i} cx={ox + px} cy={oy + py} r={PR} fill={color} />
      ))}
    </>
  );
}

export type DominoPieceProps = {
  a:           Val;
  b:           Val;
  orient?:     'h' | 'v';
  selected?:   boolean;
  playable?:   boolean;
  faceDown?:   boolean;
  disabled?:   boolean;
  placing?:    boolean;
  draggable?:  boolean;
  /** Preview semitransparente de dónde quedaría la ficha si se juega ahí
   *  (zonas de drop del tablero) — no es clickeable/arrastrable en sí, el
   *  contenedor que la envuelve maneja click/drop. */
  ghost?:      boolean;
  /** Skin de ficha comprada y equipada (docs/PLAN_COSMETICOS.md) — solo
   *  cambia el color de fondo, nunca los pips/patrón (legibilidad). */
  skin?:       SkinFicha;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?:  () => void;
  /** Reordenar la mano: la propia ficha es también zona de drop de otra ficha arrastrada. */
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?:     (e: React.DragEvent<HTMLDivElement>) => void;
  /** Reorden táctil (móvil, donde el drag de HTML5 no existe). */
  onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove?:  (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?:   (e: React.TouchEvent<HTMLDivElement>) => void;
  onClick?:    () => void;
  className?:  string;
  style?:      CSSProperties;
};

export default function DominoPiece({
  a, b,
  orient    = 'h',
  selected  = false,
  playable  = false,
  faceDown  = false,
  disabled  = false,
  placing   = false,
  draggable = false,
  ghost     = false,
  skin      = 'clasica',
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onClick,
  className = '',
  style,
}: DominoPieceProps) {
  const uid = useId();
  const isV = orient === 'v';
  const W   = isV ? H_H : W_H;
  const H   = isV ? W_H : H_H;

  const ax = PAD;
  const ay = PAD;
  const bx = isV ? PAD : PAD + F + DIV;
  const by = isV ? PAD + F + DIV : PAD;

  // Descriptor de la skin equipada — define fondo, pips (color y si son
  // puntos o números) y el borde en estado normal. Los estados semánticos
  // (jugable/seleccionado/ghost/disabled) pisan el borde igual para todas
  // las skins; faceDown/disabled ignoran la skin (dorso/apagado fijos).
  const def = SKIN_FICHA[skin] ?? SKIN_FICHA.clasica;

  // Borde: el de la skin en normal, verde en jugable, violeta en
  // seleccionado, ámbar punteado en preview (ghost, zonas de drop).
  const stroke  = ghost    ? 'var(--amber, #ef9f2e)'
                : selected ? '#7c3aed'
                : playable ? '#16a34a'
                : disabled ? '#d1d5db'
                :            def.stroke;
  const strokeW = ghost ? 2 : selected ? 2.5 : 1.5;

  // Fondo sólido (real, no dinero real — como un dominó de verdad) — el
  // ghost se atenúa entero vía opacity del wrapper (.dp-ghost), no
  // mezclando alpha acá: si no, el color semitransparente sobre el fondo
  // oscuro de la mesa se ve sucio en vez de "la ficha real, más tenue".
  const fillFace = faceDown  ? '#1e1b4b'  // dorso oscuro
                 : disabled  ? '#f3f4f6'  // apagado (mismo para toda skin)
                 :             def.fillFace;

  const [dX1, dY1, dX2, dY2] = isV
    ? [PAD, PAD + F, PAD + F, PAD + F]
    : [PAD + F, PAD, PAD + F, PAD + F];

  const clickable = !!onClick && !disabled && !faceDown;
  const cls = [
    'dp',
    selected  && 'dp-selected',
    playable  && 'dp-playable',
    disabled  && 'dp-disabled',
    placing   && 'dp-placing',
    ghost     && 'dp-ghost',
    clickable && 'dp-clickable',
    draggable && 'dp-draggable',
    className,
  ].filter(Boolean).join(' ');

  // SVG sin width/height absolutos: responde al tamaño del wrapper via viewBox.
  const svgNode = (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', width: '100%', height: '100%' }}
      onClick={clickable ? onClick : undefined}
      aria-label={faceDown ? 'Ficha oculta' : `${a}-${b}`}
      role={clickable ? 'button' : 'img'}
    >
      {/* Sombra sutil para dar profundidad */}
      <filter id={`sh-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#00000033" />
      </filter>

      <rect
        x={strokeW / 2}
        y={strokeW / 2}
        width={W - strokeW}
        height={H - strokeW}
        rx={RX}
        fill={fillFace}
        stroke={stroke}
        strokeWidth={strokeW}
        strokeDasharray={ghost ? '5 4' : undefined}
        filter={!faceDown && !ghost ? `url(#sh-${uid})` : undefined}
      />

      {faceDown ? (
        <>
          <defs>
            <pattern id={uid} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#3730a3" strokeWidth="3" />
            </pattern>
          </defs>
          <rect
            x={PAD} y={PAD}
            width={W - 2 * PAD}
            height={H - 2 * PAD}
            rx={3}
            fill={`url(#${uid})`}
          />
        </>
      ) : (
        <>
          <line
            x1={dX1} y1={dY1} x2={dX2} y2={dY2}
            stroke={stroke} strokeWidth={1.2}
          />
          <Cara val={a} ox={ax} oy={ay} def={def} />
          <Cara val={b} ox={bx} oy={by} def={def} />
        </>
      )}
    </svg>
  );

  // Dimensiones naturales del tile: el caller puede sobrescribirlas con `style`
  const baseStyle = { display: 'inline-flex', lineHeight: 0, width: W, height: H, ...style };

  if (draggable) {
    return (
      <div
        className={cls}
        style={baseStyle}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {svgNode}
      </div>
    );
  }

  return (
    <span className={cls} style={baseStyle}>
      {svgNode}
    </span>
  );
}

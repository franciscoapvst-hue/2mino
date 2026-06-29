import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { Val } from '../../game/types';

// ── Dimensiones SVG ─────────────────────────────────
const F   = 44;   // tamaño de cada cara (cuadrado)
const PAD = 5;    // padding exterior del tile
const DIV = 2;    // grosor del divisor
const RX  = 6;    // radio de las esquinas
const PR  = 3.5;  // radio de los puntos

// Tile horizontal: 100 × 54
// Tile vertical  : 54  × 100
const W_H = PAD + F + DIV + F + PAD; // 100
const H_H = PAD + F + PAD;            // 54

// ── Posición de los puntos dentro de una cara (relativo a su esquina) ──
//    La cara tiene F×F (44×44). Área de puntos: de 8 a 36 (28×28 interna)
//    Columnas x: 14 (izq), 22 (centro), 30 (der)
//    Filas    y: 14 (arr), 22 (medio), 30 (abj)
const PIPS: Record<Val, [number, number][]> = {
  1: [[22, 22]],
  2: [[30, 14], [14, 30]],
  3: [[30, 14], [22, 22], [14, 30]],
  4: [[14, 14], [30, 14], [14, 30], [30, 30]],
  5: [[14, 14], [30, 14], [22, 22], [14, 30], [30, 30]],
  6: [[14, 14], [30, 14], [14, 22], [30, 22], [14, 30], [30, 30]],
};

// ── Color de puntos por valor (convención dominicana caribeña) ──
const PIP_COLOR: Record<Val, string> = {
  1: '#f87171', // rojo
  2: '#60a5fa', // azul
  3: '#4ade80', // verde
  4: '#facc15', // amarillo
  5: '#fb923c', // naranja
  6: '#e9d5ff', // blanco suave
};

// ── Componente interno: una cara con sus puntos ──────
function Cara({ val, ox, oy }: { val: Val; ox: number; oy: number }) {
  return (
    <>
      {PIPS[val].map(([px, py], i) => (
        <circle key={i} cx={ox + px} cy={oy + py} r={PR} fill={PIP_COLOR[val]} />
      ))}
    </>
  );
}

// ── Props públicas ───────────────────────────────────
export type DominoPieceProps = {
  a:           Val;
  b:           Val;
  orient?:     'h' | 'v';   // horizontal (defecto) o vertical
  selected?:   boolean;     // jugador la tiene seleccionada
  playable?:   boolean;     // puede jugarse (pista verde)
  faceDown?:   boolean;     // boca abajo (mano rival)
  disabled?:   boolean;     // no jugable en este turno
  onClick?:    () => void;
  className?:  string;
  style?:      CSSProperties;
};

// ── Componente principal ─────────────────────────────
export default function DominoPiece({
  a, b,
  orient    = 'h',
  selected  = false,
  playable  = false,
  faceDown  = false,
  disabled  = false,
  onClick,
  className = '',
  style,
}: DominoPieceProps) {
  const uid  = useId();
  const isV  = orient === 'v';
  const W    = isV ? H_H : W_H;  // 54 | 100
  const H    = isV ? W_H : H_H;  // 100 | 54

  // Origen de cada cara
  const ax = PAD;
  const ay = PAD;
  const bx = isV ? PAD : PAD + F + DIV;  // 5 | 51
  const by = isV ? PAD + F + DIV : PAD;  // 51 | 5

  // Color del borde según estado
  const stroke   = selected  ? '#c084fc'
                 : playable  ? '#4ade80'
                 : disabled  ? '#3b1068'
                 :             '#a855f7';
  const strokeW  = selected  ? 2.5 : 1.5;
  const fillBg   = faceDown  ? '#100228'
                 : disabled  ? '#08021a'
                 :             '#0d0520';

  // Línea divisoria
  const [dX1, dY1, dX2, dY2] = isV
    ? [PAD, PAD + F, PAD + F, PAD + F]       // horizontal
    : [PAD + F, PAD, PAD + F, PAD + F];      // vertical

  // Clases CSS
  const clickable = !!onClick && !disabled && !faceDown;
  const cls = [
    'dp',
    selected  && 'dp-selected',
    playable  && 'dp-playable',
    disabled  && 'dp-disabled',
    clickable && 'dp-clickable',
    className,
  ].filter(Boolean).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className={cls}
      style={style}
      onClick={clickable ? onClick : undefined}
      aria-label={faceDown ? 'Ficha oculta' : `${a}-${b}`}
      role={clickable ? 'button' : 'img'}
    >
      {/* Fondo del tile */}
      <rect
        x={strokeW / 2}
        y={strokeW / 2}
        width={W - strokeW}
        height={H - strokeW}
        rx={RX}
        fill={fillBg}
        stroke={stroke}
        strokeWidth={strokeW}
      />

      {faceDown ? (
        /* Patrón boca abajo */
        <>
          <defs>
            <pattern id={uid} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#2d0a5e" strokeWidth="3" />
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
          {/* Divisor */}
          <line
            x1={dX1} y1={dY1} x2={dX2} y2={dY2}
            stroke={stroke} strokeWidth={1.2}
          />
          {/* Caras */}
          <Cara val={a} ox={ax} oy={ay} />
          <Cara val={b} ox={bx} oy={by} />
        </>
      )}
    </svg>
  );
}

// ── Valores posibles en una ficha (1-6, sin blancos) ──
export type Val = 1 | 2 | 3 | 4 | 5 | 6;

// ── Ficha física ───────────────────────────────────────
export type Pieza = {
  a: Val; // extremo izquierdo / superior
  b: Val; // extremo derecho  / inferior
};

// ── Genera el set completo 1-6 (21 fichas) ────────────
export function crearSet(): Pieza[] {
  const set: Pieza[] = [];
  for (let a = 1; a <= 6; a++)
    for (let b = a; b <= 6; b++)
      set.push({ a: a as Val, b: b as Val });
  return set; // 21 fichas
}

// ── Ficha en el tablero ────────────────────────────────
export type FichaTablero = {
  pieza:    Pieza;
  // cuál extremo de la pieza queda expuesto hacia afuera del tablero
  extremo:  'a' | 'b';
  // en qué lado del tablero fue jugada
  lado:     'izq' | 'der';
};

// ── Extremos abiertos del tablero ──────────────────────
export type Extremos = { izq: Val; der: Val };

export function getExtremos(tablero: FichaTablero[]): Extremos | null {
  if (!tablero.length) return null;
  const L = tablero[0];
  const R = tablero[tablero.length - 1];
  return {
    izq: L.extremo === 'a' ? L.pieza.a : L.pieza.b,
    der: R.extremo === 'b' ? R.pieza.b : R.pieza.a,
  };
}

// ── Puede jugarse en algún extremo ────────────────────
export function puedeJugar(p: Pieza, e: Extremos): { izq: boolean; der: boolean } {
  return {
    izq: p.a === e.izq || p.b === e.izq,
    der: p.a === e.der || p.b === e.der,
  };
}

// ── Capicúa: la ficha coincide con AMBOS extremos ─────
export function esCapicua(p: Pieza, e: Extremos): boolean {
  const matchIzq = p.a === e.izq || p.b === e.izq;
  const matchDer = p.a === e.der || p.b === e.der;
  return matchIzq && matchDer;
}

// ── Puntaje ────────────────────────────────────────────
export const PUNTOS_CAPICUA   = 30;
export const PUNTOS_TRANCA    = 30; // todos pasan (blocked)

export function sumaPips(mano: Pieza[]): number {
  return mano.reduce((s, p) => s + p.a + p.b, 0);
}

// ── Resultado de una mano ──────────────────────────────
export type ResultadoMano =
  | { tipo: 'normal';   ganador: 0|1|2|3; puntos: number }
  | { tipo: 'capicua';  ganador: 0|1|2|3; puntos: 30 }
  | { tipo: 'tranca';   equipoGanador: 0|1; puntos: 30 }; // 0=equipo A(0,2) 1=equipo B(1,3)

export function calcResultado(
  ganador:     0|1|2|3 | null,
  ultimaPieza: Pieza   | null,
  extremos:    Extremos| null,
  manos:       Pieza[][], // manos[i] = fichas del jugador i
): ResultadoMano {
  // Tranca (todos pasan)
  if (ganador === null || extremos === null) {
    const sumA = sumaPips(manos[0]) + sumaPips(manos[2]);
    const sumB = sumaPips(manos[1]) + sumaPips(manos[3]);
    return { tipo: 'tranca', equipoGanador: sumA <= sumB ? 0 : 1, puntos: PUNTOS_TRANCA };
  }

  // Capicúa
  if (ultimaPieza && extremos && esCapicua(ultimaPieza, extremos)) {
    return { tipo: 'capicua', ganador, puntos: PUNTOS_CAPICUA };
  }

  // Victoria normal: suma de pips del equipo contrario
  const equipoRival = ganador % 2 === 0 ? [1, 3] : [0, 2];
  const puntos = equipoRival.reduce((s, i) => s + sumaPips(manos[i] ?? []), 0);
  return { tipo: 'normal', ganador, puntos };
}

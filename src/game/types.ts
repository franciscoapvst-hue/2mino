// ── Valores posibles en una ficha (0=blanco al 6) ─────
export type Val = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ── Ficha física ───────────────────────────────────────
export type Pieza = {
  a: Val; // extremo izquierdo / superior
  b: Val; // extremo derecho  / inferior
};

// ── Genera el set completo 0-6 (28 fichas) ────────────
export function crearSet(): Pieza[] {
  const set: Pieza[] = [];
  for (let a = 0; a <= 6; a++)
    for (let b = a; b <= 6; b++)
      set.push({ a: a as Val, b: b as Val });
  return set; // 28 fichas — 7 por jugador con 4 jugadores
}

// ── Baraja y reparte ────────────────────────────────────
export function barajar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function repartir(jugadores: number, porJugador = 7): { manos: Pieza[][]; pozo: Pieza[] } {
  const mazo = barajar(crearSet());
  const manos: Pieza[][] = [];
  for (let i = 0; i < jugadores; i++) manos.push(mazo.splice(0, porJugador));
  return { manos, pozo: mazo };
}

// ── Ficha colocada en el tablero ────────────────────────
// izqVal/derVal = valores que esta ficha muestra a cada lado
// dentro de la cadena del tablero (pueden venir invertidos vs a/b)
export type FichaTablero = {
  pieza:  Pieza;
  izqVal: Val;
  derVal: Val;
};

// ── Abre el tablero con la primera ficha ───────────────
export function abrirTablero(p: Pieza): FichaTablero {
  return { pieza: p, izqVal: p.a, derVal: p.b };
}

// ── Coloca una ficha conectándola a un extremo existente ──
export function colocarFicha(p: Pieza, valorConectado: Val, lado: 'izq' | 'der'): FichaTablero {
  if (lado === 'der') {
    // el valor que toca el tablero (conectado) debe quedar a la izquierda de esta ficha
    return p.a === valorConectado
      ? { pieza: p, izqVal: p.a, derVal: p.b }
      : { pieza: p, izqVal: p.b, derVal: p.a };
  }
  // lado === 'izq': el valor conectado debe quedar a la derecha de esta ficha
  return p.b === valorConectado
    ? { pieza: p, izqVal: p.a, derVal: p.b }
    : { pieza: p, izqVal: p.b, derVal: p.a };
}

// ── Extremos abiertos del tablero ──────────────────────
export type Extremos = { izq: Val; der: Val };

export function getExtremos(tablero: FichaTablero[]): Extremos | null {
  if (!tablero.length) return null;
  return {
    izq: tablero[0].izqVal,
    der: tablero[tablero.length - 1].derVal,
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
    const sumA = sumaPips(manos[0] ?? []) + sumaPips(manos[2] ?? []);
    const sumB = sumaPips(manos[1] ?? []) + sumaPips(manos[3] ?? []);
    return { tipo: 'tranca', equipoGanador: sumA <= sumB ? 0 : 1, puntos: PUNTOS_TRANCA };
  }

  // Capicúa
  if (ultimaPieza && esCapicua(ultimaPieza, extremos)) {
    return { tipo: 'capicua', ganador, puntos: PUNTOS_CAPICUA };
  }

  // Victoria normal: suma de pips del equipo contrario
  const equipoRival = ganador % 2 === 0 ? [1, 3] : [0, 2];
  const puntos = equipoRival.reduce((s, i) => s + sumaPips(manos[i] ?? []), 0);
  return { tipo: 'normal', ganador, puntos };
}

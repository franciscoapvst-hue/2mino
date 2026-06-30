// ── Lógica de dominó dominicano (servidor autoritativo) ──
// Espejo de src/game/types.ts del frontend, adaptado para vivir en el
// backend sin dependencias de React.

export type Val = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Pieza = { a: Val; b: Val };

export function crearSet(): Pieza[] {
  const set: Pieza[] = [];
  for (let a = 0; a <= 6; a++)
    for (let b = a; b <= 6; b++)
      set.push({ a: a as Val, b: b as Val });
  return set; // 28 fichas
}

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

export type FichaTablero = { pieza: Pieza; izqVal: Val; derVal: Val };

export function abrirTablero(p: Pieza): FichaTablero {
  return { pieza: p, izqVal: p.a, derVal: p.b };
}

export function colocarFicha(p: Pieza, valorConectado: Val, lado: 'izq' | 'der'): FichaTablero {
  if (lado === 'der') {
    return p.a === valorConectado
      ? { pieza: p, izqVal: p.a, derVal: p.b }
      : { pieza: p, izqVal: p.b, derVal: p.a };
  }
  return p.b === valorConectado
    ? { pieza: p, izqVal: p.a, derVal: p.b }
    : { pieza: p, izqVal: p.b, derVal: p.a };
}

export type Extremos = { izq: Val; der: Val };

export function getExtremos(tablero: FichaTablero[]): Extremos | null {
  if (!tablero.length) return null;
  return { izq: tablero[0].izqVal, der: tablero[tablero.length - 1].derVal };
}

export function puedeJugar(p: Pieza, e: Extremos): { izq: boolean; der: boolean } {
  return { izq: p.a === e.izq || p.b === e.izq, der: p.a === e.der || p.b === e.der };
}

export function esCapicua(p: Pieza, e: Extremos): boolean {
  const matchIzq = p.a === e.izq || p.b === e.izq;
  const matchDer = p.a === e.der || p.b === e.der;
  return matchIzq && matchDer;
}

export const PUNTOS_CAPICUA = 30;
export const PUNTOS_TRANCA  = 30;

export function sumaPips(mano: Pieza[]): number {
  return mano.reduce((s, p) => s + p.a + p.b, 0);
}

export type ResultadoMano =
  | { tipo: 'normal';  ganadorSeat: number; puntos: number }
  | { tipo: 'capicua'; ganadorSeat: number; puntos: 30 }
  | { tipo: 'tranca';  equipoGanador: 0 | 1; puntos: 30 };

export function calcResultado(
  ganadorSeat: number | null,
  ultimaPieza: Pieza | null,
  extremos:    Extremos | null,
  manos:       Pieza[][],
): ResultadoMano {
  if (ganadorSeat === null || extremos === null) {
    const sumA = sumaPips(manos[0] ?? []) + sumaPips(manos[2] ?? []);
    const sumB = sumaPips(manos[1] ?? []) + sumaPips(manos[3] ?? []);
    return { tipo: 'tranca', equipoGanador: sumA <= sumB ? 0 : 1, puntos: PUNTOS_TRANCA };
  }
  if (ultimaPieza && esCapicua(ultimaPieza, extremos)) {
    return { tipo: 'capicua', ganadorSeat, puntos: PUNTOS_CAPICUA };
  }
  const equipoRival = ganadorSeat % 2 === 0 ? [1, 3] : [0, 2];
  const puntos = equipoRival.reduce((s, i) => s + sumaPips(manos[i] ?? []), 0);
  return { tipo: 'normal', ganadorSeat, puntos };
}

// ── Estado completo de una partida (lo que se guarda como TEXT) ────
export type Asiento = { usuario_id: string; username: string; posicion: number };

export type PartidaState = {
  maxJugadores: number;
  asientos:     Asiento[];   // orden por seat (índice 0..max-1, relativo a posicion más baja)
  manos:        Pieza[][];   // manos[seat]
  tablero:      FichaTablero[];
  turno:        number;      // seat al que le toca
  pasadas:      number;
  ultimaJugada: { lado: 'izq' | 'der' } | null;
  resultado:    ResultadoMano | null;
};

// ── Construye el estado inicial de una partida ─────────────────────
export function crearPartida(jugadores: Asiento[]): PartidaState {
  const ordenados = [...jugadores].sort((a, b) => a.posicion - b.posicion);
  const maxJugadores = ordenados.length;
  const { manos } = repartir(maxJugadores);
  return {
    maxJugadores,
    asientos: ordenados,
    manos,
    tablero: [],
    turno: 0,
    pasadas: 0,
    ultimaJugada: null,
    resultado: null,
  };
}

function seatDe(partida: PartidaState, usuarioId: string): number {
  return partida.asientos.findIndex(a => a.usuario_id === usuarioId);
}

// ── Aplica una jugada (con validación completa) ────────────────────
export function aplicarJugada(
  partida: PartidaState,
  usuarioId: string,
  pieza: Pieza,
  ladoPreferido?: 'izq' | 'der',
): { ok: true; partida: PartidaState } | { ok: false; error: string } {
  if (partida.resultado) return { ok: false, error: 'La partida ya terminó' };

  const seat = seatDe(partida, usuarioId);
  if (seat === -1) return { ok: false, error: 'No perteneces a esta partida' };
  if (seat !== partida.turno) return { ok: false, error: 'No es tu turno' };

  const mano = partida.manos[seat] ?? [];
  const tieneFicha = mano.some(p => p.a === pieza.a && p.b === pieza.b);
  if (!tieneFicha) return { ok: false, error: 'No tienes esa ficha' };

  let nuevaFicha: FichaTablero;
  let ladoJugado: 'izq' | 'der';

  if (partida.tablero.length === 0) {
    nuevaFicha = abrirTablero(pieza);
    ladoJugado = 'der';
  } else {
    const ext = getExtremos(partida.tablero)!;
    const opciones = puedeJugar(pieza, ext);
    if (!opciones.izq && !opciones.der) return { ok: false, error: 'Esa ficha no encaja en ningún extremo' };
    ladoJugado = ladoPreferido && opciones[ladoPreferido] ? ladoPreferido : (opciones.der ? 'der' : 'izq');
    const valorConectado = ladoJugado === 'der' ? ext.der : ext.izq;
    nuevaFicha = colocarFicha(pieza, valorConectado, ladoJugado);
  }

  const nuevoTablero = ladoJugado === 'der' || partida.tablero.length === 0
    ? [...partida.tablero, nuevaFicha]
    : [nuevaFicha, ...partida.tablero];

  const nuevasManos = partida.manos.map((h, i) =>
    i === seat ? h.filter(p => !(p.a === pieza.a && p.b === pieza.b)) : h
  );

  const siguiente: PartidaState = {
    ...partida,
    manos: nuevasManos,
    tablero: nuevoTablero,
    pasadas: 0,
    ultimaJugada: { lado: ladoJugado },
    turno: (partida.turno + 1) % partida.maxJugadores,
  };

  if (nuevasManos[seat].length === 0) {
    const extFinal = getExtremos(nuevoTablero);
    siguiente.resultado = calcResultado(seat, pieza, extFinal, nuevasManos);
  }

  return { ok: true, partida: siguiente };
}

// ── Aplica un pase de turno (con validación: no debe poder jugar) ──
export function aplicarPase(
  partida: PartidaState,
  usuarioId: string,
): { ok: true; partida: PartidaState } | { ok: false; error: string } {
  if (partida.resultado) return { ok: false, error: 'La partida ya terminó' };

  const seat = seatDe(partida, usuarioId);
  if (seat === -1) return { ok: false, error: 'No perteneces a esta partida' };
  if (seat !== partida.turno) return { ok: false, error: 'No es tu turno' };

  const ext = getExtremos(partida.tablero);
  if (ext) {
    const tieneJugada = (partida.manos[seat] ?? []).some(p => {
      const o = puedeJugar(p, ext);
      return o.izq || o.der;
    });
    if (tieneJugada) return { ok: false, error: 'Tienes una ficha jugable, no puedes pasar' };
  }

  const nuevasPasadas = partida.pasadas + 1;

  if (nuevasPasadas >= partida.maxJugadores) {
    const resultado = calcResultado(null, null, null, partida.manos);
    return { ok: true, partida: { ...partida, pasadas: nuevasPasadas, resultado, ultimaJugada: null } };
  }

  return {
    ok: true,
    partida: {
      ...partida,
      pasadas: nuevasPasadas,
      ultimaJugada: null,
      turno: (partida.turno + 1) % partida.maxJugadores,
    },
  };
}

// ── Vista pública de la partida para un usuario concreto ───────────
// Oculta las manos ajenas (solo expone el conteo de fichas).
export type PartidaPublica = {
  maxJugadores: number;
  asientos:     Asiento[];
  miSeat:       number;
  miMano:       Pieza[];
  conteoManos:  number[];
  tablero:      FichaTablero[];
  turno:        number;
  pasadas:      number;
  ultimaJugada: { lado: 'izq' | 'der' } | null;
  resultado:    ResultadoMano | null;
  estado:       'jugando' | 'terminado';
};

export function vistaPublica(partida: PartidaState, usuarioId: string): PartidaPublica {
  const miSeat = seatDe(partida, usuarioId);
  return {
    maxJugadores: partida.maxJugadores,
    asientos:     partida.asientos,
    miSeat,
    miMano:       miSeat >= 0 ? partida.manos[miSeat] ?? [] : [],
    conteoManos:  partida.manos.map(h => h.length),
    tablero:      partida.tablero,
    turno:        partida.turno,
    pasadas:      partida.pasadas,
    ultimaJugada: partida.ultimaJugada,
    resultado:    partida.resultado,
    estado:       partida.resultado ? 'terminado' : 'jugando',
  };
}

// ── Lógica de dominó dominicano (servidor autoritativo) ──
// Partida COMPLETA a puntos: se juegan manos sucesivas hasta que un
// equipo alcanza puntosObjetivo. Equipos = asientos enfrentados
// (0&2 vs 1&3; en 2 jugadores cada uno es su equipo).

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

export const PUNTOS_CAPICUA      = 30;
export const PUNTOS_PASO_A_TODOS = 30;

export function sumaPips(mano: Pieza[]): number {
  return mano.reduce((s, p) => s + p.a + p.b, 0);
}

/** Equipo de un asiento: pares (0,2) = equipo 0; impares (1,3) = equipo 1. */
export function equipoDe(seat: number): 0 | 1 {
  return (seat % 2) as 0 | 1;
}

// ── Resultado de UNA mano ───────────────────────────────────────────
export type ResultadoMano =
  | { tipo: 'normal';  ganadorSeat: number; puntos: number }
  | { tipo: 'capicua'; ganadorSeat: number; puntos: number }
  // equipoGanador null = tranca empatada (nadie suma)
  | { tipo: 'tranca';  equipoGanador: 0 | 1 | null; puntos: number };

// ── Estado completo de una PARTIDA (lo que se guarda como TEXT) ─────
export type Asiento = { usuario_id: string; username: string; posicion: number };

export type Fase = 'jugando' | 'entre_manos' | 'fin_partida';

export type PartidaState = {
  maxJugadores: number;
  asientos:     Asiento[];       // orden por seat
  // — partida —
  puntosObjetivo: number;        // 100 | 150 | 200
  marcador:       [number, number]; // [equipo 0, equipo 1]
  numeroMano:     number;        // 1-based
  salida:         number;        // seat que abre la mano actual
  fase:           Fase;
  listos:         boolean[];     // confirmaciones en 'entre_manos'
  equipoGanadorPartida: 0 | 1 | null;
  // Acumulado durante TODA la partida (no se resetea entre manos, solo en
  // crearPartida) — alimenta partida_resultados para historial/leaderboard.
  capicuasPorEquipo: [number, number];
  trancasPorEquipo:  [number, number];
  // — mano en curso —
  manos:          Pieza[][];     // manos[seat]
  tablero:        FichaTablero[];
  turno:          number;        // seat al que le toca
  pasadas:        number;        // pases consecutivos
  ultimaJugada:   { lado: 'izq' | 'der' } | null;
  ultimoQueJugo:  number | null; // seat que puso la última ficha
  salidaForzada:  Pieza | null;  // mano 1: obligado a abrir con esta ficha
  resultadoMano:  ResultadoMano | null; // de la mano recién cerrada
  ultimoEvento:   { tipo: 'paso_a_todos'; seat: number } | null;
  abandonadoPorSeat: number | null;     // set si la partida terminó por abandono
};

type Resultado = { ok: true; partida: PartidaState } | { ok: false; error: string };

function seatDe(partida: PartidaState, usuarioId: string): number {
  return partida.asientos.findIndex(a => a.usuario_id === usuarioId);
}

const esMismaPieza = (x: Pieza, y: Pieza) =>
  (x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a);

/** Doble más alto repartido (6-6 con 4 jugadores siempre existe). */
function dobleMasAlto(manos: Pieza[][]): { seat: number; pieza: Pieza } | null {
  for (let v = 6; v >= 0; v--) {
    for (let seat = 0; seat < manos.length; seat++) {
      const p = manos[seat].find(x => x.a === v && x.b === v);
      if (p) return { seat, pieza: p };
    }
  }
  return null;
}

// ── Construye el estado inicial de una partida ─────────────────────
export function crearPartida(jugadores: Asiento[], puntosObjetivo = 100): PartidaState {
  const ordenados = [...jugadores].sort((a, b) => a.posicion - b.posicion);
  const maxJugadores = ordenados.length;
  const { manos } = repartir(maxJugadores);

  // Mano 1: sale quien tenga el doble más alto (6-6 con 4 jugadores) y
  // está OBLIGADO a abrir con él. Con 2 jugadores el 6-6 puede quedar en
  // el pozo → cae al doble más alto repartido; sin dobles, sale seat 0.
  const apertura = dobleMasAlto(manos);

  return {
    maxJugadores,
    asientos: ordenados,
    puntosObjetivo,
    marcador: [0, 0],
    numeroMano: 1,
    salida: apertura?.seat ?? 0,
    fase: 'jugando',
    listos: new Array(maxJugadores).fill(false),
    equipoGanadorPartida: null,
    capicuasPorEquipo: [0, 0],
    trancasPorEquipo:  [0, 0],
    manos,
    tablero: [],
    turno: apertura?.seat ?? 0,
    pasadas: 0,
    ultimaJugada: null,
    ultimoQueJugo: null,
    salidaForzada: apertura?.pieza ?? null,
    resultadoMano: null,
    ultimoEvento: null,
    abandonadoPorSeat: null,
  };
}

// ── Abandono: la partida termina, gana el equipo rival ──────────────
export function aplicarAbandono(partida: PartidaState, usuarioId: string): Resultado {
  if (partida.fase === 'fin_partida') return { ok: false, error: 'La partida ya terminó' };
  const seat = seatDe(partida, usuarioId);
  if (seat === -1) return { ok: false, error: 'No perteneces a esta partida' };

  const ganador = equipoDe(seat) === 0 ? 1 : 0;
  return {
    ok: true,
    partida: {
      ...partida,
      fase: 'fin_partida',
      equipoGanadorPartida: ganador,
      abandonadoPorSeat: seat,
    },
  };
}

// ── Cierre de mano: acumula marcador y decide fase ──────────────────
function cerrarMano(
  partida: PartidaState,
  resultado: ResultadoMano,
  proximaSalida: number,
): PartidaState {
  const marcador: [number, number] = [...partida.marcador];
  const equipo = resultado.tipo === 'tranca'
    ? resultado.equipoGanador
    : equipoDe(resultado.ganadorSeat);
  if (equipo !== null) marcador[equipo] += resultado.puntos;

  // Contadores acumulados de toda la partida (partida_resultados en el
  // historial/leaderboard). Un "normal" no suma a ninguno de los dos.
  const capicuasPorEquipo: [number, number] = [...partida.capicuasPorEquipo];
  const trancasPorEquipo:  [number, number] = [...partida.trancasPorEquipo];
  if (resultado.tipo === 'capicua') capicuasPorEquipo[equipoDe(resultado.ganadorSeat)]++;
  if (resultado.tipo === 'tranca' && resultado.equipoGanador !== null) {
    trancasPorEquipo[resultado.equipoGanador]++;
  }

  const ganadorPartida = marcador[0] >= partida.puntosObjetivo ? 0
                       : marcador[1] >= partida.puntosObjetivo ? 1
                       : null;

  return {
    ...partida,
    marcador,
    capicuasPorEquipo,
    trancasPorEquipo,
    resultadoMano: resultado,
    salida: proximaSalida,
    fase: ganadorPartida !== null ? 'fin_partida' : 'entre_manos',
    equipoGanadorPartida: ganadorPartida,
    listos: new Array(partida.maxJugadores).fill(false),
    ultimoEvento: null,
  };
}

// ── Aplica una jugada (con validación completa) ────────────────────
export function aplicarJugada(
  partida: PartidaState,
  usuarioId: string,
  pieza: Pieza,
  ladoPreferido?: 'izq' | 'der',
): Resultado {
  if (partida.fase !== 'jugando') return { ok: false, error: 'La mano no está en juego' };

  const seat = seatDe(partida, usuarioId);
  if (seat === -1) return { ok: false, error: 'No perteneces a esta partida' };
  if (seat !== partida.turno) return { ok: false, error: 'No es tu turno' };

  const mano = partida.manos[seat] ?? [];
  const tieneFicha = mano.some(p => esMismaPieza(p, pieza));
  if (!tieneFicha) return { ok: false, error: 'No tienes esa ficha' };

  let nuevaFicha: FichaTablero;
  let ladoJugado: 'izq' | 'der';

  if (partida.tablero.length === 0) {
    if (partida.salidaForzada && !esMismaPieza(pieza, partida.salidaForzada)) {
      const f = partida.salidaForzada;
      return { ok: false, error: `Debes salir con el ${f.a}-${f.b}` };
    }
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
    i === seat ? h.filter(p => !esMismaPieza(p, pieza)) : h
  );

  // ── Bonus "pasó a todos": todos los rivales pasaron, el turno volvió
  //    a quien puso la última ficha Y vuelve a jugar → +30 a su equipo.
  //    Se paga AL JUGAR (no al pasar): si no pudiera jugar sería tranca,
  //    y la tranca no lleva bonus (tú también pasaste).
  const pasoATodos =
    partida.pasadas === partida.maxJugadores - 1 &&
    partida.ultimoQueJugo === seat;

  const marcador: [number, number] = [...partida.marcador];
  if (pasoATodos) marcador[equipoDe(seat)] += PUNTOS_PASO_A_TODOS;

  const siguiente: PartidaState = {
    ...partida,
    marcador,
    manos: nuevasManos,
    tablero: nuevoTablero,
    pasadas: 0,
    ultimaJugada: { lado: ladoJugado },
    ultimoQueJugo: seat,
    ultimoEvento: pasoATodos ? { tipo: 'paso_a_todos', seat } : null,
    turno: (partida.turno + 1) % partida.maxJugadores,
  };

  // El bonus puede cerrar la partida a mitad de mano
  if (pasoATodos && marcador[equipoDe(seat)] >= partida.puntosObjetivo) {
    siguiente.fase = 'fin_partida';
    siguiente.equipoGanadorPartida = equipoDe(seat);
    return { ok: true, partida: siguiente };
  }

  // ¿Dominó? (mano vacía) → cierra la mano; el ganador sale la próxima
  if (nuevasManos[seat].length === 0) {
    const extFinal = getExtremos(nuevoTablero)!;
    const resultado: ResultadoMano = esCapicua(pieza, extFinal)
      ? { tipo: 'capicua', ganadorSeat: seat, puntos: PUNTOS_CAPICUA }
      : {
          tipo: 'normal',
          ganadorSeat: seat,
          puntos: nuevasManos.reduce(
            (s, h, i) => equipoDe(i) !== equipoDe(seat) ? s + sumaPips(h) : s, 0),
        };
    return { ok: true, partida: cerrarMano(siguiente, resultado, seat) };
  }

  return { ok: true, partida: siguiente };
}

// ── Aplica un pase de turno ─────────────────────────────────────────
export function aplicarPase(partida: PartidaState, usuarioId: string): Resultado {
  if (partida.fase !== 'jugando') return { ok: false, error: 'La mano no está en juego' };

  const seat = seatDe(partida, usuarioId);
  if (seat === -1) return { ok: false, error: 'No perteneces a esta partida' };
  if (seat !== partida.turno) return { ok: false, error: 'No es tu turno' };

  const ext = getExtremos(partida.tablero);
  if (!ext) return { ok: false, error: 'No puedes pasar antes de la salida' };
  const tieneJugada = (partida.manos[seat] ?? []).some(p => {
    const o = puedeJugar(p, ext);
    return o.izq || o.der;
  });
  if (tieneJugada) return { ok: false, error: 'Tienes una ficha jugable, no puedes pasar' };

  const nuevasPasadas = partida.pasadas + 1;

  // ── Tranca: todos pasaron, incluido quien cerró ──
  if (nuevasPasadas >= partida.maxJugadores) {
    const pipsEquipo = (eq: 0 | 1) => partida.manos.reduce(
      (s, h, i) => equipoDe(i) === eq ? s + sumaPips(h) : s, 0);
    const pips0 = pipsEquipo(0);
    const pips1 = pipsEquipo(1);

    // Gana el equipo con menos pips y suma los pips de la pareja rival.
    // Empate → nadie suma.
    const equipoGanador = pips0 < pips1 ? 0 : pips1 < pips0 ? 1 : null;
    const puntos = equipoGanador === null ? 0
                 : equipoGanador === 0 ? pips1 : pips0;

    // Salida próxima: si ganó quien trancó sale él; si no, el siguiente.
    const quienTranco = partida.ultimoQueJugo ?? partida.salida;
    const proximaSalida = equipoGanador !== null && equipoDe(quienTranco) === equipoGanador
      ? quienTranco
      : (quienTranco + 1) % partida.maxJugadores;

    const resultado: ResultadoMano = { tipo: 'tranca', equipoGanador, puntos };
    return {
      ok: true,
      partida: cerrarMano({ ...partida, pasadas: nuevasPasadas, ultimaJugada: null }, resultado, proximaSalida),
    };
  }

  // Pase normal: avanza turno. El posible bonus "pasó a todos" se paga
  // cuando el jugador al que le vuelve el turno JUEGA (ver aplicarJugada).
  return {
    ok: true,
    partida: {
      ...partida,
      pasadas: nuevasPasadas,
      ultimaJugada: null,
      ultimoEvento: null,
      turno: (partida.turno + 1) % partida.maxJugadores,
    },
  };
}

// ── "Listo" entre manos: cuando todos confirman, se reparte la próxima ──
export function marcarListo(partida: PartidaState, usuarioId: string): Resultado {
  if (partida.fase !== 'entre_manos') return { ok: false, error: 'No hay mano pendiente de iniciar' };

  const seat = seatDe(partida, usuarioId);
  if (seat === -1) return { ok: false, error: 'No perteneces a esta partida' };

  const listos = [...partida.listos];
  listos[seat] = true;

  if (!listos.every(Boolean)) {
    return { ok: true, partida: { ...partida, listos } };
  }

  // Todos listos → repartir la siguiente mano. Sale `salida` (ganador de
  // la mano anterior o regla de tranca), sin ficha de apertura forzada.
  const { manos } = repartir(partida.maxJugadores);
  return {
    ok: true,
    partida: {
      ...partida,
      manos,
      tablero: [],
      turno: partida.salida,
      pasadas: 0,
      ultimaJugada: null,
      ultimoQueJugo: null,
      salidaForzada: null,
      resultadoMano: null,
      ultimoEvento: null,
      numeroMano: partida.numeroMano + 1,
      fase: 'jugando',
      listos: new Array(partida.maxJugadores).fill(false),
    },
  };
}

// ── Vista pública de la partida para un usuario concreto ───────────
export type PartidaPublica = {
  maxJugadores: number;
  asientos:     Asiento[];
  miSeat:       number;
  miEquipo:     0 | 1 | null;
  miMano:       Pieza[];
  conteoManos:  number[];
  tablero:      FichaTablero[];
  turno:        number;
  pasadas:      number;
  ultimaJugada: { lado: 'izq' | 'der' } | null;
  // — partida —
  puntosObjetivo: number;
  marcador:       [number, number];
  numeroMano:     number;
  salida:         number;
  fase:           Fase;
  listos:         boolean[];
  salidaForzada:  Pieza | null;
  resultadoMano:  ResultadoMano | null;
  equipoGanadorPartida: 0 | 1 | null;
  ultimoEvento:   { tipo: 'paso_a_todos'; seat: number } | null;
  abandonadoPorSeat: number | null;
  estado:         'jugando' | 'entre_manos' | 'terminado';
};

export function vistaPublica(partida: PartidaState, usuarioId: string): PartidaPublica {
  const miSeat = seatDe(partida, usuarioId);
  return {
    maxJugadores: partida.maxJugadores,
    asientos:     partida.asientos,
    miSeat,
    miEquipo:     miSeat >= 0 ? equipoDe(miSeat) : null,
    miMano:       miSeat >= 0 ? partida.manos[miSeat] ?? [] : [],
    conteoManos:  partida.manos.map(h => h.length),
    tablero:      partida.tablero,
    turno:        partida.turno,
    pasadas:      partida.pasadas,
    ultimaJugada: partida.ultimaJugada,
    puntosObjetivo: partida.puntosObjetivo,
    marcador:       partida.marcador,
    numeroMano:     partida.numeroMano,
    salida:         partida.salida,
    fase:           partida.fase,
    listos:         partida.listos,
    salidaForzada:  partida.salidaForzada,
    resultadoMano:  partida.resultadoMano,
    equipoGanadorPartida: partida.equipoGanadorPartida,
    ultimoEvento:   partida.ultimoEvento,
    abandonadoPorSeat: partida.abandonadoPorSeat,
    estado: partida.fase === 'fin_partida' ? 'terminado'
          : partida.fase === 'entre_manos' ? 'entre_manos'
          : 'jugando',
  };
}

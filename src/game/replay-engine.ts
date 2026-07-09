// ── Motor de repeticiones (replay), 100% cliente ──────────────────
// El backend (ver docs/CASOS_DE_USO_SOCIAL.md §5) guarda el log de
// movimientos crudo (pieza + lado por jugada), NO el tablero ya resuelto.
// Esta función reconstruye el tablero jugada a jugada — es la misma
// operación que hoy hace ms-salas/src/game/logic.ts en el servidor,
// pero puramente visual, igual que el resto de local-rules.ts.
import type { Pieza, FichaTablero } from '../api';

export type Movimiento = {
  numeroMano: number;
  orden:      number;
  seat:       number;
  tipo:       'jugar' | 'pasar';
  pieza?:     Pieza;
  lado?:      'izq' | 'der';
};

// Un evento de puntos de la partida (ver ms-salas partida_puntos) — una
// mano puede tener MÁS de uno (ej. un bono "pasó a todos" y después su
// propio cierre normal/tranca), o ninguno de tipo cierre si el bono
// empujó el marcador al objetivo a mitad de mano y terminó la partida
// ahí mismo. `marcador` es null para partidas viejas jugadas antes de
// que existiera esta tabla (no hay forma de recuperar ese dato).
export type ResultadoMano = {
  numeroMano: number;
  tipo:       'normal' | 'capicua' | 'tranca' | 'paso_a_todos';
  equipo:     0 | 1 | null;
  puntos:     number;
  noCaben:    boolean;
  marcador:   [number, number] | null;
};

export type ReplayData = {
  salaId:      string;
  asientos:    { usuario_id: string; username: string }[];
  movimientos: Movimiento[];
  manos:       ResultadoMano[];
  /** @deprecated usar `manos` — se mantiene solo por compatibilidad. */
  resultado:   { tipo: 'normal' | 'capicua' | 'tranca'; ganadorSeat: number | null; equipoGanador: 0 | 1 | null };
};

/** Agrupa los movimientos (planos, de toda la partida) por mano, en orden. */
export function agruparPorMano(movimientos: Movimiento[]): Movimiento[][] {
  const grupos = new Map<number, Movimiento[]>();
  for (const m of movimientos) {
    const arr = grupos.get(m.numeroMano) ?? [];
    arr.push(m);
    grupos.set(m.numeroMano, arr);
  }
  return [...grupos.keys()].sort((a, b) => a - b).map(k => grupos.get(k)!);
}

/**
 * El evento que mejor representa "cómo terminó esta mano": prefiere el
 * cierre formal (normal/capicúa/tranca) si existe; si la mano terminó
 * solo por un bono "pasó a todos" que llevó el marcador al objetivo a
 * mitad de mano (sin cierre formal), usa el ÚLTIMO bono como resultado.
 */
export function resultadoDeMano(manos: ResultadoMano[], numeroMano: number): ResultadoMano | null {
  const deLaMano = manos.filter(m => m.numeroMano === numeroMano);
  const cierre = deLaMano.find(m => m.tipo !== 'paso_a_todos');
  if (cierre) return cierre;
  return deLaMano.length ? deLaMano[deLaMano.length - 1] : null;
}

/** Aplica UN movimiento de tipo 'jugar' a un tablero, devolviendo el nuevo. */
export function aplicarMovimientoTablero(tablero: FichaTablero[], pieza: Pieza, lado: 'izq' | 'der'): FichaTablero[] {
  if (tablero.length === 0) {
    return [{ pieza, izqVal: pieza.a, derVal: pieza.b }];
  }
  if (lado === 'der') {
    const derActual = tablero[tablero.length - 1].derVal;
    const nuevoDer = pieza.a === derActual ? pieza.b : pieza.a;
    return [...tablero, { pieza, izqVal: derActual, derVal: nuevoDer }];
  }
  const izqActual = tablero[0].izqVal;
  const nuevoIzq = pieza.a === izqActual ? pieza.b : pieza.a;
  return [{ pieza, izqVal: nuevoIzq, derVal: izqActual }, ...tablero];
}

/** Reconstruye el tablero completo hasta (e incluyendo) el índice `hasta`. */
export function tableroHastaMovimiento(movimientos: Movimiento[], hasta: number): FichaTablero[] {
  let tablero: FichaTablero[] = [];
  for (let i = 0; i <= hasta && i < movimientos.length; i++) {
    const m = movimientos[i];
    if (m.tipo === 'jugar' && m.pieza && m.lado) {
      tablero = aplicarMovimientoTablero(tablero, m.pieza, m.lado);
    }
  }
  return tablero;
}

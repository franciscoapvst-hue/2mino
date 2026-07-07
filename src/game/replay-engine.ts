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

export type ReplayData = {
  salaId:      string;
  asientos:    { usuario_id: string; username: string }[];
  movimientos: Movimiento[];
  resultado:   { tipo: 'normal' | 'capicua' | 'tranca'; ganadorSeat: number | null; equipoGanador: 0 | 1 | null };
};

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

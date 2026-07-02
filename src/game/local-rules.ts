// ── Ayudantes de validación visual del dominó (lado cliente) ──
// SOLO utilidades puras para la UI: qué fichas se pueden jugar, extremos
// abiertos del tablero y el set completo (para la demo de fichas).
//
// El motor real del juego —repartir, turnos, colocación, puntuación,
// capicúa/tranca— es AUTORITATIVO en el servidor (ms-salas/src/game/logic.ts).
// No repliques esa lógica aquí: el cliente solo valida de forma visual.
//
// Los tipos de datos son los del contrato de la API; se reexportan desde
// ./api para mantener una única definición en el frontend.
import type { Val, Pieza, FichaTablero } from '../api';

export type { Val, Pieza, FichaTablero };

// ── Genera el set completo 0-6 (28 fichas) ────────────
export function crearSet(): Pieza[] {
  const set: Pieza[] = [];
  for (let a = 0; a <= 6; a++)
    for (let b = a; b <= 6; b++)
      set.push({ a: a as Val, b: b as Val });
  return set; // 28 fichas
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

// ── ¿Puede jugarse en algún extremo? ──────────────────
export function puedeJugar(p: Pieza, e: Extremos): { izq: boolean; der: boolean } {
  return {
    izq: p.a === e.izq || p.b === e.izq,
    der: p.a === e.der || p.b === e.der,
  };
}

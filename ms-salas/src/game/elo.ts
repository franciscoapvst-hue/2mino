// ── Cálculo de ELO para partidas ranked ─────────────────────────────
// Matemática pura, sin base de datos: fácil de testear.
//
// 1v1: se compara el ELO de ambos jugadores.
// 2v2: el ELO del equipo es el PROMEDIO de la pareja; el delta resultante
//      se aplica por igual a los dos miembros.

export const ELO_INICIAL = 1000;
export const K_FACTOR    = 32;

/** Probabilidad esperada de que A gane frente a B (fórmula ELO clásica). */
export function esperado(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Puntos que gana el equipo vencedor (y pierde el vencido).
 * Siempre ≥ 1: hasta la victoria más esperada mueve algo.
 */
export function deltaElo(eloGanador: number, eloPerdedor: number, k = K_FACTOR): number {
  const delta = Math.round(k * (1 - esperado(eloGanador, eloPerdedor)));
  return Math.max(1, delta);
}

/** ELO de un equipo: promedio de sus miembros (1v1 = el propio). */
export function eloEquipo(elos: number[]): number {
  if (!elos.length) return ELO_INICIAL;
  return elos.reduce((s, e) => s + e, 0) / elos.length;
}

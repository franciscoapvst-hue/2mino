// ── Bots de relleno para partidas casuales ──────────────────────────
// Si nadie más aparece en la cola casual, tras BOT_FILL_MS se rellenan
// los asientos restantes con bots (ver rellenoConBots en matchmaking.ts).
// Un bot juega la primera ficha jugable de su mano (de izquierda a
// derecha) y pasa automáticamente si no tiene ninguna.

import {
  aplicarJugada, aplicarPase, marcarListo, getExtremos, puedeJugar,
} from './logic';
import type { PartidaState, Pieza } from './logic';

export const BOT_FILL_MS = 10_000;

// IDs fijos (no random): cualquier ruta que necesite reconocer "esto es
// un bot" solo compara contra esta lista, sin depender de un flag extra
// en la DB. Hasta 3 bots alcanzan para rellenar un 4P con 1 humano solo.
export const BOT_IDS = [
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000000b3',
] as const;

export const BOT_USERNAMES = ['Bot Ana', 'Bot Beto', 'Bot Cami'] as const;

export function esBot(usuarioId: string): boolean {
  return (BOT_IDS as readonly string[]).includes(usuarioId);
}

/** Primera ficha jugable de la mano, en orden (izquierda a derecha). */
function elegirJugadaBot(partida: PartidaState, seat: number): Pieza | null {
  const mano = partida.manos[seat] ?? [];
  if (partida.tablero.length === 0) {
    // Abre la mano: si hay salida forzada debe ser esa; si no, la primera.
    return partida.salidaForzada ?? mano[0] ?? null;
  }
  const ext = getExtremos(partida.tablero)!;
  for (const p of mano) {
    const o = puedeJugar(p, ext);
    if (o.izq || o.der) return p;
  }
  return null;
}

/**
 * Resuelve todos los turnos de bots consecutivos a partir del estado
 * actual: juega/pasa mientras le toque a un bot, y confirma "listo"
 * entre manos por cada bot pendiente. Se detiene en cuanto le toca a
 * un humano o la partida no tiene más que resolver. Sin cambios,
 * devuelve la MISMA referencia (permite a los callers detectar "no hubo
 * movimiento de bots" con un simple !==).
 */
export function resolverTurnosBot(partida: PartidaState): PartidaState {
  let actual = partida;
  // Tope defensivo: una partida real nunca encadena tantas jugadas de
  // bot seguidas (28 fichas por jugador como mucho); evita un loop
  // infinito si algún día hay un bug en la lógica de arriba.
  for (let iter = 0; iter < 200; iter++) {
    if (actual.fase === 'jugando') {
      const seat = actual.turno;
      const asiento = actual.asientos[seat];
      if (!asiento || !esBot(asiento.usuario_id)) break;

      const pieza = elegirJugadaBot(actual, seat);
      const resultado = pieza
        ? aplicarJugada(actual, asiento.usuario_id, pieza)
        : aplicarPase(actual, asiento.usuario_id);
      if (!resultado.ok) break; // no debería ocurrir; corta por seguridad
      actual = resultado.partida;
      continue;
    }

    if (actual.fase === 'entre_manos') {
      const pendiente = actual.asientos.findIndex(
        (a, i) => esBot(a.usuario_id) && !actual.listos[i],
      );
      if (pendiente === -1) break; // sin bots pendientes: espera a los humanos
      const resultado = marcarListo(actual, actual.asientos[pendiente].usuario_id);
      if (!resultado.ok) break;
      actual = resultado.partida;
      continue;
    }

    break; // fin_partida u otra fase: nada que resolver
  }
  return actual;
}

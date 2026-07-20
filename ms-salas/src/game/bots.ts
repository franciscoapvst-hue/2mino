// ── Bots de relleno para partidas casuales ──────────────────────────
// Si nadie más aparece en la cola casual, tras BOT_FILL_MS se rellenan
// los asientos restantes con bots (ver rellenoConBots en matchmaking.ts).
// Un bot juega la primera ficha jugable de su mano (de izquierda a
// derecha) y pasa automáticamente si no tiene ninguna.

import {
  aplicarJugada, aplicarPase, aplicarTomar, marcarListo, getExtremos, puedeJugar,
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

// Un movimiento de bot, en la misma forma que necesita partida_movimientos
// (docs/CASOS_DE_USO_SOCIAL.md §5.1) — el caller (juegos.ts) los persiste
// igual que los movimientos humanos, para que el replay quede completo.
export type MovimientoBot = {
  numeroMano: number;
  seat:       number;
  tipo:       'jugar' | 'pasar';
  pieza:      Pieza | null;
  lado:       'izq' | 'der' | null;
};

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
 * Resuelve UN solo paso de bot a partir del estado actual: una jugada, un
 * pase, o una confirmación de "listo" entre manos. Devuelve `null` si no
 * hay nada que resolver (le toca a un humano dentro de su tiempo, o la
 * fase no aplica).
 *
 * También fuerza el turno de un HUMANO si se agotó `limiteJugadaMs`
 * (docs/PENDIENTES_JUEGO.md §2) — reusa la misma heurística "primera
 * ficha jugable, o pasar" que ya usan los bots, y este mismo mecanismo de
 * red de seguridad (ver juegos.ts) para no necesitar un timer propio.
 *
 * `movimiento` es `null` para las confirmaciones de "listo" — esas no son
 * movimientos de partida y no van al log de replay.
 */
function resolverUnPasoBot(
  partida: PartidaState,
): { partida: PartidaState; movimiento: MovimientoBot | null; forzadoPorTiempo: boolean } | null {
  if (partida.fase === 'jugando') {
    const seat = partida.turno;
    const asiento = partida.asientos[seat];
    if (!asiento) return null;

    const esTurnoDeBot = esBot(asiento.usuario_id);
    const tiempoAgotado = !esTurnoDeBot
      && partida.limiteJugadaMs != null
      && Date.now() - partida.turnoEmpiezaEn > partida.limiteJugadaMs;
    if (!esTurnoDeBot && !tiempoAgotado) return null;

    const numeroMano = partida.numeroMano;
    const pieza = elegirJugadaBot(partida, seat);
    // 1vs1 sin jugada: toma UNA ficha del pozo por paso (no un loop) —
    // mismo ritmo de BOT_MOVE_DELAY_MS que cualquier otro paso de esta
    // cadena (ver resolverTurnosBotConDelay), así que un bot que tiene que
    // robar varias se ve robar de a una, no todas de golpe. Recién cuando
    // el pozo se vacía (o con 4 jugadores, que nunca tiene pozo) cae a
    // aplicarPase de verdad.
    const accion: 'jugar' | 'tomar' | 'pasar' =
      pieza ? 'jugar' : partida.maxJugadores === 2 && partida.pozo.length > 0 ? 'tomar' : 'pasar';
    const resultado =
      accion === 'jugar'  ? aplicarJugada(partida, asiento.usuario_id, pieza!) :
      accion === 'tomar'  ? aplicarTomar(partida, asiento.usuario_id) :
                             aplicarPase(partida, asiento.usuario_id);
    if (!resultado.ok) return null; // no debería ocurrir; corta por seguridad

    // Si fue forzado por tiempo (no por ser bot), avisar al frontend cuál
    // asiento se quedó sin tiempo — mismo mecanismo que "pasó a todos".
    const partidaFinal = tiempoAgotado
      ? { ...resultado.partida, ultimoEvento: { tipo: 'tiempo_agotado' as const, seat } }
      : resultado.partida;

    // "tomar" no se loguea como movimiento (no hay narración de robo en
    // el replay, ver aplicarTomar en logic.ts) — mismo criterio que la
    // ruta POST /juego/tomar en juegos.ts.
    return {
      partida: partidaFinal,
      movimiento: accion === 'tomar' ? null : {
        numeroMano, seat,
        tipo:  accion,
        pieza: pieza ?? null,
        lado:  pieza ? resultado.partida.ultimaJugada?.lado ?? null : null,
      },
      forzadoPorTiempo: tiempoAgotado,
    };
  }

  if (partida.fase === 'entre_manos') {
    const pendiente = partida.asientos.findIndex(
      (a, i) => esBot(a.usuario_id) && !partida.listos[i],
    );
    if (pendiente === -1) return null; // sin bots pendientes: espera a los humanos
    const resultado = marcarListo(partida, partida.asientos[pendiente].usuario_id);
    if (!resultado.ok) return null;
    return { partida: resultado.partida, movimiento: null, forzadoPorTiempo: false };
  }

  return null; // fin_partida u otra fase: nada que resolver
}

/**
 * Resuelve todos los turnos de bots consecutivos a partir del estado
 * actual, todos de una (sin delay). Se usa solo como red de seguridad
 * (GET /juego, ver juegos.ts) — el camino normal de juego usa
 * `resolverTurnosBotConDelay` para que se pueda seguir la partida.
 *
 * Si no hubo nada que resolver, `partida` es la MISMA referencia recibida
 * (permite a los callers detectar "no hubo cambios" con un simple !==).
 */
export function resolverTurnosBot(
  partida: PartidaState,
): { partida: PartidaState; movimientos: MovimientoBot[] } {
  let actual = partida;
  const movimientos: MovimientoBot[] = [];
  // Tope defensivo: una partida real nunca encadena tantas jugadas de
  // bot seguidas (28 fichas por jugador como mucho); evita un loop
  // infinito si algún día hay un bug en la lógica de arriba.
  for (let iter = 0; iter < 200; iter++) {
    const paso = resolverUnPasoBot(actual);
    if (!paso) break;
    actual = paso.partida;
    if (paso.movimiento) movimientos.push(paso.movimiento);
    // Un turno forzado por tiempo (no un bot) corta la cadena acá: si
    // siguiéramos resolviendo el próximo turno (ej. un bot) de una,
    // `ultimoEvento: tiempo_agotado` quedaría pisado antes de que
    // cualquier cliente llegue a verlo (ver resolverTurnosBotConDelay).
    if (paso.forzadoPorTiempo) break;
  }
  return { partida: actual, movimientos };
}

/** Tiempo entre cada jugada de bot cuando hay varios seguidos — sin esto,
 *  con 2-3 bots en fila resolvía todo de una vez y no se distinguía quién
 *  jugó cada cosa. */
export const BOT_MOVE_DELAY_MS = 1_500;

/**
 * Igual que resolverTurnosBot, pero de a un paso por vez con un delay real
 * ANTES de cada jugada de bot — nunca dispara instantáneo, ni siquiera el
 * primer paso de la cadena (antes esperaba solo ENTRE pasos, así que el
 * primero de cada cadena nueva salía sin delay: justo después de que el
 * humano juega, o después de un pase forzado por tiempo, el próximo bot
 * respondía en el poll siguiente en vez de a los 1.5s reales — se veía
 * como una ráfaga instantánea seguida recién ahí del ritmo correcto).
 * `onPaso` se llama después de cada paso (después del delay, si aplica)
 * para que el caller persista ese estado intermedio — así el polling del
 * cliente lo va mostrando progresivamente en vez de saltar directo al
 * estado final.
 *
 * El paso forzado por tiempo agotado (un HUMANO, no un bot) no espera
 * este delay — ya esperó su propio límite de tiempo — y corta la cadena
 * ahí mismo: sin esto, el turno siguiente (típicamente un bot) se
 * resolvería en el mismo ciclo y pisaría `ultimoEvento: tiempo_agotado`
 * antes de que el polling del cliente (cada 2s) llegue a verlo. El
 * próximo trigger (poll o acción) retoma desde ahí — y ese bot sí espera
 * su 1.5s como cualquier otro.
 */
export async function resolverTurnosBotConDelay(
  partida: PartidaState,
  onPaso: (partida: PartidaState, movimiento: MovimientoBot | null) => Promise<void>,
): Promise<PartidaState> {
  let actual = partida;
  for (let iter = 0; iter < 200; iter++) {
    const paso = resolverUnPasoBot(actual);
    if (!paso) break;
    if (!paso.forzadoPorTiempo) {
      await new Promise(resolve => setTimeout(resolve, BOT_MOVE_DELAY_MS));
    }
    actual = paso.partida;
    await onPaso(actual, paso.movimiento);
    if (paso.forzadoPorTiempo) break;
  }
  return actual;
}

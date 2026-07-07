import { describe, it, expect } from 'vitest';
import { esBot, resolverTurnosBot, BOT_IDS, BOT_USERNAMES, BOT_FILL_MS } from './bots';
import { crearPartida, getExtremos, puedeJugar, abrirTablero } from './logic';
import type { Asiento, PartidaState } from './logic';

function asiento(id: string, username: string, posicion: number): Asiento {
  return { usuario_id: id, username, posicion };
}

describe('esBot', () => {
  it('reconoce los IDs reservados de bot', () => {
    for (const id of BOT_IDS) expect(esBot(id)).toBe(true);
  });
  it('no marca como bot un usuario real', () => {
    expect(esBot('11111111-1111-1111-1111-111111111111')).toBe(false);
  });
});

describe('resolverTurnosBot', () => {
  it('no hace nada si le toca a un humano (misma referencia, sin movimientos)', () => {
    const partida = crearPartida([
      asiento('humano-1', 'ana', 1),
      asiento('humano-2', 'beto', 2),
    ]);
    // Fuerza que le toque al humano en turno 0 para el caso simple.
    const forzada: PartidaState = { ...partida, turno: 0, salidaForzada: null };
    const resultado = resolverTurnosBot(forzada);
    expect(resultado.partida).toBe(forzada);
    expect(resultado.movimientos).toEqual([]);
  });

  it('un bot solo (1v1 contra humano) juega hasta que le toca al humano', () => {
    const base = crearPartida([
      asiento('humano-1', 'ana', 1),
      asiento(BOT_IDS[0], BOT_USERNAMES[0], 2),
    ]);
    // Fuerza que le toque al bot (seat 1), tablero ya abierto (sin
    // salidaForzada de por medio) — determinista, sin depender del reparto.
    const leTocaAlBot: PartidaState = {
      ...base, turno: 1, salidaForzada: null, tablero: [abrirTablero(base.manos[0][0])],
    };
    const { partida, movimientos } = resolverTurnosBot(leTocaAlBot);
    // Tras resolver, o bien le toca al humano, o la mano/partida cerró.
    if (partida.fase === 'jugando') {
      expect(partida.asientos[partida.turno].usuario_id).toBe('humano-1');
    } else {
      expect(['entre_manos', 'fin_partida']).toContain(partida.fase);
    }
    // El bot jugó al menos un movimiento, y todos son del seat del bot (1).
    expect(movimientos.length).toBeGreaterThan(0);
    expect(movimientos.every(m => m.seat === 1)).toBe(true);
  });

  it('el bot juega la primera ficha jugable de su mano cuando abre sin restricción', () => {
    // Mano 2 en adelante: sin salidaForzada, el bot que abre juega manos[seat][0].
    const base = crearPartida([
      asiento(BOT_IDS[0], BOT_USERNAMES[0], 1),
      asiento('humano-1', 'ana', 2),
    ]);
    const sinForzada: PartidaState = { ...base, turno: 0, salidaForzada: null, tablero: [] };
    const primeraFicha = sinForzada.manos[0][0];
    const { partida: resultado, movimientos } = resolverTurnosBot(sinForzada);
    // El tablero (si seguimos en 'jugando' o pasó a la siguiente mano)
    // debe reflejar que la primera ficha de la mano del bot fue la jugada.
    if (resultado.tablero.length > 0) {
      expect(resultado.tablero[0].pieza).toEqual(primeraFicha);
    }
    expect(movimientos[0]).toMatchObject({ seat: 0, tipo: 'jugar', pieza: primeraFicha });
  });

  it('bots consecutivos en 4P sin humanos hasta que le toca al humano', () => {
    let partida = crearPartida([
      asiento('humano-1', 'ana', 1),
      asiento(BOT_IDS[0], BOT_USERNAMES[0], 2),
      asiento(BOT_IDS[1], BOT_USERNAMES[1], 3),
      asiento(BOT_IDS[2], BOT_USERNAMES[2], 4),
    ]);
    const { partida: resuelta } = resolverTurnosBot(partida);
    partida = resuelta;
    if (partida.fase === 'jugando') {
      expect(partida.asientos[partida.turno].usuario_id).toBe('humano-1');
    }
  });

  it('confirma "listo" automáticamente por los bots entre manos, sin generar movimientos', () => {
    const base = crearPartida([
      asiento('humano-1', 'ana', 1),
      asiento(BOT_IDS[0], BOT_USERNAMES[0], 2),
    ]);
    const entreManos: PartidaState = {
      ...base,
      fase: 'entre_manos',
      listos: [false, false],
    };
    const { partida: resultado, movimientos } = resolverTurnosBot(entreManos);
    // El bot (seat 1) debe haber confirmado; el humano (seat 0) no.
    expect(resultado.listos[1]).toBe(true);
    expect(resultado.listos[0]).toBe(false);
    expect(resultado.fase).toBe('entre_manos'); // no reparte hasta que el humano confirme
    expect(movimientos).toEqual([]); // confirmar "listo" no es un movimiento de partida
  });

  it('sanidad: la jugada elegida siempre es una ficha realmente jugable', () => {
    let partida = crearPartida([
      asiento(BOT_IDS[0], BOT_USERNAMES[0], 1),
      asiento(BOT_IDS[1], BOT_USERNAMES[1], 2),
    ]);
    const { partida: resuelta } = resolverTurnosBot(partida);
    partida = resuelta;
    // Entre bots la mano se resuelve sola (tranca, dominó, o fin de partida).
    expect(['jugando', 'entre_manos', 'fin_partida']).toContain(partida.fase);
    if (partida.tablero.length >= 2) {
      const ext = getExtremos(partida.tablero.slice(0, -1))!;
      const ultima = partida.tablero[partida.tablero.length - 1].pieza;
      const o = puedeJugar(ultima, ext);
      expect(o.izq || o.der).toBe(true);
    }
  });
});

describe('BOT_FILL_MS', () => {
  it('es 10 segundos', () => {
    expect(BOT_FILL_MS).toBe(10_000);
  });
});

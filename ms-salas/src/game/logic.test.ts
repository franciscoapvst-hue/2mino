import { describe, it, expect } from 'vitest';
import {
  crearSet, getExtremos, puedeJugar, esCapicua, equipoDe,
  abrirTablero, crearPartida, aplicarJugada, aplicarPase, marcarListo, aplicarAbandono,
  PUNTOS_CAPICUA,
  type Val, type Pieza, type Asiento, type PartidaState,
} from './logic';

// ── Helpers de construcción ────────────────────────
const pz = (a: number, b: number): Pieza => ({ a: a as Val, b: b as Val });

function asientos(n: number): Asiento[] {
  return Array.from({ length: n }, (_, i) => ({
    usuario_id: `u${i}`, username: `p${i}`, posicion: i,
  }));
}

function partida(over: Partial<PartidaState> = {}): PartidaState {
  const n = over.maxJugadores ?? 2;
  return {
    maxJugadores: n,
    asientos: asientos(n),
    puntosObjetivo: 100,
    puntosCapicua: PUNTOS_CAPICUA,
    marcador: [0, 0],
    numeroMano: 1,
    salida: 0,
    fase: 'jugando',
    listos: new Array(n).fill(false),
    equipoGanadorPartida: null,
    capicuasPorEquipo: [0, 0],
    trancasPorEquipo:  [0, 0],
    manos: Array.from({ length: n }, () => []),
    tablero: [],
    turno: 0,
    pasadas: 0,
    ultimaJugada: null,
    ultimoQueJugo: null,
    salidaForzada: null,
    resultadoMano: null,
    ultimoEvento: null,
    abandonadoPorSeat: null,
    limiteJugadaMs: null,
    turnoEmpiezaEn: 0,
    delayFinManoMs: 0,
    ...over,
  };
}

const ok = (r: { ok: true; partida: PartidaState } | { ok: false; error: string }): PartidaState => {
  expect(r.ok, r.ok ? '' : (r as { error: string }).error).toBe(true);
  return (r as { ok: true; partida: PartidaState }).partida;
};

// ── Helpers puros ──────────────────────────────────
describe('crearSet', () => {
  it('genera 28 fichas únicas incluyendo blanco (0) y dobles', () => {
    const set = crearSet();
    expect(set).toHaveLength(28);
    expect(new Set(set.map(p => `${p.a}-${p.b}`)).size).toBe(28);
    expect(set).toContainEqual({ a: 0, b: 0 });
    expect(set).toContainEqual({ a: 6, b: 6 });
  });
});

describe('getExtremos / puedeJugar / equipoDe', () => {
  it('tablero vacío no tiene extremos', () => {
    expect(getExtremos([])).toBeNull();
  });
  it('lee extremos y evalúa jugabilidad', () => {
    const t = [abrirTablero(pz(2, 3))];
    const ext = getExtremos(t)!;
    expect(ext).toEqual({ izq: 2, der: 3 });
    expect(puedeJugar(pz(5, 3), ext)).toEqual({ izq: false, der: true });
    expect(puedeJugar(pz(5, 6), ext)).toEqual({ izq: false, der: false });
  });
  it('equipos: asientos pares vs impares', () => {
    expect([0, 1, 2, 3].map(equipoDe)).toEqual([0, 1, 0, 1]);
  });
});

// ── crearPartida: salida forzada con el doble más alto ─────────────
describe('crearPartida', () => {
  it('4 jugadores: sale quien tiene el 6-6, obligado a abrirlo', () => {
    const p = crearPartida(asientos(4), 150);
    expect(p.puntosObjetivo).toBe(150);
    expect(p.marcador).toEqual([0, 0]);
    expect(p.numeroMano).toBe(1);
    expect(p.fase).toBe('jugando');
    // con 4 jugadores se reparten las 28 → el 6-6 siempre está en una mano
    expect(p.salidaForzada).toEqual({ a: 6, b: 6 });
    const holder = p.manos.findIndex(m => m.some(x => x.a === 6 && x.b === 6));
    expect(p.salida).toBe(holder);
    expect(p.turno).toBe(holder);
  });

  it('delayFinManoMs por defecto es 0 (sin límite explícito, no rompe partidas viejas)', () => {
    const p = crearPartida(asientos(2));
    expect(p.delayFinManoMs).toBe(0);
  });

  it('acepta un delayFinManoMs explícito (configurado desde reglas_juego)', () => {
    const p = crearPartida(asientos(2), 100, PUNTOS_CAPICUA, null, 2500);
    expect(p.delayFinManoMs).toBe(2500);
  });
});

describe('salida forzada', () => {
  it('rechaza abrir con otra ficha y acepta el doble exigido', () => {
    const p = partida({
      manos: [[pz(6, 6), pz(2, 3)], [pz(1, 1)]],
      salidaForzada: pz(6, 6),
    });
    const mal = aplicarJugada(p, 'u0', pz(2, 3));
    expect(mal.ok).toBe(false);
    if (!mal.ok) expect(mal.error).toMatch(/Debes salir con el 6-6/);

    const bien = ok(aplicarJugada(p, 'u0', pz(6, 6)));
    expect(bien.tablero).toHaveLength(1);
  });
});

// ── aplicarJugada ──────────────────────────────────
describe('aplicarJugada', () => {
  it('rechaza si no es tu turno', () => {
    const p = partida({ manos: [[pz(2, 3)], [pz(0, 0)]], turno: 0 });
    expect(aplicarJugada(p, 'u1', pz(0, 0))).toEqual({ ok: false, error: 'No es tu turno' });
  });

  it('rechaza si la fase no es jugando', () => {
    const p = partida({ fase: 'entre_manos', manos: [[pz(2, 3)], []] });
    expect(aplicarJugada(p, 'u0', pz(2, 3)).ok).toBe(false);
  });

  it('rechaza ficha que no encaja', () => {
    const p = partida({ manos: [[pz(5, 6)], []], tablero: [abrirTablero(pz(2, 3))] });
    const r = aplicarJugada(p, 'u0', pz(5, 6));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no encaja/);
  });

  it('respeta el lado elegido y pasa el turno', () => {
    const p = partida({ manos: [[pz(3, 4), pz(9 % 7, 2)], []], tablero: [abrirTablero(pz(2, 3))] });
    const s = ok(aplicarJugada(p, 'u0', pz(3, 4), 'der'));
    expect(getExtremos(s.tablero)!.der).toBe(4);
    expect(s.turno).toBe(1);
    expect(s.ultimoQueJugo).toBe(0);
  });
});

// ── Cierre de mano por dominó ──────────────────────
describe('dominó (mano vacía)', () => {
  it('suma al marcador los pips del equipo rival, fija salida y fase entre_manos', () => {
    const p = partida({
      maxJugadores: 4,
      asientos: asientos(4),
      // seat 0 cierra; rivales (1,3) suman 5 y 3; compañero (2) no cuenta
      manos: [[pz(3, 4)], [pz(2, 3)], [pz(6, 6)], [pz(1, 2)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 0,
      listos: [false, false, false, false],
    });
    const s = ok(aplicarJugada(p, 'u0', pz(3, 4), 'der'));
    expect(s.resultadoMano).toMatchObject({ tipo: 'normal', ganadorSeat: 0, puntos: 8 });
    expect(s.marcador).toEqual([8, 0]);
    expect(s.fase).toBe('entre_manos');
    expect(s.salida).toBe(0);       // el ganador sale la próxima
    expect(s.listos).toEqual([false, false, false, false]);
  });

  it('capicúa vale 30', () => {
    // tablero 4·…·2, cierro con 2-4 → encaja por ambos extremos
    const p = partida({
      manos: [[pz(2, 4)], [pz(1, 1)]],
      tablero: [abrirTablero(pz(4, 2))],
      turno: 0,
    });
    const s = ok(aplicarJugada(p, 'u0', pz(2, 4)));
    expect(s.resultadoMano).toMatchObject({ tipo: 'capicua', puntos: 30 });
    expect(s.marcador).toEqual([30, 0]);
    expect(s.capicuasPorEquipo).toEqual([1, 0]);
    expect(s.trancasPorEquipo).toEqual([0, 0]);
  });

  it('una victoria "normal" (sin capicúa) no incrementa capicuasPorEquipo', () => {
    const p = partida({
      maxJugadores: 4,
      asientos: asientos(4),
      manos: [[pz(3, 4)], [pz(2, 3)], [pz(6, 6)], [pz(1, 2)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 0,
      listos: [false, false, false, false],
    });
    const s = ok(aplicarJugada(p, 'u0', pz(3, 4), 'der'));
    expect(s.resultadoMano).toMatchObject({ tipo: 'normal' });
    expect(s.capicuasPorEquipo).toEqual([0, 0]);
  });

  it('al alcanzar el objetivo la partida termina', () => {
    const p = partida({
      marcador: [95, 40],
      puntosObjetivo: 100,
      manos: [[pz(3, 4)], [pz(6, 6)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 0,
    });
    const s = ok(aplicarJugada(p, 'u0', pz(3, 4), 'der'));
    expect(s.fase).toBe('fin_partida');
    expect(s.equipoGanadorPartida).toBe(0);
  });
});

// ── Bonus "pasó a todos" ───────────────────────────
describe('bonus pasó a todos (+30)', () => {
  it('4P: tres pases seguidos y quien jugó vuelve a jugar → +30 a su equipo', () => {
    // seat 0 fue el último en jugar; 1, 2 y 3 pasaron (pasadas=3);
    // vuelve a jugar seat 0 → bonus.
    const p = partida({
      maxJugadores: 4,
      asientos: asientos(4),
      manos: [[pz(3, 4), pz(1, 1)], [pz(6, 6)], [pz(6, 5)], [pz(5, 5)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 0,
      pasadas: 3,
      ultimoQueJugo: 0,
    });
    const s = ok(aplicarJugada(p, 'u0', pz(3, 4), 'der'));
    expect(s.marcador).toEqual([30, 0]);
    expect(s.ultimoEvento).toEqual({ tipo: 'paso_a_todos', seat: 0, noCaben: false });
    expect(s.fase).toBe('jugando'); // la mano sigue
  });

  it('2P: el rival pasa y vuelvo a jugar → +30', () => {
    const p = partida({
      manos: [[pz(3, 4), pz(1, 1)], [pz(6, 6)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 0,
      pasadas: 1,
      ultimoQueJugo: 0,
    });
    const s = ok(aplicarJugada(p, 'u0', pz(3, 4), 'der'));
    expect(s.marcador).toEqual([30, 0]);
  });

  it('sin la pauta completa de pases no hay bonus', () => {
    const p = partida({
      maxJugadores: 4,
      asientos: asientos(4),
      manos: [[pz(3, 4), pz(1, 1)], [], [], []],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 0,
      pasadas: 2,          // solo pasaron 2, no todos
      ultimoQueJugo: 0,
    });
    const s = ok(aplicarJugada(p, 'u0', pz(3, 4), 'der'));
    expect(s.marcador).toEqual([0, 0]);
    expect(s.ultimoEvento).toBeNull();
  });

  it('el bonus cierra la partida si cae EXACTO en el objetivo', () => {
    const p = partida({
      marcador: [70, 0],
      manos: [[pz(3, 4), pz(1, 1)], [pz(6, 6)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 0,
      pasadas: 1,
      ultimoQueJugo: 0,
    });
    const s = ok(aplicarJugada(p, 'u0', pz(3, 4), 'der'));
    expect(s.marcador[0]).toBe(100);
    expect(s.fase).toBe('fin_partida');
    expect(s.equipoGanadorPartida).toBe(0);
    expect(s.ultimoEvento).toEqual({ tipo: 'paso_a_todos', seat: 0, noCaben: false });
  });

  it('"no caben": el bonus que se pasaría del objetivo NO se aplica y la partida sigue', () => {
    // Bug real: 80 + 30 = 110, por encima de los 100 del objetivo — no
    // puede ganarse la partida de pura suerte por el bono, igual que una
    // tranca cuyos pips se pasarían del objetivo tampoco cierra la partida.
    const p = partida({
      marcador: [80, 0],
      manos: [[pz(3, 4), pz(1, 1)], [pz(6, 6)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 0,
      pasadas: 1,
      ultimoQueJugo: 0,
    });
    const s = ok(aplicarJugada(p, 'u0', pz(3, 4), 'der'));
    expect(s.marcador).toEqual([80, 0]); // sin cambios, el bono no entró
    expect(s.fase).toBe('jugando');
    expect(s.equipoGanadorPartida).toBeNull();
    expect(s.ultimoEvento).toEqual({ tipo: 'paso_a_todos', seat: 0, noCaben: true });
  });
});

// ── aplicarPase y tranca ───────────────────────────
describe('aplicarPase', () => {
  it('rechaza pasar con ficha jugable', () => {
    const p = partida({ manos: [[pz(3, 5)], []], tablero: [abrirTablero(pz(2, 3))], turno: 0 });
    const r = aplicarPase(p, 'u0');
    expect(r.ok).toBe(false);
  });

  it('pase normal avanza turno sin bonus', () => {
    const p = partida({
      manos: [[pz(5, 6)], [pz(0, 0)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 0, pasadas: 0, ultimoQueJugo: 1,
    });
    const s = ok(aplicarPase(p, 'u0'));
    expect(s.pasadas).toBe(1);
    expect(s.turno).toBe(1);
    expect(s.marcador).toEqual([0, 0]); // el bonus se paga al JUGAR, no al pasar
  });

  it('tranca: gana el equipo con menos pips y suma los del rival, sin bonus', () => {
    // 4P: pasadas llega a 4. Equipo 0 (seats 0,2) pips 4+4=8; equipo 1 (1,3) 12+11=23.
    const p = partida({
      maxJugadores: 4,
      asientos: asientos(4),
      manos: [[pz(0, 4)], [pz(6, 6)], [pz(0, 4)], [pz(5, 6)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 3, pasadas: 3, ultimoQueJugo: 1,
    });
    const s = ok(aplicarPase(p, 'u3'));
    expect(s.resultadoMano).toMatchObject({ tipo: 'tranca', equipoGanador: 0, puntos: 23 });
    expect(s.marcador).toEqual([23, 0]);
    expect(s.fase).toBe('entre_manos');
    expect(s.trancasPorEquipo).toEqual([1, 0]);
    // trancó seat 1 (equipo 1) y PERDIÓ → sale el siguiente (seat 2)
    expect(s.salida).toBe(2);
  });

  it('tranca donde gana quien trancó → él sale la próxima', () => {
    // equipo 0 (seats 0,2) pips 2; equipo 1 pips 23; trancó seat 0
    const p = partida({
      maxJugadores: 4,
      asientos: asientos(4),
      manos: [[pz(0, 1)], [pz(6, 6)], [pz(0, 1)], [pz(5, 6)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 3, pasadas: 3, ultimoQueJugo: 0,
    });
    const s = ok(aplicarPase(p, 'u3'));
    expect(s.resultadoMano).toMatchObject({ tipo: 'tranca', equipoGanador: 0 });
    expect(s.salida).toBe(0);
  });

  it('tranca empatada: nadie suma', () => {
    const p = partida({
      manos: [[pz(2, 3)], [pz(1, 4)]], // 5 vs 5
      tablero: [abrirTablero(pz(6, 6))],
      turno: 1, pasadas: 1, ultimoQueJugo: 0,
    });
    const s = ok(aplicarPase(p, 'u1'));
    expect(s.resultadoMano).toMatchObject({ tipo: 'tranca', equipoGanador: null, puntos: 0 });
    expect(s.marcador).toEqual([0, 0]);
    expect(s.trancasPorEquipo).toEqual([0, 0]); // empate: no suma a nadie
  });

  it('"no caben": tranca que superaría el objetivo no suma y la partida sigue', () => {
    // Equipo 0 ya tiene 90/100. La tranca le daría 23 (pips del rival) →
    // 90+23=113 > 100, "no caben": el marcador NO cambia y la mano
    // simplemente cierra (se reparte de nuevo), sin terminar la partida.
    const p = partida({
      maxJugadores: 4,
      asientos: asientos(4),
      marcador: [90, 0],
      manos: [[pz(0, 4)], [pz(6, 6)], [pz(0, 4)], [pz(5, 6)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 3, pasadas: 3, ultimoQueJugo: 1,
    });
    const s = ok(aplicarPase(p, 'u3'));
    expect(s.resultadoMano).toMatchObject({ tipo: 'tranca', equipoGanador: 0, puntos: 23, noCaben: true });
    expect(s.marcador).toEqual([90, 0]); // no cambia
    expect(s.fase).toBe('entre_manos'); // NO termina la partida
    expect(s.equipoGanadorPartida).toBe(null);
    expect(s.trancasPorEquipo).toEqual([1, 0]); // la tranca sí cuenta para las stats
  });

  it('tranca que cae EXACTO en el objetivo sí suma y termina la partida', () => {
    // Equipo 0 tiene 77/100, la tranca le da exactamente 23 → 100, cierra.
    const p = partida({
      maxJugadores: 4,
      asientos: asientos(4),
      marcador: [77, 0],
      manos: [[pz(0, 4)], [pz(6, 6)], [pz(0, 4)], [pz(5, 6)]],
      tablero: [abrirTablero(pz(2, 3))],
      turno: 3, pasadas: 3, ultimoQueJugo: 1,
    });
    const s = ok(aplicarPase(p, 'u3'));
    expect(s.resultadoMano).toMatchObject({ tipo: 'tranca', equipoGanador: 0, puntos: 23 });
    expect(s.resultadoMano && 'noCaben' in s.resultadoMano ? s.resultadoMano.noCaben : undefined).toBeFalsy();
    expect(s.marcador).toEqual([100, 0]);
    expect(s.fase).toBe('fin_partida');
    expect(s.equipoGanadorPartida).toBe(0);
  });
});

// ── Entre manos: listos y reparto ──────────────────
describe('aplicarAbandono', () => {
  it('4P: quien abandona hace ganar al equipo rival y marca el seat', () => {
    const p = partida({ maxJugadores: 4, asientos: asientos(4), turno: 2 });
    const s = ok(aplicarAbandono(p, 'u1')); // seat 1 (equipo 1) abandona
    expect(s.fase).toBe('fin_partida');
    expect(s.equipoGanadorPartida).toBe(0); // gana el equipo par
    expect(s.abandonadoPorSeat).toBe(1);
  });

  it('rechaza si la partida ya terminó', () => {
    const p = partida({ fase: 'fin_partida', equipoGanadorPartida: 0 });
    const r = aplicarAbandono(p, 'u0');
    expect(r.ok).toBe(false);
  });

  it('rechaza a alguien ajeno a la partida', () => {
    const r = aplicarAbandono(partida(), 'ajeno');
    expect(r.ok).toBe(false);
  });
});

describe('marcarListo', () => {
  it('acumula listos y reparte la mano nueva cuando todos confirman', () => {
    const p = partida({
      fase: 'entre_manos',
      salida: 1,
      numeroMano: 1,
      marcador: [25, 0],
      resultadoMano: { tipo: 'normal', ganadorSeat: 1, puntos: 25 },
      listos: [false, false],
    });
    const s1 = ok(marcarListo(p, 'u0'));
    expect(s1.fase).toBe('entre_manos');
    expect(s1.listos).toEqual([true, false]);

    const s2 = ok(marcarListo(s1, 'u1'));
    expect(s2.fase).toBe('jugando');
    expect(s2.numeroMano).toBe(2);
    expect(s2.turno).toBe(1);            // sale el ganador anterior
    expect(s2.salidaForzada).toBeNull(); // sin apertura obligada tras mano 1
    expect(s2.tablero).toEqual([]);
    expect(s2.manos.every(m => m.length === 7)).toBe(true);
    expect(s2.marcador).toEqual([25, 0]); // el marcador persiste
  });

  it('rechaza listo fuera de entre_manos', () => {
    expect(marcarListo(partida(), 'u0').ok).toBe(false);
  });
});

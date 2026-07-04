import { describe, it, expect } from 'vitest';
import { rangoPermitido, tryMatch2p, tryMatch4p, rellenoConBots, type Ticket } from './matchmaking';
import { BOT_FILL_MS, BOT_IDS } from './bots';

const T0 = 1_000_000; // época base arbitraria

let seq = 0;
function solo(modo: 2 | 4, elo: number, creadoEn = T0): Ticket {
  seq++;
  return { id: `s${seq}`, modo, usuarioIds: [`u${seq}`], usernames: [`p${seq}`], elo, creadoEn };
}
function party(elo: number, creadoEn = T0): Ticket {
  seq++;
  return { id: `p${seq}`, modo: 4, usuarioIds: [`ua${seq}`, `ub${seq}`], usernames: [`a${seq}`, `b${seq}`], elo, creadoEn };
}

describe('rangoPermitido', () => {
  it('crece por escalones de 15s', () => {
    expect(rangoPermitido(0)).toBe(50);
    expect(rangoPermitido(14_999)).toBe(50);
    expect(rangoPermitido(15_000)).toBe(100);
    expect(rangoPermitido(30_000)).toBe(200);
    expect(rangoPermitido(45_000)).toBe(400);
    expect(rangoPermitido(60_000)).toBe(800);
    expect(rangoPermitido(999_999)).toBe(800); // se topa, no crece infinito
  });
  it('espera negativa (ticket recién creado, reloj DB adelantado) → rango base, no undefined', () => {
    expect(rangoPermitido(-0.5)).toBe(50);
    expect(rangoPermitido(-5000)).toBe(50);
    expect(rangoPermitido(0)).toBe(50);
  });
});

describe('regresión: match inmediato de tickets recién creados', () => {
  it('dos tickets con creadoEn en el "futuro" respecto a ahora igual emparejan', () => {
    // Simula el instante del INSERT: created_at de la DB queda ~1ms por
    // delante del Date.now() usado como `ahora`.
    const ahora = T0;
    const a = solo(2, 1000, ahora + 0.4);
    const b = solo(2, 1000, ahora + 0.9);
    expect(tryMatch2p([a, b], ahora)).not.toBeNull();
  });
});

describe('tryMatch2p', () => {
  it('sin tickets no empareja', () => {
    expect(tryMatch2p([], T0)).toBeNull();
  });

  it('un solo ticket no empareja', () => {
    expect(tryMatch2p([solo(2, 1000)], T0)).toBeNull();
  });

  it('dos tickets dentro de rango emparejan', () => {
    const a = solo(2, 1000), b = solo(2, 1020);
    const m = tryMatch2p([a, b], T0);
    expect(m).not.toBeNull();
    expect(new Set(m!.par.map(t => t.id))).toEqual(new Set([a.id, b.id]));
  });

  it('fuera de rango no empareja aún', () => {
    const a = solo(2, 1000), b = solo(2, 1200);
    expect(tryMatch2p([a, b], T0)).toBeNull();
  });

  it('la espera amplía el rango hasta que empareja', () => {
    const a = solo(2, 1000, T0), b = solo(2, 1150, T0); // separados por 150
    expect(tryMatch2p([a, b], T0)).toBeNull();              // ±50: no alcanza
    expect(tryMatch2p([a, b], T0 + 15_000)).toBeNull();     // ±100: tampoco
    expect(tryMatch2p([a, b], T0 + 30_000)).not.toBeNull(); // ±200: sí
  });

  it('ignora tickets de otro modo', () => {
    const a = solo(2, 1000), b = solo(4, 1000);
    expect(tryMatch2p([a, b], T0)).toBeNull();
  });

  it('con varios, prioriza el par más cercano en ELO', () => {
    const a = solo(2, 1000), b = solo(2, 1500), c = solo(2, 1010);
    const m = tryMatch2p([a, b, c], T0)!;
    // a-c están a 10 de distancia; el algoritmo de doble bucle explora
    // en orden de creación y toma el primer par dentro de rango: a-c.
    expect(new Set(m.par.map(t => t.id))).toEqual(new Set([a.id, c.id]));
  });
});

describe('tryMatch4p — party vs party', () => {
  it('dos parties dentro de rango emparejan directo', () => {
    const p1 = party(1000), p2 = party(1030);
    const m = tryMatch4p([p1, p2], T0);
    expect(m).not.toBeNull();
    expect(m!.equipoA).toEqual([p1]);
    expect(m!.equipoB).toEqual([p2]);
  });

  it('dos parties fuera de rango no emparejan (sin solos de respaldo)', () => {
    const p1 = party(1000), p2 = party(1500);
    expect(tryMatch4p([p1, p2], T0)).toBeNull();
  });
});

describe('tryMatch4p — party + relleno de solos', () => {
  it('antes del umbral de espera, la party NO acepta relleno', () => {
    const p = party(1000, T0);
    const s1 = solo(4, 990, T0), s2 = solo(4, 1010, T0);
    expect(tryMatch4p([p, s1, s2], T0)).toBeNull();
  });

  it('tras el umbral, rellena con los 2 solos más cercanos', () => {
    const p = party(1000, T0);
    const lejano = solo(4, 1400, T0);
    const cercano1 = solo(4, 990, T0);
    const cercano2 = solo(4, 1010, T0);
    const m = tryMatch4p([p, lejano, cercano1, cercano2], T0 + UMBRAL());
    expect(m).not.toBeNull();
    expect(m!.equipoA).toEqual([p]);
    expect(new Set(m!.equipoB.map(t => t.id))).toEqual(new Set([cercano1.id, cercano2.id]));
  });

  it('con menos de 2 solos disponibles, no rellena', () => {
    const p = party(1000, T0);
    const s1 = solo(4, 1000, T0);
    expect(tryMatch4p([p, s1], T0 + UMBRAL())).toBeNull();
  });
});

describe('tryMatch4p — puro solo, balanceado', () => {
  it('4 solos cercanos en ELO se emparejan y balancean por extremos/medios', () => {
    const s1 = solo(4, 1000), s2 = solo(4, 1010), s3 = solo(4, 1020), s4 = solo(4, 1030);
    const m = tryMatch4p([s1, s2, s3, s4], T0);
    expect(m).not.toBeNull();
    // heurística: equipoA = extremos [s1,s4], equipoB = medios [s2,s3]
    expect(m!.equipoA.map(t => t.id)).toEqual([s1.id, s4.id]);
    expect(m!.equipoB.map(t => t.id)).toEqual([s2.id, s3.id]);
  });

  it('menos de 4 solos no empareja', () => {
    const s1 = solo(4, 1000), s2 = solo(4, 1010), s3 = solo(4, 1020);
    expect(tryMatch4p([s1, s2, s3], T0)).toBeNull();
  });

  it('si el spread supera el rango, no empareja hasta esperar más', () => {
    const s1 = solo(4, 1000, T0), s2 = solo(4, 1010, T0);
    const s3 = solo(4, 1020, T0), s4 = solo(4, 1300, T0);
    expect(tryMatch4p([s1, s2, s3, s4], T0)).toBeNull();
    expect(tryMatch4p([s1, s2, s3, s4], T0 + 45_000)).not.toBeNull(); // rango ±400
  });

  it('ignora tickets de otro modo', () => {
    const s2p = solo(2, 1000);
    const s1 = solo(4, 1000), s2 = solo(4, 1010), s3 = solo(4, 1020), s4 = solo(4, 1030);
    const m = tryMatch4p([s2p, s1, s2, s3, s4], T0);
    expect(m).not.toBeNull();
    expect([...m!.equipoA, ...m!.equipoB].some(t => t.id === s2p.id)).toBe(false);
  });
});

function UMBRAL() { return 15_000; }

describe('rellenoConBots', () => {
  it('sin tickets, no rellena', () => {
    expect(rellenoConBots([], 2, T0)).toBeNull();
  });

  it('antes de BOT_FILL_MS, no rellena aunque esté solo en cola', () => {
    const s = solo(2, 1000, T0);
    expect(rellenoConBots([s], 2, T0 + BOT_FILL_MS - 1)).toBeNull();
  });

  it('1v1: tras BOT_FILL_MS, rellena el otro asiento con un bot', () => {
    const s = solo(2, 1000, T0);
    const r = rellenoConBots([s], 2, T0 + BOT_FILL_MS)!;
    expect(r).not.toBeNull();
    expect(r.idsAEliminar).toEqual([s.id]);
    expect(r.asientos).toHaveLength(2);
    const real = r.asientos.find(a => a.usuario_id === s.usuarioIds[0])!;
    const bot = r.asientos.find(a => a.usuario_id !== s.usuarioIds[0])!;
    expect(real.posicion).toBe(1);
    expect(BOT_IDS as readonly string[]).toContain(bot.usuario_id);
    expect(bot.posicion).toBe(2);
  });

  it('4P solo (1 humano): rellena los otros 3 asientos con bots', () => {
    const s = solo(4, 1000, T0);
    const r = rellenoConBots([s], 4, T0 + BOT_FILL_MS)!;
    expect(r.asientos).toHaveLength(4);
    const bots = r.asientos.filter(a => a.usuario_id !== s.usuarioIds[0]);
    expect(bots).toHaveLength(3);
    expect(bots.every(b => (BOT_IDS as readonly string[]).includes(b.usuario_id))).toBe(true);
  });

  it('4P party (2 humanos): quedan en el mismo equipo (1&3 o 2&4), bots rellenan el rival', () => {
    const p = party(1000, T0);
    const r = rellenoConBots([p], 4, T0 + BOT_FILL_MS)!;
    expect(r.idsAEliminar).toEqual([p.id]);
    const posReales = r.asientos
      .filter(a => p.usuarioIds.includes(a.usuario_id))
      .map(a => a.posicion)
      .sort();
    expect([[1, 3], [2, 4]]).toContainEqual(posReales);
    const bots = r.asientos.filter(a => !p.usuarioIds.includes(a.usuario_id));
    expect(bots).toHaveLength(2);
  });

  it('4P: dos solos esperando (sin party) terminan en el mismo equipo, bots rellenan el resto', () => {
    const s1 = solo(4, 1000, T0);
    const s2 = solo(4, 1000, T0 + 2000); // llegó después, aún no expiró por su cuenta
    const r = rellenoConBots([s1, s2], 4, T0 + BOT_FILL_MS)!;
    expect(r).not.toBeNull();
    const posReales = r.asientos
      .filter(a => a.usuario_id === s1.usuarioIds[0] || a.usuario_id === s2.usuarioIds[0])
      .map(a => a.posicion)
      .sort();
    expect([[1, 3], [2, 4]]).toContainEqual(posReales);
  });

  it('ignora tickets de otro modo', () => {
    const s2 = solo(2, 1000, T0);
    const s4 = solo(4, 1000, T0);
    expect(rellenoConBots([s2], 4, T0 + BOT_FILL_MS)).toBeNull(); // ticket 2P no cuenta para cola 4P
    expect(rellenoConBots([s4, s2], 4, T0 + BOT_FILL_MS)).not.toBeNull(); // pero el 4P sí, aunque haya un 2P mezclado
  });
});

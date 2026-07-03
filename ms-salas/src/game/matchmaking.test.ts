import { describe, it, expect } from 'vitest';
import { rangoPermitido, tryMatch2p, tryMatch4p, type Ticket } from './matchmaking';

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

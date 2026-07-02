import { describe, it, expect } from 'vitest';
import {
  crearSet, getExtremos, puedeJugar, esCapicua, calcResultado,
  abrirTablero, aplicarJugada, aplicarPase,
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
  return {
    maxJugadores: 2,
    asientos: asientos(2),
    manos: [[], []],
    tablero: [],
    turno: 0,
    pasadas: 0,
    ultimaJugada: null,
    resultado: null,
    ...over,
  };
}

// ── Helpers puros ──────────────────────────────────
describe('crearSet', () => {
  it('genera 28 fichas únicas incluyendo blanco (0) y dobles', () => {
    const set = crearSet();
    expect(set).toHaveLength(28);
    const claves = new Set(set.map(p => `${p.a}-${p.b}`));
    expect(claves.size).toBe(28);
    expect(set).toContainEqual({ a: 0, b: 0 });
    expect(set).toContainEqual({ a: 6, b: 6 });
  });
});

describe('getExtremos / puedeJugar', () => {
  it('tablero vacío no tiene extremos', () => {
    expect(getExtremos([])).toBeNull();
  });
  it('lee extremos abierto y evalúa jugabilidad', () => {
    const t = [abrirTablero(pz(2, 3))]; // izq 2 · der 3
    const ext = getExtremos(t)!;
    expect(ext).toEqual({ izq: 2, der: 3 });
    expect(puedeJugar(pz(5, 3), ext)).toEqual({ izq: false, der: true });
    expect(puedeJugar(pz(2, 4), ext)).toEqual({ izq: true, der: false });
    expect(puedeJugar(pz(5, 6), ext)).toEqual({ izq: false, der: false });
  });
});

// ── calcResultado ──────────────────────────────────
describe('calcResultado', () => {
  it('normal: puntos = suma de pips del equipo rival', () => {
    const r = calcResultado(0, pz(3, 4), { izq: 2, der: 4 }, [[], [pz(0, 0), pz(1, 2)]]);
    expect(r).toMatchObject({ tipo: 'normal', ganadorSeat: 0, puntos: 3 });
  });
  it('capicúa: ficha final coincide con ambos extremos → 30', () => {
    const r = calcResultado(0, pz(2, 5), { izq: 2, der: 5 }, [[], []]);
    expect(r).toMatchObject({ tipo: 'capicua', puntos: 30 });
  });
  it('tranca (ganador null): gana el equipo con menos pips', () => {
    const r = calcResultado(null, null, null, [[pz(6, 6)], [pz(0, 1)]]);
    expect(r).toMatchObject({ tipo: 'tranca', equipoGanador: 1, puntos: 30 });
  });
});

// ── esCapicua ──────────────────────────────────────
describe('esCapicua', () => {
  it('true solo si coincide con ambos extremos', () => {
    expect(esCapicua(pz(2, 5), { izq: 2, der: 5 })).toBe(true);
    expect(esCapicua(pz(2, 4), { izq: 2, der: 5 })).toBe(false);
  });
});

// ── aplicarJugada ──────────────────────────────────
describe('aplicarJugada', () => {
  it('rechaza si no es tu turno', () => {
    const p = partida({ manos: [[pz(2, 3)], [pz(0, 0)]], turno: 0 });
    expect(aplicarJugada(p, 'u1', pz(0, 0))).toEqual({ ok: false, error: 'No es tu turno' });
  });

  it('rechaza ficha que no está en la mano', () => {
    const p = partida({ manos: [[pz(2, 3)], []], turno: 0 });
    const r = aplicarJugada(p, 'u0', pz(1, 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/No tienes/);
  });

  it('rechaza ficha que no encaja en ningún extremo', () => {
    const p = partida({ manos: [[pz(5, 6)], []], tablero: [abrirTablero(pz(2, 3))], turno: 0 });
    const r = aplicarJugada(p, 'u0', pz(5, 6));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no encaja/);
  });

  it('abre el tablero, saca la ficha de la mano y pasa el turno', () => {
    const p = partida({ manos: [[pz(2, 3), pz(0, 0)], [pz(1, 1)]], turno: 0 });
    const r = aplicarJugada(p, 'u0', pz(2, 3));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.partida.tablero).toHaveLength(1);
      expect(r.partida.manos[0]).toHaveLength(1);
      expect(r.partida.turno).toBe(1);
      expect(r.partida.pasadas).toBe(0);
    }
  });

  it('respeta el lado elegido', () => {
    const p = partida({ manos: [[pz(2, 5), pz(3, 4)], []], tablero: [abrirTablero(pz(2, 3))], turno: 0 });
    const r = aplicarJugada(p, 'u0', pz(3, 4), 'der');
    expect(r.ok).toBe(true);
    if (r.ok) expect(getExtremos(r.partida.tablero)!.der).toBe(4);
  });

  it('al jugar la última ficha calcula el resultado', () => {
    const p = partida({ manos: [[pz(3, 4)], [pz(0, 0), pz(1, 1)]], tablero: [abrirTablero(pz(2, 3))], turno: 0 });
    const r = aplicarJugada(p, 'u0', pz(3, 4), 'der');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.partida.resultado?.tipo).toBe('normal');
  });
});

// ── aplicarPase ────────────────────────────────────
describe('aplicarPase', () => {
  it('rechaza pasar si hay una ficha jugable', () => {
    const p = partida({ manos: [[pz(3, 5)], []], tablero: [abrirTablero(pz(2, 3))], turno: 0 });
    const r = aplicarPase(p, 'u0');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no puedes pasar/i);
  });

  it('pasa el turno cuando no hay jugada', () => {
    const p = partida({ manos: [[pz(5, 6)], [pz(0, 0)]], tablero: [abrirTablero(pz(2, 3))], turno: 0 });
    const r = aplicarPase(p, 'u0');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.partida.pasadas).toBe(1);
      expect(r.partida.turno).toBe(1);
    }
  });

  it('tranca cuando todos pasan (pasadas alcanza maxJugadores)', () => {
    const p = partida({ manos: [[pz(5, 6)], [pz(5, 6)]], tablero: [abrirTablero(pz(2, 3))], turno: 0, pasadas: 1 });
    const r = aplicarPase(p, 'u0');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.partida.resultado?.tipo).toBe('tranca');
  });
});

import { describe, it, expect } from 'vitest';
import { resultadoUltimaMano, type MovimientoRow } from './historial';

function mov(over: Partial<MovimientoRow>): MovimientoRow {
  return {
    numero_mano: 1, orden: 0, seat: 0, tipo: 'jugar',
    pieza_a: null, pieza_b: null, lado: null,
    ...over,
  };
}

describe('resultadoUltimaMano', () => {
  it('sin movimientos, devuelve normal con el ganador de la partida', () => {
    const r = resultadoUltimaMano([], 1);
    expect(r).toEqual({ tipo: 'normal', ganadorSeat: null, equipoGanador: 1 });
  });

  it('domino normal: último jugar cierra sin capicúa', () => {
    // Tablero: 6-6 (abre) → 6-4 (der) → cierra 4-2 (der): extremos 6/2, no capicúa.
    const movimientos: MovimientoRow[] = [
      mov({ orden: 0, seat: 0, tipo: 'jugar', pieza_a: 6, pieza_b: 6 }),
      mov({ orden: 1, seat: 1, tipo: 'jugar', pieza_a: 6, pieza_b: 4, lado: 'der' }),
      mov({ orden: 2, seat: 0, tipo: 'jugar', pieza_a: 4, pieza_b: 2, lado: 'der' }),
    ];
    const r = resultadoUltimaMano(movimientos, 0);
    expect(r).toEqual({ tipo: 'normal', ganadorSeat: 0, equipoGanador: 0 });
  });

  it('capicúa: la última ficha encaja en ambos extremos', () => {
    // Tablero: 6-6 (abre, extremos 6/6) → cierra con 6-6... probemos con
    // extremos distintos: 3-3 abre (3/3) → 3-5 der (3/5) → cierra 5-3 der
    // conecta con el 5 y dejaría extremo der en 3 → extremos 3/3 = capicúa.
    const movimientos: MovimientoRow[] = [
      mov({ orden: 0, seat: 2, tipo: 'jugar', pieza_a: 3, pieza_b: 3 }),
      mov({ orden: 1, seat: 3, tipo: 'jugar', pieza_a: 3, pieza_b: 5, lado: 'der' }),
      mov({ orden: 2, seat: 0, tipo: 'jugar', pieza_a: 5, pieza_b: 3, lado: 'der' }),
    ];
    const r = resultadoUltimaMano(movimientos, 0);
    expect(r).toEqual({ tipo: 'capicua', ganadorSeat: 0, equipoGanador: 0 });
  });

  it('tranca: la mano termina en pases, usa el equipoGanador de la partida', () => {
    const movimientos: MovimientoRow[] = [
      mov({ orden: 0, seat: 0, tipo: 'jugar', pieza_a: 6, pieza_b: 6 }),
      mov({ orden: 1, seat: 1, tipo: 'pasar' }),
      mov({ orden: 2, seat: 2, tipo: 'pasar' }),
      mov({ orden: 3, seat: 3, tipo: 'pasar' }),
      mov({ orden: 4, seat: 0, tipo: 'pasar' }),
    ];
    const r = resultadoUltimaMano(movimientos, 1);
    expect(r).toEqual({ tipo: 'tranca', ganadorSeat: null, equipoGanador: 1 });
  });

  it('solo mira la ÚLTIMA mano (numero_mano más alto), ignora manos anteriores', () => {
    const movimientos: MovimientoRow[] = [
      // Mano 1: tranca (no debería influir en el resultado)
      mov({ numero_mano: 1, orden: 0, seat: 0, tipo: 'jugar', pieza_a: 1, pieza_b: 1 }),
      mov({ numero_mano: 1, orden: 1, seat: 1, tipo: 'pasar' }),
      // Mano 2: seat 1 abre, seat 0 cierra con la última jugada
      mov({ numero_mano: 2, orden: 0, seat: 1, tipo: 'jugar', pieza_a: 6, pieza_b: 6 }),
      mov({ numero_mano: 2, orden: 1, seat: 0, tipo: 'jugar', pieza_a: 6, pieza_b: 2, lado: 'der' }),
    ];
    const r = resultadoUltimaMano(movimientos, 1);
    expect(r).toEqual({ tipo: 'normal', ganadorSeat: 0, equipoGanador: 0 });
  });
});

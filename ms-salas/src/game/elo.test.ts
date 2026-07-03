import { describe, it, expect } from 'vitest';
import { esperado, deltaElo, eloEquipo, ELO_INICIAL, K_FACTOR } from './elo';

describe('esperado', () => {
  it('ELOs iguales → 50%', () => {
    expect(esperado(1000, 1000)).toBeCloseTo(0.5);
  });
  it('400 puntos de ventaja → ~91%', () => {
    expect(esperado(1400, 1000)).toBeCloseTo(0.909, 2);
  });
  it('simétrico: P(A gana B) + P(B gana A) = 1', () => {
    expect(esperado(1234, 987) + esperado(987, 1234)).toBeCloseTo(1);
  });
});

describe('deltaElo', () => {
  it('entre iguales mueve K/2', () => {
    expect(deltaElo(1000, 1000)).toBe(K_FACTOR / 2); // 16
  });
  it('favorito que gana suma poco; sorpresa suma mucho', () => {
    const favorito = deltaElo(1400, 1000);
    const sorpresa = deltaElo(1000, 1400);
    expect(favorito).toBeLessThan(sorpresa);
    expect(sorpresa).toBeGreaterThan(K_FACTOR / 2);
  });
  it('nunca es cero: mínimo 1', () => {
    expect(deltaElo(2400, 1000)).toBeGreaterThanOrEqual(1);
  });
});

describe('eloEquipo', () => {
  it('promedio de la pareja', () => {
    expect(eloEquipo([1000, 1200])).toBe(1100);
  });
  it('1v1: el propio', () => {
    expect(eloEquipo([1050])).toBe(1050);
  });
  it('vacío cae al inicial', () => {
    expect(eloEquipo([])).toBe(ELO_INICIAL);
  });
});

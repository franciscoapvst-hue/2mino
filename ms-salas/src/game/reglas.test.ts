import { describe, it, expect } from 'vitest';
import { getRegla, invalidarRegla, _resetCacheParaTests } from './reglas';

describe('getRegla', () => {
  it('sin cache cargada, devuelve el valor por defecto', () => {
    _resetCacheParaTests();
    expect(getRegla('k_factor', 32)).toBe(32);
    expect(getRegla('escalones_rango', [50, 100])).toEqual([50, 100]);
  });

  it('con la clave en cache, devuelve el valor cacheado', () => {
    _resetCacheParaTests({ k_factor: 64 });
    expect(getRegla('k_factor', 32)).toBe(64);
  });

  it('una clave ausente de la cache usa el default, aunque otras sí estén', () => {
    _resetCacheParaTests({ k_factor: 64 });
    expect(getRegla('elo_inicial', 1000)).toBe(1000);
  });
});

describe('invalidarRegla', () => {
  it('actualiza la cache in-memory sin tocar otras claves', () => {
    _resetCacheParaTests({ k_factor: 32, elo_inicial: 1000 });
    invalidarRegla('k_factor', 50);
    expect(getRegla('k_factor', 32)).toBe(50);
    expect(getRegla('elo_inicial', 1000)).toBe(1000);
  });
});

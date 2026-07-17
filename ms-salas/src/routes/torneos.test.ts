import { describe, it, expect } from 'vitest';
import { validarEstructura } from './torneos';

// Base válida: fase inicial + 2 eliminatorias (semi+final), clasifican 4.
function torneoBase() {
  return {
    nombre: 'Copa Test',
    max_equipos: 8,
    tiene_fase_inicial: true,
    num_fases_eliminatorias: 2,
    fecha_inicio: '2026-08-01T00:00:00Z',
    fecha_fin: '2026-08-31T00:00:00Z',
    creado_por: '00000000-0000-0000-0000-000000000001',
    fases: [
      { tipo: 'inicial' as const, nombre: 'Fase de grupos', clasifican_n: 4,
        ventana_inicio: '2026-08-01T00:00:00Z', ventana_fin: '2026-08-10T00:00:00Z' },
      { tipo: 'eliminatoria' as const, nombre: 'Semifinal',
        ventana_inicio: '2026-08-12T00:00:00Z', ventana_fin: '2026-08-15T00:00:00Z' },
      { tipo: 'eliminatoria' as const, nombre: 'Final',
        ventana_inicio: '2026-08-20T00:00:00Z', ventana_fin: '2026-08-22T00:00:00Z' },
    ],
  };
}

describe('validarEstructura', () => {
  it('acepta una estructura válida (con hueco entre fases)', () => {
    expect(validarEstructura(torneoBase())).toBeNull();
  });

  it('rechaza cantidad de fases distinta al formato', () => {
    const t = torneoBase();
    t.fases = t.fases.slice(0, 2);
    expect(validarEstructura(t)).toMatch(/3 fase/);
  });

  it('rechaza fase inicial fuera del primer lugar', () => {
    const t = torneoBase();
    [t.fases[0], t.fases[1]] = [t.fases[1], t.fases[0]];
    expect(validarEstructura(t)).toMatch(/fase 1 debe ser la fase inicial/);
  });

  it('rechaza solapamiento y nombra la fase conflictiva', () => {
    const t = torneoBase();
    t.fases[2].ventana_inicio = '2026-08-14T00:00:00Z'; // pisa la semi (termina el 15)
    const err = validarEstructura(t);
    expect(err).toMatch(/"Final" se solapa con "Semifinal"/);
  });

  it('acepta fases consecutivas exactas (fin de una = inicio de la otra)', () => {
    const t = torneoBase();
    t.fases[2].ventana_inicio = '2026-08-15T00:00:00Z'; // arranca justo al cerrar la semi
    expect(validarEstructura(t)).toBeNull();
  });

  it('rechaza ventana fuera del rango general del torneo', () => {
    const t = torneoBase();
    t.fases[2].ventana_fin = '2026-09-05T00:00:00Z';
    expect(validarEstructura(t)).toMatch(/"Final".*rango general/);
  });

  it('rechaza ventana que termina antes de empezar', () => {
    const t = torneoBase();
    t.fases[1].ventana_fin = t.fases[1].ventana_inicio;
    expect(validarEstructura(t)).toMatch(/"Semifinal".*termina antes/);
  });

  it('rechaza clasifican_n que no calza con el bracket', () => {
    const t = torneoBase();
    t.fases[0].clasifican_n = 6; // 2 eliminatorias necesitan 4
    expect(validarEstructura(t)).toMatch(/exactamente 4 equipos/);
  });

  it('sin fase inicial: exige cupo exacto (v1 sin bye)', () => {
    const t = torneoBase();
    t.tiene_fase_inicial = false;
    t.fases = t.fases.slice(1); // solo semi + final
    t.max_equipos = 6;          // debería ser 4 exacto
    expect(validarEstructura(t)).toMatch(/calzar exacto.*4 equipos/);
    t.max_equipos = 4;
    expect(validarEstructura(t)).toBeNull();
  });

  it('rechaza fecha_fin del torneo anterior al inicio', () => {
    const t = torneoBase();
    t.fecha_fin = '2026-07-01T00:00:00Z';
    expect(validarEstructura(t)).toMatch(/fin del torneo/);
  });
});

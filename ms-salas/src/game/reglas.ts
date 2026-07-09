// ── Cache en memoria de reglas_juego ──────────────────────────────
// Config editable desde el Back Office sin redeploy (docs/CASOS_DE_USO_
// BACKOFFICE.md §6). Se carga una vez al arrancar (ver index.ts, después
// de runMigrations) y se invalida fila por fila en cada PATCH — nunca se
// consulta la base de datos en el hot path de una jugada.
import { pool } from '../db/pool';

export type ReglaValor = number | number[] | { casual: number | null; ranked: number | null };

let cache = new Map<string, ReglaValor>();

export async function cargarReglas(): Promise<void> {
  const { rows } = await pool.query('SELECT clave, valor FROM reglas_juego');
  cache = new Map(rows.map(r => [r.clave, r.valor]));
}

/** Devuelve el valor cacheado, o `porDefecto` si la regla no existe todavía (cache vacía o fila ausente). */
export function getRegla<T extends ReglaValor>(clave: string, porDefecto: T): T {
  const v = cache.get(clave);
  return v === undefined ? porDefecto : (v as T);
}

export function invalidarRegla(clave: string, valor: ReglaValor): void {
  cache.set(clave, valor);
}

/** Tiempo límite por jugada (ms) para un tipo de sala — null = sin límite. */
export function limiteJugadaMsDe(tipo: 'casual' | 'ranked'): number | null {
  const limites = getRegla('tiempo_limite_jugada_ms', { casual: null, ranked: null } as const);
  return limites[tipo];
}

/** Solo para tests: resetea la cache a un estado conocido. */
export function _resetCacheParaTests(valores: Record<string, ReglaValor> = {}): void {
  cache = new Map(Object.entries(valores));
}

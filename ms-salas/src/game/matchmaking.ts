// ── Matchmaking ranked: lógica pura de emparejamiento ──────────────
// Sin base de datos. La capa de rutas trae los tickets vigentes de la
// cola y llama aquí; esto solo decide QUIÉN juega con quién.
//
// Se ejecuta de forma perezosa: cada poll del cliente reintenta un
// emparejamiento contra el estado actual de la cola (no hay un worker
// en segundo plano). La capa de rutas serializa los intentos con un
// advisory lock por modo para que dos polls simultáneos no dupliquen.

export type Ticket = {
  id:         string;
  modo:       2 | 4;
  usuarioIds: string[];   // 1 = ticket solo, 2 = ticket de party
  usernames:  string[];   // mismo orden que usuarioIds
  elo:        number;     // propio, o promedio de la pareja si es party
  creadoEn:   number;     // epoch ms
};

import { BOT_FILL_MS, BOT_IDS, BOT_USERNAMES } from './bots';

// ── Rango de ELO aceptable, creciente con el tiempo de espera ──────
// 0-15s: ±50 · 15-30s: ±100 · 30-45s: ±200 · 45-60s: ±400 · 60s+: ±800
export const ESCALONES_RANGO = [50, 100, 200, 400, 800];
export const PASO_MS = 15_000;

export function rangoPermitido(
  esperaMs: number,
  escalones: number[] = ESCALONES_RANGO,
  pasoMs: number = PASO_MS,
): number {
  // esperaMs puede ser levemente negativo: un ticket recién insertado tiene
  // created_at (reloj de la DB) una fracción de ms por delante del Date.now()
  // usado como "ahora". Sin el max(0,…), floor da -1 e indexa fuera del array
  // (undefined) → toda comparación de rango falla y NO empareja al entrar.
  const paso = Math.max(0, Math.floor(esperaMs / pasoMs));
  const idx = Math.min(paso, escalones.length - 1);
  return escalones[idx];
}

// Umbral de espera tras el cual una party deja de esperar a otra party
// y acepta rellenar el equipo rival con jugadores sueltos.
export const UMBRAL_RELLENO_MS = PASO_MS; // 15s

function dentroDeRango(a: Ticket, b: Ticket, ahora: number, escalones: number[], pasoMs: number): boolean {
  const espera = Math.min(ahora - a.creadoEn, ahora - b.creadoEn);
  return Math.abs(a.elo - b.elo) <= rangoPermitido(espera, escalones, pasoMs);
}

// ── 1v1 ─────────────────────────────────────────────────────────────
export type Match2p = { par: [Ticket, Ticket] };

/** Empareja los dos tickets más antiguos cuyo ELO caiga dentro de rango. */
export function tryMatch2p(
  tickets: Ticket[],
  ahora: number,
  escalones: number[] = ESCALONES_RANGO,
  pasoMs: number = PASO_MS,
): Match2p | null {
  const cola = tickets.filter(t => t.modo === 2).sort((a, b) => a.creadoEn - b.creadoEn);

  for (let i = 0; i < cola.length; i++) {
    for (let j = i + 1; j < cola.length; j++) {
      if (dentroDeRango(cola[i], cola[j], ahora, escalones, pasoMs)) {
        return { par: [cola[i], cola[j]] };
      }
    }
  }
  return null;
}

// ── 2v2 ─────────────────────────────────────────────────────────────
export type Match4p = { equipoA: Ticket[]; equipoB: Ticket[] };

/**
 * Prioridad:
 *  1) Dos parties dentro de rango → equipo vs equipo, tal cual.
 *  2) Una party que ya esperó UMBRAL_RELLENO_MS → rellena el equipo
 *     rival con los 2 solos más cercanos en ELO dentro de rango.
 *  3) Sin parties en cola → 4 solos más cercanos en ELO, repartidos
 *     en equipos balanceados (par extremo + par medio: minimiza la
 *     diferencia de promedio entre equipos para una distribución típica).
 */
export function tryMatch4p(
  tickets: Ticket[],
  ahora: number,
  escalones: number[] = ESCALONES_RANGO,
  pasoMs: number = PASO_MS,
  umbralRellenoMs: number = UMBRAL_RELLENO_MS,
): Match4p | null {
  const cola = tickets.filter(t => t.modo === 4);
  const parties = cola.filter(t => t.usuarioIds.length === 2)
    .sort((a, b) => a.creadoEn - b.creadoEn);
  const solos = cola.filter(t => t.usuarioIds.length === 1)
    .sort((a, b) => a.elo - b.elo);

  // 1) party vs party
  for (let i = 0; i < parties.length; i++) {
    for (let j = i + 1; j < parties.length; j++) {
      if (dentroDeRango(parties[i], parties[j], ahora, escalones, pasoMs)) {
        return { equipoA: [parties[i]], equipoB: [parties[j]] };
      }
    }
  }

  // 2) party + relleno de solos, si ya esperó el umbral
  for (const p of parties) {
    if (ahora - p.creadoEn < umbralRellenoMs) continue;
    const rango = rangoPermitido(ahora - p.creadoEn, escalones, pasoMs);
    const candidatos = solos.filter(s => Math.abs(s.elo - p.elo) <= rango);
    if (candidatos.length >= 2) {
      // los dos más cercanos en ELO al promedio de la party
      candidatos.sort((a, b) => Math.abs(a.elo - p.elo) - Math.abs(b.elo - p.elo));
      return { equipoA: [p], equipoB: candidatos.slice(0, 2) };
    }
  }

  // 3) puro solo: ventana deslizante de 4 ordenados por ELO dentro de rango
  for (let i = 0; i + 3 < solos.length; i++) {
    const ventana = solos.slice(i, i + 4);
    const [p1, p2, p3, p4] = ventana;
    const espera = Math.min(...ventana.map(t => ahora - t.creadoEn));
    if (p4.elo - p1.elo <= rangoPermitido(espera, escalones, pasoMs)) {
      // Balance: extremos juntos vs medios juntos (heurística simple)
      return { equipoA: [p1, p4], equipoB: [p2, p3] };
    }
  }

  return null;
}

// ── Relleno con bots (solo casual) ──────────────────────────────────
// Si nadie emparejó de forma real y algún ticket lleva esperando
// BOT_FILL_MS, arma la sala con los jugadores reales ya en cola (sin
// partir parties, que quedan siempre en el mismo equipo) y rellena los
// asientos sobrantes con bots. El caller (rutas) filtra por tipo==='casual'
// antes de llamar a esto — el ranked nunca debe emparejar contra bots.
export type AsientoRelleno = { usuario_id: string; username: string; posicion: number };

export function rellenoConBots(
  tickets: Ticket[], modo: 2 | 4, ahora: number,
): { asientos: AsientoRelleno[]; idsAEliminar: string[] } | null {
  const cola = tickets.filter(t => t.modo === modo).sort((a, b) => a.creadoEn - b.creadoEn);
  if (!cola.length) return null;
  if (!cola.some(t => ahora - t.creadoEn >= BOT_FILL_MS)) return null;

  // Toma tickets completos (sin partir parties) hasta llenar los asientos.
  const usados: Ticket[] = [];
  let ocupados = 0;
  for (const t of cola) {
    if (ocupados + t.usuarioIds.length > modo) continue;
    usados.push(t);
    ocupados += t.usuarioIds.length;
    if (ocupados === modo) break;
  }

  // Una party ocupa un par de posiciones del mismo equipo (1&3 o 2&4).
  // Los tickets sueltos van a la próxima posición libre siguiendo el
  // orden [1,3,2,4]: así, si hay varios sueltos reales en cola, quedan
  // agrupados en el mismo equipo antes de empezar a ocupar el otro
  // (en vez de terminar enfrentados entre sí por casualidad de orden).
  const paresEquipo: [number, number][] = modo === 4 ? [[1, 3], [2, 4]] : [[1, 2]];
  const ordenSueltos = modo === 4 ? [1, 3, 2, 4] : [1, 2];
  const asientos: AsientoRelleno[] = [];
  const libres = new Set(Array.from({ length: modo }, (_, i) => i + 1));

  for (const t of usados) {
    if (t.usuarioIds.length === 2) {
      const par = paresEquipo.find(([a, b]) => libres.has(a) && libres.has(b));
      if (!par) continue; // no debería pasar (no hay 2 posiciones libres del mismo equipo)
      asientos.push({ usuario_id: t.usuarioIds[0], username: t.usernames[0], posicion: par[0] });
      asientos.push({ usuario_id: t.usuarioIds[1], username: t.usernames[1], posicion: par[1] });
      libres.delete(par[0]); libres.delete(par[1]);
    } else {
      const pos = ordenSueltos.find(p => libres.has(p))!;
      asientos.push({ usuario_id: t.usuarioIds[0], username: t.usernames[0], posicion: pos });
      libres.delete(pos);
    }
  }

  [...libres].sort((a, b) => a - b).forEach((pos, i) => {
    asientos.push({ usuario_id: BOT_IDS[i], username: BOT_USERNAMES[i], posicion: pos });
  });

  return { asientos, idsAEliminar: usados.map(t => t.id) };
}

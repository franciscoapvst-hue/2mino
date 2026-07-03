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

// ── Rango de ELO aceptable, creciente con el tiempo de espera ──────
// 0-15s: ±50 · 15-30s: ±100 · 30-45s: ±200 · 45-60s: ±400 · 60s+: ±800
const ESCALONES_RANGO = [50, 100, 200, 400, 800];
const PASO_MS = 15_000;

export function rangoPermitido(esperaMs: number): number {
  // esperaMs puede ser levemente negativo: un ticket recién insertado tiene
  // created_at (reloj de la DB) una fracción de ms por delante del Date.now()
  // usado como "ahora". Sin el max(0,…), floor da -1 e indexa fuera del array
  // (undefined) → toda comparación de rango falla y NO empareja al entrar.
  const paso = Math.max(0, Math.floor(esperaMs / PASO_MS));
  const idx = Math.min(paso, ESCALONES_RANGO.length - 1);
  return ESCALONES_RANGO[idx];
}

// Umbral de espera tras el cual una party deja de esperar a otra party
// y acepta rellenar el equipo rival con jugadores sueltos.
const UMBRAL_RELLENO_MS = PASO_MS; // 15s

function dentroDeRango(a: Ticket, b: Ticket, ahora: number): boolean {
  const espera = Math.min(ahora - a.creadoEn, ahora - b.creadoEn);
  return Math.abs(a.elo - b.elo) <= rangoPermitido(espera);
}

// ── 1v1 ─────────────────────────────────────────────────────────────
export type Match2p = { par: [Ticket, Ticket] };

/** Empareja los dos tickets más antiguos cuyo ELO caiga dentro de rango. */
export function tryMatch2p(tickets: Ticket[], ahora: number): Match2p | null {
  const cola = tickets.filter(t => t.modo === 2).sort((a, b) => a.creadoEn - b.creadoEn);

  for (let i = 0; i < cola.length; i++) {
    for (let j = i + 1; j < cola.length; j++) {
      if (dentroDeRango(cola[i], cola[j], ahora)) {
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
export function tryMatch4p(tickets: Ticket[], ahora: number): Match4p | null {
  const cola = tickets.filter(t => t.modo === 4);
  const parties = cola.filter(t => t.usuarioIds.length === 2)
    .sort((a, b) => a.creadoEn - b.creadoEn);
  const solos = cola.filter(t => t.usuarioIds.length === 1)
    .sort((a, b) => a.elo - b.elo);

  // 1) party vs party
  for (let i = 0; i < parties.length; i++) {
    for (let j = i + 1; j < parties.length; j++) {
      if (dentroDeRango(parties[i], parties[j], ahora)) {
        return { equipoA: [parties[i]], equipoB: [parties[j]] };
      }
    }
  }

  // 2) party + relleno de solos, si ya esperó el umbral
  for (const p of parties) {
    if (ahora - p.creadoEn < UMBRAL_RELLENO_MS) continue;
    const rango = rangoPermitido(ahora - p.creadoEn);
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
    if (p4.elo - p1.elo <= rangoPermitido(espera)) {
      // Balance: extremos juntos vs medios juntos (heurística simple)
      return { equipoA: [p1, p4], equipoB: [p2, p3] };
    }
  }

  return null;
}

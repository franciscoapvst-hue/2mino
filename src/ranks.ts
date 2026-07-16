const modules = import.meta.glob<string>('./assets/elo-rank/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const badgeByFile: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const key = path.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase();
  badgeByFile[key] = url;
}

// Umbrales provisionales, se ajustan luego (ver conversación con usuario).
const RANGOS = [
  { nombre: 'Bronce',   file: 'bronce',   min: 0 },
  { nombre: 'Plata',    file: 'plata',    min: 1000 },
  { nombre: 'Oro',      file: 'oro',      min: 1150 },
  { nombre: 'Platino',  file: 'platino',  min: 1350 },
  { nombre: 'Diamante', file: 'diamante', min: 1550 },
] as const;

export type Rango = { nombre: string; url: string | null; min: number };

export function rangoDeElo(elo: number): Rango {
  const r = [...RANGOS].reverse().find(r => elo >= r.min) ?? RANGOS[0];
  return { nombre: r.nombre, url: badgeByFile[r.file] ?? null, min: r.min };
}

// Los 5 escalones con su insignia — para vistas que muestran la progresión
// completa (landing) en vez de un solo rango (dashboard).
export function todosLosRangos(): Rango[] {
  return RANGOS.map(r => ({ nombre: r.nombre, url: badgeByFile[r.file] ?? null, min: r.min }));
}

// Progreso hacia el siguiente rango: para el panel de rango del dashboard.
export function progresoRango(elo: number): {
  siguiente: string | null;
  faltan: number | null;
  pct: number;
} {
  const idx = RANGOS.reduce((acc, r, i) => (elo >= r.min ? i : acc), 0);
  const actual = RANGOS[idx];
  const next = RANGOS[idx + 1];
  if (!next) return { siguiente: null, faltan: null, pct: 100 };
  const pct = Math.round(((elo - actual.min) / (next.min - actual.min)) * 100);
  return {
    siguiente: next.nombre,
    faltan: next.min - elo,
    pct: Math.max(0, Math.min(100, pct)),
  };
}

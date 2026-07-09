import type { AdminSession, FeatureFlag, Segmento, Usuario } from './types';

/**
 * Cliente mock del Back Office. Reproduce el contrato de
 * docs/CASOS_DE_USO_BACKOFFICE.md (§2 login, §3 usuarios, §4 segmentos,
 * §5 feature flags) contra localStorage en vez de api-integracion.
 * Cuando el backend real exista, este es el único archivo a reemplazar —
 * las vistas ya consumen estas firmas de función, no fetch directo.
 */

const LATENCY_MS = 320;
const STORAGE_KEY = '2mino-bo-data';
const SESSION_KEY = '2mino-admin-token';

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

type DB = {
  segmentos: Segmento[];
  usuarios: Usuario[];
  flags: FeatureFlag[];
};

function seed(): DB {
  return {
    segmentos: [
      { id: 'seg-jugador', nombre: 'jugador', descripcion: 'Segmento por defecto de cualquier usuario registrado', activo: true, config: { tema: 'oscuro' } },
      { id: 'seg-tester', nombre: 'tester', descripcion: 'Acceso anticipado a features en prueba', activo: true, config: { tema: 'oscuro', features: ['torneos_beta'] } },
      { id: 'seg-admin', nombre: 'admin', descripcion: 'Acceso al Back Office', activo: true, config: {} },
    ],
    usuarios: [
      { id: 'u-1', username: 'franciscoapv', email: 'franciscoapvst@gmail.com', segmentoId: 'seg-admin', activo: true, elo: 1420, creadoEn: '2026-01-14T10:00:00Z' },
      { id: 'u-2', username: 'capicua_king', email: 'capicua@example.com', segmentoId: 'seg-jugador', activo: true, elo: 1180, creadoEn: '2026-02-02T18:30:00Z' },
      { id: 'u-3', username: 'domino_pro', email: 'pro@example.com', segmentoId: 'seg-tester', activo: true, elo: 1560, creadoEn: '2026-02-20T09:12:00Z' },
      { id: 'u-4', username: 'tranquero99', email: 'tranca@example.com', segmentoId: 'seg-jugador', activo: false, elo: 980, creadoEn: '2026-03-05T21:45:00Z' },
      { id: 'u-5', username: 'reina_de_picas', email: 'reina@example.com', segmentoId: 'seg-jugador', activo: true, elo: 1050, creadoEn: '2026-04-11T14:20:00Z' },
    ],
    flags: [
      { clave: 'torneos_habilitado', etiqueta: 'Torneos', descripcion: 'Muestra la sección de torneos en el dashboard del jugador', habilitado: false },
      { clave: 'chat_partida', etiqueta: 'Chat en partida', descripcion: 'Botón de chat flotante dentro del GameBoard', habilitado: true },
      { clave: 'tutorial_onboarding', etiqueta: 'Tutorial de onboarding', descripcion: 'Pregunta de nivel + tutorial interactivo para usuarios nuevos', habilitado: true },
      { clave: 'leaderboard_extendido', etiqueta: 'Leaderboard extendido', descripcion: 'Historial y estadísticas ampliadas en el leaderboard', habilitado: true },
      { clave: 'matchmaking_ranked', etiqueta: 'Matchmaking ranked', descripcion: 'Cola competitiva con ELO (fuera de esto, solo casual)', habilitado: true },
    ],
  };
}

function loadDB(): DB {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const fresh = seed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
  return JSON.parse(raw) as DB;
}

function saveDB(db: DB) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// ── §2 Login admin ──────────────────────────────────────────────
export async function login(username: string, password: string): Promise<AdminSession> {
  if (!username.trim() || !password.trim()) {
    throw new Error('Usuario y contraseña son requeridos.');
  }
  const session: AdminSession = { username, segmento: 'admin', token: `mock.${btoa(username)}.${Date.now()}` };
  await delay(null);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession(): AdminSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as AdminSession) : null;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ── §5 Feature flags ────────────────────────────────────────────
export async function listFlags(): Promise<FeatureFlag[]> {
  return delay(loadDB().flags);
}

export async function toggleFlag(clave: string, habilitado: boolean): Promise<FeatureFlag> {
  const db = loadDB();
  const flag = db.flags.find((f) => f.clave === clave);
  if (!flag) throw new Error('Flag no encontrado');
  flag.habilitado = habilitado;
  saveDB(db);
  return delay(flag);
}

// ── §4 Segmentos ────────────────────────────────────────────────
export async function listSegmentos(): Promise<Segmento[]> {
  return delay(loadDB().segmentos);
}

export async function createSegmento(input: { nombre: string; descripcion: string }): Promise<Segmento> {
  const db = loadDB();
  const nuevo: Segmento = { id: `seg-${crypto.randomUUID().slice(0, 8)}`, nombre: input.nombre, descripcion: input.descripcion, activo: true, config: {} };
  db.segmentos.push(nuevo);
  saveDB(db);
  return delay(nuevo);
}

export async function toggleSegmentoEstado(id: string, activo: boolean): Promise<Segmento> {
  const db = loadDB();
  const seg = db.segmentos.find((s) => s.id === id);
  if (!seg) throw new Error('Segmento no encontrado');
  seg.activo = activo;
  saveDB(db);
  return delay(seg);
}

// ── §3 Usuarios ─────────────────────────────────────────────────
export async function listUsuarios(query: string): Promise<Usuario[]> {
  const db = loadDB();
  const q = query.trim().toLowerCase();
  const rows = q ? db.usuarios.filter((u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : db.usuarios;
  return delay(rows);
}

export async function setUsuarioSegmento(id: string, segmentoId: string): Promise<Usuario> {
  const db = loadDB();
  const u = db.usuarios.find((x) => x.id === id);
  if (!u) throw new Error('Usuario no encontrado');
  u.segmentoId = segmentoId;
  saveDB(db);
  return delay(u);
}

export async function setUsuarioEstado(id: string, activo: boolean): Promise<Usuario> {
  const db = loadDB();
  const u = db.usuarios.find((x) => x.id === id);
  if (!u) throw new Error('Usuario no encontrado');
  u.activo = activo;
  saveDB(db);
  return delay(u);
}

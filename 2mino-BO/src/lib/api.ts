import type { AdminSession, FeatureFlag, Segmento, Usuario } from './types';

/**
 * Cliente del Back Office. §2 (login) y §5 (feature flags) de
 * docs/CASOS_DE_USO_BACKOFFICE.md ya hablan con api-integracion de verdad.
 * §3 (usuarios) y §4 (segmentos) siguen mock contra localStorage hasta que
 * exista el backend correspondiente — se reemplazan función por función,
 * sin que las vistas necesiten cambiar (ya consumen estas firmas).
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const SESSION_KEY = '2mino-admin-token';

// ── Sesión ────────────────────────────────────────────────────────
export function getSession(): AdminSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as AdminSession) : null;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

function saveSession(session: AdminSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// ── §2 Login admin — real, contra api-integracion ──────────────────
// Mismo POST /auth/login que usa el frontend de jugadores; acá además
// se exige segmento === 'admin' (requireAdmin lo revalida en cada
// request posterior, pero chequear ya en el login evita que alguien sin
// permisos vea la pantalla de "cargando" antes del primer 403).
export async function login(email: string, password: string): Promise<AdminSession> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Credenciales inválidas.');

  const { token, user } = data as { token: string; user: { username: string; segmento?: string } };
  if (user.segmento !== 'admin') {
    throw new Error('Esta cuenta no tiene acceso al Back Office (requiere segmento admin).');
  }
  const session: AdminSession = { username: user.username, segmento: 'admin', token };
  saveSession(session);
  return session;
}

// Cliente autenticado genérico para /admin/* — adjunta el Bearer y
// desloguea automáticamente ante 401/403 (token vencido o revocado).
async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getSession();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Sesión expirada o sin permisos — volvé a iniciar sesión.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Error de red.');
  return data as T;
}

// ── §5 Feature flags — real, contra api-integracion ────────────────
export async function listFlags(): Promise<FeatureFlag[]> {
  return adminFetch<FeatureFlag[]>('/admin/feature-flags');
}

export async function toggleFlag(clave: string, habilitado: boolean): Promise<FeatureFlag> {
  await adminFetch(`/admin/feature-flags/${clave}`, {
    method: 'PATCH',
    body: JSON.stringify({ habilitado }),
  });
  // El PATCH real solo devuelve {clave, habilitado} — se recarga la lista
  // completa para tener descripcion/valor/updated_at ya actualizados.
  const flags = await listFlags();
  const flag = flags.find((f) => f.clave === clave);
  if (!flag) throw new Error(`Flag '${clave}' no encontrada tras actualizar.`);
  return flag;
}

// ════════════════════════════════════════════════════════════════
// A partir de acá: mock contra localStorage — §3 y §4 todavía no
// tienen backend real (ver docs/CASOS_DE_USO_BACKOFFICE.md §3/§4).
// ════════════════════════════════════════════════════════════════

const LATENCY_MS = 320;
const STORAGE_KEY = '2mino-bo-data';

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

type MockDB = {
  segmentos: Segmento[];
  usuarios: Usuario[];
};

function seed(): MockDB {
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
  };
}

function loadDB(): MockDB {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const fresh = seed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
  return JSON.parse(raw) as MockDB;
}

function saveDB(db: MockDB) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// ── §4 Segmentos (mock) ──────────────────────────────────────────
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

// ── §3 Usuarios (mock) ───────────────────────────────────────────
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

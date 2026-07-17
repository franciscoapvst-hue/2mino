import type { AdminSession, FeatureFlag, ReglaJuego, Segmento, Usuario, UsuarioCompleto } from './types';
import { apiUrl } from './env';

/**
 * Cliente del Back Office — habla contra api-integracion de verdad
 * (docs/CASOS_DE_USO_BACKOFFICE.md §2/§3/§4/§5, ya completos).
 * La URL base se resuelve en cada llamada vía apiUrl() (env.ts) — puede
 * cambiar en caliente si el admin cambia de ambiente (Dev/QA/Prod).
 */

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
  const res = await fetch(`${apiUrl()}/auth/login`, {
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
  const res = await fetch(`${apiUrl()}${path}`, {
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

// ── §6 Reglas del juego — real, contra api-integracion ─────────────
export async function listReglas(): Promise<ReglaJuego[]> {
  return adminFetch<ReglaJuego[]>('/admin/reglas');
}

export async function updateRegla(clave: string, valor: unknown): Promise<ReglaJuego> {
  // A diferencia de feature-flags, el PATCH de reglas SÍ devuelve la fila
  // completa ya actualizada — no hace falta recargar la lista entera.
  return adminFetch<ReglaJuego>(`/admin/reglas/${clave}`, {
    method: 'PATCH',
    body: JSON.stringify({ valor }),
  });
}

// ── §4 Segmentos — real, contra api-integracion ────────────────────
export async function listSegmentos(): Promise<Segmento[]> {
  return adminFetch<Segmento[]>('/admin/segmentos');
}

export async function createSegmento(input: { nombre: string; descripcion: string }): Promise<Segmento> {
  return adminFetch<Segmento>('/admin/segmentos', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function toggleSegmentoEstado(id: string, activo: boolean): Promise<Segmento> {
  return adminFetch<Segmento>(`/admin/segmentos/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  });
}

// ── §3 Usuarios — real, contra api-integracion ─────────────────────
// ms-usuarios devuelve snake_case (segmento_id) — se mapea acá al
// camelCase que ya esperan las vistas, sin tocarlas.
type UsuarioApi = { id: string; username: string; email: string; segmento_id: string; activo: boolean };

function mapUsuario(u: UsuarioApi): Usuario {
  return { id: u.id, username: u.username, email: u.email, segmentoId: u.segmento_id, activo: u.activo };
}

export async function listUsuarios(query: string): Promise<Usuario[]> {
  const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const rows = await adminFetch<UsuarioApi[]>(`/admin/usuarios${qs}`);
  return rows.map(mapUsuario);
}

export async function setUsuarioSegmento(id: string, segmentoId: string): Promise<Usuario> {
  const row = await adminFetch<UsuarioApi>(`/admin/usuarios/${id}/segmento`, {
    method: 'PATCH',
    body: JSON.stringify({ segmentoId }),
  });
  return mapUsuario(row);
}

export async function setUsuarioEstado(id: string, activo: boolean): Promise<Usuario> {
  const row = await adminFetch<UsuarioApi>(`/admin/usuarios/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  });
  return mapUsuario(row);
}

// Borrado real (no reversible) — distinto de setUsuarioEstado(false), que
// solo banea. Ver comentario en ms-usuarios/src/routes/usuarios.ts sobre
// qué no limpia (referencias en salas/ranked/amigos de otros jugadores).
export async function deleteUsuario(id: string): Promise<void> {
  await adminFetch<{ message: string }>(`/admin/usuarios/${id}`, { method: 'DELETE' });
}

// Detalle completo — click en un usuario dentro de UsuariosView.
type UsuarioCompletoApi = {
  id: string; username: string; email: string; avatar: string | null; activo: boolean;
  created_at: string; updated_at: string; segmento_id: string; segmento: string | null;
  segmento_config: Record<string, unknown> | null; elo: number; partidas: number; ganadas: number;
};

export async function getUsuarioCompleto(id: string): Promise<UsuarioCompleto> {
  const u = await adminFetch<UsuarioCompletoApi>(`/admin/usuarios/${id}`);
  return {
    id: u.id, username: u.username, email: u.email, avatar: u.avatar, activo: u.activo,
    createdAt: u.created_at, updatedAt: u.updated_at, segmentoId: u.segmento_id,
    segmento: u.segmento, segmentoConfig: u.segmento_config,
    elo: u.elo, partidas: u.partidas, ganadas: u.ganadas,
  };
}

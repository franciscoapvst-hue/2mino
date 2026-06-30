const BASE = '/api';

// ── Tipos públicos ────────────────────────────────
export type SalaJugador = {
  usuario_id: string;
  username:   string;
  posicion:   number;
  equipo:     number | null;
  listo:      boolean;
  joined_at:  string;
};

export type Sala = {
  id:              string;
  codigo:          string;
  nombre:          string | null;
  creador_id:      string;
  estado:          'esperando' | 'en_juego' | 'finalizada' | 'cancelada';
  tipo:            'casual' | 'ranked';
  modo:            'clasico' | 'rapido' | 'torneo';
  max_jugadores:   number;
  jugadores_count: number;
  jugadores:       SalaJugador[];
  privada:         boolean;
  config:          Record<string, unknown>;
  created_at:      string;
};

// ── Tipos del juego ────────────────────────────────
export type Val   = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Pieza = { a: Val; b: Val };

export type FichaTablero = { pieza: Pieza; izqVal: Val; derVal: Val };

export type Asiento = { usuario_id: string; username: string; posicion: number };

export type ResultadoMano =
  | { tipo: 'normal';  ganadorSeat: number; puntos: number }
  | { tipo: 'capicua'; ganadorSeat: number; puntos: 30 }
  | { tipo: 'tranca';  equipoGanador: 0 | 1; puntos: 30 };

export type PartidaPublica = {
  maxJugadores: number;
  asientos:     Asiento[];
  miSeat:       number;
  miMano:       Pieza[];
  conteoManos:  number[];
  tablero:      FichaTablero[];
  turno:        number;
  pasadas:      number;
  ultimaJugada: { lado: 'izq' | 'der' } | null;
  resultado:    ResultadoMano | null;
  estado:       'jugando' | 'terminado';
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
};

export type UserConfig = {
  usuario_id: string;
  segmento: string;
  tema: 'dark' | 'light';
  idioma: string;
  modos_juego: string[];
  features: Record<string, boolean>;
  opciones: Record<string, unknown>;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

// ── Token management ──────────────────────────────
const TOKEN_KEY = '2mino-token';

export const tokenStore = {
  get: () =>
    localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY),
  set: (t: string, persist: boolean) =>
    persist
      ? localStorage.setItem(TOKEN_KEY, t)
      : sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

// ── HTTP helper ───────────────────────────────────
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? 'Error inesperado');
  }
  return data as T;
}

// ── API ───────────────────────────────────────────
export const api = {
  register: (body: { username: string; email: string; password: string }) =>
    req<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    req<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  forgotPassword: (email: string) =>
    req<{ message: string; _dev_token?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  me: () => req<AuthUser>('/auth/me'),

  getPreferencias: () => req<UserConfig>('/frontend/preferencias'),

  putPreferencias: (body: Partial<Pick<UserConfig, 'tema' | 'idioma' | 'opciones'>>) =>
    req<UserConfig>('/frontend/preferencias', { method: 'PUT', body: JSON.stringify(body) }),

  salas: {
    listar: (q?: { tipo?: string; modo?: string }) => {
      const qs = q ? '?' + new URLSearchParams(q as Record<string, string>) : '';
      return req<Sala[]>(`/salas${qs}`);
    },
    crear: (body: { nombre?: string; tipo?: string; modo?: string; max_jugadores?: number }) =>
      req<Sala>('/salas', { method: 'POST', body: JSON.stringify(body) }),
    porCodigo: (codigo: string) =>
      req<Sala>(`/salas/codigo/${codigo.trim().toUpperCase()}`),
    detalle: (id: string) =>
      req<Sala>(`/salas/${id}`),
    unirse: (id: string) =>
      req<Sala>(`/salas/${id}/unirse`, { method: 'POST', body: '{}' }),
    salir: (id: string) =>
      req<Sala>(`/salas/${id}/salir`, { method: 'POST', body: '{}' }),
    cambiarEstado: (id: string, estado: Sala['estado']) =>
      req<Sala>(`/salas/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
  },

  juego: {
    iniciar: (salaId: string) =>
      req<PartidaPublica>(`/salas/${salaId}/juego/iniciar`, { method: 'POST', body: '{}' }),
    estado: (salaId: string) =>
      req<PartidaPublica>(`/salas/${salaId}/juego`),
    jugar: (salaId: string, pieza: Pieza, lado?: 'izq' | 'der') =>
      req<PartidaPublica>(`/salas/${salaId}/juego/jugar`, {
        method: 'POST', body: JSON.stringify({ pieza, lado }),
      }),
    pasar: (salaId: string) =>
      req<PartidaPublica>(`/salas/${salaId}/juego/pasar`, { method: 'POST', body: '{}' }),
  },
};

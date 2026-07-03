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
  | { tipo: 'capicua'; ganadorSeat: number; puntos: number }
  | { tipo: 'tranca';  equipoGanador: 0 | 1 | null; puntos: number };

export type Fase = 'jugando' | 'entre_manos' | 'fin_partida';

export type PartidaPublica = {
  maxJugadores: number;
  asientos:     Asiento[];
  miSeat:       number;
  miEquipo:     0 | 1 | null;
  miMano:       Pieza[];
  conteoManos:  number[];
  tablero:      FichaTablero[];
  turno:        number;
  pasadas:      number;
  ultimaJugada: { lado: 'izq' | 'der' } | null;
  // — partida a puntos —
  puntosObjetivo: number;
  marcador:       [number, number];
  numeroMano:     number;
  salida:         number;
  fase:           Fase;
  listos:         boolean[];
  salidaForzada:  Pieza | null;
  resultadoMano:  ResultadoMano | null;
  equipoGanadorPartida: 0 | 1 | null;
  ultimoEvento:   { tipo: 'paso_a_todos'; seat: number } | null;
  abandonadoPorSeat: number | null;
  estado:         'jugando' | 'entre_manos' | 'terminado';
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
};

// ── Ranked / ELO ───────────────────────────────────
export type RankedInfo = {
  usuario_id: string;
  elo:        number;
  partidas:   number;
  ganadas:    number;
  historial: {
    sala_id: string; elo_antes: number; elo_despues: number;
    delta: number; gano: boolean; created_at: string;
  }[];
};

export type LeaderboardEntry = {
  usuario_id: string; username: string;
  elo: number; partidas: number; ganadas: number;
};

// ── Matchmaking (casual y ranked) ──────────────────
export type TipoJuego = 'casual' | 'ranked';

export type PartyMiembro = { usuario_id: string; username: string };

export type Party = {
  id: string; codigo: string; creador_id: string;
  estado: 'esperando' | 'en_cola' | 'matched' | 'cancelada';
  tipo?: TipoJuego;
  miembros: PartyMiembro[];
};

export type ColaEstado =
  | { en_cola: false; matched?: false }
  | { en_cola: false; matched: true; sala_id: string }
  | { en_cola: true; modo: 2 | 4; es_party: boolean; espera_ms: number; rango_actual: number };

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
    crear: (body: {
      nombre?: string; tipo?: string; modo?: string; max_jugadores?: number;
      config?: { puntosObjetivo?: number };
    }) =>
      req<Sala>('/salas', { method: 'POST', body: JSON.stringify(body) }),
    cambiarPosicion: (id: string, posicion: number) =>
      req<Sala>(`/salas/${id}/posicion`, { method: 'POST', body: JSON.stringify({ posicion }) }),
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
    listo: (salaId: string) =>
      req<PartidaPublica>(`/salas/${salaId}/juego/listo`, { method: 'POST', body: '{}' }),
    abandonar: (salaId: string) =>
      req<PartidaPublica>(`/salas/${salaId}/juego/abandonar`, { method: 'POST', body: '{}' }),
  },

  ranked: {
    me: () => req<RankedInfo>('/ranked/me'),
    leaderboard: (limit = 20) =>
      req<LeaderboardEntry[]>(`/ranked/leaderboard?limit=${limit}`),

    crearParty: (tipo: TipoJuego = 'ranked') =>
      req<Party>('/ranked/party', { method: 'POST', body: JSON.stringify({ tipo }) }),
    party: (codigo: string) => req<Party>(`/ranked/party/${codigo}`),
    unirseParty: (codigo: string) =>
      req<Party>(`/ranked/party/${codigo}/unirse`, { method: 'POST', body: '{}' }),
    salirParty: (codigo: string) =>
      req<{ ok: true }>(`/ranked/party/${codigo}/salir`, { method: 'POST', body: '{}' }),
    partyACola: (codigo: string) =>
      req<ColaEstado>(`/ranked/party/${codigo}/cola`, { method: 'POST', body: '{}' }),

    entrarCola: (modo: 2 | 4, tipo: TipoJuego = 'ranked') =>
      req<ColaEstado>('/ranked/cola/entrar', { method: 'POST', body: JSON.stringify({ modo, tipo }) }),
    estadoCola: () => req<ColaEstado>('/ranked/cola/estado'),
    salirCola: () => req<{ ok: true }>('/ranked/cola/salir', { method: 'POST', body: '{}' }),
  },
};

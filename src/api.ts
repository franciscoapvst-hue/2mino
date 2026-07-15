import type { ReplayData } from './game/replay-engine';

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
  creador_username?: string | null;
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
  // noCaben = true: el bono fijo de capicúa no entró, `puntos` son los
  // pips reales del rival en su lugar (y sí pueden terminar la partida).
  | { tipo: 'capicua'; ganadorSeat: number; puntos: number; noCaben?: boolean }
  // Los pips de una tranca siempre se suman, incluso si superan el objetivo.
  | { tipo: 'tranca';  equipoGanador: 0 | 1 | null; puntos: number };

export type Fase = 'jugando' | 'entre_manos' | 'fin_partida';

export type PartidaPublica = {
  maxJugadores: number;
  asientos:     Asiento[];
  miSeat:       number;
  miEquipo:     0 | 1 | null;
  miMano:       Pieza[];
  conteoManos:  number[];
  // Fichas reales de todos los asientos — null mientras se está jugando,
  // se revela recién al cerrar la mano (transparencia del conteo de puntos).
  manosReveladas: Pieza[][] | null;
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
  ultimoEvento:   { tipo: 'paso_a_todos'; seat: number; noCaben: boolean } | { tipo: 'tiempo_agotado'; seat: number } | null;
  abandonadoPorSeat: number | null;
  estado:         'jugando' | 'entre_manos' | 'terminado';
  // Tiempo límite por jugada (docs/PENDIENTES_JUEGO.md §2) — null = sin límite.
  limiteJugadaMs: number | null;
  turnoEmpiezaEn: number;
  // Espera (ms) configurable desde el BO antes de mostrar la pantalla de fin de mano.
  delayFinManoMs: number;
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  avatar?: string | null;
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

// ── Social: amigos, bandeja, leaderboard extendido, historial, chat ──
// Tipos según docs/CASOS_DE_USO_SOCIAL.md, servidos por ms-social/ms-salas
// vía el gateway.
export type Amigo = {
  usuario_id: string;
  username:   string;
  avatar:     string | null;
  elo:        number;
  conectado:  boolean;
};

export type UsuarioBusqueda = {
  id:       string;
  username: string;
  avatar:   string | null;
};

export type TipoNotificacion = 'solicitud_amistad' | 'amistad_aceptada' | 'invitacion_partida';

export type Notificacion = {
  id:            string;
  tipo:          TipoNotificacion;
  de_usuario_id: string;
  de_username:   string;
  de_avatar:     string | null;
  payload:       { sala_codigo?: string; party_codigo?: string; solicitud_id?: string };
  leida:         boolean;
  created_at:    string;
};

export type EstadoRelacion = 'amigo' | 'pendiente' | 'ninguno';

export type PerfilJugador = {
  usuario_id: string;
  username:   string;
  elo:        number;
  partidas:   number;
  ganadas:    number;
  capicuas:          number;
  tranques_ganados:  number;
  tranques_perdidos: number;
  progresion_elo: { fecha: string; elo: number }[];
};

export type PartidaHistorial = {
  sala_id:         string;
  fecha:           string;
  tipo_sala:       'casual' | 'ranked';
  modo:            2 | 4;
  rival_principal: string;
  gano:            boolean;
  puntos_favor:    number;
  puntos_contra:   number;
  capicua:         boolean;
  tranque:         boolean;
  delta_elo:       number | null;
};

export type ChatMensaje = {
  id:         string;
  usuario_id: string;
  username:   string;
  mensaje:    string;
  created_at: string;
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
// `code` (si el backend lo manda, ej. EMAIL_NO_VERIFICADO) permite que la
// UI reaccione a un error específico sin parsear el texto del mensaje.
export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

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
    const body = data as { error?: string; code?: string };
    throw new ApiError(body.error ?? 'Error inesperado', body.code);
  }
  return data as T;
}

// ── API ───────────────────────────────────────────
export const api = {
  // Ya no devuelve token — hay que confirmar el email antes de loguear.
  register: (body: { username: string; email: string; password: string }) =>
    req<{ message: string }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  verificarEmail: (token: string) =>
    req<AuthResponse>('/auth/verificar-email', { method: 'POST', body: JSON.stringify({ token }) }),

  reenviarVerificacion: (email: string) =>
    req<{ message: string }>('/auth/reenviar-verificacion', { method: 'POST', body: JSON.stringify({ email }) }),

  login: (body: { email: string; password: string }) =>
    req<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  loginGoogle: (code: string) =>
    req<AuthResponse>('/auth/google', { method: 'POST', body: JSON.stringify({ code }) }),

  jugarInvitado: () =>
    req<AuthResponse>('/auth/invitado', { method: 'POST' }),

  forgotPassword: (email: string) =>
    req<{ message: string; _dev_token?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  me: () => req<AuthUser>('/auth/me'),

  setAvatar: (avatar: string) =>
    req<AuthUser>('/auth/avatar', { method: 'PATCH', body: JSON.stringify({ avatar }) }),

  getPreferencias: () => req<UserConfig>('/frontend/preferencias'),

  // Feature flags de landing_config, editables desde el BO sin redeploy
  // (2mino-BO → "Feature flags"). Solo trae las habilitadas — una clave
  // ausente en la respuesta significa deshabilitada.
  featureFlags: () => req<Record<string, unknown>>('/frontend/config'),

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
    activa: () =>
      req<{ sala: Sala | null }>('/salas/activa'),
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

  // ── Social (ms-social) ────────────────────────────
  // Cada función es 1:1 con un endpoint de docs/CASOS_DE_USO_SOCIAL.md.
  social: {
    // Autocompletar mientras se escribe en el buscador de "agregar amigo".
    buscarUsuarios: (q: string) =>
      req<UsuarioBusqueda[]>(`/social/buscar-usuarios?q=${encodeURIComponent(q)}`),

    amigos: () => req<Amigo[]>('/amigos'),

    eliminarAmigo: (usuarioId: string) =>
      req<{ ok: true }>(`/amigos/${usuarioId}`, { method: 'DELETE' }),

    // Acepta un usuario_id (UUID, ej. desde el fin de partida) o un
    // username crudo (desde el buscador de FriendsView) — se distingue
    // por forma, el gateway resuelve el username si hace falta.
    enviarSolicitud: (idOUsername: string) => {
      const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOUsername);
      return req<{ ok: true }>('/solicitudes', {
        method: 'POST',
        body: JSON.stringify(esUuid ? { a_usuario_id: idOUsername } : { a_username: idOUsername }),
      });
    },

    aceptarSolicitud: (id: string) =>
      req<{ ok: true }>(`/solicitudes/${id}/aceptar`, { method: 'POST', body: '{}' }),

    rechazarSolicitud: (id: string) =>
      req<{ ok: true }>(`/solicitudes/${id}/rechazar`, { method: 'POST', body: '{}' }),

    estadoRelacion: (usuarioIds: string[]) =>
      req<Record<string, EstadoRelacion>>('/social/estado-relacion', {
        method: 'POST', body: JSON.stringify({ usuario_ids: usuarioIds }),
      }),

    notificaciones: () => req<Notificacion[]>('/notificaciones'),

    marcarLeida: (id: string) =>
      req<{ ok: true }>(`/notificaciones/${id}/leer`, { method: 'POST', body: '{}' }),

    noLeidasCount: () => req<{ count: number }>('/notificaciones/no-leidas/count'),

    invitarPartida: (aUsuarioId: string, salaCodigo: string) =>
      req<{ ok: true }>('/social/invitar-partida', {
        method: 'POST', body: JSON.stringify({ a_usuario_id: aUsuarioId, sala_codigo: salaCodigo }),
      }),

    // El endpoint real crea la sala y devuelve también a quién invitar
    // (el resto de los jugadores viejos); acá solo se necesita el código
    // para mantener la firma que ya usan los componentes.
    revancha: async (salaId: string): Promise<{ ok: true; sala_codigo: string }> => {
      const r = await req<{ sala: Sala; invitar: { usuario_id: string; username: string }[] }>(
        `/salas/${salaId}/revancha`, { method: 'POST', body: '{}' },
      );
      return { ok: true, sala_codigo: r.sala.codigo };
    },

    // Reusa el mecanismo de party ranked que ya existe (§7.2 del doc): crea
    // una party y manda la invitación por el mismo canal de notificaciones.
    invitarCompanero: async (aUsuarioId: string): Promise<{ ok: true; party_codigo: string }> => {
      const party = await api.ranked.crearParty('ranked');
      await req('/social/invitar-partida', {
        method: 'POST', body: JSON.stringify({ a_usuario_id: aUsuarioId, party_codigo: party.codigo }),
      });
      return { ok: true, party_codigo: party.codigo };
    },

    perfilJugador: (entry: LeaderboardEntry) =>
      req<PerfilJugador>(`/ranked/leaderboard/${entry.usuario_id}/perfil`),

    // miUsername ya no hace falta (era para la semilla del mock) — se
    // mantiene en la firma para no tocar ChatPanel.tsx.
    chatHistorial: (salaId: string, _miUsername: string) =>
      req<ChatMensaje[]>(`/social/chat/${salaId}`),
  },

  // ── Historial de partidas propio + replay (ms-salas) ─────────────
  historial: {
    misPartidas: () => req<PartidaHistorial[]>('/salas/mis-partidas'),
    replay: (salaId: string) => req<ReplayData>(`/salas/${salaId}/replay`),
  },
};

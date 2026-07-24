export type Segmento = {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  config: Record<string, unknown>;
};

export type Usuario = {
  id: string;
  username: string;
  email: string;
  segmentoId: string;
  activo: boolean;
};

// Detalle completo (GET /admin/usuarios/:id) — perfil + segmento + ELO,
// vía la función usuario_completo() de ms-usuarios (cruza con
// ranked_ratings de ms-salas). Se mantiene separado de `Usuario` (el de
// la tabla/listado) porque trae mucho más que lo que esa vista necesita.
export type UsuarioCompleto = {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  segmentoId: string;
  segmento: string | null;
  segmentoConfig: Record<string, unknown> | null;
  elo: number;
  partidas: number;
  ganadas: number;
};

// Forma real de landing_config (ms-frontend-landing) — sin "etiqueta",
// no existe esa columna. La vista usa `descripcion` como título.
export type FeatureFlag = {
  clave: string;
  valor: unknown;
  descripcion: string;
  habilitado: boolean;
  updated_at?: string;
};

// Forma real de reglas_juego (ms-salas) — sin "habilitado" (a diferencia
// de FeatureFlag): estas filas siempre están activas, no son toggles.
export type ReglaJuego = {
  clave: string;
  valor: unknown;
  descripcion: string;
  updated_at?: string;
};

export type AdminSession = {
  username: string;
  segmento: 'admin';
  token: string;
};

// ── Tienda / cosméticos (docs/PLAN_COSMETICOS.md) ──────────────────
// Backend en snake_case, igual que Torneo* — se usa tal cual.
export type TiendaItem = {
  id: string;
  categoria: 'ficha' | 'tablero' | 'avatar' | 'marco_avatar';
  clave: string;
  nombre: string;
  precio: number;
  disponible: boolean;
  orden: number;
  created_at: string;
};

export type Billetera = {
  usuario_id: string;
  saldo: number;
  updated_at: string;
};

export type InventarioItem = {
  item_id: string;
  categoria: string;
  clave: string;
  nombre: string;
  comprado_at: string;
};

// ── Torneos (Etapa 1 de docs/PLAN_TORNEOS.md) ──────────────────────
// Backend en snake_case — se usa tal cual (sin mapeo a camelCase como
// Usuario) porque el wizard manda de vuelta el mismo shape que recibe.
export type TorneoFase = {
  id?: string;
  tipo: 'inicial' | 'eliminatoria';
  orden?: number;
  nombre: string;
  puntos_objetivo?: number;
  ventana_inicio: string;
  ventana_fin: string;
  clasifican_n?: number | null;
  metrica?: 'puntos' | 'elo_torneo' | 'victorias';
  estado?: string;
};

export type TorneoCampo = {
  id?: string;
  etiqueta: string;
  tipo: 'texto' | 'numero' | 'telefono' | 'email';
  requerido: boolean;
  orden?: number;
};

export type TorneoEquipo = {
  id: string;
  nombre: string | null;
  estado: string;
  codigo_equipo: string;
  jugador1_username: string;
  jugador2_username: string | null;
  elo_torneo: number;
  puntos: number;
  victorias: number;
  derrotas: number;
  capicuas: number;
  tranques: number;
};

export type TorneoResumen = {
  id: string;
  nombre: string;
  estado: string;
  modo: string;
  visibilidad: string;
  max_equipos: number;
  equipos_inscritos: number;
  cuota_monto: number;   // centavos USD
  moneda: string;
  fecha_inicio: string;
  fecha_fin: string;
  created_at: string;
};

export type TorneoDetalle = {
  id: string;
  nombre: string;
  estado: string;
  modo: 'clasico' | 'rapido';
  puntos_objetivo: number;
  tiene_fase_inicial: boolean;
  puntos_clasificacion: number | null;
  num_fases_eliminatorias: number;
  max_equipos: number;
  visibilidad: 'publico' | 'privado';
  codigo_invitacion: string | null;
  elo_min: number | null;
  elo_max: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  cuota_monto: number;
  moneda: string;
  politica_reembolso: string | null;
  reglas_override: Record<string, unknown>;
  avance_automatico: boolean;
  info_html: string | null;
  created_at: string;
  fases: TorneoFase[];
  equipos: TorneoEquipo[];
  campos_inscripcion: TorneoCampo[];
};

// Lo que manda el wizard (create/update) — el gateway inyecta creado_por.
export type TorneoInput = {
  nombre: string;
  modo: 'clasico' | 'rapido';
  puntos_objetivo: number;
  tiene_fase_inicial: boolean;
  puntos_clasificacion: number | null;
  num_fases_eliminatorias: number;
  max_equipos: number;
  visibilidad: 'publico' | 'privado';
  elo_min: number | null;
  elo_max: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  cuota_monto: number;
  politica_reembolso: string | null;
  reglas_override: Record<string, unknown>;
  avance_automatico: boolean;
  info_html: string | null;
  fases: TorneoFase[];
  campos_inscripcion: TorneoCampo[];
};

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

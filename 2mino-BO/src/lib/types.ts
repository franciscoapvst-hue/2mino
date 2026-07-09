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
  elo: number;
  creadoEn: string;
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

export type AdminSession = {
  username: string;
  segmento: 'admin';
  token: string;
};

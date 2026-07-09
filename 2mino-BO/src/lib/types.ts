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

export type FeatureFlag = {
  clave: string;
  etiqueta: string;
  descripcion: string;
  habilitado: boolean;
};

export type AdminSession = {
  username: string;
  segmento: 'admin';
  token: string;
};

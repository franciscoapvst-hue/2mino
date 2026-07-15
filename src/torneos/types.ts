// Tipos del frontend de torneos — reflejan el diseño de
// docs/CASOS_DE_USO_TORNEOS.md y docs/PLAN_TORNEOS.md. Mientras el
// backend real no exista, `mockData.ts` es la única fuente de datos
// (ver ese archivo para el porqué y qué reemplazar cuando el motor real
// esté armado).

export type EstadoTorneo = 'inscripcion' | 'fase_inicial' | 'eliminatoria' | 'finalizado' | 'cancelado';
export type EstadoEquipo = 'pendiente_pago' | 'pendiente_companero' | 'completo' | 'eliminado' | 'campeon';
export type TipoFase = 'inicial' | 'eliminatoria';

export type CampoInscripcion = {
  id: string;
  clave: string;
  etiqueta: string;
  tipo: 'texto' | 'numero' | 'telefono' | 'email' | 'fecha';
  requerido: boolean;
};

export type Fase = {
  id: string;
  tipo: TipoFase;
  orden: number;
  nombre: string;
  puntosObjetivo: number;
  ventanaInicio: string; // ISO
  ventanaFin: string;    // ISO
  estado: 'pendiente' | 'en_curso' | 'finalizada';
  clasificanN: number | null;
  metrica: 'puntos' | 'elo_torneo' | 'victorias';
};

export type Equipo = {
  id: string;
  nombre: string | null;
  jugador1Username: string;
  jugador2Username: string | null;
  estado: EstadoEquipo;
  eloTorneo: number;
  puntos: number;
  victorias: number;
  derrotas: number;
  capicuas: number;
  tranques: number;
  codigoEquipo: string;
};

export type Torneo = {
  id: string;
  nombre: string;
  estado: EstadoTorneo;
  visibilidad: 'publico' | 'privado';
  fechaInicio: string;
  fechaFin: string;
  cuotaMonto: number;   // centavos DOP, 0 = gratis
  moneda: string;
  politicaReembolso: string | null;
  infoHtml: string | null;
  reglamentoPdfUrl: string | null;
  reglamentoPdfNombre: string | null;
  puntosObjetivo: number;
  tieneFaseInicial: boolean;
  maxEquipos: number;
  eloMin: number | null;
  eloMax: number | null;
  campos: CampoInscripcion[];
  fases: Fase[];
  equipos: Equipo[];
  miEquipoId: string | null; // null = el usuario actual no está inscrito
  reglasOverride: {
    tiempoLimiteJugadaMs: number | null;
    puntosCapicua: number | null; // null = no suma
    puntosTranca: number | null;  // null = no suma
    puntosPasoATodos: number | null;
  };
};

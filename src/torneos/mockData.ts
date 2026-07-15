// ── Cliente MOCK de torneos ──────────────────────────────────────────
// Este módulo existe SOLO para poder ver y probar el frontend de torneos
// mientras el motor real (docs/PLAN_TORNEOS.md) no está construido. Los
// datos viven en memoria del proceso (se resetean al recargar) — no
// localStorage, porque este frontend sí tiene backend real detrás en
// producción y no queremos que alguien confunda un dato mock persistido
// con un dato real.
//
// Cuando el backend exista: este archivo se reemplaza por llamadas a
// `api.torneos.*` (mismo patrón que `api.salas`/`api.social` en api.ts) —
// las vistas ya consumen estas firmas de función async, no acceden a
// `torneos` directo, así el reemplazo no debería tocar los componentes.
import type { Torneo, Equipo } from './types';

function horas(n: number): string {
  return new Date(Date.now() + n * 3600_000).toISOString();
}

const TORNEOS: Torneo[] = [
  {
    id: 't-1',
    nombre: 'Copa Caribe — Clasificatorio de julio',
    estado: 'inscripcion',
    visibilidad: 'publico',
    fechaInicio: horas(48),
    fechaFin: horas(48 + 96),
    cuotaMonto: 50000, // RD$500.00
    moneda: 'DOP',
    politicaReembolso: 'La cuota se reembolsa solo si el torneo es cancelado por 2mino, o si tu equipo queda incompleto al cierre de inscripción. Los reembolsos se procesan de forma manual, dentro de las 72 horas.',
    // Ejemplo de contenido cargado por el admin (Paso 8 del wizard, §7.4 de
    // CASOS_DE_USO_TORNEOS.md) — se sanitiza con DOMPurify antes de
    // renderizar. Si el admin no carga nada, se arma un detalle genérico
    // con los datos estructurados (ver el torneo "Copa Fundadores" abajo).
    infoHtml: `
      <h3 style="margin:0 0 10px;">🏆 Premios</h3>
      <p style="margin:0 0 6px;">1er lugar: <strong style="color:var(--tor-ink);">RD$8,000</strong> + badge "Campeón Copa Caribe"</p>
      <p style="margin:0 0 14px;">2do lugar: <strong style="color:var(--tor-ink);">RD$3,000</strong></p>
      <h3 style="margin:0 0 10px;">📋 Reglas especiales</h3>
      <ul style="margin:0 0 14px; padding-left:18px;">
        <li>Fase de grupos: todos contra todos, clasifican los mejores 8 por puntos acumulados.</li>
        <li>A partir de cuartos de final: eliminación directa.</li>
        <li>Puntualidad: 10 minutos de tolerancia por partida, luego walkover.</li>
      </ul>
      <p style="margin:0; font-size:0.85rem;">Auspiciado por <strong style="color:var(--tor-amber);">Colmado La Esquina</strong> 🥤</p>
    `,
    reglamentoPdfUrl: '/mock/reglamento-copa-caribe.pdf',
    reglamentoPdfNombre: 'Reglamento oficial — Copa Caribe.pdf',
    puntosObjetivo: 150,
    tieneFaseInicial: true,
    maxEquipos: 16,
    eloMin: null,
    eloMax: null,
    campos: [
      { id: 'c1', clave: 'nombre_completo', etiqueta: 'Nombre completo', tipo: 'texto', requerido: true },
      { id: 'c2', clave: 'telefono', etiqueta: 'Teléfono (WhatsApp)', tipo: 'telefono', requerido: true },
      { id: 'c3', clave: 'email', etiqueta: 'Correo electrónico', tipo: 'email', requerido: true },
      { id: 'c4', clave: 'cedula', etiqueta: 'Cédula', tipo: 'texto', requerido: true },
      { id: 'c5', clave: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'fecha', requerido: true },
      { id: 'c6', clave: 'direccion', etiqueta: 'Dirección', tipo: 'texto', requerido: false },
    ],
    fases: [
      { id: 'f1', tipo: 'inicial', orden: 0, nombre: 'Fase de grupos', puntosObjetivo: 100, ventanaInicio: horas(48), ventanaFin: horas(48 + 48), estado: 'pendiente', clasificanN: 8, metrica: 'puntos' },
      { id: 'f2', tipo: 'eliminatoria', orden: 1, nombre: 'Cuartos de final', puntosObjetivo: 150, ventanaInicio: horas(48 + 72), ventanaFin: horas(48 + 84), estado: 'pendiente', clasificanN: 4, metrica: 'puntos' },
      { id: 'f3', tipo: 'eliminatoria', orden: 2, nombre: 'Semifinal', puntosObjetivo: 150, ventanaInicio: horas(48 + 90), ventanaFin: horas(48 + 93), estado: 'pendiente', clasificanN: 2, metrica: 'puntos' },
      { id: 'f4', tipo: 'eliminatoria', orden: 3, nombre: 'Final', puntosObjetivo: 200, ventanaInicio: horas(48 + 95), ventanaFin: horas(48 + 96), estado: 'pendiente', clasificanN: null, metrica: 'puntos' },
    ],
    equipos: [
      { id: 'e1', nombre: 'Los Capicúas', jugador1Username: 'domino_pro', jugador2Username: 'capicua_king', estado: 'completo', eloTorneo: 1000, puntos: 0, victorias: 0, derrotas: 0, capicuas: 0, tranques: 0, codigoEquipo: 'CAP42X' },
      { id: 'e2', nombre: null, jugador1Username: 'reina_de_picas', jugador2Username: null, estado: 'pendiente_companero', eloTorneo: 1000, puntos: 0, victorias: 0, derrotas: 0, capicuas: 0, tranques: 0, codigoEquipo: 'REI91Q' },
    ],
    miEquipoId: null,
    reglasOverride: { tiempoLimiteJugadaMs: 20000, puntosCapicua: 30, puntosTranca: 30, puntosPasoATodos: 30 },
  },
  {
    id: 't-2',
    nombre: 'Torneo relámpago — solo viernes',
    estado: 'inscripcion',
    visibilidad: 'publico',
    fechaInicio: horas(20),
    fechaFin: horas(26),
    cuotaMonto: 0,
    moneda: 'DOP',
    politicaReembolso: null,
    infoHtml: `<h3 style="margin:0 0 8px;">Formato exprés</h3><p style="margin:0 0 8px; color:var(--tor-muted);">Sin fase de grupos — directo a eliminación simple. ¡El que pierde, sale!</p><p style="margin:0; color:var(--tor-muted);">Premio: badge exclusivo "Relámpago" en tu perfil (sin premio en efectivo este torneo).</p>`,
    reglamentoPdfUrl: null,
    reglamentoPdfNombre: null,
    puntosObjetivo: 100,
    tieneFaseInicial: false,
    maxEquipos: 8,
    eloMin: 1000,
    eloMax: null,
    campos: [
      { id: 'c1', clave: 'nombre_completo', etiqueta: 'Nombre completo', tipo: 'texto', requerido: true },
    ],
    fases: [
      { id: 'g1', tipo: 'eliminatoria', orden: 1, nombre: 'Cuartos de final', puntosObjetivo: 100, ventanaInicio: horas(20), ventanaFin: horas(22), estado: 'pendiente', clasificanN: 4, metrica: 'puntos' },
      { id: 'g2', tipo: 'eliminatoria', orden: 2, nombre: 'Semifinal', puntosObjetivo: 100, ventanaInicio: horas(23), ventanaFin: horas(24), estado: 'pendiente', clasificanN: 2, metrica: 'puntos' },
      { id: 'g3', tipo: 'eliminatoria', orden: 3, nombre: 'Final', puntosObjetivo: 150, ventanaInicio: horas(25), ventanaFin: horas(26), estado: 'pendiente', clasificanN: null, metrica: 'puntos' },
    ],
    equipos: [
      { id: 'e3', nombre: 'Tranca Total', jugador1Username: 'tranquero99', jugador2Username: 'mex_pro', estado: 'completo', eloTorneo: 1000, puntos: 0, victorias: 0, derrotas: 0, capicuas: 0, tranques: 0, codigoEquipo: 'TRN77Z' },
    ],
    miEquipoId: null,
    reglasOverride: { tiempoLimiteJugadaMs: 15000, puntosCapicua: null, puntosTranca: 20, puntosPasoATodos: 30 },
  },
  {
    id: 't-3',
    nombre: 'Copa Fundadores — junio',
    estado: 'finalizado',
    visibilidad: 'publico',
    fechaInicio: horas(-720),
    fechaFin: horas(-600),
    cuotaMonto: 0,
    moneda: 'DOP',
    politicaReembolso: null,
    infoHtml: null,
    reglamentoPdfUrl: null,
    reglamentoPdfNombre: null,
    puntosObjetivo: 150,
    tieneFaseInicial: true,
    maxEquipos: 8,
    eloMin: null,
    eloMax: null,
    campos: [],
    fases: [
      { id: 'h1', tipo: 'inicial', orden: 0, nombre: 'Fase de grupos', puntosObjetivo: 100, ventanaInicio: horas(-720), ventanaFin: horas(-670), estado: 'finalizada', clasificanN: 4, metrica: 'puntos' },
      { id: 'h2', tipo: 'eliminatoria', orden: 1, nombre: 'Semifinal', puntosObjetivo: 150, ventanaInicio: horas(-660), ventanaFin: horas(-650), estado: 'finalizada', clasificanN: 2, metrica: 'puntos' },
      { id: 'h3', tipo: 'eliminatoria', orden: 2, nombre: 'Final', puntosObjetivo: 200, ventanaInicio: horas(-610), ventanaFin: horas(-600), estado: 'finalizada', clasificanN: null, metrica: 'puntos' },
    ],
    equipos: [
      { id: 'e9', nombre: 'Los Campeones', jugador1Username: 'domino_pro', jugador2Username: 'reina_de_picas', estado: 'campeon', eloTorneo: 1180, puntos: 340, victorias: 5, derrotas: 0, capicuas: 3, tranques: 1, codigoEquipo: 'CMP01A' },
    ],
    miEquipoId: null,
    reglasOverride: { tiempoLimiteJugadaMs: 20000, puntosCapicua: 30, puntosTranca: 30, puntosPasoATodos: 30 },
  },
];

const LATENCIA_MS = 250;
function delay<T>(v: T): Promise<T> {
  return new Promise(res => setTimeout(() => res(v), LATENCIA_MS));
}

export async function listarTorneos(): Promise<Torneo[]> {
  return delay(TORNEOS);
}

export async function obtenerTorneo(id: string): Promise<Torneo | null> {
  return delay(TORNEOS.find(t => t.id === id) ?? null);
}

export async function crearEquipo(
  torneoId: string,
  datos: { nombreEquipo: string; respuestas: Record<string, string> },
): Promise<{ equipo: Equipo; requierePago: boolean }> {
  const t = TORNEOS.find(x => x.id === torneoId)!;
  const codigo = Math.random().toString(36).slice(2, 8).toUpperCase();
  const equipo: Equipo = {
    id: `e-mock-${Date.now()}`,
    nombre: datos.nombreEquipo || null,
    jugador1Username: 'vos', // en real: el usuario logueado
    jugador2Username: null,
    estado: t.cuotaMonto > 0 ? 'pendiente_pago' : 'pendiente_companero',
    eloTorneo: 1000, puntos: 0, victorias: 0, derrotas: 0, capicuas: 0, tranques: 0,
    codigoEquipo: codigo,
  };
  t.equipos.push(equipo);
  t.miEquipoId = equipo.id;
  return delay({ equipo, requierePago: t.cuotaMonto > 0 });
}

/** Simula el retorno de AZUL: siempre "aprobado" en el mock. */
export async function simularPago(torneoId: string, equipoId: string): Promise<Equipo> {
  const t = TORNEOS.find(x => x.id === torneoId)!;
  const eq = t.equipos.find(e => e.id === equipoId)!;
  eq.estado = 'pendiente_companero';
  return delay(eq);
}

export async function unirseConCodigo(
  torneoId: string,
  codigo: string,
  _respuestas: Record<string, string>,
): Promise<Equipo | { error: string }> {
  const t = TORNEOS.find(x => x.id === torneoId)!;
  const eq = t.equipos.find(e => e.codigoEquipo === codigo);
  if (!eq) return delay({ error: 'No encontramos ningún equipo con ese código.' });
  if (eq.estado === 'completo') return delay({ error: 'Ese equipo ya está completo.' });
  eq.jugador2Username = 'vos';
  eq.estado = 'completo';
  t.miEquipoId = eq.id;
  return delay(eq);
}


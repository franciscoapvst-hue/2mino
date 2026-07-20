import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import {
  crearPartida, aplicarJugada, aplicarPase, aplicarTomar, marcarListo, aplicarAbandono, vistaPublica, equipoDe,
  PUNTOS_PASO_A_TODOS, PUNTOS_CAPICUA,
} from '../game/logic';
import type { PartidaState, Pieza } from '../game/logic';
import { aplicarEloRanked } from './ranked';
import { resolverTurnosBotConDelay } from '../game/bots';
import type { MovimientoBot } from '../game/bots';
import { getRegla, limiteJugadaMsDe } from '../game/reglas';
import { avisarPartidaActualizada } from '../http';

const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

const PartidaPublicaSchema = {
  type: 'object',
  additionalProperties: true,
} as const;

// ── Helpers de acceso a datos ──────────────────────
async function getJuegoActivo(salaId: string) {
  const { rows } = await pool.query(
    `SELECT * FROM juegos WHERE sala_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [salaId],
  );
  return rows[0] ?? null;
}

function parsePartida(row: { partida: string }): PartidaState {
  return JSON.parse(row.partida) as PartidaState;
}

async function guardarPartida(juegoId: string, salaId: string, partida: PartidaState) {
  // La sala solo se finaliza cuando la PARTIDA completa termina (alguien
  // alcanzó el objetivo); entre manos sigue en juego.
  const terminada = partida.fase === 'fin_partida';
  await pool.query(
    `UPDATE juegos SET partida = $1, estado = $2, updated_at = NOW() WHERE id = $3`,
    [JSON.stringify(partida), terminada ? 'terminado' : 'jugando', juegoId],
  );
  // Requiere que el/los movimiento(s) de esta jugada ya estén guardados
  // (ver guardarMovimiento) — necesita su `turno` para anclar el punto.
  try {
    await guardarPuntos(salaId, partida);
  } catch (e) {
    console.error('Error guardando partida_puntos:', e);
  }
  if (terminada) {
    await pool.query(
      `UPDATE salas SET estado = 'finalizada', finished_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [salaId],
    );
    // ELO solo en salas ranked (la función lo verifica y es idempotente).
    // Un fallo aquí no debe tumbar la jugada ya guardada.
    try {
      await aplicarEloRanked(salaId, partida);
    } catch (e) {
      console.error('Error aplicando ELO ranked:', e);
    }
    // Historial (docs/CASOS_DE_USO_SOCIAL.md §5.4) — idempotente igual que
    // el ELO (ON CONFLICT DO NOTHING + UNIQUE(sala_id, usuario_id)).
    try {
      await guardarResultados(salaId, partida);
    } catch (e) {
      console.error('Error guardando partida_resultados:', e);
    }
  }
  // Un solo punto de aviso para todo lo que persiste un cambio de estado
  // (jugar/pasar/listo/abandonar y cada paso de bot resuelto en segundo
  // plano) — todos pasan por acá, no hace falta repetir la llamada en cada ruta.
  avisarPartidaActualizada(salaId);
}

// ── Historial: resultado agregado por jugador (docs §5.1/§5.4) ──────
async function guardarResultados(salaId: string, partida: PartidaState) {
  if (partida.equipoGanadorPartida === null) return; // abandono ya cerró distinto; no debería pasar acá
  const { rows: salaRows } = await pool.query('SELECT tipo FROM salas WHERE id = $1', [salaId]);
  const tipoSala = salaRows[0]?.tipo === 'ranked' ? 'ranked' : 'casual';

  for (let seat = 0; seat < partida.asientos.length; seat++) {
    const a = partida.asientos[seat];
    const equipo = equipoDe(seat);
    const rival = equipo === 0 ? 1 : 0;
    await pool.query(
      `INSERT INTO partida_resultados
        (sala_id, usuario_id, equipo, gano, tipo_sala, capicua,
         tranques_ganados, tranques_perdidos, puntos_favor, puntos_contra)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (sala_id, usuario_id) DO NOTHING`,
      [
        salaId, a.usuario_id, equipo, equipo === partida.equipoGanadorPartida, tipoSala,
        partida.capicuasPorEquipo[equipo] > 0,
        partida.trancasPorEquipo[equipo],
        partida.trancasPorEquipo[rival],
        partida.marcador[equipo],
        partida.marcador[rival],
      ],
    );
  }
}

// ── Log de movimientos para el replay (docs §5.1/§5.3) ──────────────
type MovimientoInput = {
  numeroMano: number;
  seat:       number;
  tipo:       'jugar' | 'pasar';
  pieza:      Pieza | null;
  lado:       'izq' | 'der' | null;
};

async function guardarMovimiento(salaId: string, m: MovimientoInput) {
  // Volumen bajo (una partida a 100 puntos son pocas decenas de jugadas);
  // no hace falta llevar un contador en PartidaState, una query de más
  // por jugada es despreciable frente al UPDATE que ya se hace a `juegos`.
  // `orden` resetea por mano (numero_mano, orden); `turno` NO resetea —
  // es el número de jugada corto a lo largo de TODA la partida, para
  // poder referenciarlo desde partida_puntos sin usar el UUID largo.
  const { rows } = await pool.query(
    `SELECT
       COALESCE(MAX(orden) FILTER (WHERE numero_mano = $2), -1) + 1 AS next_orden,
       COALESCE(MAX(turno), 0) + 1 AS next_turno
     FROM partida_movimientos WHERE sala_id = $1`,
    [salaId, m.numeroMano],
  );
  await pool.query(
    `INSERT INTO partida_movimientos (sala_id, numero_mano, orden, turno, seat, tipo, pieza_a, pieza_b, lado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [salaId, m.numeroMano, rows[0].next_orden, rows[0].next_turno, m.seat, m.tipo, m.pieza?.a ?? null, m.pieza?.b ?? null, m.lado],
  );
}

async function guardarMovimientos(salaId: string, movimientos: (MovimientoInput | MovimientoBot)[]) {
  // Secuencial (no Promise.all): el `orden`/`turno` de cada uno depende de
  // haber visto ya los INSERTs anteriores de esta misma tanda.
  for (const m of movimientos) await guardarMovimiento(salaId, m);
}

// ── Ledger de puntos (turno = partida_movimientos.turno) ────────────
// Se llama SIEMPRE que se persiste el estado de la partida (guardarPartida)
// — solo inserta algo si esta jugada cerró una mano (resultadoMano) o
// disparó el bonus "pasó a todos" (ultimoEvento). Idempotente por sí sola
// (UNIQUE(sala_id, turno, tipo) + ON CONFLICT DO NOTHING): guardarPartida
// puede llamarse varias veces con el mismo resultadoMano sin duplicar fila.
async function guardarPuntos(salaId: string, partida: PartidaState) {
  const r = partida.resultadoMano;
  const evento = partida.ultimoEvento;
  const hayBonus = evento?.tipo === 'paso_a_todos';
  if (!r && !hayBonus) return;

  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(turno), 0) AS turno FROM partida_movimientos WHERE sala_id = $1`,
    [salaId],
  );
  const turno = rows[0].turno;

  if (r) {
    const equipo = r.tipo === 'tranca' ? r.equipoGanador : equipoDe(r.ganadorSeat);
    const noCaben = r.tipo === 'capicua' && !!r.noCaben;
    await pool.query(
      `INSERT INTO partida_puntos
         (sala_id, numero_mano, turno, tipo, equipo, puntos, no_caben, marcador_0, marcador_1)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (sala_id, turno, tipo) DO NOTHING`,
      [salaId, partida.numeroMano, turno, r.tipo, equipo, r.puntos, noCaben, partida.marcador[0], partida.marcador[1]],
    );
  }

  if (evento?.tipo === 'paso_a_todos') {
    const equipo = equipoDe(evento.seat);
    await pool.query(
      `INSERT INTO partida_puntos
         (sala_id, numero_mano, turno, tipo, equipo, puntos, no_caben, marcador_0, marcador_1)
       VALUES ($1,$2,$3,'paso_a_todos',$4,$5,$6,$7,$8)
       ON CONFLICT (sala_id, turno, tipo) DO NOTHING`,
      [salaId, partida.numeroMano, turno, equipo, PUNTOS_PASO_A_TODOS, evento.noCaben, partida.marcador[0], partida.marcador[1]],
    );
  }
}

// Un juego a la vez resolviendo bots en segundo plano — sin este guard, una
// jugada del humano y el polling de GET /juego (que también dispara esto
// como red de seguridad) podrían arrancar dos cadenas de resolución en
// paralelo para el mismo juego, cada una escribiendo su propia versión del
// estado y pisándose entre sí.
const resolucionesEnCurso = new Set<string>();

// Dispara la resolución de los bots en segundo plano (no bloquea la
// respuesta al humano que acaba de jugar) y persiste cada paso intermedio
// con su delay — así el polling del cliente (cada 2s) los va mostrando de
// a uno en vez de saltar directo al estado final. No-op si no hay nada
// pendiente, o si ya hay una resolución en curso para este juego.
export function resolverBotsEnSegundoPlano(juegoId: string, salaId: string, partida: PartidaState) {
  if (resolucionesEnCurso.has(juegoId)) return;
  resolucionesEnCurso.add(juegoId);
  resolverTurnosBotConDelay(partida, async (p, m) => {
    if (m) await guardarMovimiento(salaId, m);
    await guardarPartida(juegoId, salaId, p);
  })
    .catch(e => console.error('Error resolviendo turnos de bot:', e))
    .finally(() => resolucionesEnCurso.delete(juegoId));
}

export async function juegosRoutes(app: FastifyInstance) {

  // ── POST /salas/:id/juego/iniciar ────────────────
  app.post<{
    Params: { id: string };
    Body:   { solicitante_id: string };
  }>('/salas/:id/juego/iniciar', {
    schema: {
      tags:    ['juego'],
      summary: 'Reparte fichas e inicia la partida (solo el creador)',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['solicitante_id'],
        properties: { solicitante_id: { type: 'string', format: 'uuid' } },
      },
      response: {
        201: { ...PartidaPublicaSchema },
        400: { ...ErrorSchema },
        403: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params;
    const { solicitante_id } = req.body;

    const { rows: salaRows } = await pool.query('SELECT * FROM salas WHERE id = $1', [id]);
    if (!salaRows.length) return reply.code(404).send({ error: 'Sala no encontrada' });
    const sala = salaRows[0];

    if (sala.creador_id !== solicitante_id) {
      return reply.code(403).send({ error: 'Solo el creador puede iniciar la partida' });
    }
    if (sala.estado !== 'esperando') {
      return reply.code(400).send({ error: 'La sala no está esperando jugadores' });
    }

    const { rows: jugadores } = await pool.query(
      'SELECT usuario_id, username, posicion FROM sala_jugadores WHERE sala_id = $1 ORDER BY posicion',
      [id],
    );
    if (jugadores.length !== sala.max_jugadores) {
      return reply.code(400).send({ error: `Se necesitan ${sala.max_jugadores} jugadores para iniciar` });
    }

    // Objetivo de puntos definido al crear la sala (100/150/200 por defecto,
    // configurable desde el Back Office vía reglas_juego.puntos_objetivo)
    const config = typeof sala.config === 'string' ? JSON.parse(sala.config) : (sala.config ?? {});
    const opcionesObjetivo = getRegla('puntos_objetivo', [100, 150, 200]);
    const objetivo = opcionesObjetivo.includes(config.puntosObjetivo) ? config.puntosObjetivo : opcionesObjetivo[0];

    const partida = crearPartida(
      jugadores, objetivo, getRegla('puntos_capicua', PUNTOS_CAPICUA),
      limiteJugadaMsDe(sala.tipo === 'ranked' ? 'ranked' : 'casual'),
      getRegla('delay_fin_mano_ms', 2000),
    );

    await pool.query(
      `INSERT INTO juegos (sala_id, partida) VALUES ($1, $2)`,
      [id, JSON.stringify(partida)],
    );

    await pool.query(
      `UPDATE salas SET estado = 'en_juego', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );

    return reply.code(201).send(vistaPublica(partida, solicitante_id));
  });

  // ── GET /salas/:id/juego ──────────────────────────
  app.get<{
    Params: { id: string };
    Querystring: { usuario_id: string };
  }>('/salas/:id/juego', {
    schema: {
      tags:    ['juego'],
      summary: 'Estado actual de la partida (vista enmascarada por jugador)',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      querystring: {
        type: 'object',
        required: ['usuario_id'],
        properties: { usuario_id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...PartidaPublicaSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const juego = await getJuegoActivo(req.params.id);
    if (!juego) return reply.code(404).send({ error: 'No hay partida para esta sala' });
    const partida = parsePartida(juego);
    // Red de seguridad: por si el turno quedó en un bot sin resolver (ej.
    // el servidor se reinició a mitad de una tanda). Usa el mismo resolutor
    // con delay y con guard de concurrencia que jugar/pasar/listo — si no,
    // el polling del cliente (cada 2s) pisaría el delay resolviendo todo
    // de una en cuanto la ventana de 1.5s todavía estuviera abierta. Si no
    // hay nada pendiente (el caso normal) es un no-op inmediato.
    resolverBotsEnSegundoPlano(juego.id, juego.sala_id, partida);
    return reply.send(vistaPublica(partida, req.query.usuario_id));
  });

  // ── POST /salas/:id/juego/jugar ───────────────────
  app.post<{
    Params: { id: string };
    Body:   { usuario_id: string; pieza: Pieza; lado?: 'izq' | 'der' };
  }>('/salas/:id/juego/jugar', {
    schema: {
      tags:    ['juego'],
      summary: 'Jugar una ficha',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['usuario_id', 'pieza'],
        properties: {
          usuario_id: { type: 'string', format: 'uuid' },
          pieza: {
            type: 'object',
            required: ['a', 'b'],
            properties: { a: { type: 'integer', minimum: 0, maximum: 6 }, b: { type: 'integer', minimum: 0, maximum: 6 } },
          },
          lado: { type: 'string', enum: ['izq', 'der'] },
        },
      },
      response: {
        200: { ...PartidaPublicaSchema },
        400: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const juego = await getJuegoActivo(req.params.id);
    if (!juego) return reply.code(404).send({ error: 'No hay partida para esta sala' });

    const partida = parsePartida(juego);
    const { usuario_id, pieza, lado } = req.body;
    const seat = partida.asientos.findIndex(a => a.usuario_id === usuario_id);
    const numeroManoAntes = partida.numeroMano;
    const resultado = aplicarJugada(partida, usuario_id, pieza, lado);

    if (!resultado.ok) return reply.code(400).send({ error: resultado.error });

    const movimientos: MovimientoInput[] = seat === -1 ? [] : [{
      numeroMano: numeroManoAntes, seat, tipo: 'jugar', pieza,
      lado: resultado.partida.ultimaJugada?.lado ?? null,
    }];
    await guardarMovimientos(juego.sala_id, movimientos);
    await guardarPartida(juego.id, juego.sala_id, resultado.partida);
    resolverBotsEnSegundoPlano(juego.id, juego.sala_id, resultado.partida);
    return reply.send(vistaPublica(resultado.partida, usuario_id));
  });

  // ── POST /salas/:id/juego/pasar ───────────────────
  app.post<{
    Params: { id: string };
    Body:   { usuario_id: string };
  }>('/salas/:id/juego/pasar', {
    schema: {
      tags:    ['juego'],
      summary: 'Pasar el turno (solo si no hay ficha jugable)',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['usuario_id'],
        properties: { usuario_id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...PartidaPublicaSchema },
        400: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const juego = await getJuegoActivo(req.params.id);
    if (!juego) return reply.code(404).send({ error: 'No hay partida para esta sala' });

    const partida = parsePartida(juego);
    const seat = partida.asientos.findIndex(a => a.usuario_id === req.body.usuario_id);
    const numeroManoAntes = partida.numeroMano;
    const resultado = aplicarPase(partida, req.body.usuario_id);

    if (!resultado.ok) return reply.code(400).send({ error: resultado.error });

    const movimientos: MovimientoInput[] = seat === -1 ? [] : [{
      numeroMano: numeroManoAntes, seat, tipo: 'pasar', pieza: null, lado: null,
    }];
    await guardarMovimientos(juego.sala_id, movimientos);
    await guardarPartida(juego.id, juego.sala_id, resultado.partida);
    resolverBotsEnSegundoPlano(juego.id, juego.sala_id, resultado.partida);
    return reply.send(vistaPublica(resultado.partida, req.body.usuario_id));
  });

  // ── POST /salas/:id/juego/tomar ───────────────────
  // Toma UNA ficha del pozo (1vs1, docs/PENDIENTES_JUEGO.md §3) — no
  // avanza el turno; el cliente decide si tomar de nuevo (llamando otra
  // vez) según si la ficha que le tocó es jugable o no. No se loguea en
  // partida_movimientos (no hay narración de "robó" en el replay, mismo
  // criterio simplificado que ya se usaba antes de este endpoint).
  app.post<{
    Params: { id: string };
    Body:   { usuario_id: string };
  }>('/salas/:id/juego/tomar', {
    schema: {
      tags:    ['juego'],
      summary: 'Tomar una ficha del pozo (1vs1, solo si no hay ficha jugable)',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['usuario_id'],
        properties: { usuario_id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...PartidaPublicaSchema },
        400: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const juego = await getJuegoActivo(req.params.id);
    if (!juego) return reply.code(404).send({ error: 'No hay partida para esta sala' });

    const partida = parsePartida(juego);
    const resultado = aplicarTomar(partida, req.body.usuario_id);
    if (!resultado.ok) return reply.code(400).send({ error: resultado.error });

    await guardarPartida(juego.id, juego.sala_id, resultado.partida);
    resolverBotsEnSegundoPlano(juego.id, juego.sala_id, resultado.partida);
    return reply.send(vistaPublica(resultado.partida, req.body.usuario_id));
  });

  // ── POST /salas/:id/juego/listo ───────────────────
  app.post<{
    Params: { id: string };
    Body:   { usuario_id: string };
  }>('/salas/:id/juego/listo', {
    schema: {
      tags:    ['juego'],
      summary: 'Confirmar listo para la siguiente mano (reparte cuando todos confirman)',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['usuario_id'],
        properties: { usuario_id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...PartidaPublicaSchema },
        400: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const juego = await getJuegoActivo(req.params.id);
    if (!juego) return reply.code(404).send({ error: 'No hay partida para esta sala' });

    const partida = parsePartida(juego);
    const resultado = marcarListo(partida, req.body.usuario_id);

    if (!resultado.ok) return reply.code(400).send({ error: resultado.error });

    await guardarPartida(juego.id, juego.sala_id, resultado.partida);
    resolverBotsEnSegundoPlano(juego.id, juego.sala_id, resultado.partida);
    return reply.send(vistaPublica(resultado.partida, req.body.usuario_id));
  });

  // ── POST /salas/:id/juego/abandonar ───────────────
  // El jugador deja la partida: termina como derrota suya. guardarPartida
  // finaliza la sala y (si es ranked) aplica el ELO del equipo rival.
  app.post<{
    Params: { id: string };
    Body:   { usuario_id: string };
  }>('/salas/:id/juego/abandonar', {
    schema: {
      tags:    ['juego'],
      summary: 'Abandonar la partida (cuenta como derrota; aplica ELO en ranked)',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['usuario_id'],
        properties: { usuario_id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...PartidaPublicaSchema },
        400: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const juego = await getJuegoActivo(req.params.id);
    if (!juego) return reply.code(404).send({ error: 'No hay partida para esta sala' });

    const partida = parsePartida(juego);
    const resultado = aplicarAbandono(partida, req.body.usuario_id);

    if (!resultado.ok) return reply.code(400).send({ error: resultado.error });

    await guardarPartida(juego.id, juego.sala_id, resultado.partida);
    return reply.send(vistaPublica(resultado.partida, req.body.usuario_id));
  });
}

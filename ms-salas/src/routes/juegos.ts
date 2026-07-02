import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import {
  crearPartida, aplicarJugada, aplicarPase, marcarListo, vistaPublica,
} from '../game/logic';
import type { PartidaState, Pieza } from '../game/logic';
import { aplicarEloRanked } from './ranked';

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
  }
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

    // Objetivo de puntos definido al crear la sala (100/150/200)
    const config = typeof sala.config === 'string' ? JSON.parse(sala.config) : (sala.config ?? {});
    const objetivo = [100, 150, 200].includes(config.puntosObjetivo) ? config.puntosObjetivo : 100;

    const partida = crearPartida(jugadores, objetivo);

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
    const resultado = aplicarJugada(partida, usuario_id, pieza, lado);

    if (!resultado.ok) return reply.code(400).send({ error: resultado.error });

    await guardarPartida(juego.id, juego.sala_id, resultado.partida);
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
    const resultado = aplicarPase(partida, req.body.usuario_id);

    if (!resultado.ok) return reply.code(400).send({ error: resultado.error });

    await guardarPartida(juego.id, juego.sala_id, resultado.partida);
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
    return reply.send(vistaPublica(resultado.partida, req.body.usuario_id));
  });
}

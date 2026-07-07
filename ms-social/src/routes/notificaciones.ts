import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { obtenerUsuario, obtenerSalaPorCodigo } from '../http';
import { enviarA } from '../presencia';

const ErrorSchema = { type: 'object', properties: { error: { type: 'string' } } } as const;
const AnySchema    = { type: 'object', additionalProperties: true } as const;

export async function notificacionesRoutes(app: FastifyInstance) {

  // ── GET /notificaciones ────────────────────────────
  app.get<{ Querystring: { usuario_id: string; limit?: number } }>('/notificaciones', {
    schema: {
      tags: ['social'], summary: 'Bandeja de entrada, más recientes primero',
      querystring: {
        type: 'object', required: ['usuario_id'],
        properties: {
          usuario_id: { type: 'string', format: 'uuid' },
          limit:      { type: 'integer', minimum: 1, maximum: 100, default: 30 },
        },
      },
      response: { 200: { type: 'array', items: AnySchema } },
    },
  }, async (req, reply) => {
    const { usuario_id, limit = 30 } = req.query;
    const { rows } = await pool.query(
      `SELECT id, tipo, de_usuario_id, de_username, de_avatar, payload, leida, created_at
       FROM notificaciones WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [usuario_id, limit],
    );
    return reply.send(rows);
  });

  // ── POST /notificaciones/:id/leer ──────────────────
  app.post<{ Params: { id: string }; Body: { usuario_id: string } }>(
    '/notificaciones/:id/leer', {
      schema: {
        tags: ['social'], summary: 'Marcar una notificación como leída',
        params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
        body: {
          type: 'object', required: ['usuario_id'],
          properties: { usuario_id: { type: 'string', format: 'uuid' } },
        },
        response: { 200: AnySchema },
      },
    }, async (req, reply) => {
      await pool.query(
        'UPDATE notificaciones SET leida = true WHERE id = $1 AND usuario_id = $2',
        [req.params.id, req.body.usuario_id],
      );
      return reply.send({ ok: true });
    },
  );

  // ── GET /notificaciones/no-leidas/count ────────────
  app.get<{ Querystring: { usuario_id: string } }>('/notificaciones/no-leidas/count', {
    schema: {
      tags: ['social'], summary: 'Cantidad de notificaciones sin leer (badge de campana)',
      querystring: {
        type: 'object', required: ['usuario_id'],
        properties: { usuario_id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: AnySchema },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notificaciones WHERE usuario_id = $1 AND leida = false',
      [req.query.usuario_id],
    );
    return reply.send({ count: rows[0].count });
  });

  // ── POST /invitar-partida ──────────────────────────
  // §3 del doc: reusa el mecanismo de invite-por-código que ya existe en
  // ms-salas (sala.codigo / ranked_parties.codigo) — esto solo agrega un
  // canal de entrega directo (notificación + push si está online).
  app.post<{ Body: { usuario_id: string; a_usuario_id: string; sala_codigo?: string; party_codigo?: string } }>(
    '/invitar-partida', {
      schema: {
        tags: ['social'], summary: 'Invitar a un amigo a una sala o party por código',
        body: {
          type: 'object', required: ['usuario_id', 'a_usuario_id'],
          properties: {
            usuario_id:   { type: 'string', format: 'uuid' },
            a_usuario_id: { type: 'string', format: 'uuid' },
            sala_codigo:  { type: 'string' },
            party_codigo: { type: 'string' },
          },
        },
        response: { 201: AnySchema, 400: { ...ErrorSchema }, 404: { ...ErrorSchema } },
      },
    }, async (req, reply) => {
      const { usuario_id, a_usuario_id, sala_codigo, party_codigo } = req.body;
      if (!sala_codigo && !party_codigo) {
        return reply.code(400).send({ error: 'Falta sala_codigo o party_codigo' });
      }

      // Confirma amistad (no se invita a cualquiera).
      const a = usuario_id < a_usuario_id ? usuario_id : a_usuario_id;
      const b = usuario_id < a_usuario_id ? a_usuario_id : usuario_id;
      const { rows: amigos } = await pool.query(
        'SELECT 1 FROM amigos WHERE usuario_id_a = $1 AND usuario_id_b = $2', [a, b],
      );
      if (!amigos.length) return reply.code(400).send({ error: 'Solo podés invitar a amigos' });

      // Si es invitación a sala (no party), confirma que sigue "esperando"
      // antes de notificar — evita invitar a algo que ya cerró.
      if (sala_codigo) {
        const sala = await obtenerSalaPorCodigo(sala_codigo);
        if (!sala || sala.estado !== 'esperando') {
          return reply.code(404).send({ error: 'La sala ya no acepta jugadores' });
        }
      }

      const remitente = await obtenerUsuario(usuario_id);
      const payload = sala_codigo ? { sala_codigo } : { party_codigo };
      await pool.query(
        `INSERT INTO notificaciones (usuario_id, tipo, de_usuario_id, de_username, de_avatar, payload)
         VALUES ($1, 'invitacion_partida', $2, $3, $4, $5)`,
        [a_usuario_id, usuario_id, remitente?.username ?? '(usuario)', remitente?.avatar ?? null, JSON.stringify(payload)],
      );
      enviarA(a_usuario_id, { tipo: 'notificacion_nueva' });

      return reply.code(201).send({ ok: true });
    },
  );
}

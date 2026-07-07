import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';

const AnySchema = { type: 'object', additionalProperties: true } as const;

export async function chatRoutes(app: FastifyInstance) {

  // ── GET /chat/:salaId ──────────────────────────────
  // Historial al entrar a la sala, antes de que el WS empiece a emitir
  // mensajes nuevos — paginado hacia atrás por created_at.
  app.get<{ Params: { salaId: string }; Querystring: { antes?: string; limit?: number } }>(
    '/chat/:salaId', {
      schema: {
        tags: ['social'], summary: 'Historial de mensajes de una sala',
        params: { type: 'object', properties: { salaId: { type: 'string', format: 'uuid' } } },
        querystring: {
          type: 'object',
          properties: {
            antes: { type: 'string', format: 'date-time' },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
        response: { 200: { type: 'array', items: AnySchema } },
      },
    }, async (req, reply) => {
      const { salaId } = req.params;
      const { antes, limit = 50 } = req.query;
      const params: unknown[] = [salaId];
      let filtro = '';
      if (antes) { params.push(antes); filtro = `AND created_at < $${params.length}`; }
      params.push(limit);

      const { rows } = await pool.query(
        `SELECT id, usuario_id, username, mensaje, created_at
         FROM chat_mensajes WHERE sala_id = $1 ${filtro}
         ORDER BY created_at DESC LIMIT $${params.length}`,
        params,
      );
      return reply.send(rows.reverse()); // orden cronológico para pintar directo
    },
  );
}

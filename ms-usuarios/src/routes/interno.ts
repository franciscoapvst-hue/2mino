import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';

// ── Rutas internas de ms-usuarios, solo llamadas por otros microservicios
// (nunca por el gateway ni el cliente) — mismo principio que
// ms-social/routes/interno.ts: viven detrás de la red Docker interna, sin
// JWT (no hay usuario del otro lado, es servicio-a-servicio).
export async function internoRoutes(app: FastifyInstance) {

  // ── POST /interno/billetera/:usuarioId/otorgar ──────
  // Acredita doblones ganados jugando (docs/PLAN_COSMETICOS.md Etapa 2),
  // llamado fire-and-forget por ms-salas al cerrar una partida. Idempotente
  // por (usuario_id, motivo, ref) vía el índice único parcial de
  // billetera_movimientos: otorgar dos veces por la misma partida
  // (ref = sala_id) o el mismo día (ref = YYYY-MM-DD) no duplica el saldo.
  // `ref` es obligatorio acá justamente para que esa idempotencia siempre
  // aplique (a diferencia de 'ajuste_admin', que va sin ref por diseño).
  app.post<{
    Params: { usuarioId: string };
    Body:   { monto: number; motivo: string; ref: string };
  }>('/interno/billetera/:usuarioId/otorgar', {
    schema: {
      tags:    ['system'],
      summary: 'Acredita doblones al cerrar partida (interno, idempotente por motivo+ref)',
      params: {
        type: 'object',
        properties: { usuarioId: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['monto', 'motivo', 'ref'],
        properties: {
          monto:  { type: 'integer', minimum: 1 },
          motivo: { type: 'string', minLength: 1, maxLength: 30 },
          ref:    { type: 'string', minLength: 1, maxLength: 60 },
        },
      },
      response: {
        200: {
          description: 'Saldo tras acreditar (o el actual, si ya se había acreditado)',
          type: 'object',
          properties: {
            saldo:    { type: 'integer' },
            otorgado: { type: 'boolean' }, // false = ya existía ese movimiento (no-op idempotente)
          },
        },
      },
    },
  }, async (req, reply) => {
    const { usuarioId } = req.params;
    const { monto, motivo, ref } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO billeteras (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [usuarioId],
      );
      // El movimiento y el saldo se mueven JUNTOS: el UPDATE del saldo solo
      // corre si el INSERT del movimiento realmente insertó (no fue un
      // duplicado). El CTE lo hace atómico — si esto se reintenta con el
      // mismo (usuario, motivo, ref), el ON CONFLICT no inserta, EXISTS(ins)
      // es false, y el saldo no se toca (se devuelve el actual).
      const { rows } = await client.query(
        `WITH ins AS (
           INSERT INTO billetera_movimientos (usuario_id, monto, motivo, ref)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (usuario_id, motivo, ref) WHERE ref IS NOT NULL DO NOTHING
           RETURNING id
         ),
         upd AS (
           UPDATE billeteras SET saldo = saldo + $2, updated_at = NOW()
           WHERE usuario_id = $1 AND EXISTS (SELECT 1 FROM ins)
           RETURNING saldo
         )
         SELECT
           COALESCE(
             (SELECT saldo FROM upd),
             (SELECT saldo FROM billeteras WHERE usuario_id = $1)
           ) AS saldo,
           EXISTS (SELECT 1 FROM ins) AS otorgado`,
        [usuarioId, monto, motivo, ref],
      );
      await client.query('COMMIT');
      return reply.send({ saldo: rows[0].saldo, otorgado: rows[0].otorgado });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}

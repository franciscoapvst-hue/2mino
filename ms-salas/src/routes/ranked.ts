import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { deltaElo, eloEquipo, ELO_INICIAL } from '../game/elo';
import { equipoDe } from '../game/logic';
import type { PartidaState } from '../game/logic';

const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

const RatingSchema = {
  type: 'object',
  additionalProperties: true,
} as const;

// ── Aplicación del ELO al terminar una partida ranked ───────────────
// Idempotente: UNIQUE(usuario_id, sala_id) en historial + chequeo previo.
// Transacción con FOR UPDATE para evitar carreras entre cierres.
export async function aplicarEloRanked(salaId: string, partida: PartidaState): Promise<void> {
  if (partida.fase !== 'fin_partida' || partida.equipoGanadorPartida === null) return;

  const { rows: salaRows } = await pool.query('SELECT tipo FROM salas WHERE id = $1', [salaId]);
  if (salaRows[0]?.tipo !== 'ranked') return;

  const { rows: ya } = await pool.query(
    'SELECT 1 FROM ranked_historial WHERE sala_id = $1 LIMIT 1', [salaId]);
  if (ya.length) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Asegurar fila de rating para cada jugador (arranca en ELO_INICIAL)
    for (const a of partida.asientos) {
      await client.query(
        `INSERT INTO ranked_ratings (usuario_id, username, elo)
         VALUES ($1, $2, $3)
         ON CONFLICT (usuario_id) DO UPDATE SET username = EXCLUDED.username`,
        [a.usuario_id, a.username, ELO_INICIAL],
      );
    }

    const ids = partida.asientos.map(a => a.usuario_id);
    const { rows: ratings } = await client.query(
      'SELECT usuario_id, elo FROM ranked_ratings WHERE usuario_id = ANY($1) FOR UPDATE',
      [ids],
    );
    const eloDe = new Map<string, number>(ratings.map(r => [r.usuario_id, r.elo]));

    const ganador  = partida.equipoGanadorPartida;
    const elosDeEq = (eq: 0 | 1) => partida.asientos
      .filter((_, seat) => equipoDe(seat) === eq)
      .map(a => eloDe.get(a.usuario_id) ?? ELO_INICIAL);

    // Delta único por cruce: ELO de equipo = promedio de la pareja
    const delta = deltaElo(
      eloEquipo(elosDeEq(ganador)),
      eloEquipo(elosDeEq(ganador === 0 ? 1 : 0)),
    );

    for (let seat = 0; seat < partida.asientos.length; seat++) {
      const a     = partida.asientos[seat];
      const gano  = equipoDe(seat) === ganador;
      const antes = eloDe.get(a.usuario_id) ?? ELO_INICIAL;
      const despues = Math.max(0, antes + (gano ? delta : -delta));

      await client.query(
        `UPDATE ranked_ratings
         SET elo = $1, partidas = partidas + 1, ganadas = ganadas + $2, updated_at = NOW()
         WHERE usuario_id = $3`,
        [despues, gano ? 1 : 0, a.usuario_id],
      );
      await client.query(
        `INSERT INTO ranked_historial (usuario_id, sala_id, elo_antes, elo_despues, delta, gano)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (usuario_id, sala_id) DO NOTHING`,
        [a.usuario_id, salaId, antes, despues, gano ? delta : -delta, gano],
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── Rutas de consulta ────────────────────────────────────────────────
export async function rankedRoutes(app: FastifyInstance) {

  // ── GET /ranked/leaderboard ───────────────────────
  app.get<{ Querystring: { limit?: number } }>('/ranked/leaderboard', {
    schema: {
      tags:    ['ranked'],
      summary: 'Top de jugadores por ELO',
      querystring: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      },
      response: { 200: { type: 'array', items: RatingSchema } },
    },
  }, async (req, reply) => {
    const limit = req.query.limit ?? 20;
    const { rows } = await pool.query(
      `SELECT usuario_id, username, elo, partidas, ganadas
       FROM ranked_ratings ORDER BY elo DESC, partidas DESC LIMIT $1`,
      [limit],
    );
    return reply.send(rows);
  });

  // ── GET /ranked/:usuario_id ───────────────────────
  // Rating + historial reciente. Usuario sin partidas → default 1000.
  app.get<{ Params: { usuario_id: string } }>('/ranked/:usuario_id', {
    schema: {
      tags:    ['ranked'],
      summary: 'ELO e historial de un usuario',
      params: {
        type: 'object',
        properties: { usuario_id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { ...RatingSchema }, 400: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const { usuario_id } = req.params;
    const [{ rows: rating }, { rows: historial }] = await Promise.all([
      pool.query(
        'SELECT usuario_id, username, elo, partidas, ganadas FROM ranked_ratings WHERE usuario_id = $1',
        [usuario_id],
      ),
      pool.query(
        `SELECT sala_id, elo_antes, elo_despues, delta, gano, created_at
         FROM ranked_historial WHERE usuario_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [usuario_id],
      ),
    ]);

    return reply.send({
      usuario_id,
      elo:      rating[0]?.elo      ?? ELO_INICIAL,
      partidas: rating[0]?.partidas ?? 0,
      ganadas:  rating[0]?.ganadas  ?? 0,
      historial,
    });
  });
}

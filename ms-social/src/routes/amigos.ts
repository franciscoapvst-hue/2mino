import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { obtenerUsuario, obtenerElo } from '../http';
import { estaConectado, enviarA } from '../presencia';

const ErrorSchema = { type: 'object', properties: { error: { type: 'string' } } } as const;
const AnySchema    = { type: 'object', additionalProperties: true } as const;

/** amigos(usuario_id_a, usuario_id_b) exige a < b — normaliza el par. */
function normalizarPar(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function amigosRoutes(app: FastifyInstance) {

  // ── GET /amigos ───────────────────────────────────
  app.get<{ Querystring: { usuario_id: string } }>('/amigos', {
    schema: {
      tags: ['social'], summary: 'Lista de amigos, con presencia (conectado)',
      querystring: {
        type: 'object', required: ['usuario_id'],
        properties: { usuario_id: { type: 'string', format: 'uuid' } },
      },
      response: { 200: { type: 'array', items: AnySchema } },
    },
  }, async (req, reply) => {
    const { usuario_id } = req.query;
    const { rows } = await pool.query(
      'SELECT usuario_id_a, usuario_id_b FROM amigos WHERE usuario_id_a = $1 OR usuario_id_b = $1',
      [usuario_id],
    );
    const amigoIds: string[] = rows.map(r => r.usuario_id_a === usuario_id ? r.usuario_id_b : r.usuario_id_a);

    const amigos = await Promise.all(amigoIds.map(async (id) => {
      const [u, elo] = await Promise.all([obtenerUsuario(id), obtenerElo(id)]);
      return {
        usuario_id: id,
        username:   u?.username ?? '(usuario eliminado)',
        avatar:     u?.avatar ?? null,
        elo,
        conectado:  estaConectado(id),
      };
    }));
    return reply.send(amigos);
  });

  // ── DELETE /amigos/:usuarioId ─────────────────────
  app.delete<{ Params: { usuarioId: string }; Querystring: { usuario_id: string } }>(
    '/amigos/:usuarioId', {
      schema: {
        tags: ['social'], summary: 'Eliminar amistad',
        params: { type: 'object', properties: { usuarioId: { type: 'string', format: 'uuid' } } },
        querystring: {
          type: 'object', required: ['usuario_id'],
          properties: { usuario_id: { type: 'string', format: 'uuid' } },
        },
        response: { 200: AnySchema },
      },
    }, async (req, reply) => {
      const [a, b] = normalizarPar(req.query.usuario_id, req.params.usuarioId);
      await pool.query('DELETE FROM amigos WHERE usuario_id_a = $1 AND usuario_id_b = $2', [a, b]);
      return reply.send({ ok: true });
    },
  );

  // ── POST /solicitudes ──────────────────────────────
  app.post<{ Body: { usuario_id: string; a_usuario_id: string } }>('/solicitudes', {
    schema: {
      tags: ['social'], summary: 'Enviar solicitud de amistad',
      body: {
        type: 'object', required: ['usuario_id', 'a_usuario_id'],
        properties: {
          usuario_id:   { type: 'string', format: 'uuid' },
          a_usuario_id: { type: 'string', format: 'uuid' },
        },
      },
      response: { 201: AnySchema, 400: { ...ErrorSchema }, 409: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const { usuario_id, a_usuario_id } = req.body;
    if (usuario_id === a_usuario_id) {
      return reply.code(400).send({ error: 'No puedes agregarte a ti mismo' });
    }

    const [a, b] = normalizarPar(usuario_id, a_usuario_id);
    const { rows: yaAmigos } = await pool.query(
      'SELECT 1 FROM amigos WHERE usuario_id_a = $1 AND usuario_id_b = $2', [a, b],
    );
    if (yaAmigos.length) return reply.code(409).send({ error: 'Ya son amigos' });

    const { rows: pendiente } = await pool.query(
      `SELECT 1 FROM solicitudes_amistad WHERE estado = 'pendiente'
       AND ((de_usuario_id = $1 AND a_usuario_id = $2) OR (de_usuario_id = $2 AND a_usuario_id = $1))`,
      [usuario_id, a_usuario_id],
    );
    if (pendiente.length) return reply.code(409).send({ error: 'Ya hay una solicitud pendiente con ese usuario' });

    // UPSERT, no INSERT plano: (de_usuario_id, a_usuario_id) es UNIQUE, y
    // si ya existía una solicitud entre este mismo par (rechazada antes,
    // o aceptada y luego se eliminaron como amigos) el INSERT chocaría
    // con la constraint — acá se resetea a pendiente en vez de romper.
    const { rows } = await pool.query(
      `INSERT INTO solicitudes_amistad (de_usuario_id, a_usuario_id, estado, created_at, resuelta_at)
       VALUES ($1, $2, 'pendiente', NOW(), NULL)
       ON CONFLICT (de_usuario_id, a_usuario_id)
       DO UPDATE SET estado = 'pendiente', created_at = NOW(), resuelta_at = NULL
       RETURNING id`,
      [usuario_id, a_usuario_id],
    );

    const remitente = await obtenerUsuario(usuario_id);
    await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo, de_usuario_id, de_username, de_avatar, payload)
       VALUES ($1, 'solicitud_amistad', $2, $3, $4, $5)`,
      [
        a_usuario_id, usuario_id, remitente?.username ?? '(usuario)', remitente?.avatar ?? null,
        JSON.stringify({ solicitud_id: rows[0].id }),
      ],
    );
    enviarA(a_usuario_id, { tipo: 'notificacion_nueva' });

    return reply.code(201).send({ ok: true });
  });

  // ── POST /solicitudes/:id/aceptar ──────────────────
  app.post<{ Params: { id: string }; Body: { usuario_id: string } }>(
    '/solicitudes/:id/aceptar', {
      schema: {
        tags: ['social'], summary: 'Aceptar una solicitud de amistad',
        params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
        body: {
          type: 'object', required: ['usuario_id'],
          properties: { usuario_id: { type: 'string', format: 'uuid' } },
        },
        response: { 200: AnySchema, 400: { ...ErrorSchema }, 403: { ...ErrorSchema }, 404: { ...ErrorSchema } },
      },
    }, async (req, reply) => {
      const { rows } = await pool.query('SELECT * FROM solicitudes_amistad WHERE id = $1', [req.params.id]);
      if (!rows.length) return reply.code(404).send({ error: 'Solicitud no encontrada' });
      const s = rows[0];
      if (s.a_usuario_id !== req.body.usuario_id) {
        return reply.code(403).send({ error: 'No podés resolver esta solicitud' });
      }
      if (s.estado !== 'pendiente') return reply.code(400).send({ error: 'La solicitud ya fue resuelta' });

      const [a, b] = normalizarPar(s.de_usuario_id, s.a_usuario_id);
      await pool.query(
        'INSERT INTO amigos (usuario_id_a, usuario_id_b) VALUES ($1, $2) ON CONFLICT DO NOTHING', [a, b],
      );
      await pool.query(
        `UPDATE solicitudes_amistad SET estado = 'aceptada', resuelta_at = NOW() WHERE id = $1`, [s.id],
      );
      // Saca de la bandeja del que aceptó la notificación de la solicitud
      // original — ya está resuelta, no tiene sentido que siga apareciendo
      // (ni con los botones de aceptar/rechazar ni sin ellos).
      await pool.query(
        `DELETE FROM notificaciones
         WHERE usuario_id = $1 AND tipo = 'solicitud_amistad' AND payload->>'solicitud_id' = $2`,
        [s.a_usuario_id, s.id],
      );

      const aceptador = await obtenerUsuario(s.a_usuario_id);
      await pool.query(
        `INSERT INTO notificaciones (usuario_id, tipo, de_usuario_id, de_username, de_avatar, payload)
         VALUES ($1, 'amistad_aceptada', $2, $3, $4, '{}')`,
        [s.de_usuario_id, s.a_usuario_id, aceptador?.username ?? '(usuario)', aceptador?.avatar ?? null],
      );
      enviarA(s.de_usuario_id, { tipo: 'notificacion_nueva' });

      return reply.send({ ok: true });
    },
  );

  // ── POST /solicitudes/:id/rechazar ─────────────────
  app.post<{ Params: { id: string }; Body: { usuario_id: string } }>(
    '/solicitudes/:id/rechazar', {
      schema: {
        tags: ['social'], summary: 'Rechazar una solicitud de amistad',
        params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
        body: {
          type: 'object', required: ['usuario_id'],
          properties: { usuario_id: { type: 'string', format: 'uuid' } },
        },
        response: { 200: AnySchema, 403: { ...ErrorSchema }, 404: { ...ErrorSchema } },
      },
    }, async (req, reply) => {
      const { rows } = await pool.query('SELECT * FROM solicitudes_amistad WHERE id = $1', [req.params.id]);
      if (!rows.length) return reply.code(404).send({ error: 'Solicitud no encontrada' });
      if (rows[0].a_usuario_id !== req.body.usuario_id) {
        return reply.code(403).send({ error: 'No podés resolver esta solicitud' });
      }
      await pool.query(
        `UPDATE solicitudes_amistad SET estado = 'rechazada', resuelta_at = NOW() WHERE id = $1`,
        [req.params.id],
      );
      // Misma razón que en aceptar: ya está resuelta, que no siga en la bandeja.
      await pool.query(
        `DELETE FROM notificaciones
         WHERE usuario_id = $1 AND tipo = 'solicitud_amistad' AND payload->>'solicitud_id' = $2`,
        [req.body.usuario_id, req.params.id],
      );
      return reply.send({ ok: true });
    },
  );

  // ── POST /estado-relacion ───────────────────────────
  // §6 del doc: para "¿ya somos amigos / hay solicitud pendiente?" de
  // varios usuarios a la vez (ej. todos los rivales del fin de partida),
  // sin un request por-jugador.
  app.post<{ Body: { usuario_id: string; usuario_ids: string[] } }>('/estado-relacion', {
    schema: {
      tags: ['social'], summary: 'Estado de relación con varios usuarios a la vez',
      body: {
        type: 'object', required: ['usuario_id', 'usuario_ids'],
        properties: {
          usuario_id:  { type: 'string', format: 'uuid' },
          usuario_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
      response: { 200: AnySchema },
    },
  }, async (req, reply) => {
    const { usuario_id, usuario_ids } = req.body;
    const out: Record<string, 'amigo' | 'pendiente' | 'ninguno'> = {};
    if (!usuario_ids.length) return reply.send(out);

    const { rows: amigosRows } = await pool.query(
      `SELECT usuario_id_a, usuario_id_b FROM amigos
       WHERE (usuario_id_a = $1 AND usuario_id_b = ANY($2))
          OR (usuario_id_b = $1 AND usuario_id_a = ANY($2))`,
      [usuario_id, usuario_ids],
    );
    const amigoSet = new Set(amigosRows.map(r => r.usuario_id_a === usuario_id ? r.usuario_id_b : r.usuario_id_a));

    const { rows: pendRows } = await pool.query(
      `SELECT de_usuario_id, a_usuario_id FROM solicitudes_amistad
       WHERE estado = 'pendiente' AND (
         (de_usuario_id = $1 AND a_usuario_id = ANY($2)) OR (a_usuario_id = $1 AND de_usuario_id = ANY($2))
       )`,
      [usuario_id, usuario_ids],
    );
    const pendSet = new Set(pendRows.map(r => r.de_usuario_id === usuario_id ? r.a_usuario_id : r.de_usuario_id));

    for (const id of usuario_ids) {
      out[id] = amigoSet.has(id) ? 'amigo' : pendSet.has(id) ? 'pendiente' : 'ninguno';
    }
    return reply.send(out);
  });
}

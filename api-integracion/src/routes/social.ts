import { FastifyInstance } from 'fastify';
import { callSocial, callMs } from '../http';
import { verifyToken } from '../jwt';

const ErrorSchema = { type: 'object', properties: { error: { type: 'string' } } } as const;
const AnySchema    = { type: 'object', additionalProperties: true } as const;

function auth(req: { headers: { authorization?: string } }, reply: { code: (n: number) => any }) {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) { reply.code(401).send({ error: 'Token requerido' }); return null; }
  return payload;
}

export async function socialGatewayRoutes(app: FastifyInstance) {

  // ── Buscar usuarios (autocompletar "agregar amigo") ──

  app.get<{ Querystring: { q: string } }>('/social/buscar-usuarios', {
    schema: {
      tags: ['social'], summary: 'Buscar usuarios por prefijo de username',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object', required: ['q'],
        properties: { q: { type: 'string', minLength: 1, maxLength: 20 } },
      },
      response: { 200: { type: 'array', items: AnySchema }, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    if (!req.query.q?.trim()) return reply.send([]);
    const { status, data } = await callMs(
      `/usuarios/buscar?q=${encodeURIComponent(req.query.q.trim())}&excluir=${payload.sub}`, 'GET',
    );
    return reply.code(status).send(data);
  });

  // ── Amigos ──────────────────────────────────────

  app.get('/amigos', {
    schema: {
      tags: ['social'], summary: 'Mi lista de amigos, con presencia',
      security: [{ bearerAuth: [] }],
      response: { 200: { type: 'array', items: AnySchema }, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSocial(`/amigos?usuario_id=${payload.sub}`, 'GET');
    return reply.code(status).send(data);
  });

  app.delete<{ Params: { usuarioId: string } }>('/amigos/:usuarioId', {
    schema: {
      tags: ['social'], summary: 'Eliminar amistad',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { usuarioId: { type: 'string', format: 'uuid' } } },
      response: { 200: AnySchema, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSocial(
      `/amigos/${req.params.usuarioId}?usuario_id=${payload.sub}`, 'DELETE',
    );
    return reply.code(status).send(data);
  });

  // POST /solicitudes — acepta a_usuario_id (ya conocido, ej. desde el fin
  // de partida) O a_username (agregar por nombre desde FriendsView); si
  // viene username, se resuelve acá antes de llamar a ms-social.
  app.post<{ Body: { a_usuario_id?: string; a_username?: string } }>('/solicitudes', {
    schema: {
      tags: ['social'], summary: 'Enviar solicitud de amistad',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          a_usuario_id: { type: 'string', format: 'uuid' },
          a_username:   { type: 'string' },
        },
      },
      response: { 201: AnySchema, 400: { ...ErrorSchema }, 401: { ...ErrorSchema }, 404: { ...ErrorSchema }, 409: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;

    let aUsuarioId = req.body.a_usuario_id;
    if (!aUsuarioId && req.body.a_username) {
      const { status, data } = await callMs(`/usuarios/por-username/${encodeURIComponent(req.body.a_username)}`, 'GET');
      if (status !== 200) return reply.code(404).send({ error: 'Usuario no encontrado' });
      aUsuarioId = (data as { id: string }).id;
    }
    if (!aUsuarioId) return reply.code(400).send({ error: 'Falta a_usuario_id o a_username' });

    const { status, data } = await callSocial('/solicitudes', 'POST', {
      usuario_id: payload.sub, a_usuario_id: aUsuarioId,
    });
    return reply.code(status).send(data);
  });

  app.post<{ Params: { id: string } }>('/solicitudes/:id/aceptar', {
    schema: {
      tags: ['social'], summary: 'Aceptar solicitud de amistad',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: { 200: AnySchema, 401: { ...ErrorSchema }, 403: { ...ErrorSchema }, 404: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSocial(
      `/solicitudes/${req.params.id}/aceptar`, 'POST', { usuario_id: payload.sub },
    );
    return reply.code(status).send(data);
  });

  app.post<{ Params: { id: string } }>('/solicitudes/:id/rechazar', {
    schema: {
      tags: ['social'], summary: 'Rechazar solicitud de amistad',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: { 200: AnySchema, 401: { ...ErrorSchema }, 403: { ...ErrorSchema }, 404: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSocial(
      `/solicitudes/${req.params.id}/rechazar`, 'POST', { usuario_id: payload.sub },
    );
    return reply.code(status).send(data);
  });

  app.post<{ Body: { usuario_ids: string[] } }>('/social/estado-relacion', {
    schema: {
      tags: ['social'], summary: 'Estado de relación con varios usuarios a la vez',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object', required: ['usuario_ids'],
        properties: { usuario_ids: { type: 'array', items: { type: 'string', format: 'uuid' } } },
      },
      response: { 200: AnySchema, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSocial('/estado-relacion', 'POST', {
      usuario_id: payload.sub, usuario_ids: req.body.usuario_ids,
    });
    return reply.code(status).send(data);
  });

  // ── Bandeja de entrada ─────────────────────────────

  app.get('/notificaciones', {
    schema: {
      tags: ['social'], summary: 'Mi bandeja de entrada',
      security: [{ bearerAuth: [] }],
      response: { 200: { type: 'array', items: AnySchema }, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSocial(`/notificaciones?usuario_id=${payload.sub}`, 'GET');
    return reply.code(status).send(data);
  });

  app.post<{ Params: { id: string } }>('/notificaciones/:id/leer', {
    schema: {
      tags: ['social'], summary: 'Marcar notificación como leída',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: { 200: AnySchema, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSocial(
      `/notificaciones/${req.params.id}/leer`, 'POST', { usuario_id: payload.sub },
    );
    return reply.code(status).send(data);
  });

  app.get('/notificaciones/no-leidas/count', {
    schema: {
      tags: ['social'], summary: 'Cantidad de notificaciones sin leer',
      security: [{ bearerAuth: [] }],
      response: { 200: AnySchema, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSocial(`/notificaciones/no-leidas/count?usuario_id=${payload.sub}`, 'GET');
    return reply.code(status).send(data);
  });

  app.post<{ Body: { a_usuario_id: string; sala_codigo?: string; party_codigo?: string } }>(
    '/social/invitar-partida', {
      schema: {
        tags: ['social'], summary: 'Invitar a un amigo a mi sala/party actual',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object', required: ['a_usuario_id'],
          properties: {
            a_usuario_id: { type: 'string', format: 'uuid' },
            sala_codigo:  { type: 'string' },
            party_codigo: { type: 'string' },
          },
        },
        response: { 201: AnySchema, 400: { ...ErrorSchema }, 401: { ...ErrorSchema }, 404: { ...ErrorSchema } },
      },
    }, async (req, reply) => {
      const payload = auth(req, reply); if (!payload) return;
      const { status, data } = await callSocial('/invitar-partida', 'POST', {
        usuario_id: payload.sub, ...req.body,
      });
      return reply.code(status).send(data);
    },
  );

  // ── Chat (historial; los mensajes nuevos van por WS directo a ms-social) ──

  app.get<{ Params: { salaId: string } }>('/social/chat/:salaId', {
    schema: {
      tags: ['social'], summary: 'Historial de chat de una sala',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { salaId: { type: 'string', format: 'uuid' } } },
      response: { 200: { type: 'array', items: AnySchema }, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    if (!auth(req, reply)) return;
    const { status, data } = await callSocial(`/chat/${req.params.salaId}`, 'GET');
    return reply.code(status).send(data);
  });
}

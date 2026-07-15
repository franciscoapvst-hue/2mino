import { FastifyInstance } from 'fastify';
import { callSalas } from '../http';
import { verifyToken } from '../jwt';

const ErrorSchema = { type: 'object', properties: { error: { type: 'string' } } } as const;
const AnySchema    = { type: 'object', additionalProperties: true } as const;

function auth(req: { headers: { authorization?: string } }, reply: { code: (n: number) => any }) {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) { reply.code(401).send({ error: 'Token requerido' }); return null; }
  // Único choke point de /ranked/* — ms-salas no tiene auth propia, así
  // que el bloqueo de invitados tiene que vivir acá.
  if (payload.segmento === 'invitado') {
    reply.code(403).send({ error: 'Los invitados no pueden acceder a partidas ranked' });
    return null;
  }
  return payload;
}

export async function rankedGatewayRoutes(app: FastifyInstance) {

  // ── ELO / leaderboard ─────────────────────────────

  app.get('/ranked/me', {
    schema: {
      tags: ['ranked'], summary: 'Mi ELO, récord e historial ranked',
      security: [{ bearerAuth: [] }],
      response: { 200: AnySchema, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSalas(`/ranked/${payload.sub}`, 'GET');
    return reply.code(status).send(data);
  });

  app.get<{ Querystring: { limit?: number } }>('/ranked/leaderboard', {
    schema: {
      tags: ['ranked'], summary: 'Top de jugadores por ELO',
      querystring: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } } },
      response: { 200: { type: 'array', items: AnySchema } },
    },
  }, async (req, reply) => {
    const qs = req.query.limit ? `?limit=${req.query.limit}` : '';
    const { status, data } = await callSalas(`/ranked/leaderboard${qs}`, 'GET');
    return reply.code(status).send(data);
  });

  app.get<{ Params: { usuario_id: string } }>('/ranked/leaderboard/:usuario_id/perfil', {
    schema: {
      tags: ['ranked'], summary: 'Perfil extendido de un jugador (capicúas, trancas, progresión de ELO)',
      params: { type: 'object', properties: { usuario_id: { type: 'string', format: 'uuid' } } },
      response: { 200: AnySchema },
    },
  }, async (req, reply) => {
    const { status, data } = await callSalas(`/ranked/leaderboard/${req.params.usuario_id}/perfil`, 'GET');
    return reply.code(status).send(data);
  });

  // ── Party ──────────────────────────────────────────

  app.post<{ Body: { tipo?: 'casual' | 'ranked' } }>('/ranked/party', {
    schema: {
      tags: ['ranked'], summary: 'Crear party (equipo por invitación)',
      security: [{ bearerAuth: [] }],
      body: { type: 'object', properties: { tipo: { type: 'string', enum: ['casual', 'ranked'] } } },
      response: { 201: AnySchema, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSalas('/ranked/party', 'POST', {
      usuario_id: payload.sub, username: payload.username, tipo: req.body?.tipo,
    });
    return reply.code(status).send(data);
  });

  app.get<{ Params: { codigo: string } }>('/ranked/party/:codigo', {
    schema: {
      tags: ['ranked'], summary: 'Estado de una party',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { codigo: { type: 'string' } } },
      response: { 200: AnySchema, 401: { ...ErrorSchema }, 404: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    if (!auth(req, reply)) return;
    const { status, data } = await callSalas(`/ranked/party/${req.params.codigo}`, 'GET');
    return reply.code(status).send(data);
  });

  app.post<{ Params: { codigo: string } }>('/ranked/party/:codigo/unirse', {
    schema: {
      tags: ['ranked'], summary: 'Unirse a una party por código',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { codigo: { type: 'string' } } },
      response: { 200: AnySchema, 400: { ...ErrorSchema }, 401: { ...ErrorSchema }, 404: { ...ErrorSchema }, 409: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSalas(`/ranked/party/${req.params.codigo}/unirse`, 'POST', {
      usuario_id: payload.sub, username: payload.username,
    });
    return reply.code(status).send(data);
  });

  app.post<{ Params: { codigo: string } }>('/ranked/party/:codigo/salir', {
    schema: {
      tags: ['ranked'], summary: 'Salir de una party',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { codigo: { type: 'string' } } },
      response: { 200: AnySchema, 401: { ...ErrorSchema }, 404: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSalas(`/ranked/party/${req.params.codigo}/salir`, 'POST', {
      usuario_id: payload.sub,
    });
    return reply.code(status).send(data);
  });

  app.post<{ Params: { codigo: string } }>('/ranked/party/:codigo/cola', {
    schema: {
      tags: ['ranked'], summary: 'Meter la party (2/2) a la cola ranked 4P',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { codigo: { type: 'string' } } },
      response: { 200: AnySchema, 400: { ...ErrorSchema }, 401: { ...ErrorSchema }, 404: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSalas(`/ranked/party/${req.params.codigo}/cola`, 'POST', {
      usuario_id: payload.sub,
    });
    return reply.code(status).send(data);
  });

  // ── Cola (solo) ─────────────────────────────────────

  app.post<{ Body: { modo: 2 | 4; tipo?: 'casual' | 'ranked' } }>('/ranked/cola/entrar', {
    schema: {
      tags: ['ranked'], summary: 'Entrar a la cola (solo, sin equipo)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object', required: ['modo'],
        properties: {
          modo: { type: 'integer', enum: [2, 4] },
          tipo: { type: 'string', enum: ['casual', 'ranked'] },
        },
      },
      response: { 200: AnySchema, 400: { ...ErrorSchema }, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSalas('/ranked/cola/entrar', 'POST', {
      usuario_id: payload.sub, username: payload.username, modo: req.body.modo, tipo: req.body?.tipo,
    });
    return reply.code(status).send(data);
  });

  app.get('/ranked/cola/estado', {
    schema: {
      tags: ['ranked'], summary: 'Estado de mi cola (dispara un intento de emparejar)',
      security: [{ bearerAuth: [] }],
      response: { 200: AnySchema, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSalas(`/ranked/cola/estado?usuario_id=${payload.sub}`, 'GET');
    return reply.code(status).send(data);
  });

  app.post('/ranked/cola/salir', {
    schema: {
      tags: ['ranked'], summary: 'Cancelar búsqueda (solo o party)',
      security: [{ bearerAuth: [] }],
      response: { 200: AnySchema, 401: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const payload = auth(req, reply); if (!payload) return;
    const { status, data } = await callSalas('/ranked/cola/salir', 'POST', { usuario_id: payload.sub });
    return reply.code(status).send(data);
  });
}

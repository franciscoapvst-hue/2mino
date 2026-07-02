import { FastifyInstance } from 'fastify';
import { callSalas } from '../http';
import { verifyToken } from '../jwt';

const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

const SalaResumenSchema = {
  type: 'object',
  additionalProperties: true,
} as const;

export async function salasGatewayRoutes(app: FastifyInstance) {

  // ── GET /salas ───────────────────────────────────
  app.get('/salas', {
    schema: {
      tags:        ['salas'],
      summary:     'Listar salas abiertas',
      description: 'Salas en estado "esperando". Filtrable por tipo y modo.',
      querystring: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['casual','ranked'] },
          modo: { type: 'string', enum: ['clasico','rapido','torneo'] },
        },
      },
      response: {
        200: { type: 'array', items: SalaResumenSchema },
      },
    },
  }, async (req: any, reply) => {
    const qs   = new URLSearchParams(req.query).toString();
    const path = qs ? `/salas?${qs}` : '/salas';
    const { status, data } = await callSalas(path, 'GET');
    return reply.code(status).send(data);
  });

  // ── POST /salas ──────────────────────────────────
  app.post<{
    Body: {
      nombre?:        string;
      tipo?:          string;
      modo?:          string;
      max_jugadores?: number;
      privada?:       boolean;
      config?:        Record<string, unknown>;
    };
  }>('/salas', {
    schema: {
      tags:     ['salas'],
      summary:  'Crear sala',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          nombre:        { type: 'string', maxLength: 60 },
          tipo:          { type: 'string', enum: ['casual','ranked'] },
          modo:          { type: 'string', enum: ['clasico','rapido','torneo'] },
          max_jugadores: { type: 'integer', enum: [2, 4] },
          privada:       { type: 'boolean' },
          config:        { type: 'object', additionalProperties: true },
        },
      },
      response: {
        201: { ...SalaResumenSchema },
        401: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token requerido' });

    const { status, data } = await callSalas('/salas', 'POST', {
      ...req.body,
      creador_id: payload.sub,
      username:   payload.username,
    });
    return reply.code(status).send(data);
  });

  // ── GET /salas/:id ───────────────────────────────
  app.get<{ Params: { id: string } }>('/salas/:id', {
    schema: {
      tags:    ['salas'],
      summary: 'Detalle de sala con jugadores',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...SalaResumenSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { status, data } = await callSalas(`/salas/${req.params.id}`, 'GET');
    return reply.code(status).send(data);
  });

  // ── GET /salas/codigo/:codigo ────────────────────
  app.get<{ Params: { codigo: string } }>('/salas/codigo/:codigo', {
    schema: {
      tags:    ['salas'],
      summary: 'Buscar sala por código corto',
      params: {
        type: 'object',
        properties: { codigo: { type: 'string', example: '2M-AB3C' } },
      },
      response: {
        200: { ...SalaResumenSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { status, data } = await callSalas(`/salas/codigo/${req.params.codigo}`, 'GET');
    return reply.code(status).send(data);
  });

  // ── POST /salas/:id/unirse ───────────────────────
  app.post<{ Params: { id: string } }>('/salas/:id/unirse', {
    schema: {
      tags:     ['salas'],
      summary:  'Unirse a una sala',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...SalaResumenSchema },
        400: { ...ErrorSchema },
        401: { ...ErrorSchema },
        404: { ...ErrorSchema },
        409: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token requerido' });

    const { status, data } = await callSalas(`/salas/${req.params.id}/unirse`, 'POST', {
      usuario_id: payload.sub,
      username:   payload.username,
    });
    return reply.code(status).send(data);
  });

  // ── POST /salas/:id/posicion ─────────────────────
  app.post<{ Params: { id: string }; Body: { posicion: number } }>('/salas/:id/posicion', {
    schema: {
      tags:     ['salas'],
      summary:  'Cambiar de asiento en la sala de espera (define los equipos)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['posicion'],
        properties: { posicion: { type: 'integer', minimum: 1, maximum: 4 } },
      },
      response: {
        200: { ...SalaResumenSchema },
        400: { ...ErrorSchema },
        401: { ...ErrorSchema },
        404: { ...ErrorSchema },
        409: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token requerido' });

    const { status, data } = await callSalas(`/salas/${req.params.id}/posicion`, 'POST', {
      usuario_id: payload.sub,
      posicion:   req.body.posicion,
    });
    return reply.code(status).send(data);
  });

  // ── POST /salas/:id/salir ────────────────────────
  app.post<{ Params: { id: string } }>('/salas/:id/salir', {
    schema: {
      tags:     ['salas'],
      summary:  'Salir de una sala',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...SalaResumenSchema },
        400: { ...ErrorSchema },
        401: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token requerido' });

    const { status, data } = await callSalas(`/salas/${req.params.id}/salir`, 'POST', {
      usuario_id: payload.sub,
    });
    return reply.code(status).send(data);
  });

  // ── PATCH /salas/:id/estado ──────────────────────
  app.patch<{ Params: { id: string }; Body: { estado: string } }>('/salas/:id/estado', {
    schema: {
      tags:     ['salas'],
      summary:  'Cambiar estado de sala (solo creador)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['estado'],
        properties: {
          estado: { type: 'string', enum: ['esperando', 'en_juego', 'finalizada', 'cancelada'] },
        },
      },
      response: {
        200: { ...SalaResumenSchema },
        401: { ...ErrorSchema },
        403: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token requerido' });

    const { status, data } = await callSalas(`/salas/${req.params.id}/estado`, 'PATCH', {
      estado:          req.body.estado,
      solicitante_id:  payload.sub,
    });
    return reply.code(status).send(data);
  });

  // ── POST /salas/:id/juego/iniciar ────────────────
  app.post<{ Params: { id: string } }>('/salas/:id/juego/iniciar', {
    schema: {
      tags:     ['juego'],
      summary:  'Reparte fichas e inicia la partida (solo el creador)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        201: { ...SalaResumenSchema },
        400: { ...ErrorSchema },
        401: { ...ErrorSchema },
        403: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token requerido' });

    const { status, data } = await callSalas(`/salas/${req.params.id}/juego/iniciar`, 'POST', {
      solicitante_id: payload.sub,
    });
    return reply.code(status).send(data);
  });

  // ── GET /salas/:id/juego ──────────────────────────
  app.get<{ Params: { id: string } }>('/salas/:id/juego', {
    schema: {
      tags:     ['juego'],
      summary:  'Estado actual de la partida (vista propia)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...SalaResumenSchema },
        401: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token requerido' });

    const { status, data } = await callSalas(
      `/salas/${req.params.id}/juego?usuario_id=${payload.sub}`, 'GET',
    );
    return reply.code(status).send(data);
  });

  // ── POST /salas/:id/juego/jugar ───────────────────
  app.post<{
    Params: { id: string };
    Body:   { pieza: { a: number; b: number }; lado?: 'izq' | 'der' };
  }>('/salas/:id/juego/jugar', {
    schema: {
      tags:     ['juego'],
      summary:  'Jugar una ficha',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['pieza'],
        properties: {
          pieza: {
            type: 'object',
            required: ['a', 'b'],
            properties: { a: { type: 'integer', minimum: 0, maximum: 6 }, b: { type: 'integer', minimum: 0, maximum: 6 } },
          },
          lado: { type: 'string', enum: ['izq', 'der'] },
        },
      },
      response: {
        200: { ...SalaResumenSchema },
        400: { ...ErrorSchema },
        401: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token requerido' });

    const { status, data } = await callSalas(`/salas/${req.params.id}/juego/jugar`, 'POST', {
      usuario_id: payload.sub,
      pieza:      req.body.pieza,
      lado:       req.body.lado,
    });
    return reply.code(status).send(data);
  });

  // ── POST /salas/:id/juego/pasar ───────────────────
  app.post<{ Params: { id: string } }>('/salas/:id/juego/pasar', {
    schema: {
      tags:     ['juego'],
      summary:  'Pasar el turno',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...SalaResumenSchema },
        400: { ...ErrorSchema },
        401: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token requerido' });

    const { status, data } = await callSalas(`/salas/${req.params.id}/juego/pasar`, 'POST', {
      usuario_id: payload.sub,
    });
    return reply.code(status).send(data);
  });

  // ── POST /salas/:id/juego/listo ───────────────────
  app.post<{ Params: { id: string } }>('/salas/:id/juego/listo', {
    schema: {
      tags:     ['juego'],
      summary:  'Confirmar listo para la siguiente mano',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...SalaResumenSchema },
        400: { ...ErrorSchema },
        401: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token requerido' });

    const { status, data } = await callSalas(`/salas/${req.params.id}/juego/listo`, 'POST', {
      usuario_id: payload.sub,
    });
    return reply.code(status).send(data);
  });
}

import { FastifyInstance } from 'fastify';
import { callService, callMs } from '../http';
import { requireAdmin } from '../jwt';

const MS_LANDING = () => (process.env.MS_FRONTEND_LANDING_URL ?? 'http://localhost:5000').trim();

// ── Schemas reutilizables ─────────────────────────
const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

// 401/403 se repiten en toda ruta /admin/* (requireAdmin) — un solo lugar.
const AuthErrors = {
  401: { description: 'Token inválido o expirado', ...ErrorSchema },
  403: { description: 'Requiere segmento admin',   ...ErrorSchema },
} as const;

const UuidParamSchema = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const EstadoBodySchema = {
  type: 'object',
  required: ['activo'],
  properties: { activo: { type: 'boolean' } },
} as const;

const FeatureFlagSchema = {
  type: 'object',
  properties: {
    clave:       { type: 'string' },
    valor:       { additionalProperties: true },
    descripcion: { type: 'string' },
    habilitado:  { type: 'boolean' },
    updated_at:  { type: 'string', format: 'date-time' },
  },
} as const;

const UsuarioSchema = {
  type: 'object',
  properties: {
    id:          { type: 'string', format: 'uuid' },
    username:    { type: 'string' },
    email:       { type: 'string', format: 'email' },
    segmento_id: { type: 'string', format: 'uuid' },
    segmento:    { type: 'string' },
    activo:      { type: 'boolean' },
    created_at:  { type: 'string', format: 'date-time' },
    updated_at:  { type: 'string', format: 'date-time' },
  },
} as const;

// Superset de UsuarioSchema (perfil + segmento + ELO) — GET /admin/usuarios/:id.
const UsuarioCompletoSchema = {
  type: 'object',
  properties: {
    ...UsuarioSchema.properties,
    avatar:          { type: 'string', nullable: true },
    segmento:        { type: 'string', nullable: true },
    segmento_config: { type: 'object', additionalProperties: true, nullable: true },
    elo:             { type: 'integer' },
    partidas:        { type: 'integer' },
    ganadas:         { type: 'integer' },
  },
} as const;

const SegmentoSchema = {
  type: 'object',
  properties: {
    id:          { type: 'string', format: 'uuid' },
    nombre:      { type: 'string' },
    descripcion: { type: 'string' },
    config:      { type: 'object', additionalProperties: true },
    activo:      { type: 'boolean' },
    created_at:  { type: 'string', format: 'date-time' },
    updated_at:  { type: 'string', format: 'date-time' },
  },
} as const;

// ─────────────────────────────────────────────────
// Rutas del Back Office (docs/CASOS_DE_USO_BACKOFFICE.md). Todas exigen
// requireAdmin() — nunca se exponen a internet más allá de este gateway
// (ver §10.1: el panel llega acá vía túnel SSH, nunca expone el puerto).
export async function adminRoutes(app: FastifyInstance) {

  // ── GET /admin/feature-flags ────────────────────
  // Proxy directo a ms-frontend-landing (GET /config/todas, ya existe) —
  // el único gap real era que el gateway nunca lo exponía a nadie más.
  app.get('/admin/feature-flags', {
    preHandler: requireAdmin,
    schema: {
      tags:        ['admin'],
      summary:     'Listar todas las feature flags (habilitadas y no)',
      security:    [{ bearerAuth: [] }],
      response: {
        200: { description: 'Lista completa', type: 'array', items: FeatureFlagSchema },
        ...AuthErrors,
      },
    },
  }, async (_req, reply) => {
    const { status, data } = await callService(MS_LANDING(), '/config/todas', 'GET');
    return reply.code(status).send(data);
  });

  // ── PATCH /admin/feature-flags/:clave ───────────
  // Proxy directo a ms-frontend-landing (PATCH /config/:clave, ya existe).
  app.patch<{ Params: { clave: string }; Body: { habilitado: boolean } }>(
    '/admin/feature-flags/:clave',
    {
      preHandler: requireAdmin,
      schema: {
        tags:        ['admin'],
        summary:     'Activar o desactivar una feature flag',
        security:    [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { clave: { type: 'string', example: 'torneos_habilitado' } },
        },
        body: {
          type: 'object',
          required: ['habilitado'],
          properties: { habilitado: { type: 'boolean' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { clave: { type: 'string' }, habilitado: { type: 'boolean' } },
          },
          ...AuthErrors,
          404: { description: 'Flag no encontrada', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { status, data } = await callService(
        MS_LANDING(), `/config/${req.params.clave}`, 'PATCH', req.body,
      );
      return reply.code(status).send(data);
    },
  );

  // ── GET /admin/usuarios ─────────────────────────
  // Proxy directo a ms-usuarios (GET /usuarios?q=, nuevo).
  app.get<{ Querystring: { q?: string } }>('/admin/usuarios', {
    preHandler: requireAdmin,
    schema: {
      tags:        ['admin'],
      summary:     'Buscar/listar usuarios',
      security:    [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { q: { type: 'string', maxLength: 100 } },
      },
      response: {
        200: { description: 'Usuarios encontrados', type: 'array', items: UsuarioSchema },
        ...AuthErrors,
      },
    },
  }, async (req, reply) => {
    const qs = req.query.q ? `?q=${encodeURIComponent(req.query.q)}` : '';
    const { status, data } = await callMs(`/usuarios${qs}`, 'GET');
    return reply.code(status).send(data);
  });

  // ── GET /admin/usuarios/:id ──────────────────────
  // Detalle completo (perfil + segmento + ELO) — proxy directo a
  // ms-usuarios GET /usuarios/:id/completo (función usuario_completo()).
  app.get<{ Params: { id: string } }>('/admin/usuarios/:id', {
    preHandler: requireAdmin,
    schema: {
      tags:        ['admin'],
      summary:     'Perfil completo de un usuario (segmento + ELO)',
      security:    [{ bearerAuth: [] }],
      params: UuidParamSchema,
      response: {
        200: { description: 'Perfil completo', ...UsuarioCompletoSchema },
        ...AuthErrors,
        404: { description: 'Usuario no encontrado', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { status, data } = await callMs(`/usuarios/${req.params.id}/completo`, 'GET');
    return reply.code(status).send(data);
  });

  // ── PATCH /admin/usuarios/:id/segmento ──────────
  app.patch<{ Params: { id: string }; Body: { segmentoId: string } }>(
    '/admin/usuarios/:id/segmento',
    {
      preHandler: requireAdmin,
      schema: {
        tags:        ['admin'],
        summary:     'Cambiar el segmento de un usuario',
        security:    [{ bearerAuth: [] }],
        params: UuidParamSchema,
        body: {
          type: 'object',
          required: ['segmentoId'],
          properties: { segmentoId: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { description: 'Usuario actualizado', ...UsuarioSchema },
          ...AuthErrors,
          404: { description: 'Usuario no encontrado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { status, data } = await callMs(`/usuarios/${req.params.id}/segmento`, 'PATCH', req.body);
      return reply.code(status).send(data);
    },
  );

  // ── PATCH /admin/usuarios/:id/estado ────────────
  app.patch<{ Params: { id: string }; Body: { activo: boolean } }>(
    '/admin/usuarios/:id/estado',
    {
      preHandler: requireAdmin,
      schema: {
        tags:        ['admin'],
        summary:     'Banear o reactivar una cuenta',
        security:    [{ bearerAuth: [] }],
        params: UuidParamSchema,
        body: EstadoBodySchema,
        response: {
          200: { description: 'Usuario actualizado', ...UsuarioSchema },
          ...AuthErrors,
          404: { description: 'Usuario no encontrado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { status, data } = await callMs(`/usuarios/${req.params.id}/estado`, 'PATCH', req.body);
      return reply.code(status).send(data);
    },
  );

  // ── GET /admin/segmentos ────────────────────────
  // A diferencia de GET /segmentos (público, solo activos), este trae
  // también los desactivados — uso exclusivo del Back Office.
  app.get('/admin/segmentos', {
    preHandler: requireAdmin,
    schema: {
      tags:        ['admin'],
      summary:     'Listar todos los segmentos (activos e inactivos)',
      security:    [{ bearerAuth: [] }],
      response: {
        200: { description: 'Segmentos', type: 'array', items: SegmentoSchema },
        ...AuthErrors,
      },
    },
  }, async (_req, reply) => {
    const { status, data } = await callMs('/segmentos?incluirInactivos=true', 'GET');
    return reply.code(status).send(data);
  });

  // ── POST /admin/segmentos ───────────────────────
  app.post<{ Body: { nombre: string; descripcion?: string } }>('/admin/segmentos', {
    preHandler: requireAdmin,
    schema: {
      tags:        ['admin'],
      summary:     'Crear segmento',
      security:    [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['nombre'],
        properties: {
          nombre:      { type: 'string', minLength: 2, maxLength: 50, example: 'beta_tester' },
          descripcion: { type: 'string', maxLength: 200 },
        },
      },
      response: {
        201: { description: 'Segmento creado', ...SegmentoSchema },
        ...AuthErrors,
        409: { description: 'Ya existe un segmento con ese nombre', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { status, data } = await callMs('/segmentos', 'POST', req.body);
    return reply.code(status).send(data);
  });

  // ── PATCH /admin/segmentos/:id/estado ───────────
  app.patch<{ Params: { id: string }; Body: { activo: boolean } }>(
    '/admin/segmentos/:id/estado',
    {
      preHandler: requireAdmin,
      schema: {
        tags:        ['admin'],
        summary:     'Activar o desactivar un segmento',
        security:    [{ bearerAuth: [] }],
        params: UuidParamSchema,
        body: EstadoBodySchema,
        response: {
          200: { description: 'Segmento actualizado', ...SegmentoSchema },
          ...AuthErrors,
          404: { description: 'Segmento no encontrado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { status, data } = await callMs(`/segmentos/${req.params.id}/estado`, 'PATCH', req.body);
      return reply.code(status).send(data);
    },
  );
}

import { FastifyInstance } from 'fastify';
import { callService } from '../http';
import { requireAdmin } from '../jwt';

const MS_LANDING = () => (process.env.MS_FRONTEND_LANDING_URL ?? 'http://localhost:5000').trim();

// ── Schemas reutilizables ─────────────────────────
const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
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
        401: { description: 'Token inválido o expirado', ...ErrorSchema },
        403: { description: 'Requiere segmento admin',   ...ErrorSchema },
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
          401: { description: 'Token inválido o expirado', ...ErrorSchema },
          403: { description: 'Requiere segmento admin',   ...ErrorSchema },
          404: { description: 'Flag no encontrada',        ...ErrorSchema },
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
}

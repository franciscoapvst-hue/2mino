import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { callMs, callService } from '../http';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const MS_LANDING = () => (process.env.MS_FRONTEND_LANDING_URL ?? 'http://localhost:5000').trim();

// ── Schemas reutilizables ─────────────────────────
const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

const ConfigResueltaSchema = {
  type: 'object',
  properties: {
    usuario_id:      { type: 'string', format: 'uuid' },
    segmento:        { type: 'string' },
    tema:            { type: 'string', enum: ['dark', 'light'] },
    idioma:          { type: 'string' },
    modos_juego:     { type: 'array', items: { type: 'string' } },
    features:        { type: 'object', additionalProperties: true },
    opciones:        { type: 'object', additionalProperties: true },
  },
} as const;

function getUserIdFromToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as jwt.JwtPayload;
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────
export async function frontendRoutes(app: FastifyInstance) {

  // ── GET /frontend/config ────────────────────────
  // Pública — el landing la llama sin autenticación
  app.get('/frontend/config', {
    schema: {
      tags:        ['frontend'],
      summary:     'Configuración del landing (pública)',
      description: 'Devuelve las opciones habilitadas del landing. No requiere autenticación.',
      response: {
        200: {
          description: 'Configuración activa',
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  }, async (_req, reply) => {
    const { status, data } = await callService(MS_LANDING(), '/config', 'GET');
    return reply.code(status).send(data);
  });

  // ── GET /frontend/preferencias ──────────────────
  // Merge de: config del segmento del usuario + overrides individuales
  app.get('/frontend/preferencias', {
    schema: {
      tags:        ['frontend'],
      summary:     'Configuración resuelta del usuario autenticado',
      description: 'Devuelve segmento.config fusionado con los overrides del usuario. El override gana.',
      security:    [{ bearerAuth: [] }],
      response: {
        200: { description: 'Config resuelta', ...ConfigResueltaSchema },
        401: { description: 'Token requerido',  ...ErrorSchema },
        404: { description: 'Usuario no encontrado', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'Token requerido' });

    // Llamadas en paralelo
    const [userRes, overridesRes] = await Promise.all([
      callMs(`/usuarios/${userId}`, 'GET'),
      callService(MS_LANDING(), `/usuario/${userId}/overrides`, 'GET'),
    ]);

    if (userRes.status === 404) return reply.code(404).send({ error: 'Usuario no encontrado' });

    const user      = userRes.data as any;
    const segConfig = user.segmento_config ?? {};
    const overrides = overridesRes.data as any ?? {};

    // Override gana campo a campo; opciones se hace merge profundo
    const resolved = {
      usuario_id:  userId,
      segmento:    user.segmento,
      tema:        overrides.tema   || segConfig.tema   || 'dark',
      idioma:      overrides.idioma || segConfig.idioma || 'es',
      modos_juego: segConfig.modos_juego ?? [],
      features:    segConfig.features ?? {},
      opciones:    { ...(segConfig.opciones ?? {}), ...(overrides.opciones ?? {}) },
    };

    return reply.send(resolved);
  });

  // ── PUT /frontend/preferencias ──────────────────
  // Guarda solo los campos que el usuario cambia (overrides)
  app.put<{
    Body: { tema?: string; idioma?: string; opciones?: Record<string, unknown> };
  }>('/frontend/preferencias', {
    schema: {
      tags:        ['frontend'],
      summary:     'Guardar preferencias personales (overrides)',
      description: 'Solo los campos enviados se guardan como override. El resto sigue siendo del segmento.',
      security:    [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          tema:     { type: 'string', enum: ['dark', 'light'] },
          idioma:   { type: 'string', example: 'es' },
          opciones: { type: 'object', additionalProperties: true },
        },
      },
      response: {
        200: { description: 'Override guardado', ...ConfigResueltaSchema },
        401: { description: 'Token requerido',    ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'Token requerido' });

    await callService(MS_LANDING(), `/usuario/${userId}/overrides`, 'PUT', req.body);

    // Devuelve la config resuelta completa
    const [userRes, overridesRes] = await Promise.all([
      callMs(`/usuarios/${userId}`, 'GET'),
      callService(MS_LANDING(), `/usuario/${userId}/overrides`, 'GET'),
    ]);

    const user      = userRes.data as any;
    const segConfig = user.segmento_config ?? {};
    const overrides = overridesRes.data as any ?? {};

    return reply.send({
      usuario_id:  userId,
      segmento:    user.segmento,
      tema:        overrides.tema   || segConfig.tema   || 'dark',
      idioma:      overrides.idioma || segConfig.idioma || 'es',
      modos_juego: segConfig.modos_juego ?? [],
      features:    segConfig.features ?? {},
      opciones:    { ...(segConfig.opciones ?? {}), ...(overrides.opciones ?? {}) },
    });
  });
}

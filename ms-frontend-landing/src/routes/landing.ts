import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';

// ── Schemas reutilizables ─────────────────────────
const ConfigSchema = {
  type: 'object',
  additionalProperties: true,
  description: 'Clave→valor de las opciones activas del landing',
} as const;

const OverridesSchema = {
  type: 'object',
  properties: {
    usuario_id: { type: 'string', format: 'uuid' },
    tema:       { type: 'string', enum: ['dark', 'light'] },
    idioma:     { type: 'string', example: 'es' },
    opciones:   { type: 'object', additionalProperties: true },
    updated_at: { type: 'string', format: 'date-time' },
  },
} as const;

const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

// ─────────────────────────────────────────────────
export async function landingRoutes(app: FastifyInstance) {

  // ── GET /config ─────────────────────────────────
  // Devuelve todas las opciones habilitadas del landing
  app.get('/config', {
    schema: {
      tags:        ['config'],
      summary:     'Obtener configuración del landing',
      description: 'Devuelve solo las opciones con habilitado=true como un objeto clave→valor.',
      response: {
        200: ConfigSchema,
      },
    },
  }, async (_req, reply) => {
    const { rows } = await pool.query(
      `SELECT clave, valor FROM landing_config WHERE habilitado = true ORDER BY clave`,
    );

    // Convierte filas en un objeto plano { clave: valor }
    const config = Object.fromEntries(rows.map(r => [r.clave, r.valor]));
    return reply.send(config);
  });

  // ── GET /config/todas ───────────────────────────
  // Lista completa (para panel de admin futuro)
  app.get('/config/todas', {
    schema: {
      tags:        ['config'],
      summary:     'Listar todas las opciones de configuración',
      description: 'Incluye opciones habilitadas y deshabilitadas. Útil para administración.',
      response: {
        200: {
          description: 'Lista de configuración completa',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              clave:       { type: 'string' },
              valor:       { additionalProperties: true },
              descripcion: { type: 'string' },
              habilitado:  { type: 'boolean' },
              updated_at:  { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  }, async (_req, reply) => {
    const { rows } = await pool.query(
      `SELECT clave, valor, descripcion, habilitado, updated_at FROM landing_config ORDER BY clave`,
    );
    return reply.send(rows);
  });

  // ── PATCH /config/:clave ────────────────────────
  // Habilitar o deshabilitar una opción del landing
  app.patch<{
    Params: { clave: string };
    Body:   { habilitado: boolean };
  }>('/config/:clave', {
    schema: {
      tags:        ['config'],
      summary:     'Habilitar o deshabilitar una opción del landing',
      params: {
        type: 'object',
        properties: { clave: { type: 'string', example: 'registro_habilitado' } },
      },
      body: {
        type: 'object',
        required: ['habilitado'],
        properties: { habilitado: { type: 'boolean' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            clave:      { type: 'string' },
            habilitado: { type: 'boolean' },
          },
        },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { clave } = req.params;
    const { habilitado } = req.body;

    const { rows } = await pool.query(
      `UPDATE landing_config SET habilitado = $1, updated_at = NOW()
       WHERE clave = $2 RETURNING clave, habilitado`,
      [habilitado, clave],
    );

    if (!rows.length) return reply.code(404).send({ error: `Opción '${clave}' no encontrada` });
    return reply.send(rows[0]);
  });

  // ── GET /usuario/:id/overrides ──────────────────
  // Devuelve solo los campos que el usuario cambió respecto a su segmento
  app.get<{ Params: { id: string } }>('/usuario/:id/overrides', {
    schema: {
      tags:        ['preferencias'],
      summary:     'Obtener overrides de frontend del usuario',
      description: 'Devuelve null en los campos que el usuario no ha personalizado (usa la config del segmento).',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { description: 'Overrides del usuario (puede estar vacío)', ...OverridesSchema },
      },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT * FROM frontend_overrides WHERE usuario_id = $1`,
      [req.params.id],
    );
    // Devuelve objeto vacío si no hay overrides — es válido, significa "usa todo del segmento"
    return reply.send(rows[0] ?? { usuario_id: req.params.id, opciones: {} });
  });

  // ── PUT /usuario/:id/overrides ──────────────────
  // Guarda solo los campos que difieren del segmento
  app.put<{
    Params: { id: string };
    Body:   { tema?: string; idioma?: string; opciones?: Record<string, unknown> };
  }>('/usuario/:id/overrides', {
    schema: {
      tags:        ['preferencias'],
      summary:     'Guardar overrides de frontend del usuario',
      description: 'Upsert de los campos que el usuario personaliza. Los campos nulos se eliminan del override (vuelven al default del segmento).',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: {
          tema:     { type: 'string', enum: ['dark', 'light'] },
          idioma:   { type: 'string', example: 'es' },
          opciones: { type: 'object', additionalProperties: true },
        },
      },
      response: {
        200: { description: 'Overrides guardados', ...OverridesSchema },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params;
    const { tema, idioma, opciones = {} } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO frontend_overrides (usuario_id, tema, idioma, opciones)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id) DO UPDATE
         SET tema       = EXCLUDED.tema,
             idioma     = EXCLUDED.idioma,
             opciones   = EXCLUDED.opciones,
             updated_at = NOW()
       RETURNING *`,
      [id, tema ?? null, idioma ?? null, JSON.stringify(opciones)],
    );
    return reply.send(rows[0]);
  });
}

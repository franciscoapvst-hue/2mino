import { FastifyInstance } from 'fastify';
import { callMs } from '../http';
import { verifyToken } from '../jwt';

// ── Schemas reutilizables ─────────────────────────
const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

const ItemSchema = {
  type: 'object',
  properties: {
    id:          { type: 'string', format: 'uuid' },
    categoria:   { type: 'string' },
    clave:       { type: 'string' },
    nombre:      { type: 'string' },
    precio:      { type: 'integer' },
    orden:       { type: 'integer' },
    ya_comprado: { type: 'boolean' },
  },
} as const;

const BilleteraSchema = {
  type: 'object',
  properties: {
    usuario_id: { type: 'string', format: 'uuid' },
    saldo:      { type: 'integer' },
    updated_at: { type: 'string', format: 'date-time' },
  },
} as const;

const InventarioItemSchema = {
  type: 'object',
  properties: {
    item_id:     { type: 'string', format: 'uuid' },
    categoria:   { type: 'string' },
    clave:       { type: 'string' },
    nombre:      { type: 'string' },
    comprado_at: { type: 'string', format: 'date-time' },
  },
} as const;

// ─────────────────────────────────────────────────
export async function tiendaGatewayRoutes(app: FastifyInstance) {

  // ── GET /tienda/items ────────────────────────────
  app.get('/tienda/items', {
    schema: {
      tags:     ['tienda'],
      summary:  'Catálogo de cosméticos disponibles',
      security: [{ bearerAuth: [] }],
      response: {
        200: { description: 'Catálogo', type: 'array', items: ItemSchema },
        401: { description: 'Token ausente o inválido', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token inválido o expirado' });
    const { status, data } = await callMs(`/tienda/items?usuarioId=${payload.sub}`, 'GET');
    return reply.code(status).send(data);
  });

  // ── GET /billetera ───────────────────────────────
  app.get('/billetera', {
    schema: {
      tags:     ['tienda'],
      summary:  'Saldo de doblones del usuario autenticado',
      security: [{ bearerAuth: [] }],
      response: {
        200: { description: 'Saldo', ...BilleteraSchema },
        401: { description: 'Token ausente o inválido', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token inválido o expirado' });
    const { status, data } = await callMs(`/usuarios/${payload.sub}/billetera`, 'GET');
    return reply.code(status).send(data);
  });

  // ── GET /inventario ──────────────────────────────
  app.get('/inventario', {
    schema: {
      tags:     ['tienda'],
      summary:  'Cosméticos que ya posee el usuario autenticado',
      security: [{ bearerAuth: [] }],
      response: {
        200: { description: 'Inventario', type: 'array', items: InventarioItemSchema },
        401: { description: 'Token ausente o inválido', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token inválido o expirado' });
    const { status, data } = await callMs(`/usuarios/${payload.sub}/inventario`, 'GET');
    return reply.code(status).send(data);
  });

  // ── POST /tienda/items/:id/comprar ───────────────
  app.post<{ Params: { id: string } }>('/tienda/items/:id/comprar', {
    schema: {
      tags:     ['tienda'],
      summary:  'Comprar un cosmético con el saldo del usuario autenticado',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: {
        200: {
          description: 'Comprado',
          type: 'object',
          properties: { item_id: { type: 'string', format: 'uuid' }, saldo: { type: 'integer' } },
        },
        401: { description: 'Token ausente o inválido', ...ErrorSchema },
        402: { description: 'Saldo insuficiente',       ...ErrorSchema },
        404: { description: 'Ítem no encontrado',       ...ErrorSchema },
        409: { description: 'Ya tenés este ítem',       ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token inválido o expirado' });
    const { status, data } = await callMs(
      `/tienda/items/${req.params.id}/comprar`, 'POST', { usuarioId: payload.sub },
    );
    return reply.code(status).send(data);
  });
}

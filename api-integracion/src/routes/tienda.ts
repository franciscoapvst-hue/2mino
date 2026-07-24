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

const DoblonPaqueteSchema = {
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    nombre:     { type: 'string' },
    doblones:   { type: 'integer' },
    precio_usd: { type: 'string' },
    orden:      { type: 'integer' },
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
        409: { description: 'Ya tienes este ítem',      ...ErrorSchema },
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

  // ── GET /billetera/doblones/paquetes ─────────────
  app.get('/billetera/doblones/paquetes', {
    schema: {
      tags:     ['tienda'],
      summary:  'Catálogo de paquetes de doblones (comprar con PayPal)',
      security: [{ bearerAuth: [] }],
      response: {
        200: { description: 'Paquetes', type: 'array', items: DoblonPaqueteSchema },
        401: { description: 'Token ausente o inválido', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token inválido o expirado' });
    const { status, data } = await callMs('/billetera/doblones/paquetes', 'GET');
    return reply.code(status).send(data);
  });

  // ── POST /billetera/doblones/orden ───────────────
  app.post<{ Body: { paqueteId: string } }>('/billetera/doblones/orden', {
    schema: {
      tags:     ['tienda'],
      summary:  'Crear una orden de PayPal para comprar un paquete de doblones',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['paqueteId'],
        properties: { paqueteId: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { description: 'Orden creada', type: 'object', properties: { orderId: { type: 'string' } } },
        401: { description: 'Token ausente o inválido', ...ErrorSchema },
        404: { description: 'Paquete no encontrado',    ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token inválido o expirado' });
    const { status, data } = await callMs('/billetera/doblones/orden', 'POST', {
      usuarioId: payload.sub, paqueteId: req.body.paqueteId,
    });
    return reply.code(status).send(data);
  });

  // ── POST /billetera/doblones/:orderId/capturar ───
  app.post<{ Params: { orderId: string } }>('/billetera/doblones/:orderId/capturar', {
    schema: {
      tags:     ['tienda'],
      summary:  'Capturar el pago y acreditar los doblones',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { orderId: { type: 'string' } } },
      response: {
        200: { description: 'Acreditado', type: 'object', properties: { saldo: { type: 'integer' }, doblones: { type: 'integer' } } },
        401: { description: 'Token ausente o inválido',       ...ErrorSchema },
        404: { description: 'Orden no encontrada o ya procesada', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) return reply.code(401).send({ error: 'Token inválido o expirado' });
    const { status, data } = await callMs(
      `/billetera/doblones/${req.params.orderId}/capturar`, 'POST', { usuarioId: payload.sub },
    );
    return reply.code(status).send(data);
  });

  // ── POST /paypal/webhook ─────────────────────────
  // Pública (PayPal la llama directamente) pero NO por JWT — la verificación
  // real es de firma, en ms-usuarios (que tiene las credenciales de PayPal).
  // Acá solo se empaquetan los headers `paypal-*` (callMs no los reenvía) y
  // se reenvía todo a /interno/paypal/webhook.
  app.post('/paypal/webhook', {
    schema: { tags: ['tienda'], summary: 'Webhook de PayPal (verificado por firma en ms-usuarios)' },
  }, async (req, reply) => {
    const h = req.headers;
    const paypalHeaders = {
      'paypal-auth-algo':        h['paypal-auth-algo'] as string | undefined,
      'paypal-cert-url':         h['paypal-cert-url'] as string | undefined,
      'paypal-transmission-id':  h['paypal-transmission-id'] as string | undefined,
      'paypal-transmission-sig': h['paypal-transmission-sig'] as string | undefined,
      'paypal-transmission-time': h['paypal-transmission-time'] as string | undefined,
    };
    const { status, data } = await callMs('/interno/paypal/webhook', 'POST', {
      headers: paypalHeaders, event: req.body,
    });
    return reply.code(status).send(data);
  });
}

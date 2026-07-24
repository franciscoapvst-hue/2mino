import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { crearOrden, capturarOrden, verificarWebhookSignature } from '../paypal';

// ── Schemas reutilizables ─────────────────────────
const ItemSchema = {
  type: 'object',
  properties: {
    id:          { type: 'string', format: 'uuid' },
    categoria:   { type: 'string', enum: ['ficha', 'tablero', 'avatar', 'marco_avatar'] },
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

// Fila completa (admin, Back Office) — a diferencia de ItemSchema (jugador,
// sin `disponible` ni `created_at`, con `ya_comprado` calculado).
const ItemAdminSchema = {
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    categoria:  { type: 'string', enum: ['ficha', 'tablero', 'avatar', 'marco_avatar'] },
    clave:      { type: 'string' },
    nombre:     { type: 'string' },
    precio:     { type: 'integer' },
    disponible: { type: 'boolean' },
    orden:      { type: 'integer' },
    created_at: { type: 'string', format: 'date-time' },
  },
} as const;

const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
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

// Se llama al crear un usuario nuevo (registro, Google, invitado) — así
// "lo que tengo" siempre incluye los ítems gratis (ficha y tablero
// clásicos) por defecto, sin caso especial en el frontend para "todavía
// no eligió ninguno". Por precio=0 y no por clave: agregar un ítem gratis
// nuevo al seed (ver db/pool.ts) no requiere tocar esta función.
export async function otorgarItemsGratis(usuarioId: string) {
  await pool.query(
    `INSERT INTO inventario (usuario_id, item_id)
     SELECT $1, id FROM tienda_items WHERE precio = 0
     ON CONFLICT DO NOTHING`,
    [usuarioId],
  );
}

// ─────────────────────────────────────────────────
export async function tiendaRoutes(app: FastifyInstance) {

  // ── GET /tienda/items ───────────────────────────
  // Catálogo disponible=true, con ya_comprado resuelto contra el
  // inventario de `usuarioId` (el gateway lo resuelve del JWT, ver
  // api-integracion/routes/tienda.ts). `todos=true` es el modo admin (Back
  // Office, vía /admin/tienda/items del gateway): trae TODO el catálogo,
  // incluso lo no disponible, sin `ya_comprado` (no es de un usuario en
  // particular) — mismo criterio que `GET /segmentos?incluirInactivos=true`.
  app.get<{ Querystring: { usuarioId?: string; todos?: string } }>('/tienda/items', {
    schema: {
      tags:        ['tienda'],
      summary:     'Catálogo de cosméticos',
      querystring: {
        type: 'object',
        properties: {
          usuarioId: { type: 'string', format: 'uuid' },
          todos:     { type: 'string', enum: ['true'] },
        },
      },
      response: {
        200: { description: 'Catálogo', type: 'array' },
        400: { description: 'Falta usuarioId (y no es modo todos)', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    if (req.query.todos === 'true') {
      const { rows } = await pool.query(
        `SELECT id, categoria, clave, nombre, precio, disponible, orden, created_at
         FROM tienda_items ORDER BY categoria, orden`,
      );
      return reply.send(rows);
    }
    if (!req.query.usuarioId) {
      return reply.code(400).send({ error: 'usuarioId requerido' });
    }
    const { rows } = await pool.query(
      `SELECT t.id, t.categoria, t.clave, t.nombre, t.precio, t.orden,
              (inv.item_id IS NOT NULL) AS ya_comprado
       FROM tienda_items t
       LEFT JOIN inventario inv ON inv.item_id = t.id AND inv.usuario_id = $1
       WHERE t.disponible = true
       ORDER BY t.categoria, t.orden`,
      [req.query.usuarioId],
    );
    return reply.send(rows);
  });

  // ── POST /tienda/items ──────────────────────────
  // Crear un ítem nuevo (Back Office). Solo agrega la fila al catálogo —
  // que de verdad se vea distinto en juego (una skin nueva de ficha o
  // tablero) sigue necesitando código (SKIN_FICHA_FILL/game.css en el
  // frontend, ver docs/PLAN_COSMETICOS.md §5): esto no genera assets.
  app.post<{ Body: { categoria: string; clave: string; nombre: string; precio: number; orden?: number } }>(
    '/tienda/items',
    {
      schema: {
        tags:        ['tienda'],
        summary:     'Crear un ítem de catálogo',
        body: {
          type: 'object',
          required: ['categoria', 'clave', 'nombre', 'precio'],
          properties: {
            categoria: { type: 'string', enum: ['ficha', 'tablero', 'avatar', 'marco_avatar'] },
            clave:     { type: 'string', minLength: 1, maxLength: 40 },
            nombre:    { type: 'string', minLength: 1, maxLength: 60 },
            precio:    { type: 'integer', minimum: 0 },
            orden:     { type: 'integer', minimum: 0, default: 0 },
          },
        },
        response: {
          201: { description: 'Ítem creado', ...ItemAdminSchema },
          409: { description: 'Ya existe un ítem con esa clave', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { categoria, clave, nombre, precio, orden = 0 } = req.body;
      try {
        const { rows } = await pool.query(
          `INSERT INTO tienda_items (categoria, clave, nombre, precio, orden)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, categoria, clave, nombre, precio, disponible, orden, created_at`,
          [categoria, clave, nombre, precio, orden],
        );
        return reply.code(201).send(rows[0]);
      } catch (err: any) {
        if (err.code === '23505') return reply.code(409).send({ error: `Ya existe un ítem con clave '${clave}'` });
        throw err;
      }
    },
  );

  // ── PATCH /tienda/items/:id ─────────────────────
  // Editar un ítem existente (Back Office) — nombre/precio/disponible/
  // orden. NO categoria/clave: esos dos están acoplados al código del
  // frontend (SKIN_FICHA_FILL/SKIN_TABLERO_PREVIEW en src/skins.ts, el
  // selector [data-tablero] de game.css) — cambiarlos rompería la skin
  // ya wireada sin tocar nada del lado del cliente.
  app.patch<{
    Params: { id: string };
    Body: { nombre?: string; precio?: number; disponible?: boolean; orden?: number };
  }>('/tienda/items/:id', {
    schema: {
      tags:   ['tienda'],
      summary: 'Editar nombre/precio/disponibilidad/orden de un ítem',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        properties: {
          nombre:     { type: 'string', minLength: 1, maxLength: 60 },
          precio:     { type: 'integer', minimum: 0 },
          disponible: { type: 'boolean' },
          orden:      { type: 'integer', minimum: 0 },
        },
      },
      response: {
        200: { description: 'Ítem actualizado',  ...ItemAdminSchema },
        404: { description: 'Ítem no encontrado', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { nombre, precio, disponible, orden } = req.body;
    const { rows } = await pool.query(
      `UPDATE tienda_items SET
         nombre     = COALESCE($1, nombre),
         precio     = COALESCE($2, precio),
         disponible = COALESCE($3, disponible),
         orden      = COALESCE($4, orden)
       WHERE id = $5
       RETURNING id, categoria, clave, nombre, precio, disponible, orden, created_at`,
      [nombre ?? null, precio ?? null, disponible ?? null, orden ?? null, req.params.id],
    );
    if (!rows.length) return reply.code(404).send({ error: 'Ítem no encontrado' });
    return reply.send(rows[0]);
  });

  // ── GET /usuarios/:id/billetera ─────────────────
  app.get<{ Params: { id: string } }>('/usuarios/:id/billetera', {
    schema: {
      tags:    ['tienda'],
      summary: 'Saldo de doblones del usuario',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: {
        200: { description: 'Saldo', ...BilleteraSchema },
      },
    },
  }, async (req, reply) => {
    await pool.query(
      `INSERT INTO billeteras (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [req.params.id],
    );
    const { rows } = await pool.query(
      `SELECT usuario_id, saldo, updated_at FROM billeteras WHERE usuario_id = $1`,
      [req.params.id],
    );
    return reply.send(rows[0]);
  });

  // ── POST /usuarios/:id/billetera/ajuste ─────────
  // Ajuste manual de saldo (Back Office) — motivo 'ajuste_admin', ya
  // anticipado en el comentario de billetera_movimientos (db/pool.ts)
  // desde la Etapa 1. Sirve tanto para dar saldo de prueba como para
  // corregir un error puntual; `monto` puede ser negativo (descontar),
  // pero nunca deja el saldo por debajo de 0 (mismo criterio que la
  // constraint `saldo >= 0` de la tabla).
  app.post<{ Params: { id: string }; Body: { monto: number } }>('/usuarios/:id/billetera/ajuste', {
    schema: {
      tags:    ['tienda'],
      summary: 'Ajustar el saldo de un usuario (admin)',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        required: ['monto'],
        properties: { monto: { type: 'integer' } },
      },
      response: {
        200: { description: 'Saldo actualizado', ...BilleteraSchema },
        400: { description: 'El ajuste dejaría el saldo negativo', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { monto } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO billeteras (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [req.params.id],
      );
      const { rows: walletRows } = await client.query(
        `SELECT saldo FROM billeteras WHERE usuario_id = $1 FOR UPDATE`,
        [req.params.id],
      );
      const saldoActual = walletRows[0].saldo as number;
      if (saldoActual + monto < 0) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: `El saldo actual es ${saldoActual}, no se puede descontar ${-monto}` });
      }

      const { rows } = await client.query(
        `UPDATE billeteras SET saldo = saldo + $1, updated_at = NOW()
         WHERE usuario_id = $2 RETURNING usuario_id, saldo, updated_at`,
        [monto, req.params.id],
      );
      await client.query(
        `INSERT INTO billetera_movimientos (usuario_id, monto, motivo) VALUES ($1, $2, 'ajuste_admin')`,
        [req.params.id, monto],
      );
      await client.query('COMMIT');
      return reply.send(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── GET /usuarios/:id/inventario ────────────────
  app.get<{ Params: { id: string } }>('/usuarios/:id/inventario', {
    schema: {
      tags:    ['tienda'],
      summary: 'Cosméticos que ya posee el usuario',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: {
        200: { description: 'Inventario', type: 'array', items: InventarioItemSchema },
      },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT t.id as item_id, t.categoria, t.clave, t.nombre, inv.comprado_at
       FROM inventario inv
       JOIN tienda_items t ON t.id = inv.item_id
       WHERE inv.usuario_id = $1
       ORDER BY t.categoria, t.orden`,
      [req.params.id],
    );
    return reply.send(rows);
  });

  // ── POST /tienda/items/:id/comprar ──────────────
  // Transacción con `SELECT ... FOR UPDATE` sobre la fila de `billeteras`
  // (mismo espíritu que el lock de fila que ya usa el wizard de torneos en
  // ms-salas/routes/torneos.ts) — evita que dos compras "al mismo tiempo"
  // con saldo justo para una sola descuenten las dos.
  app.post<{ Params: { id: string }; Body: { usuarioId: string } }>('/tienda/items/:id/comprar', {
    schema: {
      tags:        ['tienda'],
      summary:     'Comprar un cosmético',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        required: ['usuarioId'],
        properties: { usuarioId: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: {
          description: 'Comprado',
          type: 'object',
          properties: { item_id: { type: 'string', format: 'uuid' }, saldo: { type: 'integer' } },
        },
        402: { description: 'Saldo insuficiente',      type: 'object', properties: { error: { type: 'string' } } },
        404: { description: 'Ítem no encontrado',      type: 'object', properties: { error: { type: 'string' } } },
        409: { description: 'Ya tenés este ítem',      type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (req, reply) => {
    const { usuarioId } = req.body;
    const itemId = req.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO billeteras (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [usuarioId],
      );
      const { rows: walletRows } = await client.query(
        `SELECT saldo FROM billeteras WHERE usuario_id = $1 FOR UPDATE`,
        [usuarioId],
      );
      const saldoActual = walletRows[0].saldo as number;

      const { rows: itemRows } = await client.query(
        `SELECT id, precio FROM tienda_items WHERE id = $1 AND disponible = true`,
        [itemId],
      );
      if (!itemRows.length) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Ítem no encontrado' });
      }
      const item = itemRows[0];

      const { rows: yaTiene } = await client.query(
        `SELECT 1 FROM inventario WHERE usuario_id = $1 AND item_id = $2`,
        [usuarioId, itemId],
      );
      if (yaTiene.length) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'Ya tenés este ítem' });
      }

      if (saldoActual < item.precio) {
        await client.query('ROLLBACK');
        return reply.code(402).send({ error: 'Saldo insuficiente' });
      }

      await client.query(
        `INSERT INTO inventario (usuario_id, item_id) VALUES ($1, $2)`,
        [usuarioId, itemId],
      );
      await client.query(
        `INSERT INTO billetera_movimientos (usuario_id, monto, motivo, ref)
         VALUES ($1, $2, 'compra_item', $3)`,
        [usuarioId, -item.precio, itemId],
      );
      const { rows: nuevoSaldo } = await client.query(
        `UPDATE billeteras SET saldo = saldo - $1, updated_at = NOW()
         WHERE usuario_id = $2 RETURNING saldo`,
        [item.precio, usuarioId],
      );

      await client.query('COMMIT');
      return reply.send({ item_id: itemId, saldo: nuevoSaldo[0].saldo });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── GET /billetera/doblones/paquetes ────────────
  app.get('/billetera/doblones/paquetes', {
    schema: {
      tags:    ['tienda'],
      summary: 'Catálogo de paquetes de doblones (comprar con PayPal)',
      response: { 200: { description: 'Paquetes', type: 'array', items: DoblonPaqueteSchema } },
    },
  }, async (_req, reply) => {
    const { rows } = await pool.query(
      `SELECT id, nombre, doblones, precio_usd, orden FROM doblon_paquetes
       WHERE disponible = true ORDER BY orden`,
    );
    return reply.send(rows);
  });

  // ── POST /billetera/doblones/orden ──────────────
  // Crea la fila `doblon_compras` (id generado acá, ANTES de llamar a
  // PayPal) y la usa como reference_id de la orden — así el webhook puede
  // cruzarla sin depender de que la captura directa haya llegado primero.
  app.post<{ Body: { usuarioId: string; paqueteId: string } }>('/billetera/doblones/orden', {
    schema: {
      tags:    ['tienda'],
      summary: 'Crear una orden de PayPal para comprar un paquete de doblones',
      body: {
        type: 'object',
        required: ['usuarioId', 'paqueteId'],
        properties: {
          usuarioId: { type: 'string', format: 'uuid' },
          paqueteId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { description: 'Orden creada', type: 'object', properties: { orderId: { type: 'string' } } },
        404: { description: 'Paquete no encontrado', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { usuarioId, paqueteId } = req.body;
    const { rows: paqueteRows } = await pool.query(
      `SELECT id, doblones, precio_usd FROM doblon_paquetes WHERE id = $1 AND disponible = true`,
      [paqueteId],
    );
    if (!paqueteRows.length) return reply.code(404).send({ error: 'Paquete no encontrado' });
    const paquete = paqueteRows[0];

    const compraId = crypto.randomUUID();
    const { orderId } = await crearOrden(Number(paquete.precio_usd), compraId);
    await pool.query(
      `INSERT INTO doblon_compras (id, usuario_id, paquete_id, doblones, precio_usd, paypal_order_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [compraId, usuarioId, paquete.id, paquete.doblones, paquete.precio_usd, orderId],
    );
    return reply.send({ orderId });
  });

  // Acredita una compra 'iniciado' → captura contra PayPal + suma el saldo,
  // en una sola transacción con lock de fila. Idempotente: si ya estaba
  // 'aprobado' (la captura directa y el webhook pueden llegar los dos),
  // no hace nada — usado por el endpoint de captura Y por el webhook.
  async function acreditarCompra(paypalOrderId: string): Promise<{ saldo: number; doblones: number } | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: compraRows } = await client.query(
        `SELECT id, usuario_id, doblones FROM doblon_compras
         WHERE paypal_order_id = $1 AND estado = 'iniciado' FOR UPDATE`,
        [paypalOrderId],
      );
      if (!compraRows.length) {
        await client.query('ROLLBACK');
        return null; // ya procesada (o no existe) — no-op idempotente
      }
      const compra = compraRows[0];

      const { capturaId, respuesta } = await capturarOrden(paypalOrderId);

      const { rowCount } = await client.query(
        `UPDATE doblon_compras SET estado = 'aprobado', paypal_capture_id = $1, paypal_respuesta = $2, updated_at = NOW()
         WHERE id = $3 AND estado = 'iniciado'`,
        [capturaId, JSON.stringify(respuesta), compra.id],
      );
      if (rowCount === 0) {
        await client.query('ROLLBACK');
        return null; // carrera con otra llamada — la otra ya acreditó
      }

      await client.query(
        `INSERT INTO billeteras (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [compra.usuario_id],
      );
      const { rows: saldoRows } = await client.query(
        `UPDATE billeteras SET saldo = saldo + $1, updated_at = NOW()
         WHERE usuario_id = $2 RETURNING saldo`,
        [compra.doblones, compra.usuario_id],
      );
      await client.query(
        `INSERT INTO billetera_movimientos (usuario_id, monto, motivo, ref)
         VALUES ($1, $2, 'compra_doblones', $3)`,
        [compra.usuario_id, compra.doblones, compra.id],
      );

      await client.query('COMMIT');
      return { saldo: saldoRows[0].saldo, doblones: compra.doblones };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── POST /billetera/doblones/:orderId/capturar ──
  // El frontend llama esto al disparar onApprove del SDK — nunca se confía
  // en el evento del navegador solo (PLAN_TORNEOS §5.3).
  app.post<{ Params: { orderId: string }; Body: { usuarioId: string } }>('/billetera/doblones/:orderId/capturar', {
    schema: {
      tags:    ['tienda'],
      summary: 'Capturar el pago y acreditar los doblones',
      params: { type: 'object', properties: { orderId: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['usuarioId'],
        properties: { usuarioId: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { description: 'Acreditado', type: 'object', properties: { saldo: { type: 'integer' }, doblones: { type: 'integer' } } },
        404: { description: 'Orden no encontrada o ya procesada', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const resultado = await acreditarCompra(req.params.orderId);
    if (!resultado) return reply.code(404).send({ error: 'Orden no encontrada o ya procesada' });
    return reply.send(resultado);
  });

  // ── POST /interno/paypal/webhook ────────────────
  // Respaldo por si el jugador cierra la pestaña justo después de aprobar,
  // antes de que /capturar complete (PLAN_TORNEOS §5.3). Verificación de
  // firma OBLIGATORIA antes de procesar nada. No expuesto con JWT — lo
  // llama PayPal directamente vía el gateway (ms-usuarios no tiene puerto
  // público), verificado por firma en su lugar.
  //
  // El gateway reenvía los headers `paypal-*` (necesarios para verificar la
  // firma) empaquetados en el body, ya que `callMs()` solo reenvía JSON —
  // ver api-integracion/src/routes/tienda.ts.
  app.post<{ Body: { headers: Record<string, string | undefined>; event: unknown } }>('/interno/paypal/webhook', {
    schema: { tags: ['tienda'], summary: 'Webhook de PayPal (verificado por firma, no por JWT)' },
  }, async (req, reply) => {
    const { headers, event } = req.body;
    const ok = await verificarWebhookSignature(headers, event);
    if (!ok) return reply.code(400).send({ error: 'Firma de webhook inválida' });

    const evento = event as { resource?: { supplementary_data?: { related_ids?: { order_id?: string } }; id?: string } };
    const orderId = evento.resource?.supplementary_data?.related_ids?.order_id ?? evento.resource?.id;
    if (orderId) await acreditarCompra(orderId).catch(() => {}); // idempotente; un fallo acá no debe reintentar infinito vía 5xx

    return reply.code(200).send({ recibido: true });
  });
}

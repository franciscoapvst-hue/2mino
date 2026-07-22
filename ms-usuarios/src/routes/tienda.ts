import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';

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
}

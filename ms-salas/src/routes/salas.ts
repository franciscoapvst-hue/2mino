import { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { pool } from '../db/pool';

// ── Código corto único (reutilizable: salas "2M-" y parties "PT-") ──
export function generarCodigo(prefijo = '2M-'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = prefijo;
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export async function codigoDisponibleEn(
  tabla: 'salas' | 'ranked_parties', prefijo: string,
  // Opcional: la conexión de una transacción ya abierta (ver crearSala en
  // matchmaking.ts). Sin esto, un caller que ya tiene un client afuera de
  // una transacción con un advisory lock tomado pedía OTRA conexión del
  // mismo pool acá adentro — bajo carga, con el pool lleno de conexiones
  // bloqueadas esperando ese mismo advisory lock, esta query nunca
  // encontraba una conexión libre: la transacción quedaba "idle in
  // transaction" para siempre, sin soltar el lock, y todo el matchmaking
  // se trababa detrás (reproducido en producción, ver docs/ESCALABILIDAD.md).
  db: Pick<Pool, 'query'> | PoolClient = pool,
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generarCodigo(prefijo);
    const { rows } = await db.query(`SELECT id FROM ${tabla} WHERE codigo = $1`, [code]);
    if (!rows.length) return code;
  }
  throw new Error('No se pudo generar un código único');
}

async function codigoDisponible(): Promise<string> {
  return codigoDisponibleEn('salas', '2M-');
}

// ── Schemas ───────────────────────────────────────
const JugadorSchema = {
  type: 'object',
  properties: {
    usuario_id: { type: 'string', format: 'uuid' },
    username:   { type: 'string' },
    posicion:   { type: 'integer' },
    equipo:     { type: ['integer', 'null'] },
    listo:      { type: 'boolean' },
    joined_at:  { type: 'string', format: 'date-time' },
  },
} as const;

const SalaSchema = {
  type: 'object',
  properties: {
    id:            { type: 'string', format: 'uuid' },
    codigo:        { type: 'string' },
    nombre:        { type: ['string', 'null'] },
    creador_id:    { type: 'string', format: 'uuid' },
    estado:        { type: 'string', enum: ['esperando','en_juego','finalizada','cancelada'] },
    tipo:          { type: 'string', enum: ['casual','ranked'] },
    modo:          { type: 'string', enum: ['clasico','rapido','torneo'] },
    max_jugadores: { type: 'integer' },
    privada:       { type: 'boolean' },
    config:        { type: 'object', additionalProperties: true },
    jugadores:     { type: 'array', items: JugadorSchema },
    created_at:    { type: 'string', format: 'date-time' },
    updated_at:    { type: 'string', format: 'date-time' },
    started_at:    { type: ['string', 'null'], format: 'date-time' },
    finished_at:   { type: ['string', 'null'], format: 'date-time' },
  },
} as const;

const SalaResumenSchema = {
  type: 'object',
  properties: {
    id:                { type: 'string', format: 'uuid' },
    codigo:            { type: 'string' },
    nombre:            { type: ['string', 'null'] },
    creador_id:        { type: 'string', format: 'uuid' },
    creador_username:  { type: ['string', 'null'] },
    estado:            { type: 'string' },
    tipo:              { type: 'string' },
    modo:              { type: 'string' },
    max_jugadores:     { type: 'integer' },
    jugadores_count:   { type: 'integer' },
    privada:           { type: 'boolean' },
    created_at:        { type: 'string', format: 'date-time' },
  },
} as const;

const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

// ── Helper: sala con jugadores ────────────────────
export async function getSalaConJugadores(id: string) {
  const { rows: sala } = await pool.query(
    `SELECT s.*,
            COALESCE(
              json_agg(sj ORDER BY sj.posicion) FILTER (WHERE sj.usuario_id IS NOT NULL),
              '[]'
            ) AS jugadores
     FROM salas s
     LEFT JOIN sala_jugadores sj ON sj.sala_id = s.id
     WHERE s.id = $1
     GROUP BY s.id`,
    [id],
  );
  return sala[0] ?? null;
}

// ─────────────────────────────────────────────────
export async function salasRoutes(app: FastifyInstance) {

  // ── GET /salas ───────────────────────────────────
  // Lista salas abiertas (esperando) con conteo de jugadores
  app.get('/salas', {
    schema: {
      tags:        ['salas'],
      summary:     'Listar salas abiertas',
      description: 'Devuelve las salas en estado "esperando", ordenadas por creación.',
      querystring: {
        type: 'object',
        properties: {
          tipo:  { type: 'string', enum: ['casual','ranked'] },
          modo:  { type: 'string', enum: ['clasico','rapido','torneo'] },
        },
      },
      response: {
        200: { type: 'array', items: SalaResumenSchema },
      },
    },
  }, async (req: any, reply) => {
    const { tipo, modo } = req.query as { tipo?: string; modo?: string };

    const conditions = [`s.estado = 'esperando'`];
    const params: string[] = [];

    if (tipo) { params.push(tipo); conditions.push(`s.tipo = $${params.length}`); }
    if (modo) { params.push(modo); conditions.push(`s.modo = $${params.length}`); }

    const where = conditions.join(' AND ');

    const { rows } = await pool.query(
      `SELECT s.id, s.codigo, s.nombre, s.creador_id, s.estado, s.tipo, s.modo,
              s.max_jugadores, s.privada, s.created_at,
              COUNT(sj.usuario_id)::int AS jugadores_count,
              MAX(creador.username) AS creador_username
       FROM salas s
       LEFT JOIN sala_jugadores sj      ON sj.sala_id = s.id
       LEFT JOIN sala_jugadores creador ON creador.sala_id = s.id AND creador.usuario_id = s.creador_id
       WHERE ${where}
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      params,
    );
    return reply.send(rows);
  });

  // ── GET /salas/todas ─────────────────────────────
  // Todas las salas (admin / historial)
  app.get('/salas/todas', {
    schema: {
      tags:    ['salas'],
      summary: 'Listar todas las salas (incluye finalizadas y canceladas)',
      querystring: {
        type: 'object',
        properties: {
          estado: { type: 'string', enum: ['esperando','en_juego','finalizada','cancelada'] },
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            salas: { type: 'array', items: SalaResumenSchema },
          },
        },
      },
    },
  }, async (req: any, reply) => {
    const { estado, limit = 50, offset = 0 } = req.query as {
      estado?: string; limit?: number; offset?: number;
    };

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (estado) { params.push(estado); conditions.push(`s.estado = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const lIdx = params.length - 1;
    const oIdx = params.length;

    const [listRes, countRes] = await Promise.all([
      pool.query(
        `SELECT s.id, s.codigo, s.nombre, s.creador_id, s.estado, s.tipo, s.modo,
                s.max_jugadores, s.privada, s.created_at,
                COUNT(sj.usuario_id)::int AS jugadores_count,
                MAX(creador.username) AS creador_username
         FROM salas s
         LEFT JOIN sala_jugadores sj      ON sj.sala_id = s.id
         LEFT JOIN sala_jugadores creador ON creador.sala_id = s.id AND creador.usuario_id = s.creador_id
         ${where}
         GROUP BY s.id
         ORDER BY s.created_at DESC
         LIMIT $${lIdx} OFFSET $${oIdx}`,
        params,
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM salas s ${where}`, params.slice(0, -2)),
    ]);

    return reply.send({ total: countRes.rows[0].total, salas: listRes.rows });
  });

  // ── GET /salas/activa ─────────────────────────────
  // Partida en curso del usuario, si tiene una — para ofrecerle
  // reintegrarse al iniciar sesión (docs/ESCALABILIDAD.md no; esto es
  // continuidad de sesión, no escalabilidad). 200 siempre, `sala: null`
  // si no hay ninguna — no es un error, es una respuesta normal.
  app.get<{ Querystring: { usuario_id: string } }>('/salas/activa', {
    schema: {
      tags: ['salas'], summary: 'Partida en_juego del usuario, si tiene una',
      querystring: {
        type: 'object', required: ['usuario_id'],
        properties: { usuario_id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: {
          type: 'object',
          properties: { sala: { anyOf: [{ ...SalaSchema }, { type: 'null' }] } },
        },
      },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT s.id FROM salas s
       JOIN sala_jugadores sj ON sj.sala_id = s.id
       WHERE sj.usuario_id = $1 AND s.estado = 'en_juego'
       ORDER BY s.started_at DESC LIMIT 1`,
      [req.query.usuario_id],
    );
    if (!rows.length) return reply.send({ sala: null });
    return reply.send({ sala: await getSalaConJugadores(rows[0].id) });
  });

  // ── POST /salas ──────────────────────────────────
  // Crear una sala nueva
  app.post<{
    Body: {
      creador_id: string;
      username:   string;
      nombre?:    string;
      tipo?:      string;
      modo?:      string;
      max_jugadores?: number;
      privada?:   boolean;
      config?:    Record<string, unknown>;
    };
  }>('/salas', {
    schema: {
      tags:    ['salas'],
      summary: 'Crear sala',
      body: {
        type: 'object',
        required: ['creador_id', 'username'],
        properties: {
          creador_id:    { type: 'string', format: 'uuid' },
          username:      { type: 'string' },
          nombre:        { type: 'string', maxLength: 60 },
          tipo:          { type: 'string', enum: ['casual','ranked'], default: 'casual' },
          modo:          { type: 'string', enum: ['clasico','rapido','torneo'], default: 'clasico' },
          max_jugadores: { type: 'integer', enum: [2, 4], default: 4 },
          privada:       { type: 'boolean', default: false },
          config:        { type: 'object', additionalProperties: true },
        },
      },
      response: {
        201: { description: 'Sala creada', ...SalaSchema },
        400: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const {
      creador_id, username,
      nombre = null,
      tipo   = 'casual',
      modo   = 'clasico',
      max_jugadores = 4,
      privada       = false,
      config        = {},
    } = req.body;

    const codigo = await codigoDisponible();

    const { rows } = await pool.query(
      `INSERT INTO salas (codigo, nombre, creador_id, tipo, modo, max_jugadores, privada, config)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [codigo, nombre, creador_id, tipo, modo, max_jugadores, privada, JSON.stringify(config)],
    );

    const sala = rows[0];

    // El creador entra automáticamente en posición 1
    await pool.query(
      `INSERT INTO sala_jugadores (sala_id, usuario_id, username, posicion)
       VALUES ($1,$2,$3,1)`,
      [sala.id, creador_id, username],
    );

    const salaCompleta = await getSalaConJugadores(sala.id);
    return reply.code(201).send(salaCompleta);
  });

  // ── GET /salas/:id ───────────────────────────────
  // Detalle de una sala con sus jugadores
  app.get<{ Params: { id: string } }>('/salas/:id', {
    schema: {
      tags:    ['salas'],
      summary: 'Detalle de sala',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...SalaSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const sala = await getSalaConJugadores(req.params.id);
    if (!sala) return reply.code(404).send({ error: 'Sala no encontrada' });
    return reply.send(sala);
  });

  // ── GET /salas/codigo/:codigo ────────────────────
  // Buscar sala por su código corto
  app.get<{ Params: { codigo: string } }>('/salas/codigo/:codigo', {
    schema: {
      tags:    ['salas'],
      summary: 'Buscar sala por código',
      params: {
        type: 'object',
        properties: { codigo: { type: 'string', example: '2M-AB3C' } },
      },
      response: {
        200: { ...SalaSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query(
      'SELECT id FROM salas WHERE codigo = $1',
      [req.params.codigo.toUpperCase()],
    );
    if (!rows.length) return reply.code(404).send({ error: 'Código de sala no válido' });
    const sala = await getSalaConJugadores(rows[0].id);
    return reply.send(sala);
  });

  // ── POST /salas/:id/unirse ───────────────────────
  app.post<{
    Params: { id: string };
    Body:   { usuario_id: string; username: string };
  }>('/salas/:id/unirse', {
    schema: {
      tags:    ['salas'],
      summary: 'Unirse a una sala',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['usuario_id', 'username'],
        properties: {
          usuario_id: { type: 'string', format: 'uuid' },
          username:   { type: 'string' },
        },
      },
      response: {
        200: { description: 'Sala actualizada', ...SalaSchema },
        400: { ...ErrorSchema },
        404: { ...ErrorSchema },
        409: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params;
    const { usuario_id, username } = req.body;

    const sala = await getSalaConJugadores(id);
    if (!sala) return reply.code(404).send({ error: 'Sala no encontrada' });
    if (sala.estado !== 'esperando') return reply.code(400).send({ error: 'La sala ya no acepta jugadores' });

    const yaEsta = sala.jugadores.some((j: any) => j.usuario_id === usuario_id);
    if (yaEsta) return reply.code(409).send({ error: 'Ya estás en esta sala' });

    if (sala.jugadores.length >= sala.max_jugadores) {
      return reply.code(400).send({ error: 'La sala está llena' });
    }

    // Siguiente posición libre
    const posicionesOcupadas = new Set(sala.jugadores.map((j: any) => j.posicion));
    let posicion = 1;
    while (posicionesOcupadas.has(posicion)) posicion++;

    await pool.query(
      `INSERT INTO sala_jugadores (sala_id, usuario_id, username, posicion)
       VALUES ($1,$2,$3,$4)`,
      [id, usuario_id, username, posicion],
    );

    const actualizada = await getSalaConJugadores(id);
    return reply.send(actualizada);
  });

  // ── POST /salas/:id/posicion ─────────────────────
  // Cambiar de asiento en la sala de espera. Los equipos son los
  // asientos enfrentados (1&3 vs 2&4), así que elegir posición = elegir pareja.
  app.post<{
    Params: { id: string };
    Body:   { usuario_id: string; posicion: number };
  }>('/salas/:id/posicion', {
    schema: {
      tags:    ['salas'],
      summary: 'Cambiar de posición/asiento (define los equipos)',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['usuario_id', 'posicion'],
        properties: {
          usuario_id: { type: 'string', format: 'uuid' },
          posicion:   { type: 'integer', minimum: 1, maximum: 4 },
        },
      },
      response: {
        200: { ...SalaSchema },
        400: { ...ErrorSchema },
        404: { ...ErrorSchema },
        409: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params;
    const { usuario_id, posicion } = req.body;

    const sala = await getSalaConJugadores(id);
    if (!sala) return reply.code(404).send({ error: 'Sala no encontrada' });
    if (sala.estado !== 'esperando') return reply.code(400).send({ error: 'La partida ya empezó' });
    if (posicion > sala.max_jugadores) return reply.code(400).send({ error: 'Posición fuera de rango' });

    const yo = sala.jugadores.find((j: any) => j.usuario_id === usuario_id);
    if (!yo) return reply.code(400).send({ error: 'No estás en esta sala' });

    const ocupada = sala.jugadores.some(
      (j: any) => j.posicion === posicion && j.usuario_id !== usuario_id,
    );
    if (ocupada) return reply.code(409).send({ error: 'Ese asiento está ocupado' });

    await pool.query(
      'UPDATE sala_jugadores SET posicion=$1 WHERE sala_id=$2 AND usuario_id=$3',
      [posicion, id, usuario_id],
    );

    const actualizada = await getSalaConJugadores(id);
    return reply.send(actualizada);
  });

  // ── POST /salas/:id/salir ────────────────────────
  app.post<{
    Params: { id: string };
    Body:   { usuario_id: string };
  }>('/salas/:id/salir', {
    schema: {
      tags:    ['salas'],
      summary: 'Salir de una sala',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['usuario_id'],
        properties: { usuario_id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { ...SalaSchema },
        400: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params;
    const { usuario_id } = req.body;

    const sala = await getSalaConJugadores(id);
    if (!sala) return reply.code(404).send({ error: 'Sala no encontrada' });
    if (sala.estado === 'en_juego') return reply.code(400).send({ error: 'No puedes salir de una partida en curso' });

    await pool.query(
      'DELETE FROM sala_jugadores WHERE sala_id=$1 AND usuario_id=$2',
      [id, usuario_id],
    );

    // Si era el creador y quedan jugadores, transfiere la sala al primer jugador
    if (sala.creador_id === usuario_id) {
      const { rows: restantes } = await pool.query(
        'SELECT usuario_id FROM sala_jugadores WHERE sala_id=$1 ORDER BY posicion LIMIT 1',
        [id],
      );
      if (restantes.length) {
        await pool.query(
          'UPDATE salas SET creador_id=$1, updated_at=NOW() WHERE id=$2',
          [restantes[0].usuario_id, id],
        );
      } else {
        // Sala vacía → cancelar
        await pool.query(
          `UPDATE salas SET estado='cancelada', updated_at=NOW() WHERE id=$1`,
          [id],
        );
      }
    }

    const actualizada = await getSalaConJugadores(id);
    return reply.send(actualizada);
  });

  // ── PATCH /salas/:id/estado ──────────────────────
  app.patch<{
    Params: { id: string };
    Body:   { estado: string; solicitante_id: string };
  }>('/salas/:id/estado', {
    schema: {
      tags:    ['salas'],
      summary: 'Cambiar estado de la sala (solo el creador)',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['estado', 'solicitante_id'],
        properties: {
          estado:          { type: 'string', enum: ['esperando','en_juego','finalizada','cancelada'] },
          solicitante_id:  { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { ...SalaSchema },
        403: { ...ErrorSchema },
        404: { ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params;
    const { estado, solicitante_id } = req.body;

    const { rows } = await pool.query('SELECT * FROM salas WHERE id=$1', [id]);
    if (!rows.length) return reply.code(404).send({ error: 'Sala no encontrada' });
    if (rows[0].creador_id !== solicitante_id) return reply.code(403).send({ error: 'Solo el creador puede cambiar el estado' });

    const extra: Record<string, string> = {};
    if (estado === 'en_juego')   extra.started_at  = 'NOW()';
    if (estado === 'finalizada') extra.finished_at = 'NOW()';

    const extraSQL = Object.keys(extra).map(k => `, ${k}=${extra[k]}`).join('');

    await pool.query(
      `UPDATE salas SET estado=$1, updated_at=NOW()${extraSQL} WHERE id=$2`,
      [estado, id],
    );

    const sala = await getSalaConJugadores(id);
    return reply.send(sala);
  });
}

// ── Limpieza: salas incompletas/abandonadas ───────
// Dos casos, ambos sin partida jugada (no hay historial/ELO/replay que
// perder — esas tablas solo tienen filas para salas que llegaron a
// 'en_juego'):
//  - 'esperando' que no se llenó (jugadores_count < max_jugadores) en los
//    primeros 5 minutos desde su creación — el caso típico es el creador
//    solo, que nunca invitó a nadie ni salió formalmente (comprobado
//    contra la base real: hay salas 'esperando' con 1 solo jugador desde
//    hace días). Se ancla a created_at, no a "cuánto lleva incompleta",
//    para no depender de una columna nueva que haya que tocar en cada
//    join/salida — simple a propósito, esto es limpieza best-effort.
//  - 'cancelada' — se genera cuando el último jugador se va (POST
//    /salas/:id/salir) o el creador cierra la sala (PATCH
//    /salas/:id/estado), pero nunca se borra sola, así que se acumulan.
//    updated_at sí queda exacto acá (ambos paths lo tocan al cancelar).
export async function limpiarSalasIncompletas(): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM salas s
     WHERE (
       s.estado = 'esperando'
       AND s.created_at < NOW() - INTERVAL '5 minutes'
       AND (SELECT COUNT(*) FROM sala_jugadores sj WHERE sj.sala_id = s.id) < s.max_jugadores
     ) OR (
       s.estado = 'cancelada'
       AND s.updated_at < NOW() - INTERVAL '5 minutes'
     )`,
  );
  return rowCount ?? 0;
}

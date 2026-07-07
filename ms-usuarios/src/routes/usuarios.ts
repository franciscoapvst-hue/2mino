import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../db/pool';

const ROUNDS = 12;

// ── Schemas reutilizables ─────────────────────────
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

const UserSchema = {
  type: 'object',
  properties: {
    id:              { type: 'string', format: 'uuid' },
    username:        { type: 'string' },
    email:           { type: 'string', format: 'email' },
    segmento_id:     { type: 'string', format: 'uuid' },
    segmento:        { type: 'string' },
    segmento_config: { type: 'object', additionalProperties: true },
    avatar:          { type: 'string', nullable: true },
    created_at:      { type: 'string', format: 'date-time' },
    updated_at:      { type: 'string', format: 'date-time' },
  },
} as const;

const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

const MessageSchema = {
  type: 'object',
  properties: { message: { type: 'string' } },
} as const;

// ─────────────────────────────────────────────────
export async function usuariosRoutes(app: FastifyInstance) {

  // ── GET /segmentos ──────────────────────────────
  app.get('/segmentos', {
    schema: {
      tags:    ['segmentos'],
      summary: 'Listar todos los segmentos activos',
      response: {
        200: {
          description: 'Lista de segmentos',
          type: 'array',
          items: SegmentoSchema,
        },
      },
    },
  }, async (_req, reply) => {
    const { rows } = await pool.query(
      `SELECT id, nombre, descripcion, config, activo, created_at, updated_at
       FROM segmentos WHERE activo = true ORDER BY nombre`,
    );
    return reply.send(rows);
  });

  // ── POST /usuarios ──────────────────────────────
  app.post<{ Body: { username: string; email: string; password: string; segmento?: string } }>(
    '/usuarios',
    {
      schema: {
        tags:        ['usuarios'],
        summary:     'Crear usuario',
        description: 'Crea un usuario nuevo. Se asigna al segmento indicado (default: tester).',
        body: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 20, example: 'jugador42' },
            email:    { type: 'string', format: 'email', example: 'jugador@correo.com' },
            password: { type: 'string', minLength: 8,   example: 'MiPass123!' },
            segmento: { type: 'string', example: 'tester' },
          },
        },
        response: {
          201: { description: 'Usuario creado',           ...UserSchema },
          409: { description: 'Username o email en uso',  ...ErrorSchema },
          400: { description: 'Datos inválidos',           ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { username, email, password, segmento = 'tester' } = req.body;
      const passwordHash = await bcrypt.hash(password, ROUNDS);

      const { rows: segRows } = await pool.query(
        `SELECT id FROM segmentos WHERE nombre = $1 AND activo = true`,
        [segmento],
      );
      if (!segRows.length) {
        return reply.code(400).send({ error: `Segmento '${segmento}' no existe o está inactivo` });
      }
      const segmentoId = segRows[0].id;

      try {
        const { rows } = await pool.query(
          `INSERT INTO usuarios (username, email, password_hash, segmento_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id, username, email, segmento_id, created_at`,
          [username, email, passwordHash, segmentoId],
        );
        return reply.code(201).send({ ...rows[0], segmento });
      } catch (err: any) {
        if (err.code === '23505') {
          const field = err.detail?.includes('username') ? 'username' : 'email';
          return reply.code(409).send({ error: `El ${field} ya está registrado` });
        }
        throw err;
      }
    },
  );

  // ── POST /usuarios/verificar ────────────────────
  app.post<{ Body: { email: string; password: string } }>(
    '/usuarios/verificar',
    {
      schema: {
        tags:        ['usuarios'],
        summary:     'Verificar credenciales',
        description: 'Compara email + contraseña. Devuelve el usuario con su segmento.',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'jugador@correo.com' },
            password: { type: 'string', example: 'MiPass123!' },
          },
        },
        response: {
          200: { description: 'Credenciales válidas', ...UserSchema },
          401: { description: 'Credenciales inválidas', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body;

      const { rows } = await pool.query(
        `SELECT u.*, s.nombre as segmento, s.config as segmento_config
         FROM usuarios u
         LEFT JOIN segmentos s ON s.id = u.segmento_id
         WHERE u.email = $1`,
        [email],
      );

      if (!rows.length) {
        return reply.code(401).send({ error: 'Credenciales inválidas' });
      }

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return reply.code(401).send({ error: 'Credenciales inválidas' });

      const { password_hash, ...safeUser } = user;
      return reply.send(safeUser);
    },
  );

  // ── GET /usuarios/:id ───────────────────────────
  app.get<{ Params: { id: string } }>(
    '/usuarios/:id',
    {
      schema: {
        tags:    ['usuarios'],
        summary: 'Obtener usuario por ID (incluye segmento)',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'UUID del usuario' },
          },
        },
        response: {
          200: { description: 'Usuario encontrado',    ...UserSchema },
          404: { description: 'Usuario no encontrado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT u.id, u.username, u.email, u.segmento_id, u.avatar, u.created_at, u.updated_at,
                s.nombre as segmento, s.config as segmento_config
         FROM usuarios u
         LEFT JOIN segmentos s ON s.id = u.segmento_id
         WHERE u.id = $1`,
        [req.params.id],
      );
      if (!rows.length) return reply.code(404).send({ error: 'Usuario no encontrado' });
      return reply.send(rows[0]);
    },
  );

  // ── GET /usuarios/por-username/:username ────────
  // Resuelve username → id. Lo usa el gateway (routes/social.ts) para
  // "agregar amigo por nombre de usuario" — ms-social no guarda username
  // como clave, solo UUID, así que el gateway resuelve acá antes de llamar
  // a POST /solicitudes.
  app.get<{ Params: { username: string } }>(
    '/usuarios/por-username/:username',
    {
      schema: {
        tags:    ['usuarios'],
        summary: 'Buscar usuario por username (resuelve a UUID)',
        params: {
          type: 'object',
          properties: { username: { type: 'string' } },
        },
        response: {
          200: { description: 'Usuario encontrado',    ...UserSchema },
          404: { description: 'Usuario no encontrado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT u.id, u.username, u.email, u.segmento_id, u.avatar, u.created_at, u.updated_at,
                s.nombre as segmento, s.config as segmento_config
         FROM usuarios u
         LEFT JOIN segmentos s ON s.id = u.segmento_id
         WHERE u.username = $1`,
        [req.params.username],
      );
      if (!rows.length) return reply.code(404).send({ error: 'Usuario no encontrado' });
      return reply.send(rows[0]);
    },
  );

  // ── GET /usuarios/buscar ─────────────────────────
  // Búsqueda por prefijo de username, para autocompletar mientras se
  // escribe (ej. buscador de "agregar amigo" en FriendsView). Distinto
  // de por-username/:username (que exige match exacto para resolver a
  // UUID); acá puede haber 0, 1 o varios resultados.
  app.get<{ Querystring: { q: string; excluir?: string; limit?: number } }>(
    '/usuarios/buscar',
    {
      schema: {
        tags:    ['usuarios'],
        summary: 'Buscar usuarios por prefijo de username (autocompletar)',
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q:       { type: 'string', minLength: 1, maxLength: 20 },
            excluir: { type: 'string', format: 'uuid' },
            limit:   { type: 'integer', minimum: 1, maximum: 20, default: 8 },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id:       { type: 'string', format: 'uuid' },
                username: { type: 'string' },
                avatar:   { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { q, excluir, limit = 8 } = req.query;
      const { rows } = await pool.query(
        `SELECT id, username, avatar FROM usuarios
         WHERE username ILIKE $1 || '%' AND ($2::uuid IS NULL OR id != $2)
         ORDER BY username ASC LIMIT $3`,
        [q, excluir ?? null, limit],
      );
      return reply.send(rows);
    },
  );

  // ── PATCH /usuarios/:id/avatar ──────────────────
  app.patch<{ Params: { id: string }; Body: { avatar: string } }>(
    '/usuarios/:id/avatar',
    {
      schema: {
        tags:        ['usuarios'],
        summary:     'Actualizar avatar del usuario',
        description: 'Guarda el nombre de archivo del avatar elegido de la carpeta de fotos de perfil.',
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['avatar'],
          properties: {
            avatar: { type: 'string', minLength: 1, maxLength: 100, example: 'avatar-01.png' },
          },
        },
        response: {
          200: { description: 'Avatar actualizado',    ...UserSchema },
          404: { description: 'Usuario no encontrado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { rows } = await pool.query(
        `UPDATE usuarios SET avatar = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, username, email, segmento_id, avatar, created_at, updated_at`,
        [req.body.avatar, req.params.id],
      );
      if (!rows.length) return reply.code(404).send({ error: 'Usuario no encontrado' });
      return reply.send(rows[0]);
    },
  );

  // ── POST /usuarios/reset-token ──────────────────
  app.post<{ Body: { email: string } }>(
    '/usuarios/reset-token',
    {
      schema: {
        tags:        ['usuarios'],
        summary:     'Generar token de recuperación de contraseña',
        description: 'Crea un token de 1 hora. En producción se enviaría por email; en dev se incluye en la respuesta.',
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email', example: 'jugador@correo.com' },
          },
        },
        response: {
          200: {
            description: 'Solicitud procesada',
            type: 'object',
            properties: {
              message:    { type: 'string' },
              _dev_token: { type: 'string', description: 'Solo visible fuera de producción' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { email } = req.body;
      const { rows } = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);

      const msg = 'Si el correo existe, recibirás instrucciones en breve';
      if (!rows.length) return reply.send({ message: msg });

      await pool.query(
        `UPDATE reset_tokens SET used = TRUE WHERE usuario_id = $1 AND used = FALSE`,
        [rows[0].id],
      );

      const token     = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO reset_tokens (usuario_id, token, expires_at) VALUES ($1, $2, $3)`,
        [rows[0].id, token, expiresAt],
      );

      app.log.info({ email, token }, 'Reset token generado');

      if (process.env.ENABLE_EMAIL === 'true') {
        // TODO: integrar proveedor de email (SendGrid, Resend, SES, etc.)
        app.log.warn('Email sending enabled pero no implementado aún');
      } else {
        app.log.info('Email sending deshabilitado (ENABLE_EMAIL=false)');
      }

      return reply.send({
        message: msg,
        ...(process.env.NODE_ENV !== 'production' && { _dev_token: token }),
      });
    },
  );

  // ── POST /usuarios/reset-password ──────────────
  app.post<{ Body: { token: string; newPassword: string } }>(
    '/usuarios/reset-password',
    {
      schema: {
        tags:        ['usuarios'],
        summary:     'Restablecer contraseña con token',
        description: 'Valida el token (no usado, no expirado) y actualiza la contraseña.',
        body: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token:       { type: 'string', description: 'Token recibido por email', example: 'abc123...' },
            newPassword: { type: 'string', minLength: 8, example: 'NuevoPass456!' },
          },
        },
        response: {
          200: { description: 'Contraseña actualizada',   ...MessageSchema },
          400: { description: 'Token inválido o expirado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { token, newPassword } = req.body;

      const { rows } = await pool.query(
        `SELECT * FROM reset_tokens
         WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
        [token],
      );

      if (!rows.length) return reply.code(400).send({ error: 'Token inválido o expirado' });

      const passwordHash = await bcrypt.hash(newPassword, ROUNDS);

      await pool.query(
        'UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, rows[0].usuario_id],
      );

      await pool.query('UPDATE reset_tokens SET used = TRUE WHERE id = $1', [rows[0].id]);

      return reply.send({ message: 'Contraseña actualizada correctamente' });
    },
  );

  // ── POST /usuarios/oauth-google ─────────────────
  // El gateway ya verificó el ID token de Google antes de llamar acá — este
  // endpoint solo hace find-or-create por email. Si es un usuario nuevo, se
  // genera un username único a partir del sugerido y una contraseña aleatoria
  // (password_hash es NOT NULL pero esta cuenta nunca la usa para loguearse;
  // sigue sirviendo el flujo de "olvidé mi contraseña" si alguna vez la quiere).
  app.post<{ Body: { email: string; nombreSugerido: string } }>(
    '/usuarios/oauth-google',
    {
      schema: {
        tags:        ['usuarios'],
        summary:     'Find-or-create para login con Google',
        description: 'Busca un usuario por email; si no existe, lo crea con un username derivado del nombre de Google.',
        body: {
          type: 'object',
          required: ['email', 'nombreSugerido'],
          properties: {
            email:          { type: 'string', format: 'email' },
            nombreSugerido: { type: 'string' },
          },
        },
        response: {
          200: { description: 'Usuario existente', ...UserSchema },
          201: { description: 'Usuario creado',     ...UserSchema },
        },
      },
    },
    async (req, reply) => {
      const { email, nombreSugerido } = req.body;

      const { rows: existentes } = await pool.query(
        `SELECT u.*, s.nombre as segmento, s.config as segmento_config
         FROM usuarios u
         LEFT JOIN segmentos s ON s.id = u.segmento_id
         WHERE u.email = $1`,
        [email],
      );
      if (existentes.length) {
        const { password_hash, ...safeUser } = existentes[0];
        return reply.send(safeUser);
      }

      const { rows: segRows } = await pool.query(
        `SELECT id FROM segmentos WHERE nombre = 'tester' AND activo = true`,
      );
      const segmentoId = segRows[0].id;

      const base = nombreSugerido
        .normalize('NFD').replace(/[̀-ͯ]/g, '')  // saca acentos
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 16) || 'jugador';
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), ROUNDS);

      // Prueba el nombre base y, si está tomado, le agrega un sufijo numérico
      // hasta encontrar uno libre (usuarios concurrentes podrían chocar igual,
      // por eso el catch de 23505 más abajo como red de seguridad final).
      for (let intento = 0; intento < 20; intento++) {
        const username = intento === 0 ? base : `${base}${Math.floor(Math.random() * 10000)}`.slice(0, 20);
        try {
          const { rows } = await pool.query(
            `INSERT INTO usuarios (username, email, password_hash, segmento_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, email, segmento_id, avatar, created_at`,
            [username, email, passwordHash, segmentoId],
          );
          return reply.code(201).send({ ...rows[0], segmento: 'tester' });
        } catch (err: any) {
          if (err.code === '23505' && err.detail?.includes('username')) continue;
          throw err;
        }
      }
      return reply.code(500).send({ error: 'No se pudo generar un username único' });
    },
  );
}

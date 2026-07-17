import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { enviarEmailVerificacion } from '../email';

const ROUNDS = 12;
// bcrypt(12) por invitado (varios cientos de ms de CPU cada uno, y esa
// contraseña no la ve ni la usa nadie — nunca hay login real contra una
// cuenta invitado) fue el cuello de botella real bajo carga en el load
// test de docs/ESCALABILIDAD.md, no Postgres. 4 rounds es ~256x más barato
// y sigue siendo un hash bcrypt válido (compare() contra un formato roto
// puede tirar en vez de devolver false, así que no vale la pena ahorrarse
// el bcrypt.hash entero acá solo para esta cuenta descartable).
const ROUNDS_INVITADO = 4;

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
    activo:          { type: 'boolean' },
    email_verificado: { type: 'boolean' },
    created_at:      { type: 'string', format: 'date-time' },
    updated_at:      { type: 'string', format: 'date-time' },
  },
} as const;

// Superset de UserSchema (perfil + segmento + ELO) — GET /usuarios/:id/completo.
const UsuarioCompletoSchema = {
  type: 'object',
  properties: {
    ...UserSchema.properties,
    segmento:        { type: 'string', nullable: true },
    segmento_config: { type: 'object', additionalProperties: true, nullable: true },
    elo:             { type: 'integer' },
    partidas:        { type: 'integer' },
    ganadas:         { type: 'integer' },
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
  app.get<{ Querystring: { incluirInactivos?: string } }>('/segmentos', {
    schema: {
      tags:    ['segmentos'],
      summary: 'Listar segmentos',
      description: 'Por defecto solo los activos. `incluirInactivos=true` trae todos (uso del Back Office).',
      querystring: {
        type: 'object',
        properties: { incluirInactivos: { type: 'string', enum: ['true', 'false'] } },
      },
      response: {
        200: {
          description: 'Lista de segmentos',
          type: 'array',
          items: SegmentoSchema,
        },
      },
    },
  }, async (req, reply) => {
    const todos = req.query.incluirInactivos === 'true';
    const { rows } = await pool.query(
      `SELECT id, nombre, descripcion, config, activo, created_at, updated_at
       FROM segmentos ${todos ? '' : 'WHERE activo = true'} ORDER BY nombre`,
    );
    return reply.send(rows);
  });

  // ── POST /segmentos ─────────────────────────────
  // Back Office §4 — crear un segmento nuevo (config vacía, se edita después).
  app.post<{ Body: { nombre: string; descripcion?: string } }>('/segmentos', {
    schema: {
      tags:        ['segmentos'],
      summary:     'Crear segmento',
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
        409: { description: 'Ya existe un segmento con ese nombre', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { nombre, descripcion = '' } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO segmentos (nombre, descripcion, config)
         VALUES ($1, $2, '{}') RETURNING id, nombre, descripcion, config, activo, created_at, updated_at`,
        [nombre, descripcion],
      );
      return reply.code(201).send(rows[0]);
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ error: `El segmento '${nombre}' ya existe` });
      throw err;
    }
  });

  // ── PATCH /segmentos/:id/estado ─────────────────
  app.patch<{ Params: { id: string }; Body: { activo: boolean } }>('/segmentos/:id/estado', {
    schema: {
      tags:        ['segmentos'],
      summary:     'Activar o desactivar un segmento',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        required: ['activo'],
        properties: { activo: { type: 'boolean' } },
      },
      response: {
        200: { description: 'Segmento actualizado',   ...SegmentoSchema },
        404: { description: 'Segmento no encontrado', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query(
      `UPDATE segmentos SET activo = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, nombre, descripcion, config, activo, created_at, updated_at`,
      [req.body.activo, req.params.id],
    );
    if (!rows.length) return reply.code(404).send({ error: 'Segmento no encontrado' });
    return reply.send(rows[0]);
  });

  // ── GET /usuarios ────────────────────────────────
  // Back Office §3 — buscar/listar. Sin cursor de paginación todavía (el
  // volumen de usuarios hoy no lo justifica); ordenado por más reciente.
  app.get<{ Querystring: { q?: string } }>('/usuarios', {
    schema: {
      tags:        ['usuarios'],
      summary:     'Buscar/listar usuarios (Back Office)',
      querystring: {
        type: 'object',
        properties: { q: { type: 'string', maxLength: 100 } },
      },
      response: {
        200: { description: 'Usuarios encontrados', type: 'array', items: UserSchema },
      },
    },
  }, async (req, reply) => {
    const q = (req.query.q ?? '').trim();
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, u.segmento_id, u.activo, u.created_at, u.updated_at,
              s.nombre as segmento
       FROM usuarios u
       LEFT JOIN segmentos s ON s.id = u.segmento_id
       WHERE $1 = '' OR u.username ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%'
       ORDER BY u.created_at DESC
       LIMIT 100`,
      [q],
    );
    return reply.send(rows);
  });

  // ── PATCH /usuarios/:id/segmento ─────────────────
  app.patch<{ Params: { id: string }; Body: { segmentoId: string } }>('/usuarios/:id/segmento', {
    schema: {
      tags:        ['usuarios'],
      summary:     'Cambiar el segmento de un usuario',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        required: ['segmentoId'],
        properties: { segmentoId: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { description: 'Usuario actualizado',    ...UserSchema },
        404: { description: 'Usuario no encontrado',  ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { rowCount } = await pool.query(
      `UPDATE usuarios SET segmento_id = $1, updated_at = NOW() WHERE id = $2`,
      [req.body.segmentoId, req.params.id],
    );
    if (!rowCount) return reply.code(404).send({ error: 'Usuario no encontrado' });

    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, u.segmento_id, u.activo, u.created_at, u.updated_at,
              s.nombre as segmento
       FROM usuarios u LEFT JOIN segmentos s ON s.id = u.segmento_id WHERE u.id = $1`,
      [req.params.id],
    );
    return reply.send(rows[0]);
  });

  // ── PATCH /usuarios/:id/estado ───────────────────
  // Banear/reactivar — nunca borra: /usuarios/verificar (login) rechaza
  // si activo=false. Reversible, no rompe FKs de salas/ranked/amigos.
  app.patch<{ Params: { id: string }; Body: { activo: boolean } }>('/usuarios/:id/estado', {
    schema: {
      tags:        ['usuarios'],
      summary:     'Banear o reactivar una cuenta',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        required: ['activo'],
        properties: { activo: { type: 'boolean' } },
      },
      response: {
        200: { description: 'Usuario actualizado',   ...UserSchema },
        404: { description: 'Usuario no encontrado', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query(
      `UPDATE usuarios SET activo = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, username, email, segmento_id, activo, created_at, updated_at`,
      [req.body.activo, req.params.id],
    );
    if (!rows.length) return reply.code(404).send({ error: 'Usuario no encontrado' });
    return reply.send(rows[0]);
  });

  // ── DELETE /usuarios/:id ─────────────────────────
  // Borrado real (a diferencia de /estado, que solo banea con un flag).
  // Pensado para liberar email/username de cuentas de prueba (ej. volver
  // a registrar con la misma cuenta de Google al testear OAuth) — no es
  // el flujo de "eliminar mi cuenta" de un jugador real, ese debería ser
  // el ban reversible de siempre.
  //
  // usuario_id en ms-salas/ms-social es un UUID suelto, SIN constraint de
  // FK real entre servicios (bounded contexts separados aunque compartan
  // Postgres) — este DELETE no puede fallar por eso, pero tampoco limpia
  // esas filas: el historial/ranked de OTRO jugador que compitió contra
  // este usuario sigue intacto (referencia un id que ya no existe, mismo
  // criterio que cualquier plataforma real: borrar tu cuenta no borra el
  // resultado del partido de tu rival). Aceptable para cuentas de prueba
  // de bajo uso; si esto se usa sobre cuentas con actividad real, evaluar
  // sumar limpieza en cascada en ms-salas/ms-social.
  app.delete<{ Params: { id: string } }>('/usuarios/:id', {
    schema: {
      tags:        ['usuarios'],
      summary:     'Eliminar una cuenta (borrado real, no reversible)',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: {
        200: { description: 'Usuario eliminado',     ...MessageSchema },
        404: { description: 'Usuario no encontrado', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { rowCount } = await pool.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
    if (!rowCount) return reply.code(404).send({ error: 'Usuario no encontrado' });
    return reply.send({ message: 'Usuario eliminado' });
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
            segmento: { type: 'string', example: 'jugador' },
          },
        },
        response: {
          201: {
            description: 'Usuario creado — requiere confirmar el email antes de poder loguear',
            type: 'object',
            properties: { message: { type: 'string' } },
          },
          409: { description: 'Username o email en uso',  ...ErrorSchema },
          400: { description: 'Datos inválidos',           ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { username, email, password, segmento = 'jugador' } = req.body;
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
          `INSERT INTO usuarios (username, email, password_hash, segmento_id, email_verificado)
           VALUES ($1, $2, $3, $4, false)
           RETURNING id, username, email`,
          [username, email, passwordHash, segmentoId],
        );
        const usuario = rows[0];

        const token     = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await pool.query(
          `INSERT INTO email_verificacion_tokens (usuario_id, token, expires_at) VALUES ($1, $2, $3)`,
          [usuario.id, token, expiresAt],
        );
        await enviarEmailVerificacion(usuario.email, usuario.username, token);
        app.log.info({ email: usuario.email, token }, 'Token de verificación de email generado');

        return reply.code(201).send({
          message: 'Cuenta creada. Revisá tu correo para confirmarla antes de iniciar sesión.',
          ...(process.env.NODE_ENV !== 'production' && { _dev_token: token }),
        });
      } catch (err: any) {
        if (err.code === '23505') {
          const field = err.detail?.includes('username') ? 'username' : 'email';
          return reply.code(409).send({ error: `El ${field} ya está registrado` });
        }
        throw err;
      }
    },
  );

  // ── POST /usuarios/verificar-email ──────────────
  // Confirma la cuenta a partir del token del link del email. Devuelve el
  // usuario completo (mismo shape que /usuarios/verificar) para que el
  // gateway pueda firmar sesión directo — clickear el link ya loguea.
  app.post<{ Body: { token: string } }>(
    '/usuarios/verificar-email',
    {
      schema: {
        tags:        ['usuarios'],
        summary:     'Confirmar cuenta con el token del email',
        body: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string' } },
        },
        response: {
          200: { description: 'Cuenta confirmada', ...UserSchema },
          400: { description: 'Token inválido, vencido o ya usado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT * FROM email_verificacion_tokens
         WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
        [req.body.token],
      );
      if (!rows.length) return reply.code(400).send({ error: 'Link inválido o vencido' });

      const { usuario_id } = rows[0];
      await pool.query('UPDATE usuarios SET email_verificado = true WHERE id = $1', [usuario_id]);
      await pool.query('UPDATE email_verificacion_tokens SET used = TRUE WHERE token = $1', [req.body.token]);

      const { rows: userRows } = await pool.query(
        `SELECT u.*, s.nombre as segmento, s.config as segmento_config
         FROM usuarios u LEFT JOIN segmentos s ON s.id = u.segmento_id
         WHERE u.id = $1`,
        [usuario_id],
      );
      const { password_hash, ...safeUser } = userRows[0];
      return reply.send(safeUser);
    },
  );

  // ── POST /usuarios/reenviar-verificacion ────────
  app.post<{ Body: { email: string } }>(
    '/usuarios/reenviar-verificacion',
    {
      schema: {
        tags:        ['usuarios'],
        summary:     'Reenviar el email de confirmación de cuenta',
        body: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { message: { type: 'string' }, _dev_token: { type: 'string' } },
          },
        },
      },
    },
    async (req, reply) => {
      const msg = 'Si el correo existe y no está confirmado, te reenviamos el link';
      const { rows } = await pool.query(
        'SELECT id, username, email, email_verificado FROM usuarios WHERE email = $1',
        [req.body.email],
      );
      if (!rows.length || rows[0].email_verificado) return reply.send({ message: msg });

      const usuario = rows[0];
      await pool.query(
        `UPDATE email_verificacion_tokens SET used = TRUE WHERE usuario_id = $1 AND used = FALSE`,
        [usuario.id],
      );
      const token     = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO email_verificacion_tokens (usuario_id, token, expires_at) VALUES ($1, $2, $3)`,
        [usuario.id, token, expiresAt],
      );
      await enviarEmailVerificacion(usuario.email, usuario.username, token);

      return reply.send({
        message: msg,
        ...(process.env.NODE_ENV !== 'production' && { _dev_token: token }),
      });
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
          403: {
            description: 'Cuenta sin confirmar',
            type: 'object',
            properties: { error: { type: 'string' }, code: { type: 'string' } },
          },
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
      if (user.activo === false) return reply.code(401).send({ error: 'Cuenta desactivada' });
      if (user.email_verificado === false) {
        return reply.code(403).send({
          error: 'Confirmá tu cuenta desde el email que te mandamos antes de iniciar sesión',
          code:  'EMAIL_NO_VERIFICADO',
        });
      }

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
        `SELECT u.id, u.username, u.email, u.segmento_id, u.avatar, u.activo, u.created_at, u.updated_at,
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

  // ── GET /usuarios/:id/completo ──────────────────
  // Back Office §3 "ver detalle" — perfil + segmento + ELO en una sola
  // consulta, vía la función usuario_completo() (ver db/pool.ts para el
  // porqué de una función y no una vista para cruzar con ranked_ratings
  // de ms-salas).
  app.get<{ Params: { id: string } }>(
    '/usuarios/:id/completo',
    {
      schema: {
        tags:        ['usuarios'],
        summary:     'Perfil completo del usuario (segmento + ELO)',
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { description: 'Perfil completo',       ...UsuarioCompletoSchema },
          404: { description: 'Usuario no encontrado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT * FROM usuario_completo($1)`,
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
        `SELECT id FROM segmentos WHERE nombre = 'jugador' AND activo = true`,
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
        const username = intento === 0 ? base : `${base}${crypto.randomInt(10000)}`.slice(0, 20);
        try {
          const { rows } = await pool.query(
            `INSERT INTO usuarios (username, email, password_hash, segmento_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, email, segmento_id, avatar, created_at`,
            [username, email, passwordHash, segmentoId],
          );
          return reply.code(201).send({ ...rows[0], segmento: 'jugador' });
        } catch (err: any) {
          if (err.code === '23505' && err.detail?.includes('username')) continue;
          throw err;
        }
      }
      return reply.code(500).send({ error: 'No se pudo generar un username único' });
    },
  );

  // ── POST /usuarios/invitado ─────────────────────
  // Crea una cuenta real y efímera, sin pedir ningún dato — mismo patrón
  // que oauth-google (username generado, password aleatoria que la cuenta
  // nunca usa), pero sin email real: se genera uno sintético único porque
  // la columna es NOT NULL UNIQUE. email_verificado queda en su default
  // (true), no hace falta verificar nada. El bloqueo de ranked/torneos
  // para este segmento vive en el gateway (api-integracion), no acá.
  app.post('/usuarios/invitado', {
    schema: {
      tags:        ['usuarios'],
      summary:     'Crea una sesión de invitado (sin registro)',
      description: 'Cuenta efímera sin email/password reales — el gateway bloquea ranked (y, cuando exista, torneos) para este segmento.',
      response: {
        201: { description: 'Cuenta creada', ...UserSchema },
      },
    },
  }, async (req, reply) => {
    const { rows: segRows } = await pool.query(
      `SELECT id FROM segmentos WHERE nombre = 'invitado' AND activo = true`,
    );
    const segmentoId = segRows[0].id;
    const email = `invitado-${crypto.randomUUID()}@guest.2mino.local`;
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), ROUNDS_INVITADO);

    // Mismo loop de reintento con sufijo numérico que oauth-google.
    for (let intento = 0; intento < 20; intento++) {
      const username = intento === 0 ? 'Invitado' : `Invitado${crypto.randomInt(10000)}`.slice(0, 20);
      try {
        const { rows } = await pool.query(
          `INSERT INTO usuarios (username, email, password_hash, segmento_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id, username, email, segmento_id, avatar, created_at`,
          [username, email, passwordHash, segmentoId],
        );
        return reply.code(201).send({ ...rows[0], segmento: 'invitado' });
      } catch (err: any) {
        if (err.code === '23505' && err.detail?.includes('username')) continue;
        throw err;
      }
    }
    return reply.code(500).send({ error: 'No se pudo generar un username único' });
  });
}

// ── Limpieza: invitados abandonados ─────────────────
// El logout normal ya borra la cuenta invitado al momento (ver POST
// /auth/logout en el gateway) — esto es la red de seguridad para la
// pestaña cerrada sin pasar por ahí (recarga, crash, cerrar el
// navegador), que es el caso más común en la práctica. El token de
// invitado vive en sessionStorage (no localStorage — ver LoginScreen.tsx
// handleGuestClick), así que del lado del cliente esa sesión ya está
// muerta apenas se cierra la pestaña; acá solo falta que el servidor se
// entere. 24h en vez de calcarle los 5 minutos a limpiarSalasIncompletas
// porque una cuenta sí puede seguir "viva" (misma pestaña, mismo token)
// por horas de juego real — no hay forma de distinguir eso de un
// abandono sin agregar una columna de "última actividad".
export async function limpiarInvitadosAbandonados(): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM usuarios u
     USING segmentos s
     WHERE u.segmento_id = s.id
       AND s.nombre = 'invitado'
       AND u.created_at < NOW() - INTERVAL '24 hours'`,
  );
  return rowCount ?? 0;
}

import { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { callMs } from '../http';
import { signToken, verifyToken } from '../jwt';

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// 'postmessage' es el redirect_uri especial que espera Google para el flujo
// de popup de un code client de JS (no hay redirect real de por medio).
const googleClient = (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
  ? new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 'postmessage')
  : null;

// ── Schemas reutilizables ─────────────────────────
const UserSchema = {
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    username:   { type: 'string', example: 'jugador42' },
    email:      { type: 'string', format: 'email' },
    avatar:     { type: 'string', nullable: true },
    segmento:   { type: 'string', example: 'jugador' },
    created_at: { type: 'string', format: 'date-time' },
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

const TokenUserSchema = {
  type: 'object',
  properties: {
    token: { type: 'string', description: 'JWT válido por 7 días' },
    user:  UserSchema,
  },
} as const;

// ─────────────────────────────────────────────────
export async function authRoutes(app: FastifyInstance) {

  // ── POST /auth/register ─────────────────────────
  app.post<{ Body: { username: string; email: string; password: string } }>(
    '/auth/register',
    {
      // Endpoint sensible a fuerza bruta / abuso de creación de cuentas.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags:        ['auth'],
        summary:     'Registrar nuevo usuario',
        description: 'Crea una cuenta nueva y devuelve un JWT listo para usar.',
        body: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 20, example: 'jugador42' },
            email:    { type: 'string', format: 'email', example: 'jugador@correo.com' },
            password: { type: 'string', minLength: 8, example: 'MiPass123!' },
          },
        },
        response: {
          201: { description: 'Usuario creado',           ...TokenUserSchema },
          409: { description: 'Usuario o email ya existe', ...ErrorSchema },
          400: { description: 'Datos inválidos',           ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { status, data } = await callMs('/usuarios', 'POST', req.body);
      if (status !== 201) return reply.code(status).send(data);

      const user = data as { id: string; username: string; segmento: string };
      const token = signToken(user);
      return reply.code(201).send({ token, user });
    },
  );

  // ── POST /auth/login ────────────────────────────
  app.post<{ Body: { email: string; password: string } }>(
    '/auth/login',
    {
      // Endpoint sensible a fuerza bruta de contraseñas.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags:        ['auth'],
        summary:     'Iniciar sesión',
        description: 'Verifica credenciales y devuelve un JWT.',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'jugador@correo.com' },
            password: { type: 'string', example: 'MiPass123!' },
          },
        },
        response: {
          200: { description: 'Login exitoso',        ...TokenUserSchema },
          401: { description: 'Credenciales inválidas', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { status, data } = await callMs('/usuarios/verificar', 'POST', req.body);
      if (status !== 200) return reply.code(status).send(data);

      const user = data as { id: string; username: string; segmento: string };
      const token = signToken(user);
      return reply.send({ token, user });
    },
  );

  // ── POST /auth/forgot-password ──────────────────
  app.post<{ Body: { email: string } }>(
    '/auth/forgot-password',
    {
      // Evita usar este endpoint para enumerar emails registrados a fuerza bruta.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags:        ['auth'],
        summary:     'Solicitar recuperación de contraseña',
        description: 'Genera un token de reset. En producción se envía por email; en dev el token aparece en la respuesta (`_dev_token`).',
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email', example: 'jugador@correo.com' },
          },
        },
        response: {
          200: {
            description: 'Solicitud procesada (la respuesta es la misma aunque el email no exista)',
            type: 'object',
            properties: {
              message:    { type: 'string' },
              _dev_token: { type: 'string', description: 'Solo en entorno dev' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { data } = await callMs('/usuarios/reset-token', 'POST', req.body);
      return reply.send(data);
    },
  );

  // ── POST /auth/reset-password ───────────────────
  app.post<{ Body: { token: string; newPassword: string } }>(
    '/auth/reset-password',
    {
      // Evita fuerza bruta sobre el token de reset.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags:        ['auth'],
        summary:     'Restablecer contraseña',
        description: 'Usa el token recibido por email para establecer una nueva contraseña.',
        body: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token:       { type: 'string', example: 'abc123...' },
            newPassword: { type: 'string', minLength: 8, example: 'NuevoPass456!' },
          },
        },
        response: {
          200: { description: 'Contraseña actualizada', ...MessageSchema },
          400: { description: 'Token inválido o expirado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { status, data } = await callMs('/usuarios/reset-password', 'POST', req.body);
      return reply.code(status).send(data);
    },
  );

  // ── POST /auth/google ───────────────────────────
  app.post<{ Body: { code: string } }>(
    '/auth/google',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags:        ['auth'],
        summary:     'Iniciar sesión con Google',
        description: 'Cambia el authorization code (popup propio, no el widget de Google) por tokens, verifica el ID token y devuelve un JWT propio (crea la cuenta si es la primera vez).',
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', description: 'Authorization code devuelto por google.accounts.oauth2 (ux_mode: popup)' },
          },
        },
        response: {
          200: { description: 'Login exitoso',   ...TokenUserSchema },
          201: { description: 'Cuenta creada y login exitoso', ...TokenUserSchema },
          401: { description: 'Código o token de Google inválido', ...ErrorSchema },
          503: { description: 'Login con Google no configurado', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      if (!googleClient || !GOOGLE_CLIENT_ID) {
        return reply.code(503).send({ error: 'Login con Google no está configurado' });
      }

      let idToken: string | null | undefined;
      try {
        const { tokens } = await googleClient.getToken(req.body.code);
        idToken = tokens.id_token;
      } catch {
        return reply.code(401).send({ error: 'Código de Google inválido' });
      }
      if (!idToken) return reply.code(401).send({ error: 'Código de Google inválido' });

      let payload;
      try {
        const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
        payload = ticket.getPayload();
      } catch {
        return reply.code(401).send({ error: 'Token de Google inválido' });
      }
      if (!payload?.email || !payload.email_verified) {
        return reply.code(401).send({ error: 'Token de Google inválido' });
      }

      const { status, data } = await callMs('/usuarios/oauth-google', 'POST', {
        email: payload.email,
        nombreSugerido: payload.name ?? payload.email.split('@')[0],
      });
      if (status !== 200 && status !== 201) return reply.code(status).send(data);

      const user = data as { id: string; username: string; segmento: string };
      const token = signToken(user);
      return reply.code(status).send({ token, user });
    },
  );

  // ── GET /auth/me ────────────────────────────────
  app.get(
    '/auth/me',
    {
      schema: {
        tags:        ['auth'],
        summary:     'Perfil del usuario autenticado',
        description: 'Devuelve los datos del usuario asociado al JWT del header `Authorization`.',
        security:    [{ bearerAuth: [] }],
        response: {
          200: { description: 'Datos del usuario', ...UserSchema },
          401: { description: 'Token ausente o inválido', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const payload = verifyToken(req.headers.authorization);
      if (!payload) return reply.code(401).send({ error: 'Token inválido o expirado' });
      const { status, data } = await callMs(`/usuarios/${payload.sub}`, 'GET');
      return reply.code(status).send(data);
    },
  );

  // ── PATCH /auth/avatar ──────────────────────────
  app.patch<{ Body: { avatar: string } }>(
    '/auth/avatar',
    {
      schema: {
        tags:        ['auth'],
        summary:     'Elegir avatar de la carpeta de fotos de perfil',
        security:    [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['avatar'],
          properties: {
            avatar: { type: 'string', minLength: 1, maxLength: 100, example: 'avatar-01.png' },
          },
        },
        response: {
          200: { description: 'Avatar actualizado',       ...UserSchema },
          401: { description: 'Token ausente o inválido', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const payload = verifyToken(req.headers.authorization);
      if (!payload) return reply.code(401).send({ error: 'Token inválido o expirado' });
      const { status, data } = await callMs(`/usuarios/${payload.sub}/avatar`, 'PATCH', req.body);
      return reply.code(status).send(data);
    },
  );
}

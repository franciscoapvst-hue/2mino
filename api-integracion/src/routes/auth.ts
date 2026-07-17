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

  // El cliente del frontend (src/api.ts, req()) manda siempre
  // `Content-Type: application/json`, incluso en rutas sin body como
  // /auth/invitado — el parser JSON por defecto de Fastify rechaza esa
  // combinación (Content-Type presente + cuerpo vacío) con
  // FST_ERR_CTP_EMPTY_JSON_BODY. Acá se trata un body vacío como `{}` en
  // vez de error; scoped a este plugin (encapsulamiento de Fastify), no
  // afecta otras rutas del gateway. Las rutas que sí requieren campos
  // (register, login, etc.) siguen rechazando `{}` igual, solo que ahora
  // vía el schema (400 "required property"), no el content-type parser.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    const raw = body as string;
    if (raw.trim() === '') { done(null, {}); return; }
    try {
      done(null, JSON.parse(raw));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // ── POST /auth/register ─────────────────────────
  app.post<{ Body: { username: string; email: string; password: string } }>(
    '/auth/register',
    {
      // Endpoint sensible a fuerza bruta / abuso de creación de cuentas.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags:        ['auth'],
        summary:     'Registrar nuevo usuario',
        description: 'Crea una cuenta nueva. NO devuelve token — hay que confirmar el email antes de poder loguear.',
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
          201: { description: 'Cuenta creada, pendiente de confirmar por email', ...MessageSchema },
          409: { description: 'Usuario o email ya existe', ...ErrorSchema },
          400: { description: 'Datos inválidos',           ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { status, data } = await callMs('/usuarios', 'POST', req.body);
      return reply.code(status).send(data);
    },
  );

  // ── POST /auth/verificar-email ──────────────────
  // Confirma la cuenta con el token del link del email. Si es válido,
  // firma sesión directo — clickear el link ya deja logueado, sin tener
  // que volver a escribir la contraseña.
  app.post<{ Body: { token: string } }>(
    '/auth/verificar-email',
    {
      schema: {
        tags:        ['auth'],
        summary:     'Confirmar cuenta con el token del email',
        body: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string' } },
        },
        response: {
          200: { description: 'Cuenta confirmada, sesión iniciada', ...TokenUserSchema },
          400: { description: 'Link inválido o vencido', ...ErrorSchema },
        },
      },
    },
    async (req, reply) => {
      const { status, data } = await callMs('/usuarios/verificar-email', 'POST', req.body);
      if (status !== 200) return reply.code(status).send(data);

      const user = data as { id: string; username: string; segmento: string };
      const token = signToken(user);
      return reply.send({ token, user });
    },
  );

  // ── POST /auth/reenviar-verificacion ────────────
  app.post<{ Body: { email: string } }>(
    '/auth/reenviar-verificacion',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags:        ['auth'],
        summary:     'Reenviar el email de confirmación de cuenta',
        body: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        },
        response: { 200: { description: 'Solicitud procesada', ...MessageSchema } },
      },
    },
    async (req, reply) => {
      const { data } = await callMs('/usuarios/reenviar-verificacion', 'POST', req.body);
      return reply.send(data);
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
          403: {
            description: 'Cuenta sin confirmar (email_verificado=false)',
            type: 'object',
            properties: { error: { type: 'string' }, code: { type: 'string' } },
          },
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

  // ── POST /auth/invitado ─────────────────────────
  app.post('/auth/invitado', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, // mismo grupo que register/login/google — evita spam de cuentas gratis
    schema: {
      tags:        ['auth'],
      summary:     'Sesión de invitado, sin registro',
      description: 'Crea una cuenta efímera y devuelve un JWT — no accede a ranked ni (cuando exista) a torneos.',
      response: {
        201: { description: 'Sesión creada', ...TokenUserSchema },
      },
    },
  }, async (req, reply) => {
    const { status, data } = await callMs('/usuarios/invitado', 'POST');
    if (status !== 201) return reply.code(status).send(data);
    const user = data as { id: string; username: string; segmento: string };
    const token = signToken(user);
    return reply.code(201).send({ token, user });
  });

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

  // ── POST /auth/logout ───────────────────────────
  // Las cuentas invitado son efímeras a propósito — dejarlas en la base
  // para siempre después de que el jugador se va es basura acumulándose
  // sin límite (y cada una encima le costó un bcrypt.hash al crearse). Acá
  // se borran de verdad al cerrar sesión; el barrido periódico en
  // ms-usuarios (limpiarInvitadosAbandonados) cubre el caso de la pestaña
  // cerrada sin pasar por acá. Para una cuenta real, esto es un logout
  // normal — no se toca la fila.
  app.post(
    '/auth/logout',
    {
      schema: {
        tags:        ['auth'],
        summary:     'Cerrar sesión',
        description: 'Si el token es de una cuenta invitado, la borra de la base — son efímeras a propósito.',
        security:    [{ bearerAuth: [] }],
        response: { 200: { ...MessageSchema } },
      },
    },
    async (req, reply) => {
      const payload = verifyToken(req.headers.authorization);
      if (payload?.segmento === 'invitado') {
        // Best-effort: el logout del cliente no debe fallar por esto.
        await callMs(`/usuarios/${payload.sub}`, 'DELETE').catch(() => {});
      }
      return reply.send({ message: 'Sesión cerrada' });
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

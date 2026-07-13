import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { authRoutes } from './routes/auth';
import { frontendRoutes } from './routes/frontend';
import { salasGatewayRoutes } from './routes/salas';
import { rankedGatewayRoutes } from './routes/ranked';
import { socialGatewayRoutes } from './routes/social';
import { adminRoutes } from './routes/admin';

const app = Fastify({
  logger: true,
  ajv: { customOptions: { strict: false } },
});

// ── CORS ─────────────────────────────────────────
// CORS_ORIGIN acepta una lista separada por comas — en producción hace
// falta más de un origen permitido: el frontend público (2mino.online)
// Y el Back Office local, que llega al mismo api-integracion por túnel
// SSH (ver docs/CASOS_DE_USO_BACKOFFICE.md §10.1) con origin
// http://localhost:5174. Sin esto, el navegador bloquea las respuestas
// de /admin/* aunque el request llegue bien (se ve como "se queda
// cargando" en el panel, no como un error de red obvio).
const corsOrigin = process.env.CORS_ORIGIN ?? '*';
app.register(cors, {
  origin:  corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim()),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// ── Rate limit ───────────────────────────────────
// Red de seguridad global por IP: 300 req/min alcanza sobrado para uso
// normal (el polling más agresivo del frontend es GET /juego cada 2s,
// ~30 req/min) pero frena a un cliente/bot que martille cualquier ruta.
// /auth/* tiene además un límite más estricto propio (ver routes/auth.ts).
app.register(rateLimit, {
  max:        300,
  timeWindow: '1 minute',
});

// ── OpenAPI / Swagger ─────────────────────────────
app.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title:       '2mino — API de Integración',
      description: 'Punto de entrada público. Autentica usuarios y orquesta los microservicios internos.',
      version:     '1.0.0',
    },
    servers: [
      { url: 'http://localhost:3000',   description: 'Local' },
      { url: 'https://api.2mino.com',   description: 'Producción (VPS IONOS)' },
    ],
    tags: [
      { name: 'auth',     description: 'Registro, login y recuperación de contraseña' },
      { name: 'frontend', description: 'Configuración del landing y preferencias de usuario' },
      { name: 'salas',    description: 'Salas de juego: crear, listar, unirse y salir' },
      { name: 'juego',    description: 'Estado y movimientos de la partida' },
      { name: 'ranked',   description: 'ELO, leaderboard y matchmaking' },
      { name: 'social',   description: 'Amigos, bandeja de entrada, chat de partida' },
      { name: 'admin',    description: 'Back Office — requiere JWT con segmento admin' },
      { name: 'system',   description: 'Estado del servicio' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'JWT obtenido en /auth/login o /auth/register',
        },
      },
    },
  },
});

app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking:  true,
  },
  staticCSP: true,
});

// ── Rutas ─────────────────────────────────────────
app.register(authRoutes);
app.register(frontendRoutes);
app.register(salasGatewayRoutes);
app.register(rankedGatewayRoutes);
app.register(socialGatewayRoutes);
app.register(adminRoutes);

app.get('/health', {
  schema: {
    tags:    ['system'],
    summary: 'Health check',
    response: {
      200: {
        type: 'object',
        properties: {
          service: { type: 'string' },
          status:  { type: 'string' },
        },
      },
    },
  },
}, async () => ({ service: 'api-integracion', status: 'ok' }));

// ── Arranque ──────────────────────────────────────
async function start() {
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Swagger UI → http://localhost:${port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
